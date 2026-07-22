const QUOTES_URL = 'https://cdn.jsdelivr.net/gh/GomezMig03/MotivationalAPI/es.json';

const FALLBACK_QUOTES: { phrase: string; author: string }[] = [
  { phrase: 'No importa lo lento que vayas mientras no te detengas.', author: 'Confucio' },
  { phrase: 'Si puedes soñarlo, puedes hacerlo.', author: 'Walt Disney' },
  { phrase: 'La ocasión hay que crearla, no esperar a que llegue.', author: 'Francis Bacon' },
  { phrase: 'Cada logro tiene etapas de esfuerzo y de triunfo.', author: 'Mahatma Gandhi' },
  {
    phrase: 'No importa cuántas veces caigas; lo importante es levantarte una vez más.',
    author: 'Fernando Alonso',
  },
];

interface RemoteQuote {
  id?: number;
  phrase: string;
  author: string;
  religion?: number;
}

let cachedQuotes: RemoteQuote[] | null = null;
let cachedQuotesDate: string | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayIndex(length: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % length;
}

async function loadQuotes(): Promise<RemoteQuote[]> {
  const key = todayKey();
  if (cachedQuotes && cachedQuotesDate === key) return cachedQuotes;

  try {
    const response = await fetch(QUOTES_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as RemoteQuote[];
    const secular = data.filter((q) => q.phrase?.trim() && q.religion !== 1);
    cachedQuotes = secular.length > 0 ? secular : data;
    cachedQuotesDate = key;
    return cachedQuotes;
  } catch {
    cachedQuotes = FALLBACK_QUOTES.map((q, i) => ({ ...q, id: i, religion: 0 }));
    cachedQuotesDate = key;
    return cachedQuotes;
  }
}

export async function getDailyMotivationalQuote(): Promise<{
  text: string;
  author: string;
  source: 'api' | 'fallback';
}> {
  const quotes = await loadQuotes();
  const index = dayIndex(quotes.length);
  const picked = quotes[index] ?? quotes[0] ?? FALLBACK_QUOTES[0]!;
  const fromApi = cachedQuotes !== null && cachedQuotes.length > FALLBACK_QUOTES.length;

  return {
    text: picked.phrase.trim(),
    author: picked.author.trim(),
    source: fromApi ? 'api' : 'fallback',
  };
}
