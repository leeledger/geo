/**
 * robots.txt 매처 — RFC 9309 대로 읽는다. 순수 함수만, import 없음.
 *
 * 왜 scan.ts 의 것과 따로인가: 그쪽은 「Disallow: /」 전면 차단만 센다. 홈페이지 점수는 그 기준으로
 * 매겨 왔으니 건드리면 점수가 바뀐다(D154). 플랫폼(블로그·인스타)은 경로 규칙·`*` 그룹·`$` 로
 * 막고 들이는 게 갈려서 전면 차단만 보면 틀린 답이 나온다. 그래서 플랫폼 길만 이 매처를 쓴다.
 */

export type RobotRule = { allow: boolean; path: string };
/** UA(소문자) → 그 UA 에 걸린 규칙 전부. 같은 UA 가 여러 그룹에 나오면 합친다(RFC 9309 2.2.1) */
export type RobotGroups = Map<string, RobotRule[]>;

export type Verdict = { allowed: boolean; group: "own" | "*" | "none"; rule: string | null };

export function parseRobots(txt: string): RobotGroups {
  const groups: RobotGroups = new Map();
  let agents: string[] = [];
  let inRules = false;
  for (const line of txt.replace(/^﻿/, "").split(/\r?\n/)) {
    const s = line.replace(/#.*$/, "").trim();
    if (!s) continue;
    const i = s.indexOf(":");
    if (i < 0) continue;
    const k = s.slice(0, i).trim().toLowerCase();
    const v = s.slice(i + 1).trim();
    if (k === "user-agent") {
      // 규칙 뒤에 오는 user-agent 는 새 그룹의 시작이다
      if (inRules) { agents = []; inRules = false; }
      const ua = v.toLowerCase();
      agents.push(ua);
      if (!groups.has(ua)) groups.set(ua, []);
    } else if (k === "allow" || k === "disallow") {
      if (!agents.length) continue;
      inRules = true;
      for (const ua of agents) groups.get(ua)!.push({ allow: k === "allow", path: v });
    }
  }
  return groups;
}

/** 규칙 경로가 그 경로에 걸리는가. `*` 는 아무 글자, 끝의 `$` 는 끝. 앞에서부터 맞춘다 */
function matches(rulePath: string, path: string): boolean {
  const anchored = rulePath.endsWith("$");
  const body = anchored ? rulePath.slice(0, -1) : rulePath;
  const re = body.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + re + (anchored ? "$" : "")).test(path);
}

/**
 * 봇 이름 그룹이 있으면 그것만, 없으면 `*`, 둘 다 없으면 허용.
 * 가장 긴 규칙이 이기고 길이가 같으면 Allow. 빈 Disallow 는 무시한다.
 */
export function verdict(groups: RobotGroups, botId: string, pathAndQuery: string): Verdict {
  const own = groups.get(botId.toLowerCase());
  const star = groups.get("*");
  const rules = own ?? star;
  const group = own ? "own" : star ? "*" : "none";
  if (!rules) return { allowed: true, group, rule: null };
  const path = pathAndQuery || "/";
  let best: RobotRule | null = null;
  for (const r of rules) {
    if (!r.path) continue;
    if (!matches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow)) best = r;
  }
  if (!best) return { allowed: true, group, rule: null };
  return { allowed: best.allow, group, rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}` };
}

/**
 * 받은 응답으로 규칙 파일 상태를 정한다.
 * 2xx → 읽는다. 4xx(429 빼고) → 파일 없음 = 모두 들임(RFC 9309 2.3.1.3).
 * 429·5xx·0(못 받음)·남은 3xx → 확인 못 함. 429 의 HTML 본문을 규칙으로 읽으면 안 된다.
 */
export function robotsState(status: number, body: string): { robots: "ok" | "none" | "fail"; groups: RobotGroups | null } {
  if (status >= 200 && status < 300) return { robots: "ok", groups: parseRobots(body) };
  if (status >= 400 && status < 500 && status !== 429) return { robots: "none", groups: null };
  return { robots: "fail", groups: null };
}
