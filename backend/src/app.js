import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createWatchlistRouter } from './routes/watchlist.routes.js';
import { createFilingsRouter } from './routes/filings.routes.js';
import { createQuotesRouter } from './routes/quotes.routes.js';
import { createScanRouter } from './routes/scan.routes.js';
import { createNotesRouter } from './routes/notes.routes.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { errorHandler } from './utils/errors.js';

const limiter = rateLimit({ windowMs: 60000, max: 100 });

export function createApp(broadcast) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(limiter);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  app.use('/api/watchlist', createWatchlistRouter(broadcast));
  app.use('/api/filings', createFilingsRouter());
  app.use('/api/quotes', createQuotesRouter());
  app.use('/api/scan', createScanRouter(broadcast));
  app.use('/api/notes', createNotesRouter());
  app.use('/api/dashboard', createDashboardRouter());

  app.use(errorHandler);

  return app;
}
