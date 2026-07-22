import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const MIN_SCALE = 0.22;

interface LayoutMetrics {
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
  width: number;
  height: number;
}

interface OrgChartFitProps {
  children: ReactNode;
  className?: string;
}

function measureChart(inner: HTMLElement): { iw: number; ih: number } {
  const chart = inner.querySelector<HTMLElement>('.org-chart');
  if (!chart) return { iw: 0, ih: 0 };

  const rows = chart.querySelectorAll<HTMLElement>('.org-chart__roots, .org-chart__children');
  let maxRowWidth = 0;
  rows.forEach((row) => {
    maxRowWidth = Math.max(maxRowWidth, row.scrollWidth, row.offsetWidth);
  });

  const styles = getComputedStyle(chart);
  const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const iw = Math.max(maxRowWidth + padX, chart.scrollWidth, chart.offsetWidth);
  const ih = chart.scrollHeight;

  return { iw, ih };
}

export function OrgChartFit({ children, className = '' }: OrgChartFitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutMetrics | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const fit = () => {
      inner.style.transform = 'none';

      const { iw, ih } = measureChart(inner);
      const cw = container.clientWidth;

      if (!iw || !ih || !cw) {
        setLayout({
          scale: 1,
          naturalWidth: iw || 1,
          naturalHeight: ih || 1,
          width: cw || iw || 1,
          height: ih || 1,
        });
        return;
      }

      const scale = Math.max(MIN_SCALE, Math.min(1, (cw - 8) / iw));
      setLayout({
        scale,
        naturalWidth: iw,
        naturalHeight: ih,
        width: Math.ceil(iw * scale),
        height: Math.ceil(ih * scale),
      });
    };

    const scheduleFit = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(fit);
      });
    };

    const observer = new ResizeObserver(scheduleFit);
    observer.observe(container);
    observer.observe(inner);
    scheduleFit();

    const logo = inner.querySelector<HTMLImageElement>('.org-chart__logo');
    if (logo && !logo.complete) {
      logo.addEventListener('load', scheduleFit);
      return () => {
        logo.removeEventListener('load', scheduleFit);
        observer.disconnect();
      };
    }

    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={containerRef} className={`org-chart-fit${className ? ` ${className}` : ''}`}>
      <div
        className="org-chart-fit__canvas"
        style={
          layout
            ? {
                width: layout.width,
                height: layout.height,
              }
            : undefined
        }
      >
        <div
          ref={innerRef}
          className="org-chart-fit__inner"
          style={
            layout
              ? {
                  width: layout.naturalWidth,
                  height: layout.naturalHeight,
                  transform: layout.scale < 1 ? `scale(${layout.scale})` : undefined,
                  transformOrigin: 'top left',
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
