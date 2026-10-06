import { DomainError } from "./errors";

/**
 * Limitador simples em memória (janela fixa). Suficiente para uma instância;
 * para várias instâncias, trocar por Redis mantendo a mesma interface.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    return;
  }
  b.count++;
  if (b.count > limit) {
    const secs = Math.ceil((b.resetAt - now) / 1000);
    throw new DomainError(`Muitas tentativas. Aguarde ${secs}s e tente novamente.`, "RATE_LIMITED");
  }
}
