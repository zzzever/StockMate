#!/usr/bin/env python3
"""
Kronos Python Runner — 常驻 worker 模式。

启动时只加载一次模型（显式缓存到 KRONOS_HOME/models，缓存命中后离线加载），
然后从 stdin 逐行读取 JSON 请求、逐行回写 JSON 结果（stdout.flush() 确保及时）。
模型常驻内存，后续请求秒级响应，避免每次预测重复 import torch / 加载模型。

协议（每行一个 JSON）:
  Rust -> stdin : {"lookback":..,"pred_len":..,"model":..,"data":{...},"timestamps":[...]}
  Rust <- stdout: {"forecast":[...],"model":..} 或 {"error":"..."}

安装:
    pip install torch pandas numpy transformers huggingface-hub
"""
import json
import os
import sys
import traceback

# 国内网络无法访问 huggingface.co 时自动切换到 hf-mirror.com 镜像
# （用户可设置 HF_ENDPOINT 覆盖）
if not os.environ.get("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

import numpy as np
import pandas as pd


def report(stage, pct):
    """向 stderr 打印一行 JSON 进度（Rust 侧逐行解析并推送到前端 Channel）。

    stderr 中非 JSON 行（日志/警告）会被 Rust 侧忽略。
    """
    print(json.dumps({"stage": stage, "pct": pct}), file=sys.stderr, flush=True)


# 模型缓存目录（相对 KRONOS_HOME 固定命名，便于复用与 .gitignore）
CACHE_SUBDIR = "models"

# 默认模型
DEFAULT_MODEL = "NeoQuasar/Kronos-small"
TOKENIZER_ID = "NeoQuasar/Kronos-Tokenizer-base"


def resolve_kronos_home():
    """返回 KRONOS_HOME（Kronos 仓库目录）。"""
    home = os.environ.get("KRONOS_HOME", "")
    if home and os.path.isdir(home):
        return home
    return ""


def setup_sys_path():
    """把 Kronos 仓库与 model 子目录加入 sys.path，返回 kronos_home。"""
    kronos_home = resolve_kronos_home()
    if kronos_home:
        sys.path.insert(0, kronos_home)
        model_dir = os.path.join(kronos_home, "model")
        if os.path.isdir(model_dir):
            sys.path.insert(0, model_dir)
    return kronos_home


def model_cache_dir(kronos_home):
    """固定模型缓存目录：<KRONOS_HOME>/models。"""
    cache = os.path.join(kronos_home, CACHE_SUBDIR)
    os.makedirs(cache, exist_ok=True)
    return cache


def ensure_model_cached(model_id, cache_dir):
    """把模型显式下载到固定缓存目录；已缓存则跳过（local_files_only 离线检查）。
    逐文件下载（config.json + model.safetensors），避免 snapshot_download 在
    LFS/镜像下整体失败。"""
    from huggingface_hub import hf_hub_download

    files = ["config.json", "model.safetensors"]
    missing = []
    for fn in files:
        try:
            hf_hub_download(
                repo_id=model_id,
                filename=fn,
                cache_dir=cache_dir,
                local_files_only=True,
            )
        except Exception:
            missing.append(fn)

    if not missing:
        return True  # 全部已缓存

    # 需要在线下载缺失文件
    for fn in missing:
        hf_hub_download(repo_id=model_id, filename=fn, cache_dir=cache_dir)
    return False


def load_predictor():
    """启动时调用一次：导入模型、下载/复用缓存、加载到内存，返回 (predictor, model_name)。"""
    kronos_home = setup_sys_path()
    if not kronos_home:
        raise RuntimeError(
            "无法定位 KRONOS_HOME 目录。请设置 KRONOS_HOME 环境变量指向 Kronos 仓库目录。"
        )

    report("初始化 Kronos 模型", 40)
    from model import Kronos, KronosPredictor, KronosTokenizer

    model_name = os.environ.get("KRONOS_MODEL", DEFAULT_MODEL)
    cache_dir = model_cache_dir(kronos_home)

    # 显式缓存：下载到固定目录，命中后 local_files_only 离线加载
    ensure_model_cached(TOKENIZER_ID, cache_dir)
    ensure_model_cached(model_name, cache_dir)

    tokenizer = KronosTokenizer.from_pretrained(
        TOKENIZER_ID,
        cache_dir=cache_dir,
        local_files_only=True,
    )
    model = Kronos.from_pretrained(
        model_name,
        cache_dir=cache_dir,
        local_files_only=True,
    )
    # max_context 固定为模型上限（512）；实际序列长度由请求的 lookback 决定
    predictor = KronosPredictor(model, tokenizer, max_context=512)
    return predictor, model_name


def run_forecast(predictor, model_name, input_data):
    """对单个请求执行一次预测（模型已常驻内存，秒级返回）。"""
    lookback = input_data.get("lookback", 120)
    pred_len = input_data.get("pred_len", 10)
    data = input_data.get("data", {})
    timestamps = input_data.get("timestamps", [])

    if not data.get("close"):
        return {"error": "缺少收盘价数据"}

    report("获取历史行情", 10)
    closes = data["close"][:lookback]
    n = len(closes)

    # Build DataFrame
    df_data = {
        "open": data.get("open", closes)[:n],
        "high": data.get("high", closes)[:n],
        "low": data.get("low", closes)[:n],
        "close": closes,
    }
    if data.get("volume"):
        df_data["volume"] = data["volume"][:n]

    df = pd.DataFrame(df_data)
    x_timestamp = (
        pd.Series(pd.to_datetime(timestamps[:n]))
        if timestamps
        else pd.Series(
            pd.date_range(end=pd.Timestamp.today(), periods=n, freq="D")
        )
    )

    # Generate future timestamps
    freq = "D"
    if len(x_timestamp) > 1:
        freq = pd.infer_freq(x_timestamp) or "D"
    y_timestamp = pd.Series(
        pd.date_range(
            start=x_timestamp.iloc[-1] + pd.Timedelta(days=1),
            periods=pred_len,
            freq=freq,
        )
    )

    # Run prediction（模型已加载，仅需一次前向计算）
    report("推理预测中", 80)
    pred_df = predictor.predict(
        df=df,
        x_timestamp=x_timestamp,
        y_timestamp=y_timestamp,
        pred_len=pred_len,
        T=1.0,
        top_p=0.9,
        sample_count=1,
        verbose=False,
    )

    result = {
        "forecast": (
            pred_df["close"].tolist()
            if "close" in pred_df
            else pred_df.iloc[:, 0].tolist()
        ),
        "model": model_name,
    }
    report("完成", 100)
    return result


def main():
    # 启动时加载模型一次；失败则输出错误 JSON 并退出（Rust 侧据此向用户报告）
    try:
        predictor, model_name = load_predictor()
    except Exception:
        msg = traceback.format_exc()
        print(json.dumps({"error": f"Kronos 模型加载失败: {msg}"}), flush=True)
        sys.exit(1)

    # 常驻循环：逐行读请求、逐行回写结果
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            input_data = json.loads(line)
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"JSON 解析失败: {e}"}), flush=True)
            continue
        try:
            result = run_forecast(predictor, model_name, input_data)
        except Exception:
            result = {"error": f"Kronos 预测失败: {traceback.format_exc()}"}
        print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
