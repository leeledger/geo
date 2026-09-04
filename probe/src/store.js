import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

/** 한 줄씩 append. 중간에 죽어도 그때까지의 결과는 남는다. */
export function appendJsonl(file, obj) {
  ensureDir(file);
  fs.appendFileSync(file, JSON.stringify(obj) + "\n", "utf8");
}

export async function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(file, "utf8"),
    crlfDelay: Infinity,
  });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo++;
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      console.warn(`  ! ${path.basename(file)}:${lineNo} 파싱 실패, 건너뜀`);
    }
  }
  return out;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** 동시 실행 상한을 둔 풀. 외부 의존성 없이. */
export async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function withRetry(fn, { tries = 3, baseMs = 2000, label = "" } = {}) {
  let last;
  for (let t = 1; t <= tries; t++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retryable = e.retryable ?? (e.name === "TimeoutError" || e.name === "AbortError");
      if (!retryable || t === tries) throw e;
      const wait = baseMs * 2 ** (t - 1) + Math.random() * 500;
      console.warn(`  ↻ ${label} 재시도 ${t}/${tries - 1} (${Math.round(wait)}ms) — ${e.message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
