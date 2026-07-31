use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MIN_PYTHON_VERSION: &str = "3.10";

/// A single forecast point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForecastPoint {
    pub date: String,
    pub value: f64,
    pub lower: Option<f64>,
    pub upper: Option<f64>,
}

/// Main forecast result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KronosForecast {
    pub history: Vec<ForecastPoint>,
    pub forecast: Vec<ForecastPoint>,
    pub features: HashMap<String, f64>,
    pub confidence: f64,
    pub signal: String,
    pub expected_return: f64,
}

/// Run the Kronos Python model via subprocess.
/// Input: OHLCV data as CSV, Output: JSON forecast.
pub async fn run_kronos_predict(
    opens: &[f64],
    highs: &[f64],
    lows: &[f64],
    closes: &[f64],
    volumes: &[u64],
    dates: &[String],
    horizon: usize,
    model_name: &str,
) -> Result<KronosForecast, String> {
    // Build input JSON for the Python script — real OHLCV (no fake data)
    let input_data = serde_json::json!({
        "lookback": closes.len(),
        "pred_len": horizon,
        "model": model_name,
        "data": {
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": volumes,
        },
        "timestamps": dates,
    });

    // Try to find kronos_runner.py in the project
    let runner_script = find_runner_script()?;
    let kronos_home = find_kronos_home();
    let input_json = serde_json::to_string(&input_data)
        .map_err(|e| format!("JSON序列化失败: {}", e))?;

    // Use python (Python 3.14 with working torch) — python3 may have broken deps
    let python_cmd = "python";

    let mut child = tokio::process::Command::new(python_cmd)
        .arg(&runner_script)
        .arg(&input_json)
        .env("KRONOS_HOME", &kronos_home)
        .current_dir(&kronos_home)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                format!(
                    "找不到 Python。请安装 Python {} 并安装依赖:\n\
                     pip install torch pandas numpy transformers\n\
                     然后下载模型: https://huggingface.co/NeoQuasar/Kronos-small",
                    MIN_PYTHON_VERSION
                )
            } else {
                format!("Python执行失败: {}", e)
            }
        })?;

    // Timeout: model first-load/download may take up to 10 min
    use tokio::io::AsyncReadExt;
    let (status, stdout_bytes, stderr_bytes) = tokio::select! {
        status = child.wait() => {
            let mut out = Vec::new();
            let mut err = Vec::new();
            if let Some(stdout) = child.stdout.as_mut() { let _ = stdout.read_to_end(&mut out).await; }
            if let Some(stderr) = child.stderr.as_mut() { let _ = stderr.read_to_end(&mut err).await; }
            (status, out, err)
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(600)) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err("Kronos 预测超时(10分钟)。可能是首次下载模型或网络不可达，请重试。".into());
        }
    };

    // On failure, prefer the structured error from the script's stdout
    let exit_ok = match &status {
        Ok(s) => s.success(),
        Err(e) => return Err(format!("Python执行失败: {}", e)),
    };
    if !exit_ok {
        if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&stdout_bytes) {
            if let Some(msg) = v.get("error").and_then(|x| x.as_str()) {
                return Err(format!("Kronos 预测失败: {}", msg));
            }
        }
        let stderr = String::from_utf8_lossy(&stderr_bytes).to_string();
        let stdout_text = String::from_utf8_lossy(&stdout_bytes).to_string();
        return Err(format!("Kronos预测失败:\nSTDERR: {}\nSTDOUT: {}", stderr, stdout_text));
    }

    let stdout = String::from_utf8_lossy(&stdout_bytes).to_string();
    let result: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| {
        let preview: String = stdout.chars().take(800).collect();
        format!("解析预测结果失败: {}。stdout前800字符: {}", e, preview)
    })?;

    // Build response
    let pred_values: Vec<f64> = result["forecast"]
        .as_array()
        .map(|arr| arr.iter().map(|v| v.as_f64().unwrap_or(0.0)).collect())
        .unwrap_or_default();

    let history_points: Vec<ForecastPoint> = closes.iter().enumerate().map(|(i, &p)| {
        ForecastPoint {
            date: dates.get(i).cloned().unwrap_or_default(),
            value: p,
            lower: None,
            upper: None,
        }
    }).collect();

    let forecast_points: Vec<ForecastPoint> = pred_values.iter().enumerate().map(|(i, &v)| {
        ForecastPoint {
            date: format!("f+{}", i + 1),
            value: v,
            lower: Some(v * 0.95),
            upper: Some(v * 1.05),
        }
    }).collect();

    let last_price = closes.last().copied().unwrap_or(0.0);
    let final_fcst = pred_values.last().copied().unwrap_or(last_price);
    let expected_return = if last_price > 0.0 {
        (final_fcst - last_price) / last_price * 100.0
    } else {
        0.0
    };

    let signal = if expected_return > 3.0 { "up" }
    else if expected_return < -3.0 { "down" }
    else { "sideways" };

    let mut features = HashMap::new();
    features.insert("Kronos 模型".to_string(), 0.7);
    features.insert("价格趋势".to_string(), 0.2);
    features.insert("成交量".to_string(), 0.1);

    Ok(KronosForecast {
        history: history_points,
        forecast: forecast_points,
        features,
        confidence: 0.75,
        signal: signal.to_string(),
        expected_return,
    })
}

