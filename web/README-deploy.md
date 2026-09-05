# 배포 메모

Vercel 프로젝트: **geo** (codeis' projects)
- Git: leeledger/geo · main 브랜치 push 시 자동 배포
- Root Directory: `web`
- 환경변수: DATABASE_URL · IP_HASH_SALT · ADMIN_TOKEN (Production/Preview)

## 주의

- 프로젝트를 새로 만들지 말 것. 같은 리포를 보는 프로젝트가 둘이면
  Hobby 플랜 동시 빌드 한도에 걸려 배포가 BLOCKED 된다.
- 색인은 막혀 있다. 공개 시 `NEXT_PUBLIC_ALLOW_INDEX=true` 를 환경변수에 추가.
- CLI 수동 배포: `cd web && npx vercel deploy --prod`
