import type { DashboardMotivationalQuote } from '../../api/dashboard.types';

interface Props {
  quote: DashboardMotivationalQuote;
  featured?: boolean;
}

export function DashboardMotivationalQuote({ quote, featured = false }: Props) {
  return (
    <div
      className={`card-style mb-30 dashboard-quote h-100${featured ? ' dashboard-quote--featured' : ''}`}
    >
      <h6 className="text-medium mb-2">Frase del día</h6>
      <div className="quote">&ldquo;{quote.text}&rdquo;</div>
      <div className="author">{quote.author}</div>
    </div>
  );
}
