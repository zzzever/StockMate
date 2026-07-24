use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;

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
pub fn run_kronos_predict(
    prices: &[f64],
    volumes: &[u64],
    dates: &[String],
    horizon: usize,
    model_name: &str,
) -> Result<KronosForecast, String> {
    // Build input JSON for the Python script
    let input_data = serde_json::json!({
        "lookback": prices.len(),
        "pred_len": horizon,
        "model": model_name,
        "data": {
            "open": prices,
            "high": prices.iter().map(|p| p * 1.01).collect::<Vec<_>>(),
            "low": prices.iter().map(|p| p * 0.99).collect::<Vec<_>>(),
            "close": prices,
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

    let output = Command::new(python_cmd)
        .arg(&runner_script)
        .arg(&input_json)
        .env("KRONOS_HOME", &kronos_home)
        .current_dir(&kronos_home)
        .output()
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

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout_text = String::from_utf8_lossy(&output.stdout).to_string();
        return Err(format!("Kronos预测失败:\nSTDERR: {}\nSTDOUT: {}", stderr, stdout_text));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("解析预测结果失败: {}", e))?;

    // Build response
    let pred_values: Vec<f64> = result["forecast"]
        .as_array()
        .map(|arr| arr.iter().map(|v| v.as_f64().unwrap_or(0.0)).collect())
        .unwrap_or_default();

    let history_points: Vec<ForecastPoint> = prices.iter().enumerate().map(|(i, &p)| {
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

    let last_price = prices.last().copied().unwrap_or(0.0);
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
