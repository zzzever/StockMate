#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
akshare_data.py - StockMate v0.2.0 data bridge
Fetches A-share market data via akshare with CLI output.
"""

import sys
import json
import argparse
from datetime import datetime, timedelta

try:
    import akshare as ak
except ImportError:
    print(json.dumps({"error": "akshare not installed. pip install akshare"}), file=sys.stderr)
    sys.exit(1)


def spot_data():
    """Real-time A-share spot data (东方财富)"""
    try:
        df = ak.stock_zh_a_spot_em()
        # Keep only needed columns
        cols = ['代码', '名称', '最新价', '涨跌幅', '涨跌额', '成交量', '成交额', '所属行业']
        df = df[cols].head(100)
        records = df.to_dict(orient='records')
        return {"mode": "spot", "count": len(records), "data": records}
    except Exception as e:
        return {"mode": "spot", "error": str(e), "data": []}


def sector_data():
    """Sector hot-ranking (板块热点)"""
    try:
        # Try industry concept boards
        df = ak.stock_board_industry_name_em()
        df = df.sort_values(by='涨跌幅', ascending=False).head(20)
        records = df.to_dict(orient='records')
        return {"mode": "sector", "count": len(records), "data": records}
    except Exception as e:
        return {"mode": "sector", "error": str(e), "data": []}


def finance_data(symbol: str):
    """Individual stock financial report (Sina)"""
    try:
        df = ak.stock_financial_report_sina(stock=symbol, symbol="利润表")
        if df.empty:
            return {"mode": "finance", "symbol": symbol, "data": []}
        # Latest report
        latest = df.iloc[0].to_dict()
        return {"mode": "finance", "symbol": symbol, "latest": latest}
    except Exception as e:
        return {"mode": "finance", "symbol": symbol, "error": str(e), "data": []}


def hist_data(symbol: str, days: int = 60):
    """Historical daily K-line"""
    try:
        df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date="", end_date="", adjust="qfq")
        if df is None or df.empty:
            return {"mode": "hist", "symbol": symbol, "data": []}
        df = df.tail(days)
        records = df.to_dict(orient='records')
        return {"mode": "hist", "symbol": symbol, "count": len(records), "data": records}
    except Exception as e:
        return {"mode": "hist", "symbol": symbol, "error": str(e), "data": []}


def fund_flow_data(symbol: str):
    """Individual stock fund flow (资金流)"""
    try:
        df = ak.stock_individual_fund_flow(stock=symbol, market="sh")
        if df is None or df.empty:
            return {"mode": "fund_flow", "symbol": symbol, "data": []}
        records = df.head(5).to_dict(orient='records')
        return {"mode": "fund_flow", "symbol": symbol, "count": len(records), "data": records}
    except Exception as e:
        return {"mode": "fund_flow", "symbol": symbol, "error": str(e), "data": []}


def market_overview():
    """Market overview (涨跌家数, etc.)"""
    try:
        df = ak.stock_zh_a_spot_em()
        up = int((df['涨跌幅'] > 0).sum())
        down = int((df['涨跌幅'] < 0).sum())
        flat = int((df['涨跌幅'] == 0).sum())
        turnover = df['成交额'].sum() if '成交额' in df.columns else 0
        return {"mode": "overview", "up": up, "down": down, "flat": flat, "turnover": str(turnover)}
    except Exception as e:
        return {"mode": "overview", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="StockMate akshare data bridge")
    parser.add_argument("--mode", required=True, choices=["spot", "sector", "finance", "hist", "fund_flow", "overview"])
    parser.add_argument("--symbol", default="600519", help="Stock code for finance/hist/fund_flow")
    parser.add_argument("--days", type=int, default=60, help="Days for hist mode")
    parser.add_argument("--output", default="json", choices=["json"])
    args = parser.parse_args()

    result = {}
    if args.mode == "spot":
        result = spot_data()
    elif args.mode == "sector":
        result = sector_data()
    elif args.mode == "finance":
        result = finance_data(args.symbol)
    elif args.mode == "hist":
        result = hist_data(args.symbol, args.days)
    elif args.mode == "fund_flow":
        result = fund_flow_data(args.symbol)
    elif args.mode == "overview":
        result = market_overview()

    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
