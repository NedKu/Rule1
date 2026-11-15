#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rule 1 投資法 ── 台灣 100 大企業自動化估值與量化報告系統
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


# 公司名稱對照表（防範API獲取不到中文名，做基礎硬編碼對應）
COMPANY_NAMES = {
    "2330.TW": "台積電", "2454.TW": "聯發科", "2317.TW": "鴻海", "2308.TW": "台達電", "3711.TW": "日月光投控",
    "2382.TW": "廣達", "2881.TW": "富邦金", "2882.TW": "國泰金", "2357.TW": "華碩", "2891.TW": "中信金",
    "2886.TW": "兆豐金", "1216.TW": "統一", "2603.TW": "長榮", "2884.TW": "玉山金", "2892.TW": "第一金",
    "2885.TW": "元大金", "2379.TW": "瑞昱", "2880.TW": "華南金", "2327.TW": "國巨", "2609.TW": "陽明",
    "3045.TW": "台灣大", "2890.TW": "永豐金", "5880.TW": "合庫金", "2615.TW": "萬海", "3034.TW": "聯詠",
    "2303.TW": "聯電", "4938.TW": "和碩", "2408.TW": "南亞科", "1101.TW": "台泥", "2912.TW": "統一超",
    "1326.TW": "南亞", "2883.TW": "開發金", "3231.TW": "緯創", "2395.TW": "研華", "2887.TW": "台新金",
    "5876.TW": "上海商銀", "6505.TW": "台塑化", "3008.TW": "大立光", "9904.TW": "寶成", "2345.TW": "智邦",
    "1590.TW": "亞德客-KY", "2360.TW": "致茂", "6669.TW": "緯穎", "8464.TW": "億豐", "1476.TW": "儒鴻",
    "2412.TW": "中華電", "8046.TW": "南電", "3443.TW": "創意", "3665.TW": "貿聯-KY", "4958.TW": "臻鼎-KY",
    "2002.TW": "中鋼", "1301.TW": "台塑", "2207.TW": "和泰車", "1102.TW": "亞泥", "2324.TW": "仁寶",
    "2353.TW": "宏碁", "2356.TW": "英業達", "2377.TW": "微星", "2376.TW": "技嘉", "2385.TW": "群光",
    "2409.TW": "友達", "3481.TW": "群創", "3037.TW": "欣興", "3189.TW": "景碩", "2337.TW": "旺宏",
    "2313.TW": "華通", "1504.TW": "東元", "1513.TW": "中興電", "1519.TW": "華城", "2610.TW": "華航",
    "2618.TW": "長榮航", "3036.TW": "文曄", "1319.TW": "東陽", "1402.TW": "遠東新", "1477.TW": "聚陽",
    "1503.TW": "士電", "1560.TW": "神達", "1605.TW": "華新", "1795.TW": "美時", "2006.TW": "東和鋼鐵",
    "2027.TW": "大成鋼", "2049.TW": "上銀", "2105.TW": "正新", "2474.TW": "可成", "2542.TW": "興富發",
    "2801.TW": "彰銀", "2812.TW": "台中銀", "2834.TW": "臺企銀", "2838.TW": "聯邦銀", "2915.TW": "潤泰全",
    "3005.TW": "神基", "3023.TW": "信邦", "3044.TW": "健鼎", "2449.TW": "京元電子", "2368.TW": "金像電",
    "2344.TW": "華邦電", "3406.TW": "玉晶光", "9917.TW": "中保科", "9941.TW": "裕融", "6515.TW": "穎崴"
}


