import Link from "next/link";
import type { Metadata } from "next";
import { SERVICES } from "@/lib/services";
import SiteNav from "../SiteNav";

export const metadata: Metadata = {
  title: "서비스 — Cited 사이티드",
  description: "AI 답변 인용 측정, 기술 세팅, 외부 문서 진입, 사이트 구축. 하는 일과 하지 않는 일을 나눠 적었습니다.",
};

export default function Services() {
  return (
    <>
      <SiteNav />
      <header className="hero simple">
        <div className="wrap">
          <div className="lab">서비스</div>
          <h1>넷 중 필요한 것만</h1>
          <p className="lede">
            대부분은 <b>측정</b>부터 시작합니다. 나머지는 재본 뒤에 정해도 늦지 않습니다.
          </p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="svcs">
            {SERVICES.map((s) => (
              <Link className="svc" key={s.slug} href={`/services/${s.slug}`}>
                <div className="svch">
                  <span className="mono no">{s.no}</span>
                  <span className="mono tag">{s.tag}</span>
                </div>
                <h2>{s.name}</h2>
                <p>{s.short}</p>
                <div className="svcq">{s.question}</div>
                <span className="svcgo mono">자세히 →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
