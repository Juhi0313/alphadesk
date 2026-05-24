import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const BSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.bseindia.com'
};

export async function searchBSECompany(query) {
  try {
    const url = `https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active&scripname=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.Table?.[0];
    if (!item) return null;
    return {
      bse_code: item.SCRIP_CD,
      company_name: item.Scrip_Name,
      isin: item.ISIN_CODE
    };
  } catch (e) {
    logger.warn('[BSE] searchBSECompany error', e.message);
    return null;
  }
}

export async function getBSEQuote(bse_code) {
  try {
    const url = `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=${bse_code}&seriesid=`;
    const res = await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      price: parseFloat(data?.CurrRate),
      change: parseFloat(data?.Chg),
      change_pct: parseFloat(data?.PcChg),
      company_name: data?.Iname,
      currency: 'INR'
    };
  } catch (e) {
    logger.warn('[BSE] getBSEQuote error', e.message);
    return null;
  }
}

export async function getBSEFilings(bse_code) {
  try {
    const url = `https://api.bseindia.com/BseIndiaAPI/api/AnnualRptData/w?scripcode=${bse_code}&flag=0`;
    const res = await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.Table || []).slice(0, 3).map(f => ({
      form_type: 'Annual Report',
      filing_date: f.DissemDt,
      accession_number: `BSE-${bse_code}-${f.DissemDt}`,
      direct_url: f.PDFS,
      source_url: f.PDFS
    }));
  } catch (e) {
    logger.warn('[BSE] getBSEFilings error', e.message);
    return [];
  }
}
