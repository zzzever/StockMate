#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
akshare_server.py - StockMate v0.2.0 Python Sidecar HTTP Server
Provides RESTful HTTP endpoints for A-share market data via akshare.
"""

import sys
import json
import time
import threading
from datetime import datetime, timedelta
from functools import wraps

try:
    from flask import Flask, request, jsonify
    import akshare as ak
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}. pip install flask akshare"}), file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)

# ============================================================
# Cache layer
# ============================================================
_cache = {}
_cache_lock = threading.Lock()

TTL_SPOT = 60       # 1 minute
TTL_SECTOR = 300    # 5 minutes
TTL_FINANCE = 3600  # 1 hour
TTL_HISTORY = 86400 # 1 day
TTL_OVERVIEW = 60   # 1 minute


def _cache_key(endpoint, **params):
    """Generate a cache key from endpoint and sorted params."""
    parts = [endpoint] + [f"{k}={v}" for k, v in sorted(params.items())]
    return "|".join(parts)


def _get_cached(key, ttl):
    """Get cached value if not expired."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        ts, value = entry
        if time.time() - ts > ttl:
            del _cache[key]
            return None
        return value


def _set_cached(key, value):
    """Set cache entry."""
    with _cache_lock:
        _cache[key] = (time.time(), value)


def cached(ttl):
    """Decorator to cache Flask endpoint results."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # For simplicity, cache only on exact endpoint + query string
            key = _cache_key(request.path, **request.args.to_dict())
            cached_val = _get_cached(key, ttl)
            if cached_val is not None:
                return jsonify(cached_val)
            result = f(*args, **kwargs)
            # result may be a Response object; only cache dicts
            if isinstance(result, dict):
                _set_cached(key, result)
                return jsonify(result)
            return result
        return wrapper
    return decorator


# ============================================================
# Unified response helpers
# ============================================================
def success(data):
    return {"success": True, "data": data, "error": None}


def error(message, code=500):
    return {"success": False, "data": None, "error": message}


# ============================================================
# Endpoints
# ============================================================
@app.route("/health", methods=["GET"])
def health():
    return jsonify(success({"status": "ok", "timestamp": datetime.now().isoformat()}))


@app.route("/sectors", methods=["GET"])
@cached(TTL_SECTOR)
def sectors():
    """Return ALL industry + concept board indices with standardized fields.

    Fields: name, change_percent, volume, code
    Covers both industry boards (行业板块) and concept boards (概念板块).
    """
    try:
        boards = []
        seen = set()

        # Fetch industry boards (行业板块)
        try:
            df_ind = ak.stock_board_industry_name_em()
            if df_ind is not None and not df_ind.empty:
                for _, row in df_ind.iterrows():
                    name = str(row.get("板块名称", row.get("名称", "")))
                    if name and name not in seen:
                        seen.add(name)
                        boards.append({
                            "name": name,
                            "change_percent": float(row.get("涨跌幅", 0) or 0),
                            "volume": int(row.get("成交量", 0) or 0),
                            "code": str(row.get("板块代码", row.get("代码", ""))),
                        })
        except Exception as e:
            print(f"[sectors] industry boards fetch failed: {e}", flush=True)

        # Fetch concept boards (概念板块)
        try:
            df_con = ak.stock_board_concept_name_em()
            if df_con is not None and not df_con.empty:
                for _, row in df_con.iterrows():
                    name = str(row.get("板块名称", row.get("名称", "")))
                    if name and name not in seen:
                        seen.add(name)
                        boards.append({
                            "name": name,
                            "change_percent": float(row.get("涨跌幅", 0) or 0),
                            "volume": int(row.get("成交量", 0) or 0),
                            "code": str(row.get("板块代码", row.get("代码", ""))),
                        })
        except Exception as e:
            print(f"[sectors] concept boards fetch failed: {e}", flush=True)

        print(f"[sectors] {len(boards)} total boards returned", flush=True)
        return jsonify(success(boards))
    except Exception as e:
        return jsonify(error(str(e))), 500


@app.route("/hot_stocks", methods=["GET"])
@cached(TTL_SPOT)
def hot_stocks():
    try:
        df = ak.stock_zh_a_spot_em()
        if df.empty:
            return jsonify(success([]))
        cols = ["代码", "名称", "最新价", "涨跌幅", "涨跌额", "成交量", "成交额", "所属行业"]
        df = df[cols].head(100)
        records = df.to_dict(orient="records")
        return jsonify(success(records))
    except Exception as e:
        return jsonify(error(str(e))), 500


@app.route("/history", methods=["GET"])
@cached(TTL_HISTORY)
def history():
    symbol = request.args.get("symbol", "")
    days = request.args.get("days", "60")
    if not symbol:
        return jsonify(error("symbol is required")), 400
    try:
        days_int = int(days)
    except ValueError:
        return jsonify(error("days must be an integer")), 400
    try:
        df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date="", end_date="", adjust="qfq")
        if df is None or df.empty:
            return jsonify(success([]))
        df = df.tail(days_int)
        records = df.to_dict(orient="records")
        return jsonify(success(records))
    except Exception as e:
        return jsonify(error(str(e))), 500


@app.route("/finance", methods=["GET"])
@cached(TTL_FINANCE)
def finance():
    symbol = request.args.get("symbol", "")
    if not symbol:
        return jsonify(error("symbol is required")), 400
    try:
        df = ak.stock_financial_report_sina(stock=symbol, symbol="利润表")
        if df is None or df.empty:
            return jsonify(success(None))
        latest = df.iloc[0].to_dict()
        return jsonify(success(latest))
    except Exception as e:
        return jsonify(error(str(e))), 500


@app.route("/fund_flow", methods=["GET"])
@cached(TTL_SPOT)
def fund_flow():
    symbol = request.args.get("symbol", "")
    if not symbol:
        return jsonify(error("symbol is required")), 400
    try:
        df = ak.stock_individual_fund_flow(stock=symbol, market="sh")
        if df is None or df.empty:
            return jsonify(success([]))
        records = df.head(5).to_dict(orient="records")
        return jsonify(success(records))
    except Exception as e:
        return jsonify(error(str(e))), 500


@app.route("/intraday", methods=["GET"])
@cached(TTL_SPOT)
def intraday():
    """Return 5-min K-line data for today's intraday chart.

    Fallback chain:
      1. 5-min K-line (48 bars = 4 hours)
      2. 1-min K-line (240 bars = 4 hours)
      3. Empty success response (caller will use its own fallbacks)
    """
    symbol = request.args.get("symbol", "")
    if not symbol:
        return jsonify(error("symbol is required")), 400
    # Try today → yesterday → 2 days ago for the most recent trading day
    from datetime import timedelta
    for days_back in range(5):
        try_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
        for period, bars in [("5", 48), ("1", 240)]:
            try:
                df = ak.stock_zh_a_hist_min_em(symbol=symbol, period=period, adjust="qfq")
                if df is not None and not df.empty:
                    # Filter to the target date
                    if "时间" in df.columns:
                        df_date = df[df["时间"].astype(str).str.startswith(f"{try_date[:4]}-{try_date[4:6]}-{try_date[6:]}")]
                        if not df_date.empty:
                            df_date = df_date.tail(bars)
                            records = df_date.to_dict(orient="records")
                            print(f"[intraday] {symbol}: {len(records)} bars from {try_date} ({period}-min)", flush=True)
                            return jsonify(success(records))
                    # Fallback: use tail if date filtering fails
                    df = df.tail(bars)
                    records = df.to_dict(orient="records")
                    print(f"[intraday] {symbol}: {len(records)} bars from recent data ({period}-min)", flush=True)
                    return jsonify(success(records))
            except Exception as e:
                print(f"[intraday] {symbol}: {period}-min query error: {e}", flush=True)
                continue
    return jsonify(success([]))


@app.route("/overview", methods=["GET"])
@cached(TTL_OVERVIEW)
def overview():
    try:
        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            return jsonify(success({
                "up": 0, "down": 0, "flat": 0,
                "turnover": 0, "northbound_inflow": None
            }))
        up = int((df["涨跌幅"] > 0).sum())
        down = int((df["涨跌幅"] < 0).sum())
        flat = int((df["涨跌幅"] == 0).sum())
        turnover = df["成交额"].sum() if "成交额" in df.columns else 0
        # Northbound inflow not directly available in akshare spot; placeholder
        northbound = None
        return jsonify(success({
            "up": up,
            "down": down,
            "flat": flat,
            "turnover": str(turnover),
            "northbound_inflow": northbound,
        }))
    except Exception as e:
        return jsonify(error(str(e))), 500


# ============================================================
# Entry point
# ============================================================
def main():
    import argparse
    parser = argparse.ArgumentParser(description="StockMate akshare HTTP sidecar")
    parser.add_argument("--port", type=int, default=0, help="Port to listen on (0 = auto)")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    args = parser.parse_args()

    # Run on specified or random port; print chosen port to stdout
    from werkzeug.serving import make_server
    server = make_server(args.host, args.port, app)
    actual_port = server.server_address[1]
    print(f"STOCKMATE_SIDECAR_PORT={actual_port}", flush=True)
    sys.stdout.flush()
    server.serve_forever()


if __name__ == "__main__":
    main()