fn find_kronos_home() -> String {
    // Check KRONOS_HOME env var first
    if let Ok(home) = std::env::var("KRONOS_HOME") {
        if std::path::Path::new(&home).exists() {
            return home;
        }
    }
    // Check relative to project root
    if let Some(root) = find_project_root() {
        let path = root.join("kronos_src");
        if path.exists() {
            return path.to_string_lossy().to_string();
        }
    }
    // Look for kronos_src relative to current dir
    let candidates = vec![
        "kronos_src",
        "../kronos_src",
        "../../kronos_src",
    ];
    if let Ok(cwd) = std::env::current_dir() {
        for candidate in &candidates {
            let full = cwd.join(candidate);
            if full.exists() {
                return full.to_string_lossy().to_string();
            }
        }
    }
    // Check parent directories
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.clone();
        for _ in 0..5 {
            let kronos = dir.join("kronos_src");
            if kronos.exists() {
                return kronos.to_string_lossy().to_string();
            }
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
    }
    std::env::var("KRONOS_HOME").unwrap_or_else(|_| ".".to_string())
}

fn find_project_root() -> Option<std::path::PathBuf> {
    // Check for known parent markers
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.clone();
        loop {
            let marker = dir.join("crates");
            if marker.exists() && marker.is_dir() {
                return Some(dir);
            }
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
    }
    None
}

fn find_runner_script() -> Result<String, String> {
    // Check relative to project root
    if let Some(root) = find_project_root() {
        let path = root.join("scripts").join("kronos_runner.py");
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }
    // Check common locations relative to executable
    let candidates = vec![
        "kronos_runner.py",
        "scripts/kronos_runner.py",
        "../scripts/kronos_runner.py",
        "../../scripts/kronos_runner.py",
    ];

    // Also check KRONOS_HOME env var
    if let Ok(home) = std::env::var("KRONOS_HOME") {
        let path = format!("{}/kronos_runner.py", home);
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
    }

    for candidate in &candidates {
        if std::path::Path::new(candidate).exists() {
            return Ok(candidate.to_string());
        }
        // Try relative to current dir
        if let Ok(cwd) = std::env::current_dir() {
            let full = cwd.join(candidate);
            if full.exists() {
                return Ok(full.to_string_lossy().to_string());
            }
        }
    }

    Err(
        "找不到 kronos_runner.py。请确保 Kronos 环境已正确安装:\n\
         1. git clone https://github.com/shiyu-coder/Kronos\n\
         2. pip install -r requirements.txt\n\
         3. 设置 KRONOS_HOME 环境变量指向 Kronos 目录".to_string()
    )
}
