import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1/chat/completions';

export const MODELS = {
  extractor: process.env.EXTRACTOR_MODEL || 'microsoft/phi-4-mini-instruct',
  judge: process.env.JUDGE_MODEL || 'qwen/qwen3-4b',
  reviewer: process.env.REVIEWER_MODEL || 'qwen/qwen3-4b',
  auditor: process.env.AUDITOR_MODEL || 'qwen/qwen3-4b',
  writer: process.env.WRITER_MODEL || 'google/gemma-3-4b-it',
};

export async function callModel({ role, systemPrompt, userPrompt, maxTokens = 1024, temperature = 0.2 }) {
  const model = MODELS[role] || MODELS.judge;
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY not configured');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(NVIDIA_BASE, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`NIM API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonResponse(text) {
  const clean = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
