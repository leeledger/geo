import Link from "next/link";
import Nav from "@/components/Nav";
import type { Metadata } from "next";
import data from "@/content/ai.json";

/**
 * 초등·중등 AI 교육 (Step 45).
 *
 * 문구는 전부 content/ai.json 에 있고, 근거는 public/llms.txt · content/home.html 뿐이다.
 * 「AI 시대 코딩」의 주차별 목차·시간표·수강료는 사이트에 없다 — 지어 넣지 말 것(KG-45-1).
 * 검사: node scripts/test-ai-page.mjs
 */

export const metadata: Metadata = {
  title: data.title,
  description: data.description,
  alternates: { canonical: "/ai" },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Course",
      "@id": "https://robotncoding.com/ai#course",
      name: "AI 시대 코딩",
      description: data.schemaDescription,
      url: "https://robotncoding.com/ai",
      inLanguage: "ko",
      educationalLevel: "초등 5학년~중학교 3학년",
      teaches: ["AI 리터러시", "자연어 코딩", "프롬프트 작성", "AI 결과 검증"],
      provider: { "@type": "EducationalOrganization", "@id": "https://robotncoding.com/#org", name: "로봇&코딩학원" },
      hasCourseInstance: {
        "@type": "CourseInstance",
        courseMode: "Onsite",
        location: {
          "@type": "Place",
          name: "로봇&코딩학원",
          address: "서울 송파구 석촌동 274-8 2층",
        },
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: data.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

const CSS = `
.aw{padding:72px 0;border-bottom:1px solid rgba(255,255,255,.06)}
.aw h1{font-size:clamp(28px,5vw,46px);line-height:1.25;font-weight:900;margin:14px 0 20px;word-break:keep-all}
.aw h2{font-size:clamp(22px,3.4vw,32px);line-height:1.35;font-weight:800;margin:10px 0 18px;word-break:keep-all}
.aw h3{font-size:18px;font-weight:800;margin:0 0 8px;word-break:keep-all}
.aw p,.aw li,.aw td,.aw th{word-break:keep-all;line-height:1.75}
.aw .lead{max-width:760px}
.aw .hl{color:var(--amber)}
.aw .more{color:var(--amber);text-decoration:underline;text-underline-offset:4px;font-weight:700}
.aw-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:26px}
.aw-card{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px 20px 16px;background:rgba(255,255,255,.02)}
.aw-card p{margin:0;color:var(--fg-2)}
.aw-card p+p{margin-top:10px}
.aw-card .k{font-size:12px;letter-spacing:.08em;color:var(--cyan);margin-bottom:8px}
.aw-card.no{border-color:rgba(245,166,35,.35)}
.aw-card.no .k{color:var(--amber)}
.aw-steps{counter-reset:s;list-style:none;padding:0;margin:26px 0 0;display:grid;gap:10px}
.aw-steps li{counter-increment:s;display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:start;border-top:1px solid rgba(255,255,255,.08);padding:14px 0}
.aw-steps li::before{content:counter(s,decimal-leading-zero);font-family:'IBM Plex Mono',monospace;color:var(--amber);font-size:20px}
.aw-steps b{display:block;margin-bottom:2px}
.aw-steps span{color:var(--fg-2)}
.paper .aw-card{border-color:var(--paper-line);background:var(--paper-card)}
.paper .aw-card p{color:var(--paper-ink-2)}
.paper .aw-card .k{color:#B5760A}
.aw-tw{overflow-x:auto;margin-top:22px}
.aw-tw table{border-collapse:collapse;min-width:640px;width:100%}
.aw-tw th,.aw-tw td{border-bottom:1px solid rgba(255,255,255,.1);padding:12px 10px;text-align:left;vertical-align:top;font-size:15px}
.aw-tw th{color:var(--fg-3);font-weight:500;font-size:13px}
.aw-src{font-size:12.5px;color:var(--fg-3);margin-top:10px}
.aw-faq details{border-top:1px solid rgba(255,255,255,.1);padding:16px 0}
.aw-faq summary{cursor:pointer;font-weight:700;word-break:keep-all}
.aw-faq details p{margin:10px 0 0;color:var(--fg-2)}
.aw-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.aw-cta a{display:inline-block;padding:14px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.18);text-decoration:none;font-weight:700}
.aw-cta a.pri{background:var(--amber);color:#0B0F16;border-color:var(--amber)}
.paper .aw-steps span,.paper .aw-faq details p,.paper .aw-src{color:var(--paper-ink-2)}
.paper .aw-tw th,.paper .aw-tw td{border-color:var(--paper-line)}
.paper.aw,.paper .aw-steps li,.paper .aw-faq details{border-color:var(--paper-line)}
.aw-faq summary:hover{background:transparent}
.aw-posts{list-style:none;padding:0;margin:18px 0 0}
.aw-posts li{border-top:1px solid rgba(255,255,255,.08);padding:12px 0}
.aw-posts a{text-decoration:none;font-weight:700}
@media (max-width:600px){.aw{padding:52px 0}.aw-steps li{grid-template-columns:40px 1fr}}
`;

function Cta() {
  return (
    <div className="aw-cta">
      <a className="pri" href="tel:02-422-0525">전화 상담 02-422-0525</a>
      <a href="http://pf.kakao.com/_Bxhxbxjxb/chat" target="_blank" rel="noopener">카카오톡으로 묻기</a>
    </div>
  );
}

export default function AiEducation() {
  const { stages, course, roles, no, made, adult, tuition } = data;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Nav />

      <section className="aw">
        <div className="wrap">
          <div className="lab">{data.lab}</div>
          <h1>
            {data.h1[0]}
            <br />
            <span className="hl">{data.h1[1]}</span>
          </h1>
          {data.lead.map((p) => (
            <p className="lead" key={p}>{p}</p>
          ))}
          <Cta />
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Stages</div>
          <h2>{stages.h2}</h2>
          <p className="lead">{stages.intro}</p>
          <div className="aw-tw">
            <table>
              <thead>
                <tr><th>단계</th><th>대상</th><th>AI를 다루는 자리</th></tr>
              </thead>
              <tbody>
                {stages.rows.map((r) => (
                  <tr key={r.step}><td><b>{r.step}</b></td><td>{r.grade}</td><td>{r.text}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="aw">
        <div className="wrap">
          <div className="lab">Course</div>
          <h2>{course.h2}</h2>
          {course.paras.map((p) => (
            <p className="lead" key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Roles</div>
          <h2>{roles.h2}</h2>
          <p className="lead">{roles.intro}</p>
          <ol className="aw-steps">
            {roles.items.map((it) => (
              <li key={it.k}><div><b>{it.k}</b><span>{it.text}</span></div></li>
            ))}
          </ol>
          <p className="lead">{roles.after}</p>
          <p className="lead"><Link className="more" href={roles.afterLink.href}>{roles.afterLink.label}</Link></p>
        </div>
      </section>

      <section className="aw">
        <div className="wrap">
          <div className="lab">What we don&apos;t do</div>
          <h2>{no.h2}</h2>
          <div className="aw-grid">
            {no.cards.map((c) => (
              <div className="aw-card no" key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                {"link" in c && c.link ? <p><Link className="more" href={c.link}>관련 글 →</Link></p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Student work</div>
          <h2>{made.h2}</h2>
          {made.paras.map((p) => (
            <p className="lead" key={p}>{p}</p>
          ))}
          <p className="lead"><Link className="more" href={made.link.href}>{made.link.label}</Link></p>
        </div>
      </section>

      <section className="aw">
        <div className="wrap">
          <div className="lab">For adults</div>
          <h2>{adult.h2}</h2>
          <p className="lead">{adult.text}</p>
          <p className="lead"><Link className="more" href={adult.link.href}>{adult.link.label}</Link></p>
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Tuition</div>
          <h2>{tuition.h2}</h2>
          <div className="aw-tw">
            <table>
              <thead>
                <tr><th>대상</th><th>해당 단계</th><th>수업 시간</th><th>월 수강료</th></tr>
              </thead>
              <tbody>
                {tuition.rows.map((r) => (
                  <tr key={r.who}><td><b>{r.who}</b></td><td>{r.stage}</td><td>{r.time}</td><td>{r.fee}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aw-src">{tuition.note}</p>
        </div>
      </section>

      <section className="aw aw-faq">
        <div className="wrap">
          <div className="lab">FAQ</div>
          <h2>자주 묻는 것</h2>
          {data.faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="aw paper">
        <div className="wrap">
          <div className="lab">Read more</div>
          <h2>{data.postsH2}</h2>
          <ul className="aw-posts">
            {data.posts.map((p) => (
              <li key={p.href}><Link href={p.href}>{p.label}</Link></li>
            ))}
          </ul>
          <Cta />
        </div>
      </section>
    </>
  );
}
