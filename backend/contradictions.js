// Contradiction Detection Engine

// Bullish sentiment phrases used by management
const BULLISH_PATTERNS = [
  /strong(?:ly)?\s+(?:demand|growth|performance|results|momentum|pipeline)/gi,
  /(?:record|exceptional|outstanding|excellent)\s+(?:revenue|sales|earnings|results|performance)/gi,
  /(?:growing|accelerating|expanding)\s+(?:rapidly|strongly|significantly)/gi,
  /(?:well-positioned|confident|optimistic)\s+(?:for|about|in)/gi,
  /(?:robust|healthy|solid)\s+(?:demand|pipeline|backlog|growth)/gi,
  /significant(?:ly)?\s+(?:increased|improved|grown|expanded)/gi,
  /(?:exceeded|surpassed|outperformed)\s+(?:expectations|targets|guidance)/gi,
  /demand\s+remains?\s+(?:strong|robust|healthy|solid)/gi,
  /(?:gaining|capturing)\s+market\s+share/gi,
  /(?:positive|favorable|constructive)\s+(?:outlook|momentum|trends)/gi,
  /(?:continue|continuing)\s+to\s+(?:grow|expand|scale)/gi,
  /ahead\s+of\s+(?:plan|schedule|expectations)/gi,
  /(?:strong|record)\s+(?:bookings|orders|backlog)/gi,
];

// Bearish/negative financial signal patterns  
const BEARISH_PATTERNS = [
  /revenue\s+(?:declined?|decreased?|fell?|dropped?|down)\s+(?:\d+%?|\$[\d.]+[MBK]?)/gi,
  /(?:net\s+)?(?:loss|losses)\s+of\s+\$[\d.]+/gi,
  /(?:impairment|write-?(?:down|off))\s+(?:of|charge)\s+\$[\d.]+/gi,
  /(?:restructuring|layoff|workforce\s+reduction)\s+(?:charge|cost)/gi,
  /(?:decrease|decline|reduction|drop)\s+(?:of|in)\s+(?:\d+%?|\$[\d.]+)/gi,
  /(?:missed?|below)\s+(?:expectations|consensus|estimates|guidance)/gi,
  /(?:headwinds?|challenges?|pressures?)\s+(?:impacting|affecting|on)/gi,
  /(?:slowing|softening|weakening)\s+(?:demand|growth|momentum)/gi,
  /(?:inventory\s+(?:build-?up|excess|elevated))/gi,
  /(?:customer\s+(?:churn|attrition|losses?))/gi,
  /cash\s+(?:burn|runway|concerns?)/gi,
  /going\s+concern/gi,
  /(?:material\s+)?(?:weakness|weaknesses)\s+in\s+internal\s+control/gi,
];

// Numeric patterns to extract financial figures
const NUMBER_PATTERNS = {
  percentDecline: /(?:decreased?|declined?|fell?|dropped?|down)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%/gi,
  percentIncrease: /(?:increased?|grew?|rose?|up)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%/gi,
  dollarAmount: /\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:million|billion|thousand|M|B|K)?/gi,
};

// Extract sentences containing patterns
function extractSentences(text, patterns) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const matches = [];
  
  for (const sentence of sentences) {
    const cleanSentence = sentence.trim();
    if (cleanSentence.length < 20) continue;
    
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(cleanSentence)) {
        matches.push(cleanSentence);
        break;
      }
    }
  }
  return matches;
}