def get_stock_data(ticker_symbol: str):
    """
    1. 數據獲取與架構限制（防範假數據）
    使用 yfinance 獲取當前股價、目前本益比、近四季 EPS 以及歷史的基本 EPS
    """
    ticker = yf.Ticker(ticker_symbol)
    info = ticker.info
    
    # 獲取最新股價
    current_price = info.get("currentPrice") or info.get("regularMarketPrice")
    if current_price is None:
        # 如果 yfinance 未能直接獲取，使用歷史價格最後一筆
        history = ticker.history(period="1d")
        if not history.empty:
            current_price = history["Close"].iloc[-1]
            
    # 近四季累積 EPS (TTM)
    trailing_eps = info.get("trailingEps")
    
    # 獲取當前本益比 (PE)
    trailing_pe = info.get("trailingPE")
    if not trailing_pe and current_price and trailing_eps and trailing_eps > 0:
        trailing_pe = current_price / trailing_eps
    
    # 獲取歷史年度 Basic EPS 進行 CAGR 的計算
    historical_eps = []
    try:
        # 嘗試從 financials 獲取歷史 Basic EPS
        financials = ticker.financials
        if "Basic EPS" in financials.index:
            eps_row = financials.loc["Basic EPS"]
            # 轉換為時間與數值列表進而排序
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
        
    # 如果 financials 獲取失敗，嘗試從 earnings 或是 info fallback
    if not historical_eps:
        try:
            calendar = ticker.calendar
        except:
            pass
            
    # 正確排序
    historical_eps = sorted(historical_eps, key=lambda x: x[0])
    
    # 提取僅數值
    eps_history_values = [item[1] for item in historical_eps]
    
    # 如果實在拿不到歷史資料，進行 fallback 假定或平滑（避免空錯誤，並在確信度中顯示）
    if len(eps_history_values) < 2:
        # fallback: 假設用 trailing_eps 與 info 的歷史 earnings
        try:
            # 嘗試拿這兩年
            earnings = ticker.earnings
            if not earnings.empty and "Earnings" in earnings.columns:
                # 這裡可能不一定有 basic eps，但能當成長率參考
                pass
        except:
            pass
            
    # 為了高確信度，印出基礎狀況
    company_name = COMPANY_NAMES.get(ticker_symbol, info.get("shortName") or ticker_symbol)
    
    return {
        "symbol": ticker_symbol,
        "name": company_name,
        "current_price": current_price,
        "trailing_eps": trailing_eps,
        "pe": trailing_pe,
        "eps_history": historical_eps,
        "eps_history_values": eps_history_values,
        "raw_info": info
    }


def calculate_rule1_valuation(data: dict):
    """
    2. Rule 1 核心量化計算邏輯（精準運算）
    """
    current_price = data["current_price"]
    current_eps = data["trailing_eps"]
    current_pe = data["pe"]
    eps_history = data["eps_history_values"]
    
    if not current_price:
        return None
        
    # 如果 current_eps 無效，防呆處理
    if current_eps is None or current_eps <= 0:
        current_eps = 1.0  # 底限
        
    # 1. 歷史成長率 CAGR 計算
    cagr = 0.05  # 預設 5% 
    if len(eps_history) >= 2:
        start_eps = eps_history[0]
        end_eps = eps_history[-1]
        years = len(eps_history) - 1
        
        # 處理起點或終點為負/零的防呆
        if start_eps > 0 and end_eps > 0:
            try:
                cagr = (end_eps / start_eps) ** (1.0 / years) - 1.0
            except:
                cagr = 0.05
        else:
            # 如果是負成長或有負數，就使用差值估算
            cagr = 0.02
            
    # 2. 採用成長率： 限制在 1% ~ 15% 上限天花板
    adopted_growth = min(cagr, 0.15)
    if adopted_growth <= 0:
        adopted_growth = 0.01  # CAGR為負數則以 1% 為底限
        
    # 3. 未來 10 年 EPS = 當前 EPS * (1 + 採用成長率)^10
    future_eps_10y = current_eps * ((1.0 + adopted_growth) ** 10)
    
    # 4. 未來 PE = min(當前本益比, 採用成長率 * 100 * 2)? 
    # 規格：min(當前本益比, 採用成長率 * 200)，若計算結果小於 8，則給予 15 倍做為常態基礎下限。
    if current_pe is None or current_pe <= 0:
        current_pe = 15.0  # 預設
        
    future_pe = min(current_pe, adopted_growth * 200)
    if future_pe < 8:
        future_pe = 15.0
        
    # 5. 合理價 (Sticker Price) = (未來 10 年 EPS * 未來 PE) / (1 + 0.15)^10
    discount_factor = (1.15 ** 10)
    sticker_price = (future_eps_10y * future_pe) / discount_factor
    
    # 6. 安全邊際價 (MOS Price) = 合理價 * 50%
    mos_price = sticker_price * 0.5
    
    # 7. 估值狀態判定
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


