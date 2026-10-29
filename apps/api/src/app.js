import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';

/**
 * Builds the Express app. Kept separate from server.js so tests can import it
 * without opening a network port.
 */
export function createApp({ checkDb }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // Request logging: method, path, status, time. Bodies/headers are NOT logged (they may hold secrets).
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.use('/api/health', healthRouter({ checkDb }));
  // Next modules (Day 2+): /api/auth, /api/employees, /api/attendance, /api/leaves ...

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
