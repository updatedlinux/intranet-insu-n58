import { useEffect, useRef } from 'react';
import { Chart, type ChartConfiguration, registerables } from 'chart.js';
import type { DashboardChartSeries } from '../../api/dashboard.types';

Chart.register(...registerables);

const CHART_PRIMARY = '#6E4A82';
const CHART_NAVY = '#4F2D63';

interface ChartBlockProps {
  title: string;
  series?: DashboardChartSeries;
  type?: 'bar' | 'line' | 'doughnut';
}

function ChartBlock({ title, series, type = 'bar' }: ChartBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !series?.labels.length) return;

    chartRef.current?.destroy();

    const colors = series.data.map((_, i) => (i % 2 === 0 ? CHART_PRIMARY : CHART_NAVY));

    const config: ChartConfiguration = {
      type,
      data: {
        labels: series.labels,
        datasets: [
          {
            label: title,
            data: series.data,
            backgroundColor: type === 'line' ? 'transparent' : colors,
            borderColor: CHART_PRIMARY,
            borderWidth: type === 'line' ? 3 : 1,
            tension: 0.35,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales:
          type === 'doughnut'
            ? undefined
            : {
                y: { beginAtZero: true, grid: { color: 'rgba(143,146,161,.08)' } },
                x: { grid: { display: false } },
              },
      },
    };

    chartRef.current = new Chart(ctx, config);
    return () => chartRef.current?.destroy();
  }, [series, title, type]);

  if (!series?.labels.length) {
    return (
      <div className="card-style mb-30 h-100">
        <h6 className="text-medium mb-20">{title}</h6>
        <p className="text-gray mb-0">Sin datos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="card-style mb-30 h-100">
      <h6 className="text-medium mb-20">{title}</h6>
      <div className="dashboard-chart-wrap chart">
        <canvas ref={canvasRef} aria-label={title} />
      </div>
    </div>
  );
}

interface Props {
  variant: string;
  charts: {
    primary?: DashboardChartSeries;
    secondary?: DashboardChartSeries;
    moduleUsage?: DashboardChartSeries;
    monthlyActivity?: DashboardChartSeries;
  };
}

export function DashboardCharts({ variant, charts }: Props) {
  if (variant === 'admin') {
    return (
      <div className="row mb-30">
        <div className="col-lg-6">
          <ChartBlock title="Uso por módulo (30 días)" series={charts.moduleUsage} type="bar" />
        </div>
        <div className="col-lg-6">
          <ChartBlock
            title="Actividad mensual (auditoría)"
            series={charts.monthlyActivity}
            type="line"
          />
        </div>
      </div>
    );
  }

  if (variant === 'leader' || variant === 'ti') {
    return (
      <div className="row mb-30">
        <div className="col-lg-6">
          <ChartBlock
            title={variant === 'leader' ? 'Tareas por estado' : 'Tickets por categoría'}
            series={charts.primary}
            type={variant === 'ti' ? 'doughnut' : 'bar'}
          />
        </div>
        <div className="col-lg-6">
          <ChartBlock
            title={variant === 'leader' ? 'Tareas por colaborador' : 'Tickets resueltos (7 días)'}
            series={charts.secondary}
            type="bar"
          />
        </div>
      </div>
    );
  }

  return null;
}
