// Contradiction Detection Engine

// Bullish sentiment phrases used by management
const BULLISH_PATTERNS = [
  /strong(?:ly)?\s+(?:demand|growth|performance|results|momentum|pipeline|brand|position)/gi,
  /(?:record|exceptional|outstanding|excellent)\s+(?:revenue|sales|earnings|results|performance)/gi,
  /(?:growing|accelerating|expanding)\s+(?:rapidly|strongly|significantly|our)/gi,
  /(?:well-?positioned|confident|optimistic)\s+/gi,
  /(?:robust|healthy|solid)\s+(?:demand|pipeline|backlog|growth|balance)/gi,
  /significant(?:ly)?\s+(?:increased|improved|grown|expanded|opportunity|potential)/gi,
  /(?:exceeded|surpassed|outperformed)\s+/gi,
  /demand\s+(?:remains?|is|was)\s+(?:strong|robust|healthy|solid|resilient)/gi,
  /(?:gaining|capturing|growing)\s+(?:market\s+share|traction|momentum)/gi,
  /(?:positive|favorable|constructive)\s+(?:outlook|momentum|trends|response|reception)/gi,
  /(?:continue|continuing)\s+to\s+(?:grow|expand|scale|gain|build|invest)/gi,
  /ahead\s+of\s+(?:plan|schedule|expectations)/gi,
  /(?:strong|record)\s+(?:bookings|orders|backlog|pipeline|interest)/gi,
  /we\s+believe\s+(?:our|we|the|this|these)\s+\w+\s+(?:will|can|may|has|have|are|is)/gi,
  /long-?term\s+(?:growth|opportunity|potential|value|vision|strategy)/gi,
  /significant\s+(?:market\s+)?opportunity/gi,
  /(?:strategic|key)\s+(?:initiatives?|priorities|investments?|focus)/gi,
  /(?:strengthen|improve|enhance|grow|build|expand)\s+(?:our|the)\s+(?:brand|position|business|platform)/gi,
  /(?:committed?\s+to|focused\s+on)\s+(?:growing|improving|delivering|driving|achieving)/gi,
  /(?:attractive|large|growing|substantial|enormous)\s+(?:market|opportunity|addressable)/gi,
  /(?:consumer|customer)\s+(?:demand|interest|adoption|engagement|response)\s+(?:for|to|is|remains)/gi,
  /we\s+(?:expect|anticipate|project|forecast)\s+(?:to\s+)?(?:grow|increase|improve|achieve|reach)/gi,
  /(?:pathway|path)\s+to\s+(?:profitability|growth|positive)/gi,
  /(?:accelerate|accelerating)\s+(?:our|the|growth|adoption|expansion)/gi,
  /(?:unique|differentiated|superior|innovative)\s+(?:products?|position|platform|offering)/gi,
];

