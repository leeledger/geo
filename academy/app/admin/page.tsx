"use client";

import { useEffect, useState, useCallback } from "react";

type Row = {
  slug: string; title: string; summary: string; category: string;
  tags: string[]; published: boolean; published_at: string | null;
  updated_at: string; source_url: string | null;
};

const BLANK = {
  slug: "", title: "", summary: "", body: "", category: "수업기록",
  tags: "", published: true, published_at: "", source_url: "",
};

export default function Admin() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [ok, setOk] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ ...BLANK });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setId(localStorage.getItem("aid") ?? ""); }, []);

  /** 모든 요청에 같은 헤더가 붙어야 한다. 한 군데라도 빠지면 거기서만 401 이 난다. */
  const hdr = useCallback(() => ({ "x-admin-pw": pw, "x-admin-id": id }), [pw, id]);

  const load = useCallback(async (p = pw, i = id) => {
    const r = await fetch("/api/posts", { headers: { "x-admin-pw": p, "x-admin-id": i } });
    if (r.status === 401) { setOk(false); setMsg("아이디나 비밀번호가 맞지 않습니다."); return; }
    const d = await r.json();
    if (d.error) { setMsg(d.error); return; }
    setOk(true); setMsg(null); setRows(d.posts ?? []);
    localStorage.setItem("aid", i);   // 아이디만 기억한다
  }, [pw, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json", ...hdr() },
      body: JSON.stringify(f),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) { setMsg(d.error); return; }
    setMsg(`저장했습니다 → /blog/${d.slug}`);
    setF({ ...BLANK });
    load();
  }

  async function edit(slug: string) {
    const r = await fetch("/api/posts", { headers: { "x-admin-pw": pw } });
    const d = await r.json();
    const row = (d.posts ?? []).find((x: Row) => x.slug === slug);
    if (!row) return;
    // 본문은 목록에 없으므로 공개 페이지에서 받아온다
    const full = await fetch(`/api/posts?slug=${encodeURIComponent(slug)}`, {
      headers: hdr(),
    }).then((x) => x.json()).catch(() => null);
    setF({
      ...BLANK, ...row,
      tags: (row.tags ?? []).join(", "),
      published_at: row.published_at?.slice(0, 10) ?? "",
      source_url: row.source_url ?? "",
      body: full?.post?.body ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(slug: string) {
    if (!confirm(`"${slug}" 글을 지웁니다. 되돌릴 수 없습니다.`)) return;
    await fetch(`/api/posts?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE", headers: hdr(),
    });
    load();
  }

  if (!ok) {
    return (
      <main className="adm">
        <div className="wrap narrow">
          <h1>글 관리</h1>
          <p className="lead">로봇&amp;코딩학원 수업 기록을 쓰고 고치는 곳입니다.</p>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="admlogin">
            {/* autoComplete 를 정확히 줘야 브라우저 비밀번호 관리자가 알아본다 */}
            <input value={id} onChange={(e) => setId(e.target.value)}
                   placeholder="아이디" autoComplete="username"
                   name="username" autoFocus={!id} />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                   placeholder="비밀번호" autoComplete="current-password"
                   name="password" autoFocus={!!id} />
            <button className="btn primary" type="submit">들어가기</button>
          </form>
          {msg && <p className="admmsg err">{msg}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="adm">
      <div className="wrap narrow">
        <div className="admhead">
          <h1>글 관리</h1>
          {/* 에이전트 망·노출·크롤러 현황은 사이티드 쪽에 있다.
              학원은 사이티드의 첫 레퍼런스라 측정 기록이 그쪽에 쌓인다. */}
          <a className="admlink" href="https://geo-rose-nine.vercel.app/admin/ops"
             target="_blank" rel="noopener">운영 현황 · 에이전트 망 ↗</a>
        </div>
        {msg && <p className="admmsg">{msg}</p>}

        <form onSubmit={save} className="admform">
          <label>제목
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </label>
          <div className="two">
            <label>주소 조각 (비우면 자동)
              <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })}
                     placeholder="예: 미로-과제에서-막히는-지점" />
            </label>
            <label>분류
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option>수업기록</option><option>학생작품</option><option>대회·진학</option>
                <option>교육관점</option><option>학원소식</option><option>학부모안내</option>
              </select>
            </label>
          </div>
          <label>요약 (목록·검색결과에 그대로 나옵니다)
            <textarea rows={2} value={f.summary}
                      onChange={(e) => setF({ ...f, summary: e.target.value })} />
          </label>
          <label>본문 (## 제목 · - 목록 · **굵게** · &gt; 인용 · ``` 코드)
            <textarea rows={20} value={f.body} required
                      onChange={(e) => setF({ ...f, body: e.target.value })} />
          </label>
          <div className="two">
            <label>태그 (쉼표로 구분)
              <input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })}
                     placeholder="파이썬, 초등코딩, 송파" />
            </label>
            <label>공개 날짜 (비우면 오늘)
              <input type="date" value={f.published_at}
                     onChange={(e) => setF({ ...f, published_at: e.target.value })} />
            </label>
          </div>
          <label>네이버 블로그 원문 주소 (옮겨온 글이면)
            <input value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })}
                   placeholder="https://blog.naver.com/force11/..." />
          </label>
          <label className="chk">
            <input type="checkbox" checked={f.published}
                   onChange={(e) => setF({ ...f, published: e.target.checked })} />
            바로 공개하기
          </label>
          <div className="admrow">
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
            <button className="btn ghost" type="button" onClick={() => setF({ ...BLANK })}>
              새 글
            </button>
          </div>
        </form>

        <h2>올린 글 {rows.length}개</h2>
        <div className="admlist">
          {rows.map((r) => (
            <div className="admitem" key={r.slug}>
              <div>
                <b>{r.title}</b>
                <span className="mono">
                  {r.published ? "공개" : "초안"} · {r.category} · /{r.slug}
                </span>
              </div>
              <div className="admbtns">
                <button onClick={() => edit(r.slug)}>수정</button>
                <button onClick={() => del(r.slug)} className="danger">삭제</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
