export const GROWTH_DDL: string[];
export const GROWTH_FOOT: string[];
export const GROWTH_SLUGS: string[];
/** 리포트 표 한 줄. CTR 은 비율(0.125 = 12.5%), 순위 「-」는 null. 리포트가 반올림한 값이다 */
export type GscRow = { key: string; clicks: number; impressions: number; ctr: number; position: number | null };
type Totals = { clicks: number; impressions: number; ctr: number; position: number };
type Range = { startDate: string; endDate: string };
export type GrowthGsc = { range7: Range; range28: Range; last7: Totals; last28: Totals };
type CfTotals = { requests: number; cachedRequests: number; bytes: number; cachedBytes: number; pageViews: number; uniques: number; days: number };
export type GrowthCf = { until: string; last7: CfTotals; last28: CfTotals };
export type ParsedGrowth = {
  week: string;
  generated: string | null;
  gsc: GrowthGsc | null;
  cf: GrowthCf | null;
  notes: string | null;
  /** 모양이 달라 비운 덩어리(서치콘솔·Cloudflare) 설명. notes 에도 들어간다 */
  odd: string[];
  queries7: GscRow[] | null;
  queries28: GscRow[] | null;
  pages28: GscRow[] | null;
};
export type Opportunity = {
  week: string | null;
  count: number | null;
  url: string | null;
  updatedAt: string | null;
  lowCtr: { query: string; impressions: number; clicks: number; ctr: number; position: number; guide: string | null; tool: string | null }[] | null;
  uncovered: { query: string; impressions: number; clicks: number; position: number; tool: string | null }[] | null;
  /** 열린 이슈가 하나도 없을 때 growth-import 가 최신 주 행에 남기는 표시 */
  none?: true;
};
export function splitRow(line: string): string[] | null;
export function parseGrowthReport(md: string): ParsedGrowth;
export function parseOpportunityIssue(issue: { title?: string; body?: string | null; html_url?: string; updated_at?: string }): Opportunity;
export function weekOfName(name: string): string | null;
export function weeksToFetch(listed: string[], stored: Iterable<string>, max?: number): string[];
export function kstDay(iso: string | null | undefined): string | null;
export function weekMonday(label: string): string;
export function reportStalled(latest: { week: string; generated: string | null } | null | undefined, today: string): boolean;
export function 주별칸(
  tracked: { crawl: boolean; posts: boolean },
  v: { posts: number | null | undefined; search: number | null; ai: number | null; other: number | null; cov: (number | null)[] | null },
): { 글: string; 방문: string; 색인: string };
