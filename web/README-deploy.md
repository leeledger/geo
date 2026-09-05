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
- 2026-09-05: 중복 프로젝트 `web` 의 Git 연결을 끊어 빌드 충돌을 해소했다.

## 커밋 이메일 (자동 배포와 직결)

이 리포는 `.git/config` 에 아래를 박아 두었다.

```
user.name  = leeledger
user.email = 71445292+leeledger@users.noreply.github.com
```

바꾸지 말 것. `luxual8@gmail.com` 로 커밋하면 GitHub 가 그 커밋을
**luxual8-sketch** 계정 소유로 귀속시키는데, 이 계정은 Vercel 팀 멤버가 아니라
배포가 `BLOCKED (TEAM_ACCESS_REQUIRED)` 로 막힌다.
Vercel 팀 멤버 `luxual8-4199` 에 연결된 GitHub 계정은 **leeledger** 다.
