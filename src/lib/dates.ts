/**
 * Datas: tudo é gravado em UTC no banco e exibido no fuso de Brasília.
 * O Brasil não tem horário de verão desde 2019, então o offset é fixo em -03:00.
 */
export const APP_TIMEZONE = "America/Sao_Paulo";
const APP_OFFSET = "-03:00";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const monthYearFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, month: "long", year: "numeric" });

export const formatDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));
export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));
export const formatMonthYear = (d: Date | string) => monthYearFmt.format(new Date(d));

/** "2026-10-10T18:00" (input datetime-local, horário de Brasília) → Date UTC */
export function parseLocalDateTime(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${APP_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → valor para input datetime-local no horário de Brasília */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(new Date(d).getTime() - 3 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export function timeAgo(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return formatDate(d);
}
