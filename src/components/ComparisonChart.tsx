import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Coins, 
  Percent, 
  Plus, 
  Trash2, 
  Info,
  CheckCircle2,
  LineChart,
  HelpCircle
} from "lucide-react";
import { Rule1Valuation } from "../types";

interface ComparisonChartProps {
  allStocks: Rule1Valuation[];
  selectedCompareList: Rule1Valuation[];
  onToggleCompare: (stock: Rule1Valuation) => void;
  onSelectStock: (stock: Rule1Valuation) => void;
  selectedStock: Rule1Valuation | null;
  theme: "dark" | "light";
}

type ChartMetric = "price" | "cagr" | "eps" | "pe";

export default function ComparisonChart({
  allStocks,
  selectedCompareList,
  onToggleCompare,
  onSelectStock,
  selectedStock,
  theme
}: ComparisonChartProps) {
  const [metric, setMetric] = useState<ChartMetric>("price");
  const [marketTab, setMarketTab] = useState<"TW" | "US">("TW");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  // Resize listener
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(Math.max(300, entry.contentRect.width));
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Sync marketTab when selectedStock changes
  useEffect(() => {
    if (selectedStock) {
      const isTwStock = selectedStock.symbol.endsWith(".TW") || selectedStock.symbol.endsWith(".tw");
      setMarketTab(isTwStock ? "TW" : "US");
    }
  }, [selectedStock]);

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 80,
    });
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // 分流台美股比較清單
  const compareList = marketTab === "TW"
    ? selectedCompareList.filter(s => s.symbol.endsWith(".TW") || s.symbol.endsWith(".tw"))
    : selectedCompareList.filter(s => !s.symbol.endsWith(".TW") && !s.symbol.endsWith(".tw"));

  const curSym = marketTab === "TW" ? "NT$" : "US$";
  const curUnit = marketTab === "TW" ? "新台幣 (TWD)" : "美元 (USD)";

  // 輔助獲取顏色
  const getStatusColor = (status: string) => {
    if (status === "🟢 低估") return "rgba(16, 185, 129, 0.85)";  // bg-emerald-500
    if (status === "🔴 偏高") return "rgba(239, 68, 68, 0.85)";    // bg-red-500
    return "rgba(245, 158, 11, 0.85)";                            // bg-amber-500
  };

  const getStatusBorderColor = (status: string) => {
    if (status === "🟢 低估") return "rgb(52, 211, 153)";  // emerald-400
    if (status === "🔴 偏高") return "rgb(248, 113, 113)";   // red-400
    return "rgb(251, 191, 36)";                           // amber-400
  };

  const allFilteredStocks = marketTab === "TW"
    ? allStocks.filter(s => s.symbol.endsWith(".TW") || s.symbol.endsWith(".tw"))
    : allStocks.filter(s => !s.symbol.endsWith(".TW") && !s.symbol.endsWith(".tw"));

  // 渲染 SVG 圖表
  const renderChart = () => {
    if (compareList.length === 0) {
      return (
        <div className={`p-10 text-center rounded-2xl border-2 border-dashed flex flex-col items-center justify-center min-h-[300px] ${
          theme === "dark" 
            ? "border-slate-805/80 bg-slate-900/30 text-slate-400" 
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}>
          <BarChart3 className="h-12 w-12 text-teal-500/60 mb-3 animate-pulse" />
          <p className="font-semibold text-sm">尚未選定要比較的{marketTab === "TW" ? "台股" : "美股"}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            請從下方「加入比較群組」中勾選欲比較的個股。
          </p>
        </div>
      );
    }

    const padding = { top: 40, right: 30, bottom: 65, left: 60 };
    const chartHeight = 320;
    const chartWidth = width;
    const contentHeight = chartHeight - padding.top - padding.bottom;
    const contentWidth = chartWidth - padding.left - padding.right;

    // 計算最大數值
    let maxVal = 100;
    if (metric === "price") {
      maxVal = Math.max(...compareList.flatMap(s => [s.currentPrice, s.stickerPrice, s.mosPrice])) * 1.15;
    } else if (metric === "cagr") {
      maxVal = Math.max(...compareList.flatMap(s => [s.cagr, s.adoptedGrowth])) * 100 * 1.15;
      if (maxVal < 15) maxVal = 20; // 成長率至少繪至 20%
    } else if (metric === "eps") {
      const allEps = compareList.map(s => s.trailingEps);
      const minEps = Math.min(...allEps, 0);
      maxVal = Math.max(...allEps, 1) * 1.15;
    } else if (metric === "pe") {
      maxVal = Math.max(...compareList.map(s => s.pe), 15) * 1.15;
    }

    // 當數據全為 0 的極端防禦
    if (maxVal <= 0) maxVal = 100;

    // Y 軸刻度對應
    const getY = (val: number) => {
      const ratio = val / maxVal;
      return padding.top + contentHeight * (1 - ratio);
    };

    // X 軸刻度對應
    const totalBars = compareList.length;
    const bandWidth = contentWidth / totalBars;
    const barWidthRatio = 0.65; // 寬度百分比
    const actualBandWidth = bandWidth * barWidthRatio;

    // 生成格線刻度
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => maxVal * pct);

    return (
      <div className="relative overflow-visible">
        <svg width={chartWidth} height={chartHeight} className="overflow-visible select-none">
          {/* 背景格線 */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i} className="opacity-40">
                <line 
                  x1={padding.left} 
                  y1={y} 
                  x2={chartWidth - padding.right} 
                  y2={y} 
                  stroke={theme === "dark" ? "rgba(148, 163, 184, 0.12)" : "rgba(100, 116, 139, 0.25)"} 
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text 
                  x={padding.left - 12} 
                  y={y + 4} 
                  textAnchor="end" 
                  className={`font-mono text-[10px] ${
                    theme === "dark" ? "fill-slate-500" : "fill-slate-600"
                  }`}
                >
                  {metric === "cagr" ? `${tick.toFixed(0)}%` : tick > 1000 ? `${(tick/1000).toFixed(1)}k` : tick.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* 數據柱 */}
          {compareList.map((stock, idx) => {
            const x = padding.left + (idx * bandWidth) + ((bandWidth - actualBandWidth) / 2);
            const isFocused = selectedStock?.symbol === stock.symbol;

            // 柱頭元素渲染
            if (metric === "price") {
              // 繪製三個柱子（MOS, 現價, 合理價）
              const subBarWidth = actualBandWidth / 3.4;
              
              const yMos = getY(stock.mosPrice);
              const yCur = getY(stock.currentPrice);
              const ySticker = getY(stock.stickerPrice);

              const zeroY = getY(0);

              return (
                <g 
                  key={stock.symbol}
                  className="cursor-pointer"
                  onClick={() => onSelectStock(stock)}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* 高亮背景 */}
                  {isFocused && (
                    <rect 
                      x={padding.left + (idx * bandWidth)}
                      y={padding.top - 15}
                      width={bandWidth}
                      height={contentHeight + 25}
                      className={theme === "dark" ? "fill-teal-500/5 stroke-teal-500/20" : "fill-teal-500/5 stroke-teal-500/10"}
                      rx={8}
                    />
                  )}

                  {/* 1. 安全價 MOS Price (Emerald) */}
                  <motion.rect 
                    x={x}
                    y={yMos}
                    width={subBarWidth}
                    height={Math.max(zeroY - yMos, 1)}
                    fill="rgba(16, 185, 129, 0.75)"
                    stroke="rgba(52, 211, 153, 0.9)"
                    strokeWidth="1"
                    rx={2.5}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 }}
                  />

                  {/* 2. 當前限價 Current Price (Status color coded) */}
                  <motion.rect 
                    x={x + subBarWidth + 2}
                    y={yCur}
                    width={subBarWidth}
                    height={Math.max(zeroY - yCur, 1)}
                    fill={getStatusColor(stock.status)}
                    stroke={getStatusBorderColor(stock.status)}
                    strokeWidth="1.5"
                    rx={2.5}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 + 0.05 }}
                  />

                  {/* 3. 合理價 Sticker Price (Teal/Silver) */}
                  <motion.rect 
                    x={x + (subBarWidth * 2) + 4}
                    y={ySticker}
                    width={subBarWidth}
                    height={Math.max(zeroY - ySticker, 1)}
                    fill={theme === "dark" ? "rgba(45, 212, 191, 0.6)" : "rgba(13, 148, 136, 0.6)"}
                    stroke="rgba(45, 212, 191, 0.9)"
                    strokeWidth="1"
                    rx={2.5}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 + 0.1 }}
                  />
                </g>
              );
            } else if (metric === "cagr") {
              // 比較 實際歷史 CAGR vs 採用成長率(1-15%)
              const subBarWidth = actualBandWidth / 2.3;
              const yCalculated = getY(Math.max(0, stock.cagr * 100));
              const yAdopted = getY(Math.max(0, stock.adoptedGrowth * 100));
              const zeroY = getY(0);

              return (
                <g
                  key={stock.symbol}
                  className="cursor-pointer"
                  onClick={() => onSelectStock(stock)}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* 高亮背景 */}
                  {isFocused && (
                    <rect 
                      x={padding.left + (idx * bandWidth)}
                      y={padding.top - 15}
                      width={bandWidth}
                      height={contentHeight + 25}
                      className={theme === "dark" ? "fill-teal-500/5 stroke-teal-500/20" : "fill-teal-500/5 stroke-teal-500/10"}
                      rx={8}
                    />
                  )}

                  {/* 1. 歷史實際 CAGR */}
                  <motion.rect 
                    x={x}
                    y={yCalculated}
                    width={subBarWidth}
                    height={Math.max(zeroY - yCalculated, 1)}
                    fill={theme === "dark" ? "rgba(99, 102, 241, 0.6)" : "rgba(79, 70, 229, 0.6)"}
                    stroke="rgba(129, 140, 248, 0.9)"
                    strokeWidth="1"
                    rx={3}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 }}
                  />

                  {/* 2. 限制後採用成長率 */}
                  <motion.rect 
                    x={x + subBarWidth + 3}
                    y={yAdopted}
                    width={subBarWidth}
                    height={Math.max(zeroY - yAdopted, 1)}
                    fill="rgba(20, 184, 166, 0.75)"
                    stroke="rgb(45, 212, 191)"
                    strokeWidth="1"
                    rx={3}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 + 0.05 }}
                  />
                </g>
              );
            } else if (metric === "eps") {
              const yVal = getY(Math.max(0, stock.trailingEps));
              const zeroY = getY(0);

              return (
                <g 
                  key={stock.symbol}
                  className="cursor-pointer"
                  onClick={() => onSelectStock(stock)}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseLeave={handleMouseLeave}
                >
                  {isFocused && (
                    <rect 
                      x={padding.left + (idx * bandWidth)}
                      y={padding.top - 15}
                      width={bandWidth}
                      height={contentHeight + 25}
                      className={theme === "dark" ? "fill-teal-500/5 stroke-teal-500/20" : "fill-teal-500/5 stroke-teal-500/10"}
                      rx={8}
                    />
                  )}

                  <motion.rect 
                    x={x + (actualBandWidth * 0.15)}
                    y={yVal}
                    width={actualBandWidth * 0.7}
                    height={Math.max(zeroY - yVal, 1)}
                    fill="rgba(139, 92, 246, 0.7)"
                    stroke="rgb(167, 139, 250)"
                    strokeWidth="1.5"
                    rx={4}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 }}
                  />
                </g>
              );
            } else {
              // metric === "pe" (本益比)
              const yVal = getY(Math.max(0, stock.pe));
              const zeroY = getY(0);

              return (
                <g 
                  key={stock.symbol}
                  className="cursor-pointer"
                  onClick={() => onSelectStock(stock)}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseLeave={handleMouseLeave}
                >
                  {isFocused && (
                    <rect 
                      x={padding.left + (idx * bandWidth)}
                      y={padding.top - 15}
                      width={bandWidth}
                      height={contentHeight + 25}
                      className={theme === "dark" ? "fill-teal-500/5 stroke-teal-500/20" : "fill-teal-500/5 stroke-teal-500/10"}
                      rx={8}
                    />
                  )}

                  <motion.rect 
                    x={x + (actualBandWidth * 0.15)}
                    y={yVal}
                    width={actualBandWidth * 0.7}
                    height={Math.max(zeroY - yVal, 1)}
                    fill="rgba(244, 63, 94, 0.7)"
                    stroke="rgb(251, 113, 133)"
                    strokeWidth="1.5"
                    rx={4}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 100, delay: idx * 0.04 }}
                  />
                </g>
              );
            }
          })}

          {/* X 軸文字標籤 */}
          {compareList.map((stock, idx) => {
            const xLabel = padding.left + (idx * bandWidth) + (bandWidth / 2);
            const isFocused = selectedStock?.symbol === stock.symbol;
            
            // 隱藏或縮寫
            const labelText = stock.symbol.replace(".TW", "").replace(".tw", "");

            return (
              <g key={stock.symbol} className="opacity-90">
                {/* 橫線坐標 */}
                <circle 
                  cx={xLabel} 
                  cy={padding.top + contentHeight + 4} 
                  r="3.5" 
                  fill={getStatusBorderColor(stock.status)} 
                />

                <text 
                  x={xLabel} 
                  y={padding.top + contentHeight + 20} 
                  className={`text-center font-mono text-[11px] outline-none font-semibold ${
                    isFocused 
                      ? "fill-teal-400 font-bold" 
                      : theme === "dark" ? "fill-slate-300 hover:fill-teal-300" : "fill-slate-700 hover:fill-teal-600"
                  }`}
                  textAnchor="middle"
                  onClick={() => onSelectStock(stock)}
                  style={{ cursor: "pointer" }}
                >
                  {labelText}
                </text>
                
                <text 
                  x={xLabel} 
                  y={padding.top + contentHeight + 34} 
                  className={`text-center text-[10px] ${
                    isFocused 
                      ? "fill-teal-400/90 font-bold" 
                      : theme === "dark" ? "fill-slate-500" : "fill-slate-500"
                  }`}
                  textAnchor="middle"
                  onClick={() => onSelectStock(stock)}
                  style={{ cursor: "pointer" }}
                >
                  {stock.name.slice(0, 4)}
                </text>
              </g>
            );
          })}

          {/* 基準底線 */}
          <line 
            x1={padding.left} 
            y1={padding.top + contentHeight} 
            x2={chartWidth - padding.right} 
            y2={padding.top + contentHeight} 
            stroke={theme === "dark" ? "rgba(148, 163, 184, 0.3)" : "rgba(100, 116, 139, 0.45)"} 
            strokeWidth="1.5"
          />
        </svg>

        {/* 懸浮提示內容 (Interactive Tooltip) */}
        <AnimatePresence>
          {hoveredIndex !== null && compareList[hoveredIndex] && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                left: tooltipPos.x,
                top: tooltipPos.y,
                pointerEvents: "none",
                zIndex: 100,
              }}
              className={`p-3.5 rounded-xl border shadow-xl text-xs space-y-1.5 transition-all w-52 ${
                theme === "dark" 
                  ? "bg-[#111827]/95 border-slate-800 text-slate-200" 
                  : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-200"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-500/20 pb-1 mb-1">
                <span className="font-bold flex items-center gap-1">
                  <span>{compareList[hoveredIndex].name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({compareList[hoveredIndex].symbol})</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  compareList[hoveredIndex].status === "🟢 低估" 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : compareList[hoveredIndex].status === "🔴 偏高"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                }`}>
                  {compareList[hoveredIndex].status}
                </span>
              </div>

              {metric === "price" && (
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">當前市價:</span>
                    <span className="font-semibold text-white">{curSym} {compareList[hoveredIndex].currentPrice.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-teal-400">合理定價:</span>
                    <span className="font-semibold text-teal-300 font-bold">{curSym} {compareList[hoveredIndex].stickerPrice.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400">安全買點 (MOS):</span>
                    <span className="font-semibold text-emerald-400 font-bold">{curSym} {compareList[hoveredIndex].mosPrice.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {metric === "cagr" && (
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">實際歷史 CAGR:</span>
                    <span className="font-semibold">{(compareList[hoveredIndex].cagr * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-teal-400">採計成長率:</span>
                    <span className="font-semibold text-teal-300">{(compareList[hoveredIndex].adoptedGrowth * 100).toFixed(1)}%</span>
                  </div>
                </div>
              )}

              {metric === "eps" && (
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">TTM EPS:</span>
                    <span className="font-semibold text-violet-400">{curSym} {compareList[hoveredIndex].trailingEps.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {metric === "pe" && (
                <div className="space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">當前 PE:</span>
                    <span className="font-semibold text-rose-400">{compareList[hoveredIndex].pe.toFixed(1)} 倍</span>
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={`rounded-2xl p-5 border shadow-lg ${
      theme === "dark" 
        ? "bg-[#0f1524]/80 border-slate-800/80 hover:border-slate-800" 
        : "bg-white border-slate-100 hover:border-slate-200"
    }`}>
      {/* 標題與選項切換 */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-500/10 pb-4 mb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-teal-500" />
            <h3 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-800"}`}>
              精選自選股 Rule 1 估值對比圖
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
              theme === "dark" 
                ? "bg-slate-900 border-slate-800 text-teal-400" 
                : "bg-slate-50 border-slate-200 text-teal-650"
            }`}>
              計價單位：{curUnit}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-light">
            分流計價以防混淆：動態對比多檔自選 {marketTab === "TW" ? "台股(新台幣 元)" : "美股(美金 USD)"}；點擊柱體可切換右側 AI 深入分析。
          </p>
        </div>

        {/* 核心數據切換與市場分流 */}
        <div className="flex flex-col sm:flex-row gap-3 self-start xl:self-center">
          {/* 市場切換 */}
          <div className="flex items-center p-1 rounded-xl bg-slate-500/5 border border-slate-500/10 self-start">
            <button
              onClick={() => setMarketTab("TW")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                marketTab === "TW"
                  ? "bg-teal-555 bg-teal-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-500/5"
              }`}
            >
              🇹🇼 台股 (TWD)
            </button>
            <button
              onClick={() => setMarketTab("US")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                marketTab === "US"
                  ? "bg-teal-555 bg-teal-500 text-white shadow"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-500/5"
              }`}
            >
              🇺🇸 美股 (USD)
            </button>
          </div>

          {/* 指標切換 */}
          <div className="flex items-center p-1 rounded-xl bg-slate-500/5 border border-slate-500/10 self-start">
            <button
              onClick={() => setMetric("price")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                metric === "price"
                  ? (theme === "dark" ? "bg-teal-500/10 text-teal-400" : "bg-teal-50/80 text-teal-600 shadow-sm")
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Coins className="h-3 w-3" />
              <span>內在價值</span>
            </button>
            <button
              onClick={() => setMetric("cagr")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                metric === "cagr"
                  ? (theme === "dark" ? "bg-teal-500/10 text-teal-400" : "bg-teal-50/80 text-teal-600 shadow-sm")
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Percent className="h-3 w-3" />
              <span>複利增速</span>
            </button>
            <button
              onClick={() => setMetric("eps")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                metric === "eps"
                  ? (theme === "dark" ? "bg-teal-500/10 text-teal-400" : "bg-teal-50/80 text-teal-600 shadow-sm")
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="h-3 w-3" />
              <span>EPS</span>
            </button>
            <button
              onClick={() => setMetric("pe")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                metric === "pe"
                  ? (theme === "dark" ? "bg-teal-500/10 text-teal-400" : "bg-teal-50/80 text-teal-600 shadow-sm")
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              <span>本益比</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG 繪製區域 */}
      <div ref={containerRef} className="w-full">
        {renderChart()}
      </div>

      {/* 數據說明與對照標誌 (Legend) */}
      {compareList.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-500/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          
          {/* 圖例 */}
          <div className="flex flex-wrap items-center gap-4 text-slate-550">
            {metric === "price" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-400"></span>
                  <span>MOS 安全買點-50% ({curSym})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-400"></span>
                  <span>當前即時股價 (顏色對應估值度)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-teal-500/30 border border-teal-400"></span>
                  <span>Sticker Price 合理定價 ({curSym})</span>
                </div>
              </>
            )}
            {metric === "cagr" && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-indigo-500/50 border border-indigo-400"></span>
                  <span>過往 4 年 Basic EPS CAGR 成長率</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-teal-500/50 border border-teal-400"></span>
                  <span>Rule 1 採計成長率上限天花板限制 (1%-15%)</span>
                </div>
              </>
            )}
            {metric === "eps" && (
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3 rounded bg-violet-500/50 border border-violet-400"></span>
                <span>近四季累積 TTM EPS 實時每股盈餘 ({curSym})</span>
              </div>
            )}
            {metric === "pe" && (
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3 rounded bg-rose-500/50 border border-rose-400"></span>
                <span>當前滾動本益比 (PE) 乘數倍數</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5" />
            <span>左側圓球：🟢安全低估、🟡公允合理、🔴估值偏高</span>
          </div>
        </div>
      )}

      {/* 底部各市場快速增減選單 */}
      <div className="mt-5 pt-4.5 border-t border-slate-500/10">
        <h4 className={`text-xs font-bold mb-3 flex items-center justify-between ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
          <span>➕ 快速增減比較名單 ({marketTab === "TW" ? "精選台股" : "熱門美股"} - 最多 8 檔)</span>
          <span className="text-[10px] text-slate-400 font-normal">已加入此群組: {compareList.length} 檔</span>
        </h4>
        
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-500/5 rounded-xl border border-slate-500/10 scrollbar-thin">
          {allFilteredStocks.map(stock => {
            const isSelected = compareList.some(s => s.symbol === stock.symbol);
            return (
              <button
                key={stock.symbol}
                onClick={() => onToggleCompare(stock)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? "bg-teal-500/15 border-teal-500/40 text-teal-400 shadow-sm"
                    : theme === "dark"
                      ? "bg-[#0c101b] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {isSelected ? (
                  <CheckCircle2 className="h-3 w-3 text-teal-400 shrink-0" />
                ) : (
                  <Plus className="h-3 w-3 text-slate-500 shrink-0" />
                )}
                <span>{stock.name}</span>
                <span className="text-[9px] text-slate-500 font-mono">({stock.symbol.split(".")[0]})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
