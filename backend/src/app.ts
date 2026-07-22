import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middlewares/error.middleware';
import { ensureDatabaseMiddleware } from './middlewares/ensureDatabase.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import routes from './routes';

export function createApp() {
  const app = express();

  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', ensureDatabaseMiddleware, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
