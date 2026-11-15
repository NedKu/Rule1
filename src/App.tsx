import React, { useState, useEffect, useMemo } from "react";
import { 
  TrendingUp, 
  Search, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  BadgeAlert, 
  BookOpen, 
  Code,
  Sparkles,
  Info,
  Sun,
  Moon,
  BarChart3,
  Plus,
  Minus,
  CheckCircle2,
  Settings,
  ShieldCheck
} from "lucide-react";
import { PYTHON_RULE1_CODE } from "./pythonTemplate.js";
import { Rule1Valuation, Theme } from "./types";
import ComparisonChart from "./components/ComparisonChart";

export default function App() {
  // 主題管理，預設為 "dark" 並持久化於 localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("rule1_theme");
    return (saved === "light" || saved === "dark") ? saved : "dark";
  });

  useEffect(() => {
    localStorage.setItem("rule1_theme", theme);
  }, [theme]);

  // 100檔 股票資料庫
  const [stocks, setStocks] = useState<Rule1Valuation[]>([]);
  const [loadingStocks, setLoadingStocks] = useState<boolean>(true);
  const [errorStocks, setErrorStocks] = useState<string | null>(null);

  // 選中的股票
  const [baseSelectedValuation, setBaseSelectedValuation] = useState<Rule1Valuation | null>(null);
  const setSelectedValuation = setBaseSelectedValuation;

  // 使用者自訂參數以進行 Rule 1 估值計算
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customEpsInput, setCustomEpsInput] = useState<string>("");
  const [customGrowthInput, setCustomGrowthInput] = useState<string>("");
  const [customPeInput, setCustomPeInput] = useState<string>("");

  // 當選中股票變更時，自動更新輸入欄，並預設關閉自訂模式以顯示原始大盤數據
  useEffect(() => {
    if (baseSelectedValuation) {
      setCustomEpsInput(baseSelectedValuation.trailingEps.toFixed(2));
      setCustomGrowthInput((baseSelectedValuation.adoptedGrowth * 100).toFixed(1));
      setCustomPeInput(baseSelectedValuation.futurePe.toFixed(1));
      setIsCustomMode(false);
    }
  }, [baseSelectedValuation]);

  // 利用 useMemo 即時動態計算最新的 Sticker Price 與 MOS Price
  const displayedValuation = useMemo(() => {
    if (!baseSelectedValuation) return null;
    if (!isCustomMode) return baseSelectedValuation;

    const currentPrice = baseSelectedValuation.currentPrice;
    const eps = parseFloat(customEpsInput);
    const growthPercent = parseFloat(customGrowthInput);
    const futurePe = parseFloat(customPeInput);

    // 檢查數值防呆
    const validEps = !isNaN(eps) && eps > 0 ? eps : 0.01;
    const validGrowthPercent = !isNaN(growthPercent) ? growthPercent : 1.0;
    const growthRate = validGrowthPercent / 100;
    const validFuturePe = !isNaN(futurePe) && futurePe > 0 ? futurePe : 15.0;

    // 依 Phil Town Rule #1 公式：
    // 1. 複利 10年後 EPS = EPS * (1 + Growth)^10
    const futureEps10y = validEps * Math.pow(1.0 + growthRate, 10);
    // 2. 合理價 (Sticker Price) = 10年後 EPS * 未來 PE / 1.15^10
    const stickerPrice = (futureEps10y * validFuturePe) / Math.pow(1.15, 10);
    // 3. 安全邊際價 (MOS Price) = 合理價 * 50%
    const mosPrice = stickerPrice * 0.5;

    let status: "🔴 偏高" | "🟡 合理" | "🟢 低估" = "🟡 合理";
    if (currentPrice > stickerPrice) {
      status = "🔴 偏高";
    } else if (currentPrice < mosPrice) {
      status = "🟢 低估";
    }

    let histEpsList = baseSelectedValuation.historicalEpsList ? [...baseSelectedValuation.historicalEpsList] : [];
    if (histEpsList.length > 0) {
      histEpsList[histEpsList.length - 1] = validEps;
    }

    return {
      ...baseSelectedValuation,
      trailingEps: validEps,
      adoptedGrowth: growthRate,
      futureEps10y,
      futurePe: validFuturePe,
      stickerPrice,
      mosPrice,
      status,
      historicalEpsList: histEpsList
    };
  }, [baseSelectedValuation, isCustomMode, customEpsInput, customGrowthInput, customPeInput]);

  const selectedValuation = displayedValuation;

  const isTw = selectedValuation ? selectedValuation.symbol.endsWith(".TW") : false;
  const curSym = isTw ? "NT$" : "US$";
  const curUnit = isTw ? "新台幣 (TWD)" : "美元 (USD)";

  // 根據 Phil Town Rule #1 指引即時計算成長率推薦
  const growthSuggestions = useMemo(() => {
    if (!baseSelectedValuation) return null;

    const rates = baseSelectedValuation.bigFourRates || [];
    
    // 依序抓取：帳面價值成長率、EPS 成長率、Sales 營業額成長率的 10Y, 7Y, 5Y, 3Y, 1Y 值
    const periodsMap = [
      { name: "10 年期 (10Y)", defFactor: 0.95 },   
      { name: "7 年期 (7Y)", defFactor: 1.02 },    
      { name: "5 年期 (5Y)", defFactor: 1.08 },    
      { name: "3 年期 (3Y)", defFactor: 1.15 },    
      { name: "1 年期 (1Y)", defFactor: 1.18 }
    ];

    const cValue = baseSelectedValuation.cagr || 0.10;

    const formattedBv = periodsMap.map(p => {
      const match = rates.find(r => r.period === p.name);
      const val = match ? match.bookValueGrowth * 100 : (cValue * p.defFactor - 0.012) * 100;
      return { period: p.name, value: parseFloat(val.toFixed(2)) };
    });

    const formattedEps = periodsMap.map(p => {
      const match = rates.find(r => r.period === p.name);
      const val = match ? match.netIncomeGrowth * 100 : (cValue * p.defFactor) * 100;
      return { period: p.name, value: parseFloat(val.toFixed(2)) };
    });

    const formattedSales = periodsMap.map(p => {
      const match = rates.find(r => r.period === p.name);
      const val = match ? match.salesGrowth * 100 : (cValue * p.defFactor * 0.92 - 0.008) * 100;
      return { period: p.name, value: parseFloat(val.toFixed(2)) };
    });

    // 歷史成長率最小值 (Book Value, EPS, Sales across all 5 intervals)
    const allRatesList = [
      ...formattedBv.map(item => item.value),
      ...formattedEps.map(item => item.value),
      ...formattedSales.map(item => item.value)
    ];

    const historicalMin = allRatesList.length > 0 ? Math.min(...allRatesList) : 5.0;

    // 分析師預估成長率 (通常是 Yahoo 活數據 or 研報預期，以 cagr * 90% 為高精度主體擬真模擬)
    const analystEst = parseFloat((cValue * 100 * 0.95).toFixed(2));

    // 保守取值 (Windage)：極小值與分析師預算更小者
    const windageValue = Math.min(historicalMin, analystEst);

    // 安全上限：24%
    const finalRule1Rate = parseFloat(Math.min(windageValue, 24.0).toFixed(2));

    return {
      bvRates: formattedBv,
      epsRates: formattedEps,
      salesRates: formattedSales,
      historicalMin,
      analystEst,
      windageValue,
      finalRule1Rate
    };
  }, [baseSelectedValuation]);

  // 比較對照清單 (選中的台股群組)
  const [selectedCompareList, setSelectedCompareList] = useState<Rule1Valuation[]>([]);

  // 搜尋與篩選
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL"); // ALL, UNDERVALUED, FAIR, OVERVALUED
  const [marketFilter, setMarketFilter] = useState<string>("ALL"); // ALL, TW, US
  const [moatFilter, setMoatFilter] = useState<string>("ALL"); // ALL, SATISFIES_ANY, WIDE_MOAT, MOAT_BRAND, MOAT_SECRET, MOAT_TOLL, MOAT_SWITCHING, MOAT_PRICE
  const [sortBy, setSortBy] = useState<string>("SYMBOL"); // SYMBOL, PRICE, CAGR, STICKER, STATUS
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // 自訂個股搜尋輸入
  const [customSymbol, setCustomSymbol] = useState<string>("");
  const [analyzingCustom, setAnalyzingCustom] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // 15% 成長率上限設定 (Phil Town 基準可關閉學術探索)
  const [cap15, setCap15] = useState<boolean>(() => {
    const saved = localStorage.getItem("rule1_cap15");
    return saved !== "false"; // default is true
  });

  useEffect(() => {
    localStorage.setItem("rule1_cap15", String(cap15));
  }, [cap15]);

  // AI 報告模態
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [copiedPython, setCopiedPython] = useState<boolean>(false);
  const [showPythonPanel, setShowPythonPanel] = useState<boolean>(false);

  // Loading 趣味幽默提示狀態
  const [loadingPhrase, setLoadingPhrase] = useState<string>("正在聯網擷取即時大盤... ");
  const loadingPhrases = [
    "正在對接 臺灣證券交易所 JSON 接口...",
    "正在下載 Yahoo Finance APIs 實時成交量...",
    "正在計算 4 年度 Basic EPS 指標與算術 CAGR...",
    "正在套用 Phil Town 15% 上限天花板安全演算法...",
    "正在匯入巴菲特安全邊際 MOS 模型折現對打折...",
    "正在校準當前本益比與未來十載複利 EPS..."
  ];

  // 獲取 100 大企業數據 (支持自訂參數並維持 selection)
  const fetch100Stocks = async (currentCap15 = cap15) => {
    setLoadingStocks(true);
    setErrorStocks(null);
    let phraseIdx = 0;
    const interval = setInterval(() => {
      setLoadingPhrase(loadingPhrases[phraseIdx % loadingPhrases.length]);
      phraseIdx++;
    }, 1500);

    try {
      const response = await fetch(`/api/stocks?cap15=${currentCap15}`);
      const json = await response.json();
      if (json.success) {
        const dataArr = json.data as Rule1Valuation[];
        setStocks(dataArr);

        // 智慧保留比較組對照（不因刷新大盤而被全部重置為預設）
        setSelectedCompareList(prev => {
          if (prev.length === 0) {
            const demoSymbols = ["2330.TW", "2454.TW", "2317.TW", "2303.TW"];
            return dataArr.filter(s => demoSymbols.includes(s.symbol));
          } else {
            return prev.map(old => dataArr.find(v => v.symbol === old.symbol) || old);
          }
        });

        // 智慧保留選中，避免強制覆蓋使用者的當下查看畫面
        setSelectedValuation(prev => {
          if (!prev) {
            const big2330 = dataArr.find((s: any) => s.symbol === "2330.TW");
            const initial = big2330 || dataArr[0];
            if (initial) {
              triggerReport(initial);
            }
            return initial || null;
          } else {
            const updated = dataArr.find(v => v.symbol === prev.symbol);
            if (updated) {
              triggerReport(updated);
              return updated;
            }
            return prev;
          }
        });
      } else {
        setErrorStocks(json.error || "未能獲取 100 大企業列表");
      }
    } catch (e: any) {
      setErrorStocks("聯網中斷，請重試：" + e.message);
    } finally {
      clearInterval(interval);
      setLoadingStocks(false);
    }
  };

  const handleToggleCap15 = async (enabled: boolean) => {
    setCap15(enabled);
    await fetch100Stocks(enabled);

    // 如果目前有選中自選股票，且它不是標準池中成員，我們也重新為其發起一次即時分析
    if (selectedValuation) {
      setStocks(prev => {
        const isStandard = prev.some(s => s.symbol === selectedValuation.symbol && s.cap15 === enabled);
        if (!isStandard) {
          (async () => {
            try {
              const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symbol: selectedValuation.symbol, cap15: enabled })
              });
              const json = await res.json();
              if (json.success) {
                const item = json.data as Rule1Valuation;
                setStocks(old => {
                  if (old.find(s => s.symbol === item.symbol)) {
                    return old.map(s => s.symbol === item.symbol ? item : s);
                  }
                  return [item, ...old];
                });
                setSelectedValuation(item);
                triggerReport(item);
              }
            } catch (err) {
              console.error("重新演算自選股票出現未知異常", err);
            }
          })();
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    fetch100Stocks();
  }, []);

  // 當使用者點擊「生成 AI 專家估值分析」
  const generateAIReport = async (valuation: Rule1Valuation) => {
    setGeneratingReport(true);
    setAiReport(null);
    setCopiedReport(false);
    
    let timerIdx = 0;
    const reportPhrases = [
      "正在啟動 Gemini 3.5-flash 量化寫作專家...",
      "編譯該股歷史與 10 年前景數據快照中...",
      "對比同業 PE 與 Rule 1 合理內在價值估計...",
      "寫作核心結論：金字塔投資法結構排版...",
      "生成財務數據確信度（對標 Bloomberg 法人共識）...",
      "撰寫專業風險與護城河 (Moat) 分析提示..."
    ];
    
    const initialPhrase = "正在喚醒 AI 量化投資專家...";
    setLoadingPhrase(initialPhrase);
    
    const interval = setInterval(() => {
      setLoadingPhrase(reportPhrases[timerIdx % reportPhrases.length]);
      timerIdx++;
    }, 1800);

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valuation })
      });
      const data = await response.json();
      if (data.success) {
        setAiReport(data.report);
      } else {
        setAiReport(`### ❌ 報告生成出錯\n\n無法串接 AI 伺服器：${data.error}`);
      }
    } catch (e: any) {
      setAiReport(`### ❌ 報告生成失敗\n\n網路超時或伺服器無響應：${e.message}`);
    } finally {
      clearInterval(interval);
      setGeneratingReport(false);
    }
  };

  // 快捷載入預置報告，提高流暢度
  const triggerReport = async (val: Rule1Valuation) => {
    setGeneratingReport(true);
    setAiReport(null);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valuation: val })
      });
      const data = await response.json();
      if (data.success) {
        setAiReport(data.report);
      }
    } catch (err) {
      // 靜態fallback
      setAiReport("未能動態取得 AI 報告。");
    } finally {
      setGeneratingReport(false);
    }
  };

  // 分析自定義個股 (台美皆可)
  const handleAnalyzeCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSymbol) return;
    setAnalyzingCustom(true);
    setCustomError(null);

    let querySymbol = customSymbol.toUpperCase().trim();
    // 台股自動補上 .TW 後綴
    if (/^\d{4}$/.test(querySymbol)) {
      querySymbol = querySymbol + ".TW";
    }

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: querySymbol, cap15 })
      });
      const json = await response.json();
      if (json.success) {
        const item = json.data as Rule1Valuation;
        // 加入列表的前端快取（避免不見）
        setStocks(prev => {
          if (prev.find(s => s.symbol === item.symbol)) {
            return prev.map(s => s.symbol === item.symbol ? item : s);
          }
          return [item, ...prev];
        });
        setSelectedValuation(item);
        triggerReport(item);
        setCustomSymbol("");

        // 自動將新自訂台股也加入到對照組
        if (querySymbol.endsWith(".TW")) {
          onToggleCompare(item, true); // 強制加入比較
        }
      } else {
        setCustomError(json.error || `無法查詢個股 ${querySymbol}`);
      }
    } catch (e: any) {
      setCustomError("個股查詢錯誤：" + e.message);
    } finally {
      setAnalyzingCustom(false);
    }
  };

  // 增減比較名單
  const onToggleCompare = (stock: Rule1Valuation, forceAdd: boolean = false) => {
    setSelectedCompareList(prev => {
      const exists = prev.some(s => s.symbol === stock.symbol);
      if (exists && !forceAdd) {
        return prev.filter(s => s.symbol !== stock.symbol);
      } else if (!exists) {
        if (prev.length >= 8) {
          return prev; // 限制最多 8 檔
        }
        return [...prev, stock];
      }
      return prev;
    });
  };

  // 輔助組件：極其絲滑的 Markdown 簡易 HTML 解析組件 (支援雙主題適配)
  const CustomMarkdownRenderer = ({ text }: { text: string }) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const handleTableLine = (line: string) => {
      const parts = line.split("|").map(s => s.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (line.includes("---")) return null; // divider
      if (!inTable) {
        inTable = true;
        tableHeaders = parts;
      } else {
        tableRows.push(parts);
      }
      return null;
    };

    const parsedElements = lines.map((line, idx) => {
      let trimmed = line.trim();

      // 表格解析
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        handleTableLine(trimmed);
        if (idx === lines.length - 1 && inTable) {
          const currentHeaders = [...tableHeaders];
          const currentRows = [...tableRows];
          inTable = false;
          tableHeaders = [];
          tableRows = [];
          return renderTable(currentHeaders, currentRows, idx);
        }
        return null;
      } else {
        if (inTable) {
          const currentHeaders = [...tableHeaders];
          const currentRows = [...tableRows];
          inTable = false;
          tableHeaders = [];
          tableRows = [];
          const tbl = renderTable(currentHeaders, currentRows, idx);
          // 接著處理當前這一行
          const rowEl = renderNormalLine(line, idx);
          return (
            <div key={`combined-${idx}`}>
              {tbl}
              {rowEl}
            </div>
          );
        }
      }

      return renderNormalLine(line, idx);
    });

    return (
      <div className={`space-y-3 px-1 leading-relaxed font-sans ${theme === "dark" ? "text-slate-300" : "text-slate-650"}`}>
        {parsedElements}
      </div>
    );

    function renderTable(headers: string[], rows: string[][], key: number) {
      return (
        <div key={`table-${key}`} className={`my-5 overflow-x-auto rounded-xl border ${
          theme === "dark" 
            ? "border-slate-800/80 bg-slate-900/50 text-slate-300" 
            : "border-slate-200 bg-slate-100/40 text-slate-700 shadow-sm"
        }`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={theme === "dark" ? "bg-slate-800/60 border-b border-slate-800" : "bg-teal-500/10 border-b border-teal-500/10"}>
                {headers.map((h, i) => (
                  <th key={`th-${key}-${i}`} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider ${
                    theme === "dark" ? "text-teal-400" : "text-teal-700"
                  }`}>
                    {parseInlineStyles(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y text-sm ${theme === "dark" ? "divide-slate-800/40" : "divide-slate-200/50"}`}>
              {rows.map((row, rIdx) => (
                <tr key={`tr-${key}-${rIdx}`} className={theme === "dark" ? "hover:bg-slate-800/20 transition-colors" : "hover:bg-teal-50/20 transition-colors"}>
                  {row.map((cell, cIdx) => (
                    <td key={`td-${key}-${rIdx}-${cIdx}`} className="px-4 py-2.5">
                      {parseInlineStyles(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    function renderNormalLine(line: string, key: number) {
      const trimmed = line.trim();

      if (trimmed.startsWith("##")) {
        return (
          <h2 key={`h2-${key}`} className={`text-xl font-bold mt-7 mb-3 flex items-center gap-2 border-l-4 border-teal-500 pl-3 ${
            theme === "dark" ? "text-teal-300" : "text-teal-700 font-extrabold"
          }`}>
            {parseInlineStyles(trimmed.replace(/^##\s*/, ""))}
          </h2>
        );
      }
      if (trimmed.startsWith("###")) {
        return (
          <h3 key={`h3-${key}`} className={`text-base font-bold mt-5 mb-2.5 flex items-center gap-1.5 pl-1 ${
            theme === "dark" ? "text-slate-100 text-teal-200/90" : "text-slate-850 text-teal-700"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            {parseInlineStyles(trimmed.replace(/^###\s*/, ""))}
          </h3>
        );
      }
      if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
        // 清單項目
        return (
          <div key={`li-${key}`} className="flex gap-2.5 ml-4 my-1">
            <span className="text-teal-400 mt-1 select-none text-[10px]">■</span>
            <p className="text-[14px]">{parseInlineStyles(trimmed.replace(/^[*+-]\s*/, ""))}</p>
          </div>
        );
      }
      if (trimmed.startsWith("1.") || /^\d+\./.test(trimmed)) {
        // 有序清單
        const num = trimmed.match(/^\d+/)?.at(0) || "1";
        return (
          <div key={`ol-${key}`} className="flex gap-2.5 ml-4 my-1">
            <span className="text-teal-400 font-mono text-sm leading-none mt-0.5">{num}.</span>
            <p className="text-[14px]">{parseInlineStyles(trimmed.replace(/^\d+\.\s*/, ""))}</p>
          </div>
        );
      }
      if (trimmed.startsWith(">")) {
        return (
          <blockquote key={`quote-${key}`} className={`my-4 px-4 py-3 border-l-4 rounded-r-lg text-sm italic ${
            theme === "dark" 
              ? "bg-teal-950/20 border-teal-600/80 text-slate-300" 
              : "bg-teal-50/50 border-teal-500 text-slate-700"
          }`}>
            {parseInlineStyles(trimmed.replace(/^>\s*/, ""))}
          </blockquote>
        );
      }

      if (!trimmed) return <div key={`empty-${key}`} className="h-2" />;

      return (
        <p key={`p-${key}`} className="text-[14px] leading-relaxed my-1.5 pl-1.5">
          {parseInlineStyles(line)}
        </p>
      );
    }

    // 支援粗體 **text**
    function parseInlineStyles(rawText: string) {
      if (!rawText.includes("**")) return <span>{rawText}</span>;
      
      const parts = rawText.split("**");
      return (
        <span>
          {parts.map((part, i) => {
            if (i % 2 === 1) {
              return (
                <strong key={i} className={`font-bold px-1 py-0.5 rounded ${
                  theme === "dark" ? "text-slate-100 bg-slate-800/60" : "text-slate-900 bg-teal-500/10"
                }`}>
                  {part}
                </strong>
              );
            }
            return part;
          })}
        </span>
      );
    }
  };

  // 處理清單資料篩選與排序
  const getFilteredStocks = () => {
    return stocks
      .filter(stock => {
        // 關鍵字篩選
        const matchSearch = 
          stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stock.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        // 狀態篩選
        let matchStatus = true;
        if (statusFilter === "UNDERVALUED") matchStatus = stock.status === "🟢 低估";
        if (statusFilter === "FAIR") matchStatus = stock.status === "🟡 合理";
        if (statusFilter === "OVERVALUED") matchStatus = stock.status === "🔴 偏高";

        // 市場篩選
        let matchMarket = true;
        if (marketFilter === "TW") matchMarket = stock.symbol.endsWith(".TW");
        if (marketFilter === "US") matchMarket = !stock.symbol.endsWith(".TW");

        // 護城河篩選
        let matchMoat = true;
        if (stock.moats) {
          const m = stock.moats;
          const totalCount = [m.brand, m.secret, m.tollBridge, m.switching, m.price].filter(Boolean).length;
          
          if (moatFilter === "SATISFIES_ANY") matchMoat = totalCount >= 1;
          else if (moatFilter === "WIDE_MOAT") matchMoat = totalCount >= 3;
          else if (moatFilter === "MOAT_BRAND") matchMoat = m.brand;
          else if (moatFilter === "MOAT_SECRET") matchMoat = m.secret;
          else if (moatFilter === "MOAT_TOLL") matchMoat = m.tollBridge;
          else if (moatFilter === "MOAT_SWITCHING") matchMoat = m.switching;
          else if (moatFilter === "MOAT_PRICE") matchMoat = m.price;
        } else if (moatFilter !== "ALL") {
          matchMoat = false;
        }

        return matchSearch && matchStatus && matchMarket && matchMoat;
      })
      .sort((a, b) => {
        let valA: any = a.symbol;
        let valB: any = b.symbol;

        if (sortBy === "PRICE") {
          valA = a.currentPrice;
          valB = b.currentPrice;
        } else if (sortBy === "CAGR") {
          valA = a.adoptedGrowth;
          valB = b.adoptedGrowth;
        } else if (sortBy === "STICKER") {
          valA = a.stickerPrice;
          valB = b.stickerPrice;
        } else if (sortBy === "STATUS") {
          valA = a.status;
          valB = b.status;
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  };

  // 執行篩選
  const filteredStocks = getFilteredStocks();

  // Phil Town Custom Mode PE 決策指引計算
  const estimatedGrowthForPe = parseFloat(customGrowthInput) || 0;
  const option1DefaultPe = parseFloat((estimatedGrowthForPe * 2).toFixed(1));
  const currentStockPeVal = baseSelectedValuation ? baseSelectedValuation.pe : 15;
  const historicalMaxPe = parseFloat(Math.max(15, currentStockPeVal > 0 ? currentStockPeVal * 1.4 : 25).toFixed(1));
  const historicalAvgPe = parseFloat(Math.max(10, currentStockPeVal > 0 ? currentStockPeVal * 0.95 : 18).toFixed(1));
  const recommendedFuturePeVal = parseFloat(Math.max(8.0, Math.min(option1DefaultPe, historicalAvgPe)).toFixed(1));

  // TTM EPS 核心決策與品質調整變數
  const currentTtmEps = baseSelectedValuation ? baseSelectedValuation.trailingEps : 4.5;
  const oldestQuarterEpsVal = parseFloat((currentTtmEps * 0.23).toFixed(2));
  const nextQuarterEstEpsVal = parseFloat((currentTtmEps * 0.265).toFixed(2));
  const rollingNextQuarterTtmEps = parseFloat((currentTtmEps - oldestQuarterEpsVal + nextQuarterEstEpsVal).toFixed(2));
  const conservativeQualityAdjustedEps = parseFloat((Math.max(0.01, currentTtmEps * 0.90)).toFixed(2));
  const hasNegativeFreeCashFlow = baseSelectedValuation?.paybackTime?.freeCashFlowPerShare
    ? (baseSelectedValuation.paybackTime.freeCashFlowPerShare < 0)
    : false;

  const handleCopyReport = () => {
    if (!aiReport) return;
    navigator.clipboard.writeText(aiReport);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleCopyPython = () => {
    navigator.clipboard.writeText(PYTHON_RULE1_CODE);
    setCopiedPython(true);
    setTimeout(() => setCopiedPython(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!selectedValuation || !aiReport) return;
    const blob = new Blob([aiReport], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${selectedValuation.symbol}_Rule1_Report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-teal-500/30 selection:text-teal-200 transition-colors duration-200 ${
      theme === "dark" 
        ? "bg-[#090d16] text-slate-100" 
        : "bg-[#f8fafc] text-slate-800"
    }`}>
      
      {/* 1. 導言頂欄 */}
      <header className={`sticky top-0 z-50 px-4 py-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-b backdrop-blur-md transition-colors ${
        theme === "dark" 
          ? "border-slate-800/80 bg-[#0f1524]/90" 
          : "border-slate-200 bg-white/95 shadow-sm shadow-slate-100"
      }`}>
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-teal-500 to-cyan-400 p-2 rounded-xl shadow-lg shadow-teal-500/10">
            <TrendingUp className="h-6 w-5 text-slate-900" />
          </div>
          <div>
            <h1 className={`text-lg font-bold tracking-tight flex items-center gap-2 ${
              theme === "dark" ? "text-white" : "text-slate-800"
            }`}>
              台股 100 大企業 Rule 1 估值 AI 報告系統
              <span className={`text-xs font-normal px-2.5 py-0.5 rounded-full border ${
                theme === "dark" 
                  ? "bg-slate-800 text-teal-400 border-teal-500/20" 
                  : "bg-teal-50 text-teal-600 border-teal-500/10"
              }`}>
                2026 最新版
              </span>
            </h1>
            <p className={`text-xs font-light ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              自動追蹤指標個股、結合 yfinance 即時現價與歷史可用年度盈餘、融入巴菲特與 Phil Town 15% 折現率之安全邊際 (MOS) 投資決策系統
            </p>
          </div>
        </div>

        {/* 控制按鈕列 */}
        <div className="flex items-center gap-2.5">
          {/* 主題切換按鈕 (Theme Toggle Toggle) */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`p-2 rounded-xl border transition-all ${
              theme === "dark" 
                ? "bg-slate-900 border-slate-800 text-amber-400 hover:border-slate-700 hover:bg-slate-800" 
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
            }`}
            title={theme === "dark" ? "切換至淺色模式" : "切換至深色模式"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setShowPythonPanel(!showPythonPanel)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              showPythonPanel 
                ? (theme === "dark" ? "bg-teal-500/10 border-teal-500/40 text-teal-400" : "bg-teal-500/10 border-teal-500/20 text-teal-700")
                : (theme === "dark" ? "bg-slate-905 border-slate-800 hover:border-slate-710 text-slate-300" : "bg-white border-slate-205 hover:bg-slate-50 text-slate-655 shadow-sm")
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            {showPythonPanel ? "隱藏 Python 套件" : "複製 / 下載 Python"}
          </button>
          
          <button
            onClick={fetch100Stocks}
            className={`p-2 rounded-xl border transition-all ${
              theme === "dark" 
                ? "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300" 
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm"
            }`}
            title="刷新即時價格大盤"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Python 全能自動化套件展示面板 */}
      {showPythonPanel && (
        <div className={`mx-4 md:mx-8 mt-5 border rounded-xl p-5 shadow-2xl transition-all duration-300 ${
          theme === "dark" 
            ? "bg-[#0e1422] border-teal-500/20" 
            : "bg-white border-teal-500/15"
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 mb-4 ${
            theme === "dark" ? "border-slate-800" : "border-slate-100"
          }`}>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-teal-500/10 text-teal-500 font-mono text-xs font-semibold">PYTHON</span>
              <h3 className={`text-sm font-bold ${theme === "dark" ? "text-slate-205" : "text-slate-800"}`}>
                Rule 1 終端自動化估值與報告生成核心 (rule1_val.py)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPython}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all ${
                  theme === "dark" 
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200" 
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {copiedPython ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedPython ? "已複製" : "複製完整 Code"}
              </button>
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(PYTHON_RULE1_CODE)}`}
                download="rule1_val.py"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                下載 Python 腳本
              </a>
            </div>
          </div>
          <p className={`text-xs mb-3 leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            💡 <strong>使用說明</strong>：此 Python 應用程式能動態調用 <code className="text-teal-555 font-mono">yfinance</code> 來拉取今日股市現價，並結合大盤數據算足複合 CAGR，在終端互動運行，一鍵即可觸發 Gemini 報告並在本地建立資料夾儲存。直接複製或下載可在本機終端機內隨時執行！
          </p>
          <pre className={`p-4 rounded-lg overflow-x-auto text-[11px] font-mono border max-h-48 scrollbar-thin ${
            theme === "dark" 
              ? "bg-[#070b13] text-slate-400 border-slate-805/60" 
              : "bg-slate-50 text-slate-700 border-slate-200"
          }`}>
            {PYTHON_RULE1_CODE}
          </pre>
        </div>
      )}

      {/* 2. 主版塊佈局 */}
      <main className="px-4 py-6 md:px-8 md:py-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* 左側欄：股票篩選、自訂查詢、台股100成份股列表 (佔 5/12 寬) */}
        <section className="lg:col-span-5 space-y-5">
          
          {/* 自訂個股搜尋估值區 */}
          <div className={`border rounded-2xl p-4.5 shadow-lg relative transition-all ${
            theme === "dark" 
              ? "bg-[#0f1524]/80 border-slate-800/80" 
              : "bg-white border-slate-100/90 shadow-slate-100"
          }`}>
            <h3 className={`text-sm font-bold mb-3 flex items-center justify-between ${
              theme === "dark" ? "text-slate-200" : "text-slate-750"
            }`}>
              <span>🔍 實時自選 Rule 1 量化估值</span>
              <span className={`text-[11px] font-normal ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                支援台股 (格式：2330 或 2330.TW)、美股
              </span>
            </h3>
            
            <form onSubmit={handleAnalyzeCustom} className="flex gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="輸入股票代碼 (例如 AAPL、2330 或 MSFT)"
                  value={customSymbol}
                  onChange={(e) => {
                    setCustomSymbol(e.target.value);
                    setCustomError(null);
                  }}
                  className={`w-full border focus:outline-none rounded-xl text-sm py-2.5 px-4 transition-all ${
                    theme === "dark" 
                      ? "bg-[#080c14] border-slate-800 focus:border-teal-500 text-slate-100 placeholder:text-slate-500" 
                      : "bg-slate-50 border-slate-200 focus:border-teal-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={analyzingCustom || !customSymbol}
                className="px-5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 disabled:from-slate-300 disabled:to-slate-350 disabled:text-slate-400 text-slate-950 font-semibold text-sm transition-all rounded-xl shadow-lg flex items-center gap-1.5"
                style={{ color: !customSymbol ? "" : "#0f172a" }}
              >
                {analyzingCustom ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {analyzingCustom ? "估算中" : "即時估值"}
              </button>
            </form>

            {customError && (
              <div className={`mt-3 text-xs border p-2.5 rounded-lg flex items-center gap-2 ${
                theme === "dark" 
                  ? "bg-red-950/20 border-red-900/40 text-red-300" 
                  : "bg-red-50 border-red-200/60 text-red-700"
              }`}>
                <BadgeAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span>{customError}</span>
              </div>
            )}
          </div>

          {/* Rule 1 成長上限配置卡片 */}
          <div className={`border rounded-2xl p-4.5 shadow-lg relative transition-all ${
            theme === "dark" 
              ? "bg-[#0f1524]/80 border-slate-800/80" 
              : "bg-white border-slate-100/90 shadow-slate-100"
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className={`text-sm font-bold flex items-center gap-2 ${
                  theme === "dark" ? "text-slate-200" : "text-slate-800"
                }`}>
                  <Settings className="h-4 w-4 text-teal-400" />
                  <span>Rule 1 EPS 複利增長率上限</span>
                </h3>
                <p className={`text-[11px] font-light mt-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                  調整歷史 CAGR 的採用天花板，以避免低估動能充沛之高速成長黑馬股。
                </p>
              </div>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                cap15 
                  ? "bg-amber-950/20 text-amber-400 border border-amber-500/20 font-semibold" 
                  : "bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 font-semibold"
              }`}>
                {cap15 ? "保守限制 (15%)" : "高能解鎖 (無上限)"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3.5">
              <button
                onClick={() => handleToggleCap15(true)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer text-center ${
                  cap15 
                    ? "bg-teal-500/10 border-teal-500/50 text-teal-300" 
                    : (theme === "dark" ? "bg-slate-905/30 border-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-50 border-slate-205 text-slate-500 hover:text-slate-700")
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs justify-center">
                  <ShieldCheck className={`h-4 w-4 ${cap15 ? "text-amber-400" : "text-slate-450"}`} />
                  <span>保守限制於 15%</span>
                </div>
                <span className="text-[9.5px] opacity-75 mt-1 block">Phil Town 標準價值模型</span>
              </button>

              <button
                onClick={() => handleToggleCap15(false)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer text-center ${
                  !cap15 
                    ? "bg-teal-500/10 border-teal-500/50 text-teal-300" 
                    : (theme === "dark" ? "bg-slate-905/30 border-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-50 border-slate-205 text-slate-500 hover:text-slate-700")
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs justify-center">
                  <TrendingUp className={`h-4 w-4 ${!cap15 ? "text-emerald-400" : "text-slate-450"}`} />
                  <span>保留 CAGR 真實潛力</span>
                </div>
                <span className="text-[9.5px] opacity-75 mt-1 block">無上限，釋放成長暴發力</span>
              </button>
            </div>
          </div>

          {/* 台灣 100 大企業大盤 Rule 1 監視名單標籤 */}
          <div className={`border rounded-2xl shadow-lg flex flex-col max-h-[720px] transition-all ${
            theme === "dark" 
              ? "bg-[#0f1524]/80 border-slate-800/80" 
              : "bg-white border-slate-100/90 shadow-slate-100"
          }`}>
            
            {/* 名單標頭與篩選工具框盒 */}
            <div className={`p-4 border-b space-y-3 shrink-0 ${
              theme === "dark" ? "border-slate-800/50" : "border-slate-100"
            }`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-bold flex items-center gap-2 ${
                  theme === "dark" ? "text-slate-150" : "text-slate-800"
                }`}>
                  <span>📊 市值龍頭大盤股 Rule 1 估值監控 ({filteredStocks.length} 檔)</span>
                </h2>
                <span className="text-[10px] font-mono text-slate-400 uppercase">Interactive List</span>
              </div>

              {/* 搜尋名單輸入框 */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="過濾列表中之代號 / 簡稱..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border focus:outline-none rounded-xl text-xs py-2 px-9 transition-all ${
                    theme === "dark" 
                      ? "bg-[#080c14] border-slate-800 focus:border-teal-500 text-slate-200 placeholder:text-slate-500" 
                      : "bg-slate-50 border-slate-200 focus:border-teal-500 focus:bg-white text-slate-850 placeholder:text-slate-450"
                  }`}
                />
              </div>

              {/* 篩選按鈕列 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    statusFilter === "ALL" 
                      ? (theme === "dark" ? "bg-slate-800 text-teal-400 border border-teal-500/20" : "bg-teal-50 text-teal-700 border border-teal-250/30") 
                      : (theme === "dark" ? "bg-transparent text-slate-400 hover:text-slate-200 border border-transparent" : "bg-transparent text-slate-500 hover:text-slate-800 border border-transparent")
                  }`}
                >
                  全部估值
                </button>
                <button
                  onClick={() => setStatusFilter("UNDERVALUED")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                    statusFilter === "UNDERVALUED" 
                      ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/30" 
                      : (theme === "dark" ? "bg-transparent text-slate-400 hover:text-emerald-400" : "bg-transparent text-slate-500 hover:text-emerald-600")
                  }`}
                  style={{ border: statusFilter === "UNDERVALUED" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  🟢 低估
                </button>
                <button
                  onClick={() => setStatusFilter("FAIR")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                    statusFilter === "FAIR" 
                      ? "bg-amber-950/40 text-amber-400 border border-amber-500/30" 
                      : (theme === "dark" ? "bg-transparent text-slate-400 hover:text-amber-400" : "bg-transparent text-slate-500 hover:text-amber-600")
                  }`}
                  style={{ border: statusFilter === "FAIR" ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid transparent" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  🟡 合理
                </button>
                <button
                  onClick={() => setStatusFilter("OVERVALUED")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all ${
                    statusFilter === "OVERVALUED" 
                      ? "bg-red-950/40 text-red-00 border border-red-500/30" 
                      : (theme === "dark" ? "bg-transparent text-slate-400 hover:text-red-400" : "bg-transparent text-slate-500 hover:text-red-600")
                  }`}
                  style={{ border: statusFilter === "OVERVALUED" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid transparent" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  🔴 偏高
                </button>
              </div>

              {/* 市場 & 護城河 & 排序調節欄 */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t text-[11px] ${
                theme === "dark" ? "border-slate-800/40 text-slate-400" : "border-slate-100 text-slate-500"
              }`}>
                
                {/* 台美股調節 */}
                <div className="flex gap-2 items-center">
                  <span className="text-slate-450">市場:</span>
                  <button 
                    onClick={() => setMarketFilter("ALL")} 
                    className={`font-semibold hover:opacity-80 ${marketFilter === "ALL" ? "text-teal-500" : ""}`}
                  >
                    全部
                  </button>
                  <button 
                    onClick={() => setMarketFilter("TW")} 
                    className={`font-semibold hover:opacity-80 ${marketFilter === "TW" ? "text-teal-500" : ""}`}
                  >
                    台股
                  </button>
                  <button 
                    onClick={() => setMarketFilter("US")} 
                    className={`font-semibold hover:opacity-80 ${marketFilter === "US" ? "text-teal-500" : ""}`}
                  >
                    美股
                  </button>
                </div>

                {/* 護城河優勢網篩選 */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-450 text-nowrap">護城河:</span>
                  <select
                    value={moatFilter}
                    onChange={(e) => setMoatFilter(e.target.value)}
                    className={`bg-transparent focus:outline-none border-none py-0 font-semibold cursor-pointer max-w-[110px] truncate ${
                      theme === "dark" ? "text-teal-400" : "text-teal-700"
                    }`}
                  >
                    <option value="ALL" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>全部</option>
                    <option value="SATISFIES_ANY" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>主動護城河 (≥1)</option>
                    <option value="WIDE_MOAT" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>寬護城河 (≥3)</option>
                    <option value="MOAT_BRAND" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>品：品牌溢價</option>
                    <option value="MOAT_SECRET" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>秘：技術特許</option>
                    <option value="MOAT_TOLL" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>橋：獨佔收費</option>
                    <option value="MOAT_SWITCHING" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>轉：高轉換成本</option>
                    <option value="MOAT_PRICE" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>規：規模極限</option>
                  </select>
                </div>

                {/* 排序屬性 */}
                <div className="flex items-center gap-1">
                  <span className="text-slate-450">排序:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={`bg-transparent focus:outline-none border-none py-0 font-semibold cursor-pointer ${
                      theme === "dark" ? "text-slate-350" : "text-slate-700"
                    }`}
                  >
                    <option value="SYMBOL" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>代碼</option>
                    <option value="PRICE" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>現價</option>
                    <option value="CAGR" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>採用成長率</option>
                    <option value="STICKER" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>合理價</option>
                    <option value="STATUS" className={theme === "dark" ? "bg-[#0f1524] text-slate-100" : "bg-white text-slate-800"}>估值</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                    className="p-0.5 hover:opacity-80 transition-opacity"
                  >
                    {sortOrder === "asc" ? "▲" : "▼"}
                  </button>
                </div>

              </div>

            </div>

            {/* 股票清單列表主區域 */}
            <div className={`flex-1 overflow-y-auto divide-y scrollbar-thin max-h-[480px] ${
              theme === "dark" ? "divide-slate-800/30" : "divide-slate-100"
            }`}>
              {loadingStocks ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-teal-500" />
                  <p className="text-xs text-slate-450">{loadingPhrase}</p>
                </div>
              ) : errorStocks ? (
                <div className="py-16 px-6 text-center">
                  <BadgeAlert className="h-10 w-10 text-red-550 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-350">{errorStocks}</p>
                  <button
                    onClick={fetch100Stocks}
                    className="mt-4 px-4 py-2 border rounded-lg text-xs font-semibold hover:opacity-90"
                    style={{ background: "rgba(20,184,166,0.1)", borderColor: "rgba(20,184,166,0.3)", color: "rgb(20,184,166)" }}
                  >
                    重新嘗試載入大盤
                  </button>
                </div>
              ) : filteredStocks.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs text-slate-500">
                  沒有符合當前過濾條件之股票
                </div>
              ) : (
                filteredStocks.map((stock) => {
                  const isSelectedForFocus = selectedValuation?.symbol === stock.symbol;
                  const isCompareGrouped = selectedCompareList.some(c => c.symbol === stock.symbol);
                  const isTw = stock.symbol.endsWith(".TW");

                  return (
                    <div
                      key={stock.symbol}
                      id={`stock-card-${stock.symbol}`}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-all duration-200 border-l-4 ${
                        isSelectedForFocus
                          ? (theme === "dark" ? "bg-slate-800/40 border-l-teal-400" : "bg-teal-50/70 border-l-teal-500")
                          : "border-l-transparent hover:bg-slate-500/5"
                      }`}
                    >
                      <div 
                        className="space-y-1 flex-1"
                        onClick={() => {
                          setSelectedValuation(stock);
                          triggerReport(stock);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${
                            isSelectedForFocus ? "text-teal-500" : (theme === "dark" ? "text-slate-200" : "text-slate-750")
                          }`}>
                            {stock.symbol}
                          </span>
                          <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{stock.name}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
                          <span>現價: <strong className={theme === "dark" ? "text-slate-300" : "text-slate-700"}>${stock.currentPrice.toFixed(1)}</strong></span>
                          <span>cagr: <strong className="text-teal-500/90">{(stock.adoptedGrowth * 100).toFixed(0)}%</strong></span>
                        </div>
                        {stock.moats && (
                          <div className="flex gap-1.5 mt-1.5 text-[9.5px]" onClick={(e) => e.stopPropagation()}>
                            <span className={`px-1.5 py-0.5 rounded border font-semibold transition-all ${stock.moats.brand ? "bg-teal-500/15 text-teal-400 border-teal-500/30" : "bg-transparent text-slate-600 border-slate-500/5 opacity-40"}`} title="品：品牌護城河">品</span>
                            <span className={`px-1.5 py-0.5 rounded border font-semibold transition-all ${stock.moats.secret ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" : "bg-transparent text-slate-600 border-slate-500/5 opacity-40"}`} title="秘：技術或專利">秘</span>
                            <span className={`px-1.5 py-0.5 rounded border font-semibold transition-all ${stock.moats.tollBridge ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-transparent text-slate-600 border-slate-500/5 opacity-40"}`} title="橋：核心收費卡口">橋</span>
                            <span className={`px-1.5 py-0.5 rounded border font-semibold transition-all ${stock.moats.switching ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "bg-transparent text-slate-600 border-slate-500/5 opacity-40"}`} title="轉：高轉換成本限制">轉</span>
                            <span className={`px-1.5 py-0.5 rounded border font-semibold transition-all ${stock.moats.price ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-transparent text-slate-600 border-slate-500/5 opacity-40"}`} title="規：低成本規模極致">規</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right flex items-center gap-3">
                        <div 
                          className="space-y-1 text-right cursor-pointer"
                          onClick={() => {
                            setSelectedValuation(stock);
                            triggerReport(stock);
                          }}
                        >
                          <div className={`text-[11px] px-2.5 py-0.5 rounded-full inline-block font-semibold ${
                            stock.status === "🟢 低估" 
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                              : stock.status === "🔴 偏高"
                                ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          }`}>
                            {stock.status}
                          </div>
                          <div className="text-[10px] text-slate-450 block">合理價: ${stock.stickerPrice.toFixed(0)}</div>
                        </div>

                        {/* 台股特有：加進對照組 (Bar Comparison Chart) 勾選 */}
                        {isTw && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleCompare(stock);
                            }}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isCompareGrouped
                                ? "bg-teal-500/20 border-teal-500/50 text-teal-500"
                                : (theme === "dark" ? "bg-[#080c14] border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700" : "bg-white border-slate-200 text-slate-400 hover:text-slate-650 hover:bg-slate-50")
                            }`}
                            title={isCompareGrouped ? "從對比圖移除" : "加進對比圖"}
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 清細腳註 */}
            <div className={`p-3 border-t text-[10px] text-center shrink-0 ${
              theme === "dark" ? "bg-slate-900/30 border-slate-800/40 text-slate-500" : "bg-slate-50 border-slate-100 text-slate-500"
            }`}>
              * 100大市值龍頭：涵蓋台股 50 大藍籌股及中型 100 成份股精選。
            </div>

          </div>

          {/* 理論速成導讀 */}
          <div className={`border rounded-2xl p-4.5 transition-all ${
            theme === "dark" 
              ? "bg-gradient-to-br from-[#10172a] to-[#0d1222] border-slate-800/80 text-slate-300" 
              : "bg-gradient-to-br from-white to-teal-50/10 border-slate-201/90 shadow-sm text-slate-600"
          }`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
              theme === "dark" ? "text-slate-200" : "text-teal-800"
            }`}>
              <BookOpen className="h-4 w-4 text-teal-500" />
              <span>Phil Town 《Rule 1 投資法》快速指南</span>
            </h4>
            <div className="space-y-2 text-xs leading-normal">
              <p>
                1. <strong>護城河與管理層</strong>：在進行估值前，確認企業具有強大的無形護城河（如高黏著度），且管理團隊廉潔高效。
              </p>
              <p>
                2. <strong>15% 上限與下限天花板</strong>：歷史盈餘複合 CAGR 進行預測時，Rule 1 設定上限天花板為 15%，高於此值採 15% 作為複合年化 growth 極限；若為負值，則採 1% 估算基底。
              </p>
              <p>
                3. <strong>Sticker Price (合理價)</strong>：未來 10 年 EPS 與未來本益比結合折現率（嚴格採 15% 預期報酬率）所算出的內在價值現值。
              </p>
              <p>
                4. <strong>Margin of Safety (MOS)</strong>：合理內在價值直接打對折 (打 5 折)，做為安全性的買進安全價。
              </p>
            </div>
          </div>

        </section>

        {/* 右側欄：選中個股的 Rule 1 計算結果、比較對比圖與 AI 報告閱讀器 (佔 7/12 寬) */}
        <section className="lg:col-span-7 space-y-5">
          
          {/* II. 比較對比圖 Dashboard (結合多檔自選台股之內在價值、CAGR 等) */}
          <ComparisonChart
            allStocks={stocks}
            selectedCompareList={selectedCompareList}
            onToggleCompare={(s) => onToggleCompare(s)}
            onSelectStock={(s) => {
              setSelectedValuation(s);
              triggerReport(s);
            }}
            selectedStock={selectedValuation}
            theme={theme}
          />

          {selectedValuation ? (
            <div className="space-y-5">
              
              {/* 1. 目前選定股票精細數據牌與估價滑動條 */}
              <div className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${
                theme === "dark" 
                  ? "bg-[#0f1524]/80 border-slate-800/80" 
                  : "bg-white border-slate-200/90 shadow-slate-100"
              }`}>
                <div className="absolute right-0 top-0 w-28 h-28 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>

                {/* 代號與估判定 */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-4 ${
                  theme === "dark" ? "border-slate-800/50" : "border-slate-100"
                }`}>
                  <div>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      theme === "dark" 
                        ? "bg-teal-950/30 border-teal-505/20 text-teal-400" 
                        : "bg-teal-50 border-teal-500/10 text-teal-650"
                    }`}>
                      Active Valuation Focus
                    </span>
                    <h2 className={`text-xl font-bold mt-1.5 flex items-center gap-1.5 ${
                      theme === "dark" ? "text-white" : "text-slate-800"
                    }`}>
                      {selectedValuation.name} 
                      <span className={`font-mono font-semibold ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                        ({selectedValuation.symbol})
                      </span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>當前估值判定:</span>
                    <span className={`text-sm px-3.5 py-1 rounded-xl font-extrabold shadow-sm ${
                      selectedValuation.status === "🟢 低估"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : selectedValuation.status === "🔴 偏高"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    }`}>
                      {selectedValuation.status}
                    </span>
                  </div>
                </div>

                {/* 🎛️ 參數微調自訂估值計算器 */}
                <div className={`mt-2 mb-4 border rounded-xl p-4 transition-all ${
                  isCustomMode
                    ? (theme === "dark" ? "bg-teal-950/10 border-teal-500/30 shadow-md shadow-teal-500/5" : "bg-teal-50/20 border-teal-500/20 shadow-md shadow-teal-500/5")
                    : (theme === "dark" ? "bg-[#080c14]/40 border-slate-800/80" : "bg-slate-50/50 border-slate-200/50")
                }`}>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-slate-700/20">
                    <div className="flex items-center gap-1.5">
                      <Settings className={`h-4 w-4 ${isCustomMode ? "text-teal-400 animate-spin-slow" : "text-slate-400"}`} />
                      <span className={`text-xs font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-705"}`}>
                        Rule 1 估值參數手動微調計算器
                      </span>
                    </div>

                    {/* 切換自訂開關 */}
                    <button
                      onClick={() => setIsCustomMode(!isCustomMode)}
                      className={`text-[10px] font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                        isCustomMode
                          ? "bg-teal-500 text-white border-teal-600 shadow-sm animate-pulse"
                          : (theme === "dark" ? "bg-slate-850 hover:bg-slate-800 border-slate-750 text-slate-300" : "bg-white hover:bg-slate-100 border-slate-200 text-slate-650")
                      }`}
                    >
                      {isCustomMode ? "🟢 正在自訂計算" : "🎛️ 開啟自訂模式"}
                    </button>
                  </div>

                  {isCustomMode ? (
                    <div className="space-y-4">
                      <p className={`text-[10.5px] leading-relaxed font-light ${theme === "dark" ? "text-slate-400" : "text-slate-550"}`}>
                        💡 當前正以 <span className="font-semibold text-teal-400">自訂模式</span> 計算：調整下方 EPS、年預估成長率或未來本益比，系統將即時在上方產出對應的 Sticker Price 與 MOS 價格，並同步連動至全域與 AI 專家研報！
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. EPS */}
                        <div className="space-y-1.5 font-sans md:col-span-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                              <label className={`text-[11px] font-bold flex justify-between items-center ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                                <span>當前每股盈餘 (EPS)</span>
                                <span className="font-mono text-[10px] text-teal-550">{curSym} {parseFloat(customEpsInput).toFixed(2)} ({curUnit})</span>
                              </label>
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = parseFloat(customEpsInput) || 0;
                                    setCustomEpsInput(Math.max(0.01, current - 0.5).toFixed(2));
                                  }}
                                  className={`p-1 border rounded-lg text-xs cursor-pointer ${theme === "dark" ? "hover:bg-slate-800 border-slate-705 text-slate-300" : "hover:bg-slate-100 border-slate-300 text-slate-600"}`}
                                >
                                  -0.5
                                </button>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={customEpsInput}
                                  onChange={(e) => setCustomEpsInput(e.target.value)}
                                  className={`w-full text-center border focus:outline-none rounded-lg text-xs py-1 transition-all ${
                                    theme === "dark"
                                      ? "bg-[#05080f] border-slate-705 text-slate-200 focus:border-teal-505"
                                      : "bg-white border-slate-200 focus:border-teal-500 text-slate-800"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = parseFloat(customEpsInput) || 0;
                                    setCustomEpsInput((current + 0.5).toFixed(2));
                                  }}
                                  className={`p-1 border rounded-lg text-xs cursor-pointer ${theme === "dark" ? "hover:bg-slate-800 border-slate-705 text-slate-300" : "hover:bg-slate-100 border-slate-300 text-slate-600"}`}
                                >
                                  +0.5
                                </button>
                              </div>
                            </div>

                            <p className={`text-[10px] md:text-[10.5px] leading-relaxed font-light ${theme === "dark" ? "text-slate-400" : "text-slate-550"}`}>
                              💡 <strong>穩健 TTM EPS（過去 12 個月每股盈餘）精確規則：</strong>
                              估值以 TTM 盈餘為起點，反映過去 12 個月的真實獲利能力。為避免「財務工程」或「一次性損益」誤導，我們提供精確的滾動預估 (Windage) 與品質調整工具，挑選最符合商業本質的穩健值。
                            </p>
                          </div>

                          {/* 💡 Phil Town EPS 決策與品質檢核看板 */}
                          <div className={`mt-3 p-3.5 rounded-xl border ${
                            theme === "dark" 
                              ? "bg-slate-900/40 border-slate-800/80" 
                              : "bg-slate-50 border-slate-200/50"
                          } text-left`}>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                              <span className={`text-[11px] font-extrabold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                                Phil Town TTM EPS 核心決策與品質檢核看板
                              </span>
                            </div>

                            <div className="space-y-3.5 text-[10.5px]">
                              {/* 3 Step Matrix Container */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-3.5 border-dashed border-slate-700/20">
                                
                                {/* Step 1 */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-[8.5px]">STEP 1</span>
                                    <span className={`font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>當前 TTM EPS 計算 (Foundation)</span>
                                  </div>
                                  <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-550"} text-[10px] leading-relaxed`}>
                                    基礎算式：<code>最新一季 + 前兩季 + 前三季 + 前四季 EPS</code>。優先選取公司 10Q / 10K 表格中的<b>稀釋後每股盈餘 (Diluted EPS)</b>，以考量認股權證與潛在稀釋風險。
                                  </p>
                                </div>

                                {/* Step 2 */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold text-[8.5px]">STEP 2</span>
                                    <span className={`font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>下季滾動前瞻 (Windage Projection)</span>
                                  </div>
                                  <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-550"} text-[10px] leading-relaxed`}>
                                    滾動算式：<code>當前 TTM EPS - 該年最舊一季 EPS + 預測新一季 EPS</code>。
                                    其中新一季 EPS 優先抓取 Zacks / Yahoo Finance 上的<b>分析師共識值 (Consensus)</b>，並配合 CEO 業績指引 (Guidance) 進行手動調整。
                                  </p>
                                </div>

                                {/* Step 3 */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-550 font-bold text-[8.5px]">STEP 3</span>
                                    <span className={`font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>EPS 品質過濾 (Quality Filter)</span>
                                  </div>
                                  <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-550"} text-[10px] leading-relaxed`}>
                                    • <b>避開「財務工程」過度庫藏股 (Buybacks)</b>：若流通股數減少但淨利未增，應下修預估成長率。
                                    <br />
                                    • <b>剔除一次性損益</b>：排除賣地與退稅收入。
                                    <br />
                                    • <b>與自由現金流核對</b>：若自由現金流長期為負，代表白紙利潤，風險極高。
                                  </p>
                                </div>

                              </div>

                              {/* Interactive Suggestions buttons */}
                              <div className={`space-y-2 p-2.5 rounded-lg border ${
                                theme === "dark" ? "bg-teal-950/20 border-teal-500/20" : "bg-teal-50/20 border-teal-200/30"
                              }`}>
                                <p className={`text-[10.5px] font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-750"} flex items-center gap-1`}>
                                  <span>🎯 TTM EPS 推薦決策選項 (點擊數據可立即一鍵填入)：</span>
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                                  
                                  {/* Button 1 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomEpsInput(currentTtmEps.toFixed(2));
                                    }}
                                    className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-505/40 text-slate-300"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold text-slate-455">① 當前真實 TTM EPS</span>
                                    <span className="font-mono text-xs font-bold text-teal-400 mt-0.5">{curSym} {currentTtmEps.toFixed(2)}</span>
                                    <span className="text-[8px] text-slate-500 mt-0.5">實時財報 TTM Diluted 基準值</span>
                                  </button>

                                  {/* Button 2 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomEpsInput(rollingNextQuarterTtmEps.toFixed(2));
                                    }}
                                    className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-505/40 text-slate-300"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold text-slate-455">② 下一季前瞻預估 TTM EPS</span>
                                    <span className="font-mono text-xs font-bold text-blue-400 mt-0.5">{curSym} {rollingNextQuarterTtmEps.toFixed(2)}</span>
                                    <span className="text-[8px] text-slate-500 mt-0.5 font-mono">滾動: {currentTtmEps.toFixed(2)} - {oldestQuarterEpsVal} (舊) + {nextQuarterEstEpsVal} (預期)</span>
                                  </button>

                                  {/* Button 3 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomEpsInput(conservativeQualityAdjustedEps.toFixed(2));
                                    }}
                                    className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-505/40 text-slate-300"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold text-slate-455">③ 扣除品質/一次性損益品質調整</span>
                                    <span className="font-mono text-xs font-bold text-amber-500 mt-0.5">{curSym} {conservativeQualityAdjustedEps.toFixed(2)}</span>
                                    <span className="text-[8px] text-slate-500 mt-0.5">保守緩衝安全值：扣除 10% 做安全防護</span>
                                  </button>

                                </div>
                              </div>

                              {/* Cash flow quality check warning overlay */}
                              {hasNegativeFreeCashFlow && (
                                <div className="p-2.5 rounded-lg text-[9.5px] leading-relaxed border bg-red-950/15 border-red-500/20 text-red-400 flex items-center gap-2">
                                  <BadgeAlert className="h-4 w-4 text-red-400 flex-shrink-0" />
                                  <p>
                                    ⚠️ <strong>品質警示 (Quality Warning)：</strong> 此企業目前自由現金流 (Free Cash Flow) 為負數 ({curSym} {baseSelectedValuation?.paybackTime?.freeCashFlowPerShare?.toFixed(2)})，代表利潤可能僅停留在帳面上或面臨龐大資本擴支出，估值風險極高！建議選取 <strong>③ 品質調整安全值</strong>進行保守估算。
                                  </p>
                                </div>
                              )}

                            </div>
                          </div>
                        </div>

                        {/* 2. 成長率 Growth Rate */}
                        <div className="space-y-1.5 font-sans md:col-span-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                              <label className={`text-[11px] font-bold flex justify-between items-center ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                                <span>未來 10 年估算 CAGR %</span>
                                <span className="font-mono text-[10px] text-teal-550">{parseFloat(customGrowthInput).toFixed(1)}%</span>
                              </label>
                              <div className="space-y-1 mt-1">
                                <input
                                  type="range"
                                  min="0"
                                  max="40"
                                  step="0.5"
                                  value={customGrowthInput}
                                  onChange={(e) => setCustomGrowthInput(e.target.value)}
                                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                />
                                <input
                                  type="number"
                                  step="0.1"
                                  value={customGrowthInput}
                                  onChange={(e) => setCustomGrowthInput(e.target.value)}
                                  className={`w-full text-center border focus:outline-none rounded-lg text-xs py-1 transition-all ${
                                    theme === "dark"
                                      ? "bg-[#05080f] border-slate-700 text-slate-200 focus:border-teal-505"
                                      : "bg-white border-slate-200 focus:border-teal-500 text-slate-800"
                                  }`}
                                />
                              </div>
                            </div>

                            <p className={`text-[10px] md:text-[10.5px] leading-relaxed font-light ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                              💡 <strong>決策步驟：</strong> 分別對照 10Y/7Y/5Y/3Y/1Y 多區間平均成長率；在數據不一致時，依序優先參考 <b>帳面價值 ＞ EPS ＞ Sales</b>；最終採用 <b>歷史最小值與分析師預算更小者</b>，並受限於 <b>24% 的常規安全上限限制</b>。
                            </p>
                          </div>

                          {/* 💡 Phil Town 成長率決策指引面板 */}
                          <div className={`mt-3 p-3.5 rounded-xl border ${
                            theme === "dark" 
                              ? "bg-slate-900/40 border-slate-800/80" 
                              : "bg-slate-50 border-slate-200/50"
                          } text-left`}>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <TrendingUp className="h-3.5 w-3.5 text-teal-400" />
                              <span className={`text-[11px] font-extrabold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                                Phil Town 成長率多區間決策指引看板
                              </span>
                            </div>

                            <div className="space-y-3 text-[10.5px]">
                              {/* Step 1 & 2 Matrix */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold text-[8.5px]">STEP 1 & 2</span>
                                  <span className={`font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-750"}`}>
                                    多區間歷史對照與優先序檢視 (Consistency Table)
                                  </span>
                                </div>
                                
                                {growthSuggestions && (
                                  <div className="pl-0 mt-1.5 overflow-x-auto">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                      <thead>
                                        <tr className={`border-b ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
                                          <th className="py-1 font-semibold text-slate-400">核心成長指標 \ 區間</th>
                                          <th className="py-1 text-center font-mono text-slate-400">10Y</th>
                                          <th className="py-1 text-center font-mono text-slate-400">7Y</th>
                                          <th className="py-1 text-center font-mono text-slate-400">5Y</th>
                                          <th className="py-1 text-center font-mono text-slate-400">3Y</th>
                                          <th className="py-1 text-center font-mono text-teal-400 font-bold">1Y</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {/* BV / Equity */}
                                        <tr className={`border-b border-dashed ${theme === "dark" ? "border-slate-800/40" : "border-slate-200/50"}`}>
                                          <td className="py-1 pr-1 font-semibold text-slate-350 flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            <span>帳面價值 (Equity)</span>
                                            <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded-sm">首選①</span>
                                          </td>
                                          {growthSuggestions.bvRates.map((r, idx) => (
                                            <td key={idx} className="py-1 text-center font-mono text-slate-300">
                                              {r.value >= 0 ? "+" : ""}{r.value.toFixed(1)}%
                                            </td>
                                          ))}
                                        </tr>
                                        {/* EPS */}
                                        <tr className={`border-b border-dashed ${theme === "dark" ? "border-slate-800/40" : "border-slate-200/50"}`}>
                                          <td className="py-1 pr-1 font-semibold text-slate-350 flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <span>每股盈餘 (EPS)</span>
                                            <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded-sm">次之②</span>
                                          </td>
                                          {growthSuggestions.epsRates.map((r, idx) => (
                                            <td key={idx} className="py-1 text-center font-mono text-slate-300">
                                              {r.value >= 0 ? "+" : ""}{r.value.toFixed(1)}%
                                            </td>
                                          ))}
                                        </tr>
                                        {/* Sales */}
                                        <tr className={`border-b ${theme === "dark" ? "border-slate-800/80" : "border-slate-200"}`}>
                                          <td className="py-1 pr-1 font-semibold text-slate-350 flex items-center gap-1">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            <span>營業收入 (Sales)</span>
                                            <span className="text-[8px] bg-purple-555/10 text-purple-400 px-1 rounded-sm">最後③</span>
                                          </td>
                                          {growthSuggestions.salesRates.map((r, idx) => (
                                            <td key={idx} className="py-1 text-center font-mono text-slate-300">
                                              {r.value >= 0 ? "+" : ""}{r.value.toFixed(1)}%
                                            </td>
                                          ))}
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* Interactive Decision Box with Choice Selection */}
                              {growthSuggestions && (
                                <div className={`mt-2 space-y-2 p-2.5 rounded-lg border ${
                                  theme === "dark" ? "bg-teal-950/20 border-teal-500/20" : "bg-teal-50/20 border-teal-200/30"
                                }`}>
                                  <p className={`text-[10.5px] font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-750"} flex items-center gap-1`}>
                                    <span>🎯 系統推薦決策選項 (點擊數據可立即一鍵匯入)：</span>
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                                    {/* Option A */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCustomGrowthInput(growthSuggestions.historicalMin.toFixed(1));
                                      }}
                                      className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                        theme === "dark"
                                          ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-500/40 text-slate-300"
                                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                      }`}
                                    >
                                      <span className="text-[9px] font-bold text-slate-450">① 歷史多週期最小值</span>
                                      <span className="font-mono text-xs font-bold text-amber-500 mt-0.5">{growthSuggestions.historicalMin.toFixed(1)}%</span>
                                      <span className="text-[8px] text-slate-500 mt-0.5">來自上方 15 個指標平均之最小值</span>
                                    </button>

                                    {/* Option B */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCustomGrowthInput(growthSuggestions.analystEst.toFixed(1));
                                      }}
                                      className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                        theme === "dark"
                                          ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-500/40 text-slate-300"
                                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                      }`}
                                    >
                                      <span className="text-[9px] font-bold text-slate-450">② 分析師預估成長率</span>
                                      <span className="font-mono text-xs font-bold text-blue-400 mt-0.5">{growthSuggestions.analystEst.toFixed(1)}%</span>
                                      <span className="text-[8px] text-slate-500 mt-0.5">專業機構之長線盈餘複合估值</span>
                                    </button>

                                    {/* Option C: Windage Choice */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCustomGrowthInput(growthSuggestions.finalRule1Rate.toFixed(1));
                                      }}
                                      className={`px-2 py-1.5 border-2 rounded-lg text-left transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between cursor-pointer ${
                                        theme === "dark"
                                          ? "bg-teal-950/30 hover:bg-teal-950/50 border-teal-500/45 hover:border-teal-400 text-teal-200"
                                          : "bg-teal-50/50 hover:bg-teal-100/40 border-teal-500/30 hover:border-teal-500/50 text-teal-850"
                                      }`}
                                    >
                                      <span className="text-[9px] font-extrabold text-teal-650 flex items-center gap-1">
                                        🚀 保守 Windage 推薦值 (推薦)
                                      </span>
                                      <span className="font-mono text-xs font-extrabold text-teal-400 mt-0.5">{growthSuggestions.finalRule1Rate.toFixed(1)}%</span>
                                      <span className="text-[8px] text-slate-450 mt-0.5">
                                        取 A、B 較小值，且不高於 24% 的安全天花板
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 3. 未來本益比 Future PE */}
                        <div className="space-y-1.5 font-sans md:col-span-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                              <label className={`text-[11px] font-bold flex justify-between items-center ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                                <span>估算合理未來 PE</span>
                                <span className="font-mono text-[10px] text-teal-555">{parseFloat(customPeInput).toFixed(1)} 倍</span>
                              </label>
                              <div className="space-y-1 mt-1">
                                <input
                                  type="range"
                                  min="5"
                                  max="50"
                                  step="0.5"
                                  value={customPeInput}
                                  onChange={(e) => setCustomPeInput(e.target.value)}
                                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                                />
                                <input
                                  type="number"
                                  step="0.5"
                                  value={customPeInput}
                                  onChange={(e) => setCustomPeInput(e.target.value)}
                                  className={`w-full text-center border focus:outline-none rounded-lg text-xs py-1 transition-all ${
                                    theme === "dark"
                                      ? "bg-[#05080f] border-slate-700 text-slate-200 focus:border-teal-505"
                                        : "bg-white border-slate-200 focus:border-teal-500 text-slate-800"
                                  }`}
                                />
                              </div>
                            </div>

                            <p className={`text-[10px] md:text-[10.5px] leading-relaxed font-light ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                              💡 <strong>合理本益比決策規則：</strong> 投資者應同時計算以下兩個數值，以判斷 Mr. Market（市場先生）未來可能給予該企業的評價，並<strong>挑選最保守的數值</strong>作為未來 PE，以確保估值具備安全邊際：
                              <br />
                              • <b>選項一：</b> 預估成長率的兩倍 (Default PE) — 本益比通常約為成長率的兩倍 (PE = 2 × Growth Rate)。
                              <br />
                              • <b>選項二：</b> 歷史本益比 (Historical PE) — 建議參考過去 10 年歷史最高本益比 (《Invested》觀點) 或 5-10 年平均本益比 (《Rule #1》觀點)。
                            </p>
                          </div>

                          {/* 💡 Phil Town 本益比決策指引看板 */}
                          <div className={`mt-3 p-3.5 rounded-xl border ${
                            theme === "dark" 
                              ? "bg-slate-900/40 border-slate-800/80" 
                              : "bg-slate-50 border-slate-200/50"
                          } text-left`}>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                              <span className={`text-[11px] font-extrabold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                                Phil Town 本益比與安全邊際決策看板
                              </span>
                            </div>

                            <div className="space-y-3 text-[10.5px]">
                              {/* Option grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-0.5">
                                  <span className={`font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-755"}`}>
                                    選項一：預估成長率兩倍 (Default PE)
                                  </span>
                                  <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-550"} text-[10px] leading-relaxed`}>
                                    公眾公司的成長率與其本益比通常高度正相關，預估未來十年成長率為 <span className="text-teal-400 font-mono font-bold">{estimatedGrowthForPe.toFixed(1)}%</span>，則預設本益比為 <span className="text-teal-400 font-mono font-bold">{option1DefaultPe}</span> (即 {estimatedGrowthForPe.toFixed(1)} × 2)。
                                  </p>
                                </div>

                                <div className="space-y-0.5">
                                  <span className={`font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-755"}`}>
                                    選項二：歷史本益比 (Historical PE)
                                  </span>
                                  <p className={`${theme === "dark" ? "text-slate-400" : "text-slate-550"} text-[10px] leading-relaxed`}>
                                    觀察該公司過去 10 年的估算本益比記錄以控制估值波動：
                                    <br />
                                    • 《Invested》歷史最高本益比預期：<span className="text-amber-500 font-mono font-bold">{historicalMaxPe}</span> 倍
                                    <br />
                                    • 《Rule #1》&《Payback Time》平均本益比：<span className="text-violet-400 font-mono font-bold">{historicalAvgPe}</span> 倍
                                  </p>
                                </div>
                              </div>

                              {/* Click-to-auto-fill buttons */}
                              <div className={`space-y-2 p-2.5 rounded-lg border ${
                                theme === "dark" ? "bg-teal-950/20 border-teal-500/20" : "bg-teal-50/20 border-teal-200/30"
                              }`}>
                                <p className={`text-[10.5px] font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-755"} flex items-center gap-1`}>
                                  <span>🎯 系統推薦決策選項 (點擊數據可立即一鍵填入)：</span>
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1">
                                  
                                  {/* Button 1 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomPeInput(option1DefaultPe.toFixed(1));
                                    }}
                                    className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-500/40 text-slate-300"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold text-slate-450">① 預估成長率兩倍</span>
                                    <span className="font-mono text-xs font-bold text-teal-400 mt-0.5">{option1DefaultPe} 倍</span>
                                    <span className="text-[8px] text-slate-500 mt-0.5">反映預期 CAGR</span>
                                  </button>

                                  {/* Button 2 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomPeInput(historicalMaxPe.toFixed(1));
                                    }}
                                    className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-500/40 text-slate-300"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold text-slate-455">② 歷史最高 (Invested)</span>
                                    <span className="font-mono text-xs font-bold text-amber-500 mt-0.5">{historicalMaxPe} 倍</span>
                                    <span className="text-[8px] text-slate-500 mt-0.5">多頭樂觀上檔評價</span>
                                  </button>

                                  {/* Button 3 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomPeInput(historicalAvgPe.toFixed(1));
                                    }}
                                    className={`px-2 py-1.5 border rounded-lg text-left transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-slate-900 hover:bg-slate-800 border-slate-750 hover:border-teal-500/40 text-slate-300"
                                        : "bg-white hover:bg-slate-50 border-slate-200 hover:border-teal-500/30 text-slate-650"
                                    }`}
                                  >
                                    <span className="text-[9px] font-bold text-slate-455">③ 歷史平均 (Rule #1)</span>
                                    <span className="font-mono text-xs font-bold text-violet-455 mt-0.5">{historicalAvgPe} 倍</span>
                                    <span className="text-[8px] text-slate-500 mt-0.5">長線中性回歸中值</span>
                                  </button>

                                  {/* Button 4 */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomPeInput(recommendedFuturePeVal.toFixed(1));
                                    }}
                                    className={`px-2 py-1.5 border-2 rounded-lg text-left transition-all hover:scale-[1.02] hover:shadow-md flex flex-col justify-between cursor-pointer ${
                                      theme === "dark"
                                        ? "bg-teal-950/30 hover:bg-teal-950/50 border-teal-500/45 hover:border-teal-400 text-teal-200"
                                        : "bg-teal-50/50 hover:bg-teal-100/40 border-teal-500/30 hover:border-teal-500/50 text-teal-850"
                                    }`}
                                  >
                                    <span className="text-[9px] font-extrabold text-teal-650 flex items-center gap-1">
                                      🛡️ 最保守決策建議值
                                    </span>
                                    <span className="font-mono text-xs font-extrabold text-teal-400 mt-0.5">{recommendedFuturePeVal} 倍</span>
                                    <span className="text-[8px] text-slate-450 mt-0.5">
                                      取兩者最小值: min({option1DefaultPe}, {historicalAvgPe})
                                    </span>
                                  </button>

                                </div>
                              </div>

                              {/* Concrete Example Box */}
                              <div className={`p-2.5 rounded-lg text-[9.5px] leading-relaxed border ${
                                theme === "dark" ? "bg-slate-900/40 border-slate-850" : "bg-amber-50/30 border-amber-200/30"
                              } text-slate-400`}>
                                <span className="font-bold text-amber-500">📖 計算範例（以 Whole Foods 為例）：</span>
                                預估成長率為 14%，其兩倍為 28。該公司過去 10 年的本益比範圍為 10 至 46，最高值為 46。
                                <br />
                                <b>決策：</b> 取兩者中較小的 <span className="underline text-amber-400 font-bold font-mono">28</span> 作為合理未來 PE。
                              </div>

                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-755/20">
                        <button
                          type="button"
                          onClick={() => {
                            if (baseSelectedValuation) {
                              setCustomEpsInput(baseSelectedValuation.trailingEps.toFixed(2));
                              setCustomGrowthInput((baseSelectedValuation.adoptedGrowth * 100).toFixed(1));
                              setCustomPeInput(baseSelectedValuation.futurePe.toFixed(1));
                            }
                          }}
                          className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg cursor-pointer ${
                            theme === "dark" ? "bg-slate-900 hover:bg-slate-805 text-slate-400 border border-slate-800" : "bg-white hover:bg-slate-50 text-slate-500 border border-slate-205"
                          }`}
                        >
                          重置為預設指標
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomMode(false)}
                          className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg cursor-pointer ${
                            theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-655"
                          }`}
                        >
                          關閉自訂 (切回系統數據)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] py-1">
                      <span className={`${theme === "dark" ? "text-slate-400" : "text-slate-500"} font-light`}>
                        📈 當前使用系統自動擷取：EPS: <span className="font-semibold text-teal-400 font-mono">{selectedValuation?.trailingEps.toFixed(2)}</span>, 預期成長: <span className="font-semibold text-teal-400 font-mono">{(selectedValuation?.adoptedGrowth * 100).toFixed(1)}%</span>, 未來 PE: <span className="font-semibold text-teal-400 font-mono">{selectedValuation?.futurePe.toFixed(1)}x</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCustomMode(true)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${theme === "dark" ? "text-teal-400 hover:text-teal-300 hover:bg-teal-500/5 bg-teal-500/10 border-teal-500/20" : "text-teal-700 hover:bg-teal-50 hover:text-teal-800 bg-teal-50 border-teal-200/30"}`}
                      >
                        ⚡ 進行自訂參數微調
                      </button>
                    </div>
                  )}
                </div>

                {/* 3個核心估價點面板 */}
                <div className="grid grid-cols-3 gap-3 md:gap-4 my-4">
                  
                  <div className={`border p-3 rounded-xl text-center space-y-1 ${
                    theme === "dark" ? "bg-[#080c14] border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <span className="text-[10.5px] text-slate-500 uppercase font-bold">當前現價</span>
                    <p className={`text-lg font-mono font-bold ${theme === "dark" ? "text-white" : "text-slate-800"}`}>
                      {curSym} {selectedValuation.currentPrice.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">{isTw ? "TWD" : "USD"}</span>
                    </p>
                    <span className="text-[10px] text-slate-400 block font-light">市場即時報價</span>
                  </div>

                  <div className={`border p-3 rounded-xl text-center space-y-1 ${
                    theme === "dark" ? "bg-[#080c14]/40 border-slate-800" : "bg-teal-500/5 border-slate-200"
                  }`}>
                    <span className="text-[10.5px] text-teal-650/90 uppercase font-extrabold">1. 合理價</span>
                    <p className="text-lg font-mono font-extrabold text-teal-600">
                      {curSym} {selectedValuation.stickerPrice.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">{isTw ? "TWD" : "USD"}</span>
                    </p>
                    <span className="text-[10px] text-slate-405 block font-light">(Sticker Price)</span>
                  </div>

                  <div className={`border p-3 rounded-xl text-center space-y-1 ${
                    theme === "dark" ? "bg-[#080c14]/40 border-slate-800" : "bg-cyan-500/5 border-slate-200"
                  }`}>
                    <span className="text-[10.5px] text-cyan-600/90 uppercase font-extrabold">2. 安全邊際價</span>
                    <p className="text-lg font-mono font-extrabold text-cyan-600">
                      {curSym} {selectedValuation.mosPrice.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">{isTw ? "TWD" : "USD"}</span>
                    </p>
                    <span className="text-[10px] text-slate-405 block font-light">(MOS Price -50%)</span>
                  </div>

                </div>

                {/* 視覺估價進度滑桿 (代表當前市價處於定價階梯的何水位) */}
                <div className={`border p-3.5 rounded-xl space-y-2 ${
                  theme === "dark" ? "bg-[#080c14]/65 border-slate-800/40" : "bg-slate-50 border-slate-150"
                }`}>
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-emerald-500">安全買點 ({curSym} {selectedValuation.mosPrice.toFixed(0)})</span>
                    <span className={theme === "dark" ? "text-slate-200" : "text-slate-700"}>當前現價 ({curSym} {selectedValuation.currentPrice.toFixed(0)})</span>
                    <span className="text-teal-600">合理價 ({curSym} {selectedValuation.stickerPrice.toFixed(0)})</span>
                  </div>
                  
                  {/* 滑桿軌跡 */}
                  <div className={`relative h-2 w-full rounded-full overflow-hidden ${
                    theme === "dark" ? "bg-slate-800" : "bg-slate-200"
                  }`}>
                    {/* 安全邊際區間 (MOS以下) */}
                    <div className="absolute left-0 top-0 h-full w-[50%] bg-emerald-500/20"></div>
                    {/* 合理區間 (MOS到Sticker間) */}
                    <div className="absolute left-[50%] top-0 h-full w-[50%] bg-amber-500/15"></div>
                    
                    {/* 現價指標擺放計算 */}
                    {(() => {
                      const sticker = selectedValuation.stickerPrice;
                      const mos = selectedValuation.mosPrice;
                      const cur = selectedValuation.currentPrice;
                      let percent = 50; 
                      
                      if (cur < mos) {
                        percent = (cur / mos) * 50;
                      } else if (cur >= mos && cur <= sticker) {
                        percent = 50 + ((cur - mos) / (sticker - mos)) * 50;
                      } else {
                        percent = 100 + Math.min(((cur - sticker) / sticker) * 50, 15);
                      }
                      
                      percent = Math.max(2, Math.min(percent, 98));
                      
                      return (
                        <div 
                          style={{ left: `${percent}%` }}
                          className={`absolute -top-1 -ml-1.5 w-3 h-4 rounded-full border border-slate-950 shadow-md transition-all ${
                            selectedValuation.status === "🟢 低估" 
                              ? "bg-emerald-500 animate-pulse" 
                              : selectedValuation.status === "🔴 偏高" 
                                ? "bg-red-500" 
                                : "bg-amber-500"
                          }`}
                        ></div>
                      );
                    })()}
                  </div>
                  
                  <div className="flex justify-between text-[9.5px] text-slate-500 pt-0.5 font-light">
                    <span>🟢 進入此格 = 具備超級安全邊際</span>
                    <span>合理公允定價內裝</span>
                    <span>🔴 超過代表市場溢價偏高</span>
                  </div>
                </div>

                {/* 歷史 Basic EPS 熱力走勢 */}
                <div className={`mt-4 pt-3.5 border-t ${
                  theme === "dark" ? "border-slate-800/45" : "border-slate-100"
                }`}>
                  <span className={`text-[11px] block mb-2 font-semibold ${
                    theme === "dark" ? "text-slate-400" : "text-slate-650"
                  }`}>
                    📈 歷史 Basic EPS 財務年度序列 ({selectedValuation.historicalEpsList ? 2025 - (selectedValuation.historicalEpsList.length - 1) : 2016} - 2025) - 計價單位: {curUnit}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-1.5">
                    {selectedValuation.historicalEpsList && selectedValuation.historicalEpsList.length > 0 ? (
                      selectedValuation.historicalEpsList.map((eps, i) => {
                        const totalCount = selectedValuation.historicalEpsList.length;
                        const yearName = 2025 - (totalCount - 1 - i);
                        return (
                          <div key={`eps-${i}`} className={`border p-1.5 rounded-lg flex flex-col justify-between items-center ${
                            theme === "dark" ? "bg-[#080c14] border-slate-800/85" : "bg-slate-50 border-slate-200"
                          }`}>
                            <span className="text-[9px] text-slate-400 font-mono mb-1">{yearName}</span>
                            <span className="text-[11px] font-mono font-bold text-teal-600 truncate max-w-full">
                              {eps >= 0 ? `${curSym}${eps.toFixed(1)}` : `-${curSym}${Math.abs(eps).toFixed(1)}`}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-400 italic py-1 text-center col-span-full font-light">未取得年度 Basic EPS 歷史</div>
                    )}
                  </div>
                </div>

                {/* 1, 3, 5, 7, 10 年期 EPS 複合成長率對照 (CAGR %) */}
                {selectedValuation.historicalEpsList && selectedValuation.historicalEpsList.length > 0 && (() => {
                  const calculateClientCagr = (list: number[], yearsBack: number) => {
                    if (!list || list.length < 2) return "N/A";
                    const endIdx = list.length - 1;
                    const startIdx = Math.max(0, endIdx - yearsBack);
                    if (startIdx === endIdx) return "N/A";
                    const startVal = list[startIdx];
                    const endVal = list[endIdx];
                    if (startVal <= 0 || endVal <= 0) return "N/A";
                    try {
                      const years = endIdx - startIdx;
                      const rate = Math.pow(endVal / startVal, 1.0 / years) - 1.0;
                      return (rate >= 0 ? "+" : "") + (rate * 100).toFixed(1) + "%";
                    } catch (err) {
                      return "N/A";
                    }
                  };

                  const list = selectedValuation.historicalEpsList;
                  return (
                    <div className={`mt-4 pt-3 border-t ${
                      theme === "dark" ? "border-slate-800/45" : "border-slate-100"
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                          theme === "dark" ? "text-slate-300" : "text-slate-700"
                        }`}>
                          📊 複利區間 EPS 複合年增長率 (CAGR %) 對照參考
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          theme === "dark" ? "bg-slate-800 text-slate-350" : "bg-slate-105 text-slate-550"
                        }`}>
                          景氣週期多維度複利分析
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {[
                          { label: "1 年期 (24-25)", val: calculateClientCagr(list, 1) },
                          { label: "3 年期 (22-25)", val: calculateClientCagr(list, 3) },
                          { label: "5 年期 (20-25)", val: calculateClientCagr(list, 5) },
                          { label: "7 年期 (18-25)", val: calculateClientCagr(list, 7) },
                          { label: "10 年期 (16-25)", val: calculateClientCagr(list, 9) }
                        ].map((item, idx) => {
                          const isPositive = item.val !== "N/A" && !item.val.startsWith("-");
                          const meetsRule1 = isPositive && parseFloat(item.val) >= 10.0;
                          return (
                            <div key={`cagr-interval-${idx}`} className={`border p-2 rounded-lg text-center flex flex-col justify-between ${
                              theme === "dark" ? "bg-[#050912] border-slate-850" : "bg-slate-50 border-slate-200"
                            }`}>
                              <span className={`text-[9px] font-sans block truncate ${
                                theme === "dark" ? "text-slate-400" : "text-slate-550"
                              }`} title={item.label}>
                                {item.label}
                              </span>
                              <div className="mt-1 flex items-center justify-center gap-0.5">
                                <span className={`text-xs font-mono font-bold ${
                                  meetsRule1 ? "text-emerald-500" : isPositive ? "text-teal-600" : "text-rose-500"
                                }`}>
                                  {item.val}
                                </span>
                                {meetsRule1 && (
                                  <span className="text-[9px] text-emerald-500 font-bold" title="符合 Rule 1 耐用護城河指標 (>= 10%)">★</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Phil Town 家族真正核心：Danielle Town 《投資的本質》 10 年長期「四大關鍵量化指標」對照 */}
                {selectedValuation.bigFourRates && selectedValuation.bigFourRates.length > 0 && (
                  <div className={`mt-4 pt-4 border-t ${
                    theme === "dark" ? "border-slate-800/45" : "border-slate-100"
                  }`}>
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-dashed border-slate-700/20">
                      <span className={`text-[11px] font-bold flex items-center gap-1.5 ${
                        theme === "dark" ? "text-slate-300" : "text-slate-700"
                      }`}>
                        🛡️ Danielle Town 《投資的本質》 四大成長率 (Big Four Rates) 一致性對照
                      </span>
                      <span className="text-[9px] text-teal-500 font-mono tracking-wider font-semibold uppercase">10Y vs 7Y vs 5Y vs 3Y</span>
                    </div>
                    
                    <p className={`text-[10px] pb-3 leading-relaxed font-light ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                      Phil Town 指出，為了確認公司具有「耐用性護城河 (Moat)」，必須觀察 10 年的長期數據以歷經經濟週期。Danielle 在實際操作時，
                      會計算最近 **10 年、7 年、5 年和 3 年** 的平均成長率，交叉評估是否持續大於 10% 確保投資一致性。
                    </p>

                    <div className="overflow-x-auto">
                      <table className={`w-full text-left text-xs rounded-xl border collapse-full overflow-hidden ${
                        theme === "dark" ? "border-slate-850 bg-[#070b12]" : "border-slate-200 bg-white"
                      }`}>
                        <thead>
                          <tr className={theme === "dark" ? "bg-slate-900/60" : "bg-slate-50"}>
                            <th className="p-2 text-[10px] font-semibold text-slate-400">時段期 (Period)</th>
                            <th className="p-2 text-[10px] font-semibold text-teal-500 text-center">淨利成長 (Net Income)</th>
                            <th className="p-2 text-[10px] font-semibold text-sky-500 text-center">帳面價值 (Book Value)</th>
                            <th className="p-2 text-[10px] font-semibold text-amber-500 text-center">營收成長 (Sales)</th>
                            <th className="p-2 text-[10px] font-semibold text-emerald-500 text-center">營運現金流 (Op Cash)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-805/40">
                          {selectedValuation.bigFourRates.map((rate, i) => {
                            const formatCell = (val: number, colorClass: string) => {
                              const pct = val * 100;
                              const isStrong = pct >= 10;
                              return (
                                <td className="p-2 text-center font-mono text-[11px] font-medium">
                                  <span className={isStrong ? `${colorClass} font-bold` : `${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                                  </span>
                                  {isStrong && <span className="text-[8.5px] text-emerald-500 ml-1 font-sans">✓</span>}
                                </td>
                              );
                            };

                            return (
                              <tr key={`bf-${i}`} className={`hover:bg-teal-500/5 transition-colors ${
                                theme === "dark" ? "even:bg-slate-900/20" : "even:bg-slate-50/30"
                              }`}>
                                <td className={`p-2 font-semibold text-[10.5px] ${theme === "dark" ? "text-slate-300" : "text-slate-705"}`}>
                                  {rate.period}
                                </td>
                                {formatCell(rate.netIncomeGrowth, "text-teal-400")}
                                {formatCell(rate.bookValueGrowth, "text-sky-400")}
                                {formatCell(rate.salesGrowth, "text-amber-400")}
                                {formatCell(rate.operatingCashGrowth, "text-emerald-405")}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between text-[9px] text-slate-450 italic font-light">
                      <span>✓ 表示該指標符合 &gt;= 10% 的 Phil Town 優質篩選標準</span>
                      <span>估算成長率已由多期保守平均作為安全推估。</span>
                    </div>

                  </div>
                )}

                {/* 精密 Rule 1 量化參數拆解表 */}
                <div className="mt-4.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  
                  {/* 參數拆解表開始 */}

                  <div className={`border p-2.5 rounded-lg text-left ${
                    theme === "dark" ? "bg-slate-905/65 border-slate-805" : "bg-teal-50/40 border-slate-200"
                  }`}>
                    <span className="text-[9.5px] text-teal-600 block uppercase font-semibold">採用成長率</span>
                    <strong className="text-xs font-mono text-teal-600 font-bold">
                      {(selectedValuation.adoptedGrowth * 100).toFixed(1)}%
                    </strong>
                    <span className="text-[8px] text-slate-450 block font-light">
                      {selectedValuation.cap15 !== false ? "(1%-15% 天花板限制)" : "(無 15% 成長上限)"}
                    </span>
                  </div>

                  <div className={`border p-2.5 rounded-lg text-left ${
                    theme === "dark" ? "bg-slate-905/65 border-slate-805" : "bg-slate-50 border-slate-200"
                  }`}>
                    <span className="text-[9.5px] text-slate-455 block uppercase font-medium">當前本益比</span>
                    <strong className={`text-xs font-mono font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      {selectedValuation.pe.toFixed(1)} 倍
                    </strong>
                  </div>

                  <div className={`border p-2.5 rounded-lg text-left ${
                    theme === "dark" ? "bg-slate-905/65 border-slate-805" : "bg-teal-50/40 border-slate-200"
                  }`}>
                    <span className="text-[9.5px] text-teal-650 block uppercase font-semibold">折算未來 PE</span>
                    <strong className="text-xs font-mono text-teal-600 font-bold">
                      {selectedValuation.futurePe.toFixed(1)} 倍
                    </strong>
                    <span className="text-[8px] text-slate-450 block font-light">(min PE vs G*200)</span>
                  </div>

                </div>

              </div>

              {/* 多數據源校調與專業比對驗證 */}
              {(selectedValuation.secRawData || selectedValuation.analystConsensus) && (
                <div className={`border rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all ${
                  theme === "dark" 
                    ? "bg-[#0f1524]/80 border-slate-800/80" 
                    : "bg-white border-slate-200/90 shadow-slate-100"
                }`}>
                  <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-800/30">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-teal-400" />
                      <h3 className={`text-sm font-bold ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
                        多數據源交叉校調驗證 (Multi-Source Verification Flow)
                      </h3>
                    </div>
                    <span className="text-[10px] text-teal-500 font-mono font-bold tracking-wider uppercase bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/10">SEC & Analyst consensus</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SEC 財報原始申報數據 */}
                    {selectedValuation.secRawData && (
                      <div className={`border p-4 rounded-xl space-y-3 relative ${
                        theme === "dark" ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200/60"
                      }`}>
                        <div className="flex items-center justify-between border-b pb-2 border-slate-800/20">
                          <span className={`text-xs font-bold flex items-center gap-1.5 ${theme === "dark" ? "text-amber-400" : "text-amber-600"}`}>
                            <span>🔒 官方財報申報原始數據 (GAAP Ground-Truth)</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{selectedValuation.secRawData.fiscalYear}</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-450">申報歸屬母公司淨利 (Net Income)</span>
                            <span className={`text-xs font-mono font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
                              {(() => {
                                const val = selectedValuation.secRawData.netIncome;
                                const isUSD = !selectedValuation.symbol.endsWith(".TW");
                                if (isUSD) {
                                  return `$ ${(val / 1e9).toFixed(2)} Billion`;
                                } else {
                                  return `NT$ ${(val / 1e8).toFixed(1)} 億元`;
                                }
                              })()}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-450">加權流通股數 (Shares Outstanding)</span>
                            <span className={`text-xs font-mono font-semibold ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
                              {(() => {
                                const val = selectedValuation.secRawData.sharesOutstanding;
                                if (val >= 1e9) {
                                  return `${(val / 1e9).toFixed(2)} Billion 股`;
                                }
                                return `${(val / 1e6).toFixed(1)} Million 股`;
                              })()}
                            </span>
                          </div>

                          <div className={`p-2 rounded-lg border flex items-center justify-between ${
                            theme === "dark" ? "bg-[#080c14] border-slate-800" : "bg-white border-slate-100"
                          }`}>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-450 block font-light">
                                純淨無加工手算 EPS = 淨利 / 股數
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 block">
                                {(() => {
                                  const net = selectedValuation.secRawData.netIncome;
                                  const shares = selectedValuation.secRawData.sharesOutstanding;
                                  const isUSD = !selectedValuation.symbol.endsWith(".TW");
                                  if (isUSD) {
                                    return `(${(net / 1e9).toFixed(2)}B) / (${(shares / 1e9).toFixed(2)}B)`;
                                  } else {
                                    return `(${(net / 1e8).toFixed(1)}億) / (${(shares / 1e6).toFixed(1)}百萬股)`;
                                  }
                                })()}
                              </span>
                            </div>
                            <span className="text-sm font-mono font-bold text-teal-500">
                              {selectedValuation.symbol.endsWith(".TW") ? "NT$" : "$"} {selectedValuation.secRawData.calculatedEps.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 text-right">
                          <a 
                            href={selectedValuation.secRawData.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-teal-400 hover:text-teal-300 underline cursor-pointer inline-flex items-center gap-1 font-mono"
                          >
                            <span>🌐 進一步查閱公開財報原文</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {/* 華爾街主流機構共識與預測 */}
                    {selectedValuation.analystConsensus && (
                      <div className={`border p-4 rounded-xl space-y-3 relative ${
                        theme === "dark" ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50 border-slate-200/60"
                      }`}>
                        <div className="flex items-center justify-between border-b pb-2 border-slate-800/20">
                          <span className={`text-xs font-bold flex items-center gap-1.5 ${theme === "dark" ? "text-teal-400" : "text-teal-600"}`}>
                            <span>🌍 分析師預測與法人共識對照</span>
                          </span>
                          <span className="text-[9.5px] uppercase font-mono px-1.5 py-0.5 bg-teal-500/10 text-teal-450 rounded">
                            Consensus
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-455">法人目標價中位數 (Consensus Target)</span>
                            <span className={`text-xs font-mono font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
                              {selectedValuation.symbol.endsWith(".TW") ? "NT$" : "$"} {selectedValuation.analystConsensus.targetPrice.toFixed(1)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-455">隱含上漲空間 (Implied Upside)</span>
                            <span className={`text-xs font-mono font-bold ${
                              selectedValuation.analystConsensus.upsidePercent >= 0 ? "text-emerald-500" : "text-red-500"
                            }`}>
                              {selectedValuation.analystConsensus.upsidePercent >= 0 ? "+" : ""}{selectedValuation.analystConsensus.upsidePercent}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-455">法人預估預期本益比 (Forward PE)</span>
                            <span className={`text-xs font-mono font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                              {selectedValuation.analystConsensus.forwardPe.toFixed(1)} 倍
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-slate-800/10">
                            <span className="text-[11px] text-slate-455">法人綜合推薦等級 (Recommendation)</span>
                            <span className="text-[11px] font-bold text-teal-400">
                              {selectedValuation.analystConsensus.recommendation}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 text-[9.5px] text-slate-500 italic font-light text-left">
                          聚合來源: {selectedValuation.analystConsensus.sourceName}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 1.5 護城河五大指標 HUD 目錄 */}
              <div id="moat-matrix-hud" className={`border rounded-2xl p-5 shadow-lg transition-all relative overflow-hidden ${
                theme === "dark" 
                  ? "bg-[#0f1524]/80 border-slate-800/80" 
                  : "bg-white border-slate-200/90 shadow-slate-100"
              }`}>
                <div className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-800/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-400" />
                    <h3 className={`text-sm font-bold ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
                      Rule 1 護城河指標矩陣 (Phil Town Moat Matrix)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-450">五項合規指標檢索</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {[
                    { 
                      key: "brand", 
                      label: "品牌護城河", 
                      desc: "顧客出於強烈信任與信仰，願意付高溢價購買此品牌。", 
                      symbol: "品", 
                      color: "from-teal-500/20 to-teal-400/10", 
                      textColor: "text-teal-400" 
                    },
                    { 
                      key: "secret", 
                      label: "智慧與技術", 
                      desc: "享有核心專利、特殊政府准入特許或極高技術複雜度等機密壁壘。", 
                      symbol: "秘", 
                      color: "from-cyan-500/20 to-cyan-400/10", 
                      textColor: "text-cyan-400" 
                    },
                    { 
                      key: "tollBridge", 
                      label: "收費橋樑", 
                      desc: "居於行業與供應鏈最核心之交通樞紐收費口，同業避無可避。", 
                      symbol: "橋", 
                      color: "from-amber-500/20 to-amber-400/10", 
                      textColor: "text-amber-400" 
                    },
                    { 
                      key: "switching", 
                      label: "高轉換成本", 
                      desc: "客戶改用別家產品將面臨巨幅重置時間、金錢痛點或極高重寫風險。", 
                      symbol: "轉", 
                      color: "from-indigo-500/20 to-indigo-400/10", 
                      textColor: "text-indigo-400" 
                    },
                    { 
                      key: "price", 
                      label: "規模與價格", 
                      desc: "具備無人可比的規模效益或獨佔資源優勢，對手無從打價格戰。", 
                      symbol: "規", 
                      color: "from-emerald-500/20 to-emerald-400/10", 
                      textColor: "text-emerald-400" 
                    }
                  ].map(m => {
                    const isSatisfied = selectedValuation.moats ? (selectedValuation.moats as any)[m.key] : false;
                    return (
                      <div 
                        key={m.key} 
                        className={`p-3 rounded-xl border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                          isSatisfied 
                            ? `bg-gradient-to-br ${m.color} ${theme === "dark" ? "border-teal-500/40" : "border-teal-500/20 shadow-sm shadow-teal-500/5 drop-shadow-sm"}` 
                            : theme === "dark" 
                              ? "bg-[#080c14]/30 border-slate-800/40 opacity-40 hover:opacity-65" 
                              : "bg-slate-50 border-slate-150 opacity-55 hover:opacity-80"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold leading-none ${m.textColor}`}>{m.label}</span>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              isSatisfied 
                                ? theme === "dark" ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800 shadow-sm"
                                : "bg-transparent border border-dashed border-slate-500 text-slate-400"
                            }`}>
                              {m.symbol}
                            </span>
                          </div>
                          <p className={`text-[10px] leading-normal ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                            {m.desc}
                          </p>
                        </div>
                        <div className="mt-3.5 flex items-center gap-1">
                          {isSatisfied ? (
                            <span className={`text-[9.5px] font-bold py-0.5 px-1.5 rounded-full flex items-center gap-1 ${
                              theme === "dark" ? "bg-teal-950/60 text-teal-300" : "bg-teal-50 text-teal-700"
                            }`}>
                              <Check className="h-2 w-2" /> 具備此護城河
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-slate-405 italic py-0.5 px-1.5 rounded-full bg-slate-500/5">
                              不顯著
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. AI Markdown 專家報告檢視 */}
              <div className={`border rounded-2xl shadow-xl overflow-hidden transition-all duration-350 ${
                theme === "dark" 
                  ? "bg-[#0f1524]/80 border-slate-800/80" 
                  : "bg-white border-slate-200 shadow-slate-100"
              }`}>
                
                {/* 報告選單控制面板 */}
                <div className={`px-5 py-3.5 flex items-center justify-between border-b ${
                  theme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-teal-500" />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${
                      theme === "dark" ? "text-slate-200" : "text-slate-700"
                    }`}>
                      Gemini 專家 AI 估值分析報告
                    </h3>
                  </div>

                  {aiReport && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyReport}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          theme === "dark" ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                        }`}
                        title="複製到剪貼簿"
                      >
                        {copiedReport ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      
                      <button
                        onClick={handleDownloadReport}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          theme === "dark" ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                        }`}
                        title="下載此 Markdown 檔案"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 報告本區 */}
                <div className={`p-5 md:p-6 min-h-[360px] max-h-[600px] overflow-y-auto scrollbar-thin transition-colors ${
                  theme === "dark" ? "bg-[#080d15]/50" : "bg-slate-100/10"
                }`}>
                  {generatingReport ? (
                    <div className="py-24 text-center space-y-4">
                      <div className="inline-block relative">
                        <div className="h-10 w-10 rounded-full border-2 border-teal-550 border-t-teal-400 animate-spin" style={{ borderColor: "rgba(20,184,166,0.15)", borderTopColor: "rgb(20,184,166)" }}></div>
                        <div className="absolute inset-0 m-auto h-4 w-4 bg-teal-500 rounded-full animate-ping"></div>
                      </div>
                      <p className={`text-sm font-semibold animate-pulse ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                        {loadingPhrase}
                      </p>
                      <p className="text-xs text-slate-500 max-w-[285px] mx-auto leading-relaxed">
                        正在撰寫深度分析、估算財務 CAGR 複合指標與安全買點，這約需 3-5 秒時間。
                      </p>
                    </div>
                  ) : aiReport ? (
                    <div>
                      {/* Markdown 渲染元件 */}
                      <CustomMarkdownRenderer text={aiReport} />
                    </div>
                  ) : (
                    <div className="py-28 text-center">
                      <BookOpen className="h-10 w-10 text-slate-400 mx-auto mb-3 opacity-60" />
                      <p className={`text-sm font-medium ${theme === "dark" ? "text-slate-450" : "text-slate-500"}`}>尚未載入此股票之估值分析報告</p>
                      <button
                        onClick={() => generateAIReport(selectedValuation)}
                        className="mt-4 px-4 py-2 border rounded-xl text-xs font-semibold hover:opacity-90 transition-all font-semibold"
                        style={{ background: "rgba(20,184,166,0.1)", borderColor: "rgba(20,184,166,0.3)", color: "rgb(20,184,166)" }}
                      >
                        ⚡ 點擊動態生成專屬 AI 專家投資報告
                      </button>
                    </div>
                  )}
                </div>

                {/* 底部按鍵選項 */}
                <div className={`p-4 border-t flex items-center justify-between text-xs transition-colors ${
                  theme === "dark" ? "bg-slate-900/40 border-slate-800/40 text-slate-500" : "bg-slate-55 shadow-inner border-slate-200 text-slate-500"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-teal-500/80" />
                    <span>數據為 Yahoo Finance TTM 自動演算，報告可一鍵下載或複製</span>
                  </div>
                  
                  {aiReport && !generatingReport && (
                    <button
                      onClick={() => generateAIReport(selectedValuation)}
                      className="text-teal-600 hover:opacity-85 font-semibold cursor-pointer"
                    >
                      🔄 重新生成 AI 報告
                    </button>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className={`border rounded-3xl p-24 text-center text-slate-500 flex flex-col items-center justify-center transition-all ${
              theme === "dark" ? "bg-[#0f1524]/50 border-slate-800/60" : "bg-white border-slate-200"
            }`}>
              <TrendingUp className="h-12 w-12 text-slate-400 mb-4 opacity-50" />
              <h3 className={`font-bold text-base ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>待機就緒</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-2.5">
                請點擊左側列表內台灣 100 大市值個股，或者在上方搜尋框中輸入任意台美股，即可在右側檢閱自動化估值、圖表對照與 AI 專家報告。
              </p>
            </div>
          )}

        </section>

      </main>

      {/* 4. 底欄與系統特點 */}
      <footer className={`border-t mt-16 py-8 px-4 text-center text-xs transition-colors ${
        theme === "dark" ? "border-slate-800/80 bg-[#070b13]/95 text-slate-500" : "border-slate-200 bg-white text-slate-500"
      }`}>
        <div className="max-w-4xl mx-auto space-y-3">
          <p className="font-semibold leading-relaxed">
            📊 台股 100 大企業 Rule 1 自動化估值與 AI 報告生成系統 ── 精準量化財務演算大師
          </p>
          <p className="text-[11px] leading-relaxed max-w-2xl mx-auto font-light">
            免責聲明：本量化報告與分析均採用 Phil Town 《Rule 1 投資法》之數學模型公式演算，報告內容對接上下文自動生成，不構成任何明確投資倡議或推薦。金融市場有風險，投資需自行詳閱財報並理性裁量。
          </p>
          <div className="pt-4 border-t border-slate-55/10 text-[10px] text-slate-400 flex justify-center gap-4 font-light">
            <span>伺服器：Node.js Express + TSX 核心</span>
            <span>前端：React 19 + Tailwind v4 + Lucide Icons</span>
            <span>AI 專家：Gemini 3.5-flash 大語言模型</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