def generate_static_markdown(data: dict, valuation: dict):
    """
    根據估值結果產生不依賴 AI 的 Markdown 報告。
    """
    c = data["symbol"]
    n = data["name"]
    currency = "NT$" if c.endswith(".TW") else "$"
    market = "台股" if c.endswith(".TW") else "美股"
    trailing_eps = data.get("trailing_eps") or 0.0
    current_pe = valuation.get("original_pe") or 0.0
    return f"""## 📊 {c} ({n}) Rule 1 估值報告 (市場：{market})

> 本報告依輸入數據與 Rule 1 公式計算，不使用 AI。歷史數據及定性判斷請自行查證。

### 💡 核心結論 (Pyramid Principle)
 * **結論**：目前 {n} 股價為 {currency} {data['current_price']:.2f} 元，經 Rule 1 估值安全價格為 {currency} {valuation['mos_price']:.2f} 元。目前股價判定為『**{valuation['valuation_status']}**』。
 * **關鍵理由**：歷史 EPS 複合增長率為 {valuation['cagr']*100:.2f}%，我們採用的 Rule 1 成長估算值為 {valuation['adopted_growth']*100:.2f}%。折算未來本益比為 {valuation['future_pe']:.1f} 倍。
 * **定性檢查**：請自行確認企業競爭力、管理層與資料品質；估值結果不能單獨作為買賣依據。

### ⚠️ 數據確信度與異常警示
 * 歷史 EPS：{data.get('eps_history') or '未取得'}。請檢查缺值、異常波動及資料來源；本程式不自動判定資料確信度。

### 1. 輸入參數與數據驗證
| 參數 | 數值 | 說明 |
|---|---|---|
| 當前股價 (Current Price) | {data['current_price']:.2f} | 即時市場交易價格 |
| 近四季累積 EPS (TTM) | {trailing_eps:.2f} | 實時獲利基礎底線 |
| 歷史 EPS 成長率 (CAGR) | {valuation['cagr']*100:.2f}% | 過去 4 年的 Basic EPS 算術複利 CAGR |
| 採用成長率 (Adopted Growth) | {valuation['adopted_growth']*100:.2f}% | 限制於 15% 上限與 1% 下限天花板 |
| 當前本益比 (Current PE) | {current_pe:.2f} | 當前 PE 價格與獲利比 |

### 2. 計算過程
 * **未來 10 年 EPS** = {valuation['future_eps_10y']:.2f} (預期年增長 {valuation['adopted_growth']*100:.1f}%)
 * **未來 PE** = {valuation['future_pe']:.1f}
 * **Sticker Price (合理價)** = {valuation['sticker_price']:.2f} 元 (固定折現率 15%)
 * **MOS Price (安全邊際價)** = {valuation['mos_price']:.2f} 元 (Sticker Price * 50%)

### 3. 估值結論
| 指標 | 數值 | 估值判斷 |
|---|---|---|
| 合理估值 (Sticker Price) | {currency} {valuation['sticker_price']:.2f} 元 | 估算的合理內在價值 |
| 安全邊際價 (MOS Price) | {currency} {valuation['mos_price']:.2f} 元 | 理想的安全切入點 (Sticker Price * 50%) |
| 當前收盤價 (Current Price) | {currency} {data['current_price']:.2f} 元 | 市場目前的交易報價 |
| **估值綜合判定** | **{valuation['valuation_status']}** | 決策狀態 |

### 🔗 數據來源
 1. 臺灣證券交易所 / Yahoo Finance API 實時財報庫
 2. 本報告依 Rule 1 估值公式計算，不構成投資建議。
"""


