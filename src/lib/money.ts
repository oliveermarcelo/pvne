const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos como moeda brasileira. */
export function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return brl.format(cents / 100);
}

/**
 * Converte texto digitado ("1.500,00", "1500", "1500.5", "R$ 20") para centavos.
 * Retorna null se o valor for inválido.
 */
export function parseBRLToCents(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  let s = input.replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, "");
  } else if (/^\d{1,3}\.\d{3}$/.test(s)) {
    // "1.500" no padrão brasileiro = mil e quinhentos
    s = s.replace(".", "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const value = Math.round(parseFloat(s) * 100);
  return Number.isSafeInteger(value) ? value : null;
}

/** Centavos → texto para preencher um input ("1500,00"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
