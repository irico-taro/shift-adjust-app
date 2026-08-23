// 日付・時刻ユーティリティ。日付は "YYYY-MM-DD"、時刻は "HH:mm" 文字列で扱い、
// 計算はすべて UTC ベースで行ってタイムゾーンによるズレを避ける。

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MINUTES_PER_DAY = 24 * 60;

export const DAY_NAMES_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toTimeString(minutes: number): string {
  const norm = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return formatDate(new Date(parseDate(date).getTime() + days * MS_PER_DAY));
}

export function diffDays(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / MS_PER_DAY);
}

export function dayOfWeek(date: string): number {
  return parseDate(date).getUTCDay();
}

/** start〜end(両端含む)の日付配列。 */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** endTime <= startTime を日跨ぎ勤務とみなした所要時間(分)。 */
export function slotDurationMinutes(startTime: string, endTime: string): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return end > start ? end - start : end + MINUTES_PER_DAY - start;
}

/**
 * 日付をまたぐ勤務も一直線に比較できるよう、基準日からの通算分に変換する。
 * minInterval / 勤務の重なり判定はこの絶対時刻で行う。
 */
export function absoluteSpan(
  epoch: string,
  date: string,
  startTime: string,
  endTime: string,
): { start: number; end: number } {
  const base = diffDays(epoch, date) * MINUTES_PER_DAY;
  const start = base + toMinutes(startTime);
  return { start, end: start + slotDurationMinutes(startTime, endTime) };
}

/** 週(月曜始まり)の識別キー。週労働時間の集計に使う。 */
export function weekStart(date: string): string {
  const dow = dayOfWeek(date); // 0=日
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return addDays(date, -backToMonday);
}

export function formatDateJa(date: string): string {
  const d = parseDate(date);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAY_NAMES_JA[d.getUTCDay()]})`;
}

export function hoursFromMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
