export interface IssueItem { token: string; figure: string; line: string }
export interface IssueSection { title: string; items: IssueItem[] }
export interface IssueIndexEntry { date: string; number: number; headline: string }
export interface Issue extends IssueIndexEntry {
  standfirst?: string; deck?: string; body?: string[]; sections: IssueSection[];
  reporting?: { sources?: { title: string; url: string }[]; note?: string; method?: string };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export function validDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
export function safeHttps(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function isEntry(v: unknown): v is IssueIndexEntry {
  return object(v) && validDate(v.date) && Number.isSafeInteger(v.number) && Number(v.number) > 0 && text(v.headline);
}
export function validateIndex(value: unknown): IssueIndexEntry[] {
  if (!Array.isArray(value) || !value.every(isEntry) || new Set(value.map(v => v.date)).size !== value.length || new Set(value.map(v => v.number)).size !== value.length) throw new Error('Invalid issue index');
  return [...value].sort((a, b) => b.date.localeCompare(a.date));
}
export function validateIssue(value: unknown, expectedDate?: string): Issue {
  if (!isEntry(value) || !object(value) || (expectedDate && value.date !== expectedDate) ||
      !Array.isArray(value.sections) || !value.sections.every(s => object(s) && text(s.title) && Array.isArray(s.items) && s.items.every(i => object(i) && text(i.token) && text(i.figure) && text(i.line))) ||
      ['standfirst', 'deck'].some(k => value[k] !== undefined && !text(value[k])) ||
      (value.body !== undefined && (!Array.isArray(value.body) || !value.body.every(text)))) throw new Error('Invalid issue');
  const r = value.reporting;
  if (r !== undefined && (!object(r) || ['note', 'method'].some(k => r[k] !== undefined && !text(r[k])) ||
      (r.sources !== undefined && (!Array.isArray(r.sources) || !r.sources.every(s => object(s) && text(s.title) && safeHttps(s.url)))))) throw new Error('Invalid reporting');
  return value as unknown as Issue;
}
export function latestIssue(index: IssueIndexEntry[], today: string) {
  return index.filter(i => i.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}
export const AT_PRESS = "Today's issue is at the press. Here is the latest one.";