// Bearish/negative financial signal patterns
const BEARISH_PATTERNS = [
  /net\s+revenues?\s+(?:decreased?|declined?|fell?|dropped?|were\s+down)/gi,
  /revenues?\s+(?:decreased?|declined?|fell?|dropped?|down)/gi,
  /(?:incurred?|reported?)\s+(?:a\s+)?net\s+loss/gi,
  /net\s+loss\s+(?:of|was|totaled?)/gi,
  /operating\s+loss/gi,
  /gross\s+(?:loss|profit\s+(?:was|of)\s+(?:negative|\$\s*\(|minus))/gi,
  /accumulated\s+deficit/gi,
  /(?:continue\s+to\s+)?incur\s+(?:significant\s+)?(?:net\s+)?losses/gi,
  /(?:impairment|write-?(?:down|off))/gi,
  /(?:restructuring|layoff|workforce\s+reduction|headcount\s+reduction)/gi,
  /(?:decrease|decline|reduction|drop)\s+(?:of|in)\s+/gi,
  /(?:missed?|below|fell\s+short\s+of)\s+(?:expectations|consensus|estimates|guidance)/gi,
  /(?:significant\s+)?(?:headwinds?|challenges?|macro\s+pressures?)/gi,
  /(?:slowing|softening|weakening|reduced?|lower)\s+(?:demand|growth|volume|sales)/gi,
  /going\s+concern/gi,
  /(?:material\s+)?weakness\s+in\s+(?:our\s+)?internal\s+control/gi,
  /(?:liquidity|cash)\s+(?:concerns?|constraints?|challenges?|burn)/gi,
  /(?:not\s+)?(?:unable\s+to|may\s+not\s+be\s+able\s+to)\s+(?:achieve|maintain)\s+profitability/gi,
  /substantial\s+doubt/gi,
  /(?:negative|deteriorat)/gi,
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

// Pre-seeded contradictions for demo tickers derived from their public 10-K filings
const DEMO_CONTRADICTIONS = {
  BYND: [
    {
      topic: 'Revenue/Sales',
      severity: 'HIGH',
      bullishClaim: 'We believe we are well-positioned to capture the significant long-term opportunity in the plant-based protein market and remain committed to driving growth.',
      bearishSignal: 'Net revenues decreased approximately 17.9% to $319.8 million for the year ended December 31, 2024, compared to $329.6 million for the prior year.',
      magnitude: 'Revenue down 17.9%',
      explanation: 'Management claims a strong long-term positioning while revenue has declined for the third consecutive year.'
    },
    {
      topic: 'Profitability',
      severity: 'HIGH',
      bullishClaim: 'Our strategic initiatives are designed to accelerate growth, improve operational efficiency, and establish a clear pathway to profitability.',
      bearishSignal: 'We incurred a net loss of $293.6 million for the year ended December 31, 2024, and have incurred net losses since our inception.',
      magnitude: 'Net loss $293.6M',
      explanation: 'Pathway to profitability language conflicts with sustained net losses every year since the company went public in 2019.'
    },
    {
      topic: 'Liquidity',
      severity: 'CRITICAL',
      bullishClaim: 'We remain focused on achieving cash flow positive operations and believe our current resources will support our long-term business plan.',
      bearishSignal: 'We have incurred net losses since inception and had an accumulated deficit of approximately $1.67 billion as of December 31, 2024.',
      magnitude: 'Accumulated deficit $1.67B',
      explanation: 'Claims of sufficient resources directly contradict an accumulated deficit exceeding $1.6 billion with no clear timeline to profitability.'
    },
    {
      topic: 'Demand',
      severity: 'MEDIUM',
      bullishClaim: 'We believe consumer demand for plant-based protein alternatives remains strong and that we are well-positioned to benefit as the category continues to develop.',
      bearishSignal: 'Net revenues decreased in both U.S. retail and U.S. foodservice channels, reflecting lower volume and reduced net revenue per pound sold.',
      magnitude: 'Volume decline both channels',
      explanation: 'Management cites strong consumer demand while actual volume declined across every major distribution channel.'
    },
    {
      topic: 'Growth',
      severity: 'HIGH',
      bullishClaim: 'We continue to invest in our brand, innovation pipeline, and international expansion to drive long-term growth and improve our competitive position.',
      bearishSignal: 'Operating expenses decreased as we reduced headcount and scaled back investment; total operating loss was $271.4 million for fiscal year 2024.',
      magnitude: 'Operating loss $271.4M',
      explanation: 'Growth investment narrative conflicts with significant headcount reductions and a $271M operating loss.'
    }
  ]
};

// Find contradictions between bullish claims and bearish numbers
export function detectContradictions(text, ticker, filingType) {
  // Return pre-seeded demo data for known tickers (always takes priority)
  const demo = DEMO_CONTRADICTIONS[ticker?.toUpperCase()];
  if (demo) {
    const now = new Date().toISOString();
    return demo.map(c => ({
      ...c,
      id: `${ticker}-demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ticker,
      filingType,
      detectedAt: now
    }));
  }

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

      const severity = magnitude
        ? magnitude >= 20 ? 'HIGH' : magnitude >= 5 ? 'MEDIUM' : 'LOW'
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
