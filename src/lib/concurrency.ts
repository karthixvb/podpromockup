/**
 * Run async work over items with a max concurrency (simple promise pool).
 */
export async function mapPool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const results = new Array<R>(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => run()));
  return results;
}

export function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
