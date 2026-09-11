export const DEFAULT_CUTOFF: string;
export function validCutoff(s: unknown): boolean;
export function kstDay(d: Date | string): string;
export function kstTime(d: Date | string): string;

export type BriefWindow = { day: string; start: Date; end: Date };
export function windows(cutoff?: string, now?: Date): { cutoff: string; open: BriefWindow; closed: BriefWindow };

export type ClientFacts = {
  id: number;
  slug: string;
  name: string;
  work: { what: string; why: string | null; at: string | null }[];
  published: { title: string; slug: string; at: string | null }[];
  delivered: number;
  measured: { queries: number; last: string | null } | null;
  firstHits: string[];
  crawl: { hits: number; vendors: string[] };
  newBots: string[];
  rescan: { total: number; prev: number | null } | null;
};

export type BriefFacts = {
  clients: ClientFacts[];
  leads: { at: string | null; company: string | null; wants: string | null; referral: string | null }[];
  inquiries: number;
  publicScans: number;
};

export function gatherDb(
  q: (sql: string, params?: unknown[]) => Promise<any[]>,
  start: Date,
  end: Date,
): Promise<BriefFacts>;

export function clientLine(c: ClientFacts): string;
