import type { Request, Response } from 'express';
import { getHealthHttpStatus, getHealthStatus } from '../services/health.service';

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const health = await getHealthStatus();
  res.status(getHealthHttpStatus(health)).json(health);
}
