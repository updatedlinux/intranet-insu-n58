import { useEffect } from 'react';
import { Chart, type ChartConfiguration, type ChartItem, registerables } from 'chart.js';

Chart.register(...registerables);

const CHART_PRIMARY = '#9a6aad';
const CHART_PRIMARY_HOVER = '#855099';

function destroyChart(instance: Chart | null) {
  if (instance) {
    instance.destroy();
  }
}

function getCanvas(id: string): CanvasRenderingContext2D | null {
  const el = document.getElementById(id) as HTMLCanvasElement | null;
  return el?.getContext('2d') ?? null;
}

function buildEngagementChart(ctx: CanvasRenderingContext2D): Chart {
  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      datasets: [
        {
          label: '',
          backgroundColor: 'transparent',
          borderColor: CHART_PRIMARY,
          data: [600, 800, 750, 880, 940, 880, 900, 770, 920, 890, 976, 1100],
          pointBackgroundColor: 'transparent',
          pointHoverBackgroundColor: CHART_PRIMARY,
          pointBorderColor: 'transparent',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 5,
          borderWidth: 5,
          pointRadius: 8,
          pointHoverRadius: 8,
          tension: 0.4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false,
          backgroundColor: '#f9f9f9',
          titleColor: '#8F92A1',
          bodyColor: '#171717',
          displayColors: false,
          padding: { x: 30, y: 10 },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 500,
          max: 1200,
          grid: { display: false },
          ticks: { padding: 35 },
          border: { display: false },
        },
        x: {
          grid: { color: 'rgba(143, 146, 161, .1)' },
          ticks: { padding: 20 },
          border: { display: false },
        },
      },
    },
  };
  return new Chart(ctx as ChartItem, config);
}

function buildUsageChart(ctx: CanvasRenderingContext2D): Chart {
  const config: ChartConfiguration<'bar'> = {
    type: 'bar',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      datasets: [
        {
          label: '',
          backgroundColor: CHART_PRIMARY,
          borderRadius: 30,
          barThickness: 6,
          maxBarThickness: 8,
          data: [600, 700, 1000, 700, 650, 800, 690, 740, 720, 1120, 876, 900],
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#F3F6F8',
          displayColors: false,
          padding: { x: 30, y: 10 },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 1200,
          grid: { display: false },
          ticks: { padding: 35 },
          border: { display: false },
        },
        x: {
          grid: { display: false },
          ticks: { padding: 20 },
          border: { display: false },
        },
      },
    },
  };
  return new Chart(ctx as ChartItem, config);
}

function buildForecastChart(ctx: CanvasRenderingContext2D): Chart {
  const config: ChartConfiguration<'line'> = {
    type: 'line',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      datasets: [
        {
          label: 'Reuniones de equipo',
          backgroundColor: 'transparent',
          borderColor: '#8fdf82',
          data: [80, 120, 110, 100, 130, 150, 115, 145, 140, 130, 160, 210],
          pointHoverBackgroundColor: CHART_PRIMARY_HOVER,
          pointHoverBorderColor: CHART_PRIMARY_HOVER,
          pointBorderWidth: 5,
          pointRadius: 5,
          pointHoverRadius: 8,
          fill: false,
          tension: 0.4,
        },
        {
          label: 'Standups',
          backgroundColor: 'transparent',
          borderColor: '#0d6efd',
          data: [120, 160, 150, 140, 165, 210, 135, 155, 170, 140, 130, 200],
          pointHoverBackgroundColor: CHART_PRIMARY,
          pointHoverBorderColor: CHART_PRIMARY,
          pointBorderWidth: 5,
          pointRadius: 5,
          pointHoverRadius: 8,
          fill: false,
          tension: 0.4,
        },
        {
          label: 'Town halls',
          backgroundColor: 'transparent',
          borderColor: '#f2994a',
          data: [180, 110, 140, 135, 100, 90, 145, 115, 100, 110, 115, 150],
          pointHoverBackgroundColor: '#f2994a',
          pointHoverBorderColor: '#f2994a',
          pointBorderWidth: 5,
          pointRadius: 5,
          pointHoverRadius: 8,
          fill: false,
          tension: 0.4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          intersect: false,
          backgroundColor: '#fbfbfb',
          displayColors: false,
          padding: { x: 30, y: 15 },
        },
      },
      responsive: true,
      scales: {
        y: {
          min: 50,
          max: 350,
          grid: { display: false },
          ticks: { padding: 35 },
          border: { display: false },
        },
        x: {
          grid: { color: 'rgba(143, 146, 161, .1)' },
          ticks: { padding: 20 },
          border: { display: false },
        },
      },
    },
  };
  return new Chart(ctx as ChartItem, config);
}

/** Inicializa gráficos del dashboard (destruye instancias previas al desmontar). */
export function useAxeroDashboard(active = true) {
  useEffect(() => {
    if (!active) return;

    const charts: Chart[] = [];
    const ctx1 = getCanvas('Chart1');
    const ctx2 = getCanvas('Chart2');
    const ctx3 = getCanvas('Chart3');

    if (ctx1) charts.push(buildEngagementChart(ctx1));
    if (ctx2) charts.push(buildUsageChart(ctx2));
    if (ctx3) charts.push(buildForecastChart(ctx3));

    return () => {
      charts.forEach((c) => destroyChart(c));
    };
  }, [active]);
}
