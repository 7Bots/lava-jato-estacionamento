// Centralized pt-BR formatters. Every currency/date/duration display must use these.

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 300 -> "R$ 3,00" */
export function formatCents(cents: number | null | undefined): string {
  return BRL.format((cents ?? 0) / 100);
}

/** "3,50" | "3.50" | 3.5 -> 350 */
export function parseReaisToCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const normalized = value.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** 300 -> "3,00" (for form inputs) */
export function centsToReaisInput(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const TIME_ONLY = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const formatDateTime = (d: Date | string) => DATE_TIME.format(new Date(d));
export const formatDate = (d: Date | string) => DATE_ONLY.format(new Date(d));
export const formatTime = (d: Date | string) => TIME_ONLY.format(new Date(d));

/** 3723000 -> "01:02:03" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** 3723000 -> "1h 02min" */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

/** 462000 -> "07:42" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
