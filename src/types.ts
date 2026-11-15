export interface Rule1Valuation {
  symbol: string;
  name: string;
  currentPrice: number;
  trailingEps: number;
  pe: number;
  cagr: number;
  adoptedGrowth: number;
  futureEps10y: number;
  futurePe: number;
  stickerPrice: number;
  mosPrice: number;
  status: "🔴 偏高" | "🟡 合理" | "🟢 低估";
  historicalEpsList: number[];
  cap15?: boolean;
  moats?: {
    brand: boolean;
    secret: boolean;
    tollBridge: boolean;
    switching: boolean;
    price: boolean;
  };
  secRawData?: {
    fiscalYear: string | number;
    netIncome: number;       // GAAP 淨利
    sharesOutstanding: number; // 通股股數
    calculatedEps: number;    // Net Income / Shares
    sourceUrl: string;       // 來源說明
  };
  analystConsensus?: {
    targetPrice: number;     // 平均目標價
    forwardPe: number;       // 預期本益比
    recommendation: string;  // 評等 (例如 Buy, Outperform)
    sourceName: string;      // 來源名稱
    upsidePercent: number;   // 上漲空間 %
  };
  bigFourRates?: {
    period: string;
    netIncomeGrowth: number;
    bookValueGrowth: number;
    salesGrowth: number;
    operatingCashGrowth: number;
  }[];
  // Phil Town Rule #1 核心擴充
  tenCap?: {
    ownerEarnings: number;
    ownerEarningsPerShare: number;
    tenCapPrice: number;
    netIncome: number;
    depreciation: number;
    arChange: number;
    apChange: number;
    tax: number;
    capex: number;
  };
  paybackTime?: {
    freeCashFlowPerShare: number;
    paybackTimeYears: number;
    paybackStatus: "🟢 買進 (≤8年)" | "🟡 保守/觀察 (>8年)";
    cumulativeCashFlows: number[];
  };
  bigFiveMetrics?: {
    roicPassed: boolean;
    salesPassed: boolean;
    epsPassed: boolean;
    equityPassed: boolean;
    fcfPassed: boolean;
    longTermDebt: number;
    earningPower: number;
    debtRepaymentYears: number;
    debtStatus: "🟢 合格 (1-3年內)" | "🔴 警示 (>3年)";
    tenYearsTable: {
      year: number;
      roic: number;
      salesGrowth: number;
      epsGrowth: number;
      equityGrowth: number;
      fcfGrowth: number;
    }[];
  };
  technicalTools?: {
    macdValue: number;
    macdSignal: "🟢 買進 (黃金交叉)" | "🔴 賣出 (死亡交叉)" | "🟡 盤整";
    stochasticK: number;
    stochasticD: number;
    stochasticSignal: "🟢 買進 (超賣區交叉)" | "🔴 賣出 (超買區交叉)" | "🟡 盤整";
    ma10Value: number;
    maSignal: "🟢 買進 (站上10MA)" | "🔴 賣出 (跌破10MA)" | "🟡 盤整";
    overallSignal: "🟢 三綠燈聯動買進" | "🔴 三紅燈全防守賣出" | "🟡 雙向震盪觀望";
  };
}

export type Theme = "light" | "dark";