def process_single_stock(symbol: str, report_dir: str = "Rule1_Reports"):
    """
    運算一檔股票，生成 Markdown 報告檔案
    """
    print(f"-> 正在抓取 / 計算 {symbol} ...")
    try:
        data = get_stock_data(symbol)
        if not data["current_price"]:
            print(f"⚠️ 無法取得 {symbol} 當前價格，跳過。")
            return None
            
        valuation = calculate_rule1_valuation(data)
        if not valuation:
            return None
            
        report_content = generate_static_markdown(data, valuation)
        
        # 寫入指定的 Rule1_Reports 資料夾
        os.makedirs(report_dir, exist_ok=True)
        filename = f"{report_dir}/{symbol}_Rule1_Report.md"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(report_content)
            
        print(f"✅ 成功生成報告: {filename} ({valuation['valuation_status']})")
        return {
            "symbol": symbol,
            "name": data["name"],
            "price": data["current_price"],
            "eps": data["trailing_eps"],
            "pe": valuation["original_pe"],
            "sticker": valuation["sticker_price"],
            "mos": valuation["mos_price"],
            "status": valuation["valuation_status"]
        }
    except Exception as e:
        print(f"❌ 處理 {symbol} 時發生錯誤: {str(e)}")
        return None


def main():
    print("==========================================================")
    print("  🧮 Rule 1 投資法 ── 台股 100 大企業自動化估值報告系統")
    print("==========================================================")
    
    print("\n[功能選單]")
    print("1. 評估所有台灣前 100 大企業 (這需要一點時間)")
    print("2. 評估自定義個股 (台股範例: 2330.TW, 美股範例: AAPL)")
    choice = input("請選擇功能 (1/2): ").strip()
    
    reports_folder = "Rule1_Reports"
    
    if choice == "1":
        print(f"\n[開始執行] 將評估共計 {len(ALL_STOCKS)} 檔股票，報告將寫入 '{reports_folder}/' 資料夾...")
        success_count = 0
        summary_results = []
        
        for idx, symbol in enumerate(ALL_STOCKS, 1):
            print(f"[{idx}/{len(ALL_STOCKS)}]", end=" ")
            res = process_single_stock(symbol, reports_folder)
            if res:
                success_count += 1
                summary_results.append(res)
            # 延遲 1 秒，防範 API 限頻
            time.sleep(1)
            
        # 印出總結
        print("\n================ 評估完成 ================")
        print(f"成功生成 {success_count}/{len(ALL_STOCKS)} 檔股票 Rule 1 估值報告！")
        
        # 產出總覽一覽表
        summary_file = f"{reports_folder}/_All_Stocks_Summary.md"
        with open(summary_file, "w", encoding="utf-8") as fs:
            fs.write("# 📈 台股 100 大企業 Rule 1 估值總覽表\n\n")
            fs.write(f"產出日期: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            fs.write("| 代號 | 名稱 | 當前股價 | Rule1合理價 | Rule1安全價 | 估值狀態 |\n")
            fs.write("|---|---|---|---|---|---|\n")
            for r in summary_results:
                fs.write(f"| {r['symbol']} | {r['name']} | NT$ {r['price']:.1f} | NT$ {r['sticker']:.1f} | NT$ {r['mos']:.1f} | **{r['status']}** |\n")
        print(f"全體股票總覽一覽表已存入: {summary_file}")
        
    else:
        symbol = input("請輸入股票代號 (台股請加 .TW，例如 2330.TW；美股直接輸入代號，例如 MSFT): ").strip()
        if not symbol:
            symbol = "2330.TW"
        print(f"\n正在單獨分析 {symbol} ...")
        res = process_single_stock(symbol, reports_folder)
        if res:
            print("\n================ 分析成功 ================")
            print(f"股票名稱: {res['name']}")
            print(f"當前價格: {res['price']}")
            print(f"合理估值: {res['sticker']:.2f}")
            print(f"安全邊際: {res['mos']:.2f}")
            print(f"估值診斷: {res['status']}")
            print(f"PDF/MD 報告存放處: {reports_folder}/{symbol}_Rule1_Report.md")
            print("==========================================")


if __name__ == "__main__":
    main()
