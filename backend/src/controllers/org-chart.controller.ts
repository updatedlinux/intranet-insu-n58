import type { NextFunction, Request, Response } from 'express';
import { getOrgChartService } from '../services/org-chart.service';

export async function getOrgChart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const data = await getOrgChartService();
    res.json(data);
  } catch (error) {
    next(error);
  }
}
