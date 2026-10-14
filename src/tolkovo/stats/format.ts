/** Russian number formatting for the stats screens. */

/** 48213 → "48 213" (no-break space; the thin one collapses in bold SF). */
export const num = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");

/** Minutes → "11 ч 40 мин" / "25 мин". */
export const duration = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} мин`;
  if (rest === 0) return `${num(h)} ч`;
  return `${num(h)} ч ${rest} мин`;
};

/** Time saved by speaking instead of typing (TOLKOVO stats formula). */
export const savedMinutes = (words: number) => words / 40 - words / 130;

const MONTHS_NOM = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** month: 1–12 */
export const monthName = (month: number) => MONTHS_NOM[month - 1] ?? "";
export const monthGen = (month: number) => MONTHS_GEN[month - 1] ?? "";

/** "2026-10-12" → "12 октября" */
export const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_GEN[m - 1] ?? ""}`;
};
