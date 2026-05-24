import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initSqlite } from './src/db/db.js';
import { createApp } from './src/app.js';
import { startPricePolling } from './src/services/pricePolling.js';
import { getAllCompanies } from './src/db/repositories/company.repo.js';
import { getAllFlags } from './src/db/repositories/flag.repo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

initSqlite();

const clients = new Set();

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

const app = createApp(broadcast);
app.use(express.static(join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '../frontend/index.html'));
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));

  try {
    const companies = getAllCompanies();
    const flags = getAllFlags();
    ws.send(JSON.stringify({ type: 'INIT', data: { companies, flags }, timestamp: Date.now() }));
  } catch (e) {
    console.error('[WS] Init send error:', e.message);
  }
});

startPricePolling(broadcast);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[AlphaDesk] Backend on http://localhost:${PORT}`);
  console.log(`[AlphaDesk] WebSocket ready`);
});