// Find contradictions between bullish claims and bearish numbers
export function detectContradictions(text, ticker, filingType) {
  if (!text || text.length < 100) return [];
  
  // Normalize: collapse newlines/tabs into spaces so sentences aren't broken
  const cleanText = text
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const contradictions = [];
  const bullishSentences = extractSentences(cleanText, BULLISH_PATTERNS);
  const bearishSentences = extractSentences(cleanText, BEARISH_PATTERNS);
  
  const topics = [
    { keywords: ['revenue', 'sales', 'income', 'net revenue'], label: 'Revenue/Sales' },
    { keywords: ['demand', 'order', 'booking', 'backlog', 'reservation'], label: 'Demand' },
    { keywords: ['market', 'share', 'competition', 'position'], label: 'Market Position' },
    { keywords: ['growth', 'expand', 'scale', 'grow'], label: 'Growth' },
    { keywords: ['margin', 'profit', 'earnings', 'ebitda'], label: 'Profitability' },
    { keywords: ['customer', 'client', 'user', 'member', 'subscriber'], label: 'Customer Metrics' },
    { keywords: ['cash', 'liquidity', 'balance', 'capital'], label: 'Liquidity' },
    { keywords: ['production', 'deliver', 'volume', 'unit', 'vehicle'], label: 'Production/Delivery' },
  ];

  // Pair bullish claims with bearish signals - cross-topic matching allowed
  for (const bullish of bullishSentences) {
    for (const bearish of bearishSentences) {
      if (bullish === bearish) continue;
      const bullishLower = bullish.toLowerCase();
      const bearishLower = bearish.toLowerCase();

      // Find best matching topic
      let bestTopic = null;
      for (const topic of topics) {
        const inBullish = topic.keywords.some(k => bullishLower.includes(k));
        const inBearish = topic.keywords.some(k => bearishLower.includes(k));
        if (inBullish || inBearish) { bestTopic = topic; break; }
      }
      if (!bestTopic) bestTopic = { label: 'Business Performance' };

      const declineMatch = bearish.match(/(\d+(?:\.\d+)?)\s*%/) ||
                           bearish.match(/decreased?\s+(?:by\s+)?(\d+)/) ||
                           bearish.match(/declined?\s+(?:by\s+)?(\d+)/);
      const magnitude = declineMatch ? parseFloat(declineMatch[1]) : null;

      if (magnitude !== null && magnitude < 2) continue;

      const severity = magnitude
        ? magnitude >= 20 ? 'HIGH' : magnitude >= 8 ? 'MEDIUM' : 'LOW'
        : 'MEDIUM';

      const isDupe = contradictions.some(c =>
        c.bullishClaim.slice(0, 40) === bullish.slice(0, 40)
      );

      if (!isDupe) {
        contradictions.push({
          id: `${ticker}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ticker,
          filingType,
          topic: bestTopic.label,
          severity,
          bullishClaim: bullish.slice(0, 300),
          bearishSignal: bearish.slice(0, 300),
          magnitude: magnitude ? `${magnitude}%` : 'Unquantified',
          detectedAt: new Date().toISOString()
        });
        break;
      }
    }
  }
  
  // Also scan for specific high-confidence patterns
  const highConfidenceChecks = [
    {
      bullishPattern: /demand\s+remains?\s+(?:strong|robust|healthy)/i,
      bearishPattern: /(?:revenue|sales|volume)\s+(?:declined?|decreased?|fell?)\s+(?:by\s+)?(\d+)/i,
      topic: 'Demand vs Revenue Decline',
      severity: 'HIGH'
    },
    {
      bullishPattern: /(?:positive|favorable)\s+(?:outlook|momentum)/i,
      bearishPattern: /(?:impairment|write-?(?:down|off))/i,
      topic: 'Positive Outlook vs Asset Impairment',
      severity: 'HIGH'
    },
    {
      bullishPattern: /(?:growing|gaining)\s+market\s+share/i,
      bearishPattern: /(?:lost?|losing)\s+(?:\d+)?\s*(?:customers?|clients?|accounts?)/i,
      topic: 'Market Share Claim vs Customer Loss',
      severity: 'HIGH'
    },
    {
      bullishPattern: /(?:strong|healthy|robust)\s+(?:cash|liquidity|balance\s+sheet)/i,
      bearishPattern: /going\s+concern|cash\s+burn/i,
      topic: 'Liquidity Claim vs Going Concern',
      severity: 'CRITICAL'
    }
  ];
  
  for (const check of highConfidenceChecks) {
    const bullishMatch = text.match(check.bullishPattern);
    const bearishMatch = text.match(check.bearishPattern);
    
    if (bullishMatch && bearishMatch) {
      // Extract context sentences
      const getBullishSentence = (match) => {
        const idx = text.indexOf(match[0]);
        const start = Math.max(0, text.lastIndexOf('.', idx) + 1);
        const end = Math.min(text.length, text.indexOf('.', idx) + 1);
        return text.slice(start, end).trim();
      };
      
      contradictions.push({
        id: `${ticker}-hc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ticker,
        filingType,
        topic: check.topic,
        severity: check.severity,
        bullishClaim: getBullishSentence(bullishMatch).slice(0, 300),
        bearishSignal: getBullishSentence(bearishMatch).slice(0, 300),
        magnitude: 'Flagged',
        detectedAt: new Date().toISOString(),
        highConfidence: true
      });
    }
  }
  
  // Deduplicate and limit
  const seen = new Set();
  return contradictions
    .filter(c => {
      const key = c.topic + c.bullishClaim.slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

// Generate structured research note from metrics and filings
export function generateResearchNote(ticker, companyName, metrics, filings, contradictions, watchItem) {
  const isIndian = watchItem?.country === 'IN' || filings.some(f => f.country === 'IN');
  const currSym = isIndian ? '₹' : '$';
  const exchange = isIndian ? 'BSE/NSE' : 'SEC EDGAR';
  const latestFiling = filings.find(f => f.form === '10-K' || f.form === 'Annual Report') || filings[0];
  const hasRisks = contradictions.length > 0;

  const formatNum = (val) => {
    if (!val) return 'N/A';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e12) return `${currSym}${sign}${(abs/1e12).toFixed(2)}T`;
    if (abs >= 1e9)  return `${currSym}${sign}${(abs/1e9).toFixed(2)}B`;
    if (abs >= 1e6)  return `${currSym}${sign}${(abs/1e6).toFixed(1)}M`;
    if (abs >= 1e3)  return `${currSym}${sign}${(abs/1e3).toFixed(1)}K`;
    return `${currSym}${sign}${abs.toLocaleString()}`;
  };

  const pctChange = (current, prior) => {
    if (!current || !prior || prior === 0) return 'N/A';
    const pct = ((current - prior) / Math.abs(prior)) * 100;
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const revenueChange = metrics?.revenue
    ? pctChange(metrics.revenue.current, metrics.revenue.prior) : 'N/A';
  const netIncomeChange = metrics?.netIncome
    ? pctChange(metrics.netIncome.current, metrics.netIncome.prior) : 'N/A';

  // Build thesis based on available data
  let thesis = '';
  if (isIndian) {
    const price = watchItem?.metrics?.price || metrics?.price;
    const mktCap = watchItem?.metrics?.marketCap || metrics?.marketCap;
    thesis = `${companyName} (${ticker}) is listed on the ${exchange}. `;
    if (mktCap) thesis += `Market capitalisation: ${formatNum(mktCap)}. `;
    if (metrics?.revenue?.current) {
      thesis += `Annual revenue: ${formatNum(metrics.revenue.current)} (${revenueChange} YoY). `;
    } else {
      thesis += `Financial data is sourced from BSE annual reports. `;
    }
    if (hasRisks) thesis += `Note: ${contradictions.length} narrative contradiction(s) detected — review carefully.`;
    else thesis += `No narrative contradictions detected in latest annual report.`;
  } else {
    thesis = `${companyName} (${ticker}) is a publicly traded company with ${
      metrics?.revenue?.current
        ? `annual revenue of ${formatNum(metrics.revenue.current)} (${revenueChange} YoY)`
        : 'financial data available via SEC filings'
    }. ${
      metrics?.netIncome?.current > 0
        ? `The company is currently profitable with net income of ${formatNum(metrics.netIncome.current)}.`
        : metrics?.netIncome?.current < 0
        ? `The company is currently operating at a net loss of ${formatNum(Math.abs(metrics.netIncome.current))}.`
        : ''
    } ${hasRisks ? `Note: ${contradictions.length} narrative contradiction(s) detected — review carefully.` : ''}`;
  }

  // Key risks
  const sectorRisks = isIndian
    ? ['No contradictions detected in latest annual report. Standard sector and regulatory risks apply (SEBI, RBI policy, INR/USD exchange rate).']
    : ['No contradictions detected in latest filings. Standard sector risks apply.'];

  return {
    id: `note-${ticker}-${Date.now()}`,
    ticker,
    companyName,
    isIndian,
    exchange,
    generatedAt: new Date().toISOString(),
    lastFiling: latestFiling?.filingDate || 'N/A',
    sections: {
      investmentThesis: thesis,

      keyRisks: hasRisks
        ? contradictions.map(c => `[${c.severity}] ${c.topic}: Management language conflicts with reported data in ${c.filingType || 'recent filing'}.`)
        : sectorRisks,

      financialSummary: {
        revenue: metrics?.revenue ? { current: formatNum(metrics.revenue.current), prior: formatNum(metrics.revenue.prior), change: revenueChange } : null,
        netIncome: metrics?.netIncome ? { current: formatNum(metrics.netIncome.current), prior: formatNum(metrics.netIncome.prior), change: netIncomeChange } : null,
        totalAssets: metrics?.assets ? formatNum(metrics.assets.current) : 'N/A',
        totalLiabilities: metrics?.liabilities ? formatNum(metrics.liabilities.current) : 'N/A',
        operatingCashflow: metrics?.operatingCashflow ? formatNum(metrics.operatingCashflow.current) : 'N/A',
        eps: metrics?.eps ? `${currSym}${metrics.eps.current?.toFixed(2)}` : 'N/A',
        marketCap: watchItem?.metrics?.marketCap ? formatNum(watchItem.metrics.marketCap) : 'N/A',
        lastUpdated: metrics?.revenue?.date || latestFiling?.filingDate || 'N/A',
        currency: isIndian ? 'INR' : 'USD',
        source: exchange
      },

      filingSummary: {
        totalFilings: filings.length,
        mostRecent10K: filings.find(f => f.form === '10-K' || f.form === 'Annual Report')?.filingDate || 'N/A',
        mostRecent10Q: filings.find(f => f.form === '10-Q' || f.form === 'Quarterly Results')?.filingDate || 'N/A',
        recentFilings: filings.slice(0, 5).map(f => ({ form: f.form, date: f.filingDate, url: f.url }))
      },

      analystNotes: '[ Edit this section with your own analysis ]'
    }
  };
}
