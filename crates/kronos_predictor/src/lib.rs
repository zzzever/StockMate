use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;

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

/// Real-time progress pushed from the Python subprocess to the frontend
/// via a Tauri Channel (`{"stage": ..., "pct": ...}` on stderr).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KronosProgress {
    pub stage: String,
    pub pct: u32,
}

// ============================================================================
// 常驻 Python worker
//
// 单个 Python 子进程持有模型常驻内存：首次调用 spawn，之后复用；
// 进程崩溃后下次调用自动重启；全局 Mutex 保证同一时刻只有一个请求，
// 避免快速连点启动多个 torch 进程（各占 1.5-3GB 内存）。
// ============================================================================

const FRESH_SPAWN_TIMEOUT_SECS: u64 = 600; // 首次启动含模型加载/下载，放宽到 10 分钟
const WARM_TIMEOUT_SECS: u64 = 120; // 模型已加载，正常应秒级；120s 足够且防卡死
const PYTHON_CMD: &str = "python";

struct KronosWorker {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout: Option<BufReader<ChildStdout>>,
    stderr: Option<BufReader<ChildStderr>>,
    runner_script: String,
    kronos_home: String,
}

fn worker() -> &'static Mutex<KronosWorker> {
    static WORKER: OnceLock<Mutex<KronosWorker>> = OnceLock::new();
    WORKER.get_or_init(|| {
        Mutex::new(KronosWorker {
            child: None,
            stdin: None,
            stdout: None,
            stderr: None,
            runner_script: String::new(),
            kronos_home: String::new(),
        })
    })
}

/// spawn 一个新的 Python worker 进程，接管其 stdin/stdout/stderr。
async fn spawn_worker(guard: &mut KronosWorker) -> Result<(), String> {
    let mut child = Command::new(PYTHON_CMD)
        .arg(&guard.runner_script)
        .env("KRONOS_HOME", &guard.kronos_home)
        .current_dir(&guard.kronos_home)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                format!(
                    "找不到 Python。请安装 Python {} 并安装依赖:\n\
                     pip install torch pandas numpy transformers huggingface-hub\n\
                     然后下载模型: https://huggingface.co/NeoQuasar/Kronos-small",
                    MIN_PYTHON_VERSION
                )
            } else {
                format!("Python执行失败: {}", e)
            }
        })?;

    guard.stdin = child.stdin.take();
    guard.stdout = child.stdout.take().map(BufReader::new);
    guard.stderr = child.stderr.take().map(BufReader::new);
    guard.child = Some(child);
    Ok(())
}

/// 丢弃 worker 持有的进程与管道，并强杀残留子进程。
async fn reset_worker(guard: &mut KronosWorker) {
    let child = guard.child.take();
    guard.stdin.take();
    guard.stdout = None;
    guard.stderr = None;
    if let Some(mut c) = child {
        let _ = c.kill().await;
        let _ = c.wait().await;
    }
}

/// 进程已退出时读取其 stderr 残留内容用于诊断（进程已死，read 不会阻塞）。
async fn read_stderr(guard: &mut KronosWorker) -> String {
    if let Some(mut err) = guard.stderr.take() {
        let mut buf = Vec::new();
        if err.read_to_end(&mut buf).await.is_ok() {
            return String::from_utf8_lossy(&buf).to_string();
        }
    }
    String::new()
}

/// 确保 worker 进程存活。返回 true 表示本次调用刚完成 spawn（含模型加载）。
async fn ensure_alive(guard: &mut KronosWorker) -> Result<bool, String> {
    if let Some(child) = guard.child.as_mut() {
        match child.try_wait() {
            Ok(None) => return Ok(false), // 进程存活，直接复用
            _ => {
                // 已退出或无法检查：清理，下面重新 spawn（崩溃自动重启）
                guard.child = None;
                guard.stdin = None;
                guard.stdout = None;
                guard.stderr = None;
            }
        }
    }
    spawn_worker(guard).await?;
    Ok(true)
}

/// Run the Kronos Python model via a resident subprocess.
/// Input: OHLCV data as CSV, Output: JSON forecast.
///
/// `progress` (optional) receives real-time `KronosProgress` events parsed
/// from the Python process's stderr JSON lines.
pub async fn run_kronos_predict(
    opens: &[f64],
    highs: &[f64],
    lows: &[f64],
    closes: &[f64],
    volumes: &[u64],
    dates: &[String],
    horizon: usize,
    model_name: &str,
    progress: tauri::ipc::Channel<serde_json::Value>,
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
    let input_json = serde_json::to_string(&input_data)
        .map_err(|e| format!("JSON序列化失败: {}", e))?;

    // 全局并发锁：同一时刻只有一个请求进出 worker 进程
    let result_json: serde_json::Value = {
        let mut guard = worker().lock().await;

        // 首次调用时解析脚本/仓库路径
        if guard.runner_script.is_empty() {
            guard.runner_script = find_runner_script()?;
            guard.kronos_home = find_kronos_home();
        }

        // 进程不存在或已崩溃：spawn（并触发 Python 侧一次性模型加载）
        let is_fresh = ensure_alive(&mut guard).await?;

        // 进度节点：模型加载 / 推理中 / 完成
        let _ = progress.send(serde_json::json!({
            "stage": if is_fresh { "初始化 Kronos 模型（首次需加载权重）" } else { "模型已就绪" },
            "pct": if is_fresh { 40 } else { 60 },
        }));

        // 写一行请求到 stdin
        {
            let stdin = guard.stdin.as_mut().ok_or("Kronos 进程未初始化")?;
            let req_line = format!("{}\n", input_json);
            stdin
                .write_all(req_line.as_bytes())
                .await
                .map_err(|e| format!("写入 Kronos 请求失败: {}", e))?;
            stdin
                .flush()
                .await
                .map_err(|e| format!("刷新 Kronos 输入失败: {}", e))?;
        }

        let _ = progress.send(serde_json::json!({
            "stage": "推理预测中（PyTorch 计算）",
            "pct": 80,
        }));

        // 读一行响应（带超时；超时则重置进程，下次调用自动重启）。
        let (line, timed_out) = {
            let stdout = guard.stdout.as_mut().ok_or("Kronos 进程 stdout 未初始化")?;
            let mut line = String::new();
            let timeout_secs = if is_fresh { FRESH_SPAWN_TIMEOUT_SECS } else { WARM_TIMEOUT_SECS };
            match tokio::time::timeout(
                std::time::Duration::from_secs(timeout_secs),
                stdout.read_line(&mut line),
            ).await {
                Ok(Ok(_)) => (line, false),
                Ok(Err(e)) => return Err(format!("读取 Kronos 输出失败: {}", e)),
                Err(_) => (line, true),
            }
        };

        if timed_out {
            reset_worker(&mut guard).await;
            return Err("Kronos 预测超时。进程已重置，请重试。".into());
        }
        if line.trim().is_empty() {
            // stdout EOF：worker 进程意外退出
            let stderr_text = read_stderr(&mut guard).await;
            reset_worker(&mut guard).await;
            return Err(format!("Kronos 进程意外退出:\n{}", stderr_text));
        }

        serde_json::from_str::<serde_json::Value>(&line)
            .map_err(|e| format!("解析预测结果失败: {}。stdout: {}", e, line))?
    };

    // worker 返回结构化错误
    if let Some(msg) = result_json.get("error").and_then(|x| x.as_str()) {
        return Err(format!("Kronos 预测失败: {}", msg));
    }

    // Build response
    let pred_values: Vec<f64> = result_json["forecast"]
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
