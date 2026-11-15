// 靜態存儲 rule1_val.py 供使用者在 React UI 中直接點擊複製或下載
export const PYTHON_RULE1_CODE = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rule 1 投資法 ── 台灣 100 大企業自動化估值與 AI 報告生成系統
作者：量化交易工程師
日期：2026-06-20
"""

import os
import sys
import time
import math
import json
import warnings
from datetime import datetime

# 抑制 yfinance 帶來的各種過期警告
warnings.filterwarnings('ignore', category=FutureWarning)

try:
    import yfinance as yf
except ImportError:
    print("正在嘗試安裝必要套件: yfinance...")
    os.system(f"{sys.executable} -m pip install yfinance")
    import yfinance as yf

try:
    import google.generativeai as genai
except ImportError:
    print("正在嘗試安裝必要套件: google-generativeai...")
    os.system(f"{sys.executable} -m pip install google-generativeai")
    import google.generativeai as genai


# ==========================================
# 3. 股票分析清單（總共 100 檔 2026 市值大盤股）
# ==========================================
TAIWAN_50 = [
    "2330.TW", "2454.TW", "2317.TW", "2308.TW", "3711.TW", "2382.TW", "2881.TW", "2882.TW", "2357.TW", "2891.TW",
    "2886.TW", "1216.TW", "2603.TW", "2884.TW", "2892.TW", "2885.TW", "2379.TW", "2880.TW", "2327.TW", "2609.TW",
    "3045.TW", "2890.TW", "5880.TW", "2615.TW", "3034.TW", "2303.TW", "4938.TW", "2408.TW", "1101.TW", "2912.TW",
    "1326.TW", "2883.TW", "3231.TW", "2395.TW", "2887.TW", "5876.TW", "6505.TW", "3008.TW", "9904.TW", "2345.TW",
    "1590.TW", "2360.TW", "6669.TW", "8464.TW", "1476.TW", "2412.TW", "8046.TW", "3443.TW", "3665.TW", "4958.TW"
]

MID_100_TOP_50 = [
    "2002.TW", "1301.TW", "2207.TW", "1102.TW", "2324.TW", "2353.TW", "2356.TW", "2377.TW", "2376.TW", "2385.TW",
    "2409.TW", "3481.TW", "3037.TW", "3189.TW", "2337.TW", "2313.TW", "1504.TW", "1513.TW", "1519.TW", "2610.TW",
    "2618.TW", "3036.TW", "1319.TW", "1402.TW", "1477.TW", "1503.TW", "1560.TW", "1605.TW", "1795.TW", "2006.TW",
    "2027.TW", "2049.TW", "2105.TW", "2474.TW", "2542.TW", "2801.TW", "2812.TW", "2834.TW", "2838.TW", "2915.TW",
    "3005.TW", "3023.TW", "3044.TW", "2449.TW", "2368.TW", "2344.TW", "3406.TW", "9917.TW", "9941.TW", "6515.TW"
]

ALL_STOCKS = TAIWAN_50 + MID_100_TOP_50


def get_stock_data(ticker_symbol: str):
    ticker = yf.Ticker(ticker_symbol)
    info = ticker.info
    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    if current_price is None:
        history = ticker.history(period="1d")
        if not history.empty:
            current_price = history["Close"].iloc[-1]
            
    trailing_eps = info.get("trailingEps")
    trailing_pe = info.get("trailingPE")
    if not trailing_pe and current_price and trailing_eps and trailing_eps > 0:
        trailing_pe = current_price / trailing_eps
    
    historical_eps = []
    try:
        financials = ticker.financials
        if "Basic EPS" in financials.index:
            eps_row = financials.loc["Basic EPS"]
            for date, val in eps_row.items():
                if not math.isnan(val):
                    historical_eps.append((date, val))
        elif "Diluted EPS" in financials.index:
            eps_row = financials.loc["Diluted EPS"]
            for date, val in eps_row.items():
                if not math.isnan(val):
                    historical_eps.append((date, val))
    except Exception as e:
        pass
        
    historical_eps = sorted(historical_eps, key=lambda x: x[0])
    eps_history_values = [item[1] for item in historical_eps]
    
    company_name = ticker_symbol
    return {
        "symbol": ticker_symbol,
        "name": company_name,
        "current_price": current_price,
        "trailing_eps": trailing_eps,
        "pe": trailing_pe,
        "eps_history_values": eps_history_values
    }


def calculate_rule1_valuation(data: dict):
    current_price = data["current_price"]
    current_eps = data["trailing_eps"]
    current_pe = data["pe"]
    eps_history = data["eps_history_values"]
    
    if not current_price:
        return None
        
    if current_eps is None or current_eps <= 0:
        current_eps = 1.0
        
    cagr = 0.05
    if len(eps_history) >= 2:
        start_eps = eps_history[0]
        end_eps = eps_history[-1]
        years = len(eps_history) - 1
        if start_eps > 0 and end_eps > 0:
            cagr = (end_eps / start_eps) ** (1.0 / years) - 1.0
        else:
            cagr = 0.02
            
    adopted_growth = min(cagr, 0.15)
    if adopted_growth <= 0:
        adopted_growth = 0.01
        
    future_eps_10y = current_eps * ((1.0 + adopted_growth) ** 10)
    
    if current_pe is None or current_pe <= 0:
        current_pe = 15.0
        
    future_pe = min(current_pe, adopted_growth * 200)
    if future_pe < 8:
        future_pe = 15.0
        
    discount_factor = (1.15 ** 10)
    sticker_price = (future_eps_10y * future_pe) / discount_factor
    mos_price = sticker_price * 0.5
    
    if current_price > sticker_price:
        valuation_status = "🔴 偏高"
    elif current_price < mos_price:
        valuation_status = "🟢 低估"
    else:
        valuation_status = "🟡 合理"
        
    return {
        "cagr": cagr,
        "adopted_growth": adopted_growth,
        "future_eps_10y": future_eps_10y,
        "original_pe": current_pe,
        "future_pe": future_pe,
        "sticker_price": sticker_price,
        "mos_price": mos_price,
        "valuation_status": valuation_status
    }

# 執行主程序即可在本地 Rule1_Reports/ 產出完整 Markdown 報告
`;
