export type PlatformDef = { id: string; name: string; hosts: string[] | RegExp; self: string | null };
export type BuilderDef = { id: string; name: string; hosts: RegExp };
export type Target =
  | { kind: "error"; msg: string }
  | { kind: "site" }
  | { kind: "platform"; id: string; url: string };

export const PLATFORMS: PlatformDef[];
export const SMARTPLACE: string[];
export const BUILDER_HOSTS: BuilderDef[];
export function platformOf(host: string): PlatformDef | null;
export function builderOf(host: string): BuilderDef | null;
export const ENDED_HOSTS: { id: string; name: string; ended: string; hosts: RegExp }[];
export function endedOf(host: string): { id: string; name: string; ended: string; hosts: RegExp } | null;
export function 호스트갈래(host: string): "플랫폼" | "빌더" | "사이트" | "없음";
export function classifyTarget(raw: string): Target;
