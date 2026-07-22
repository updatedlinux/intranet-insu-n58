import type { NextFunction, Request, Response } from 'express';
import {
  getInventoryDashboardService,
  getInventoryReportsService,
} from '../services/inventory.service';

export async function getDashboard(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getInventoryDashboardService());
  } catch (e) {
    next(e);
  }
}

export async function getReports(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getInventoryReportsService());
  } catch (e) {
    next(e);
  }
}
