export const MARKETING_DDL: string[];
export type Channel = "jisikin" | "cafe" | "blog";
export const CHANNELS: Channel[];
export const CHANNEL_NAME: Record<Channel, string>;
export function searchLink(channel: Channel, query: string): string | null;
export function normUrl(raw: string | null | undefined): string;
export type UsedCount = {
  posted: number;
  used: number;
  perEngine: Record<string, number>;
  perPost: { id: number | string; engines: string[]; first: string | null }[];
};
export function countUsed(
  posts: { id: number | string; posted_url: string | null; posted_day: string }[],
  cites: { engine: string; measured_on: string; url: string }[],
): UsedCount;
