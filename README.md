# github_clone

REA로 수집한 `morluto/rea` 공개 저장소 화면을 바탕으로 만든 React 앱입니다. 로컬 API 서버를 통해 YeonCheols 계정으로 공식 GitHub API에 연결합니다.

## 실행

Node.js 24 이상을 권장합니다.

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

브라우저에서 `http://127.0.0.1:4173/`를 엽니다. 특정 저장소는 `#/owner/repository`로 이동합니다.

## 구현 범위

- 저장소 메인, 디렉터리·파일 탐색, README 미리보기와 코드 보기
- 이슈 목록·검색·상태 및 라벨 필터, 이슈 상세
- 실제 GitHub 이슈 생성·댓글·닫기 및 재열기, Star/Unstar
- 스냅샷 모드의 로컬 이슈 생성·댓글·상태 변경 및 브라우저 저장
- 파일 검색, 복사·다운로드, 원본 GitHub 외부 링크

기본 화면은 **GitHub 모드**입니다. 저장소 정보, 기본 브랜치의 디렉터리·파일·README·최신 커밋·언어 통계, 이슈 검색과 상세·댓글을 API로 조회합니다. 이슈와 댓글은 페이지를 나누어 더 불러올 수 있습니다. GitHub 모드의 작성·변경은 실제 선택한 저장소에 반영되며 GitHub가 해당 계정에 허용한 권한으로만 동작합니다. 다른 사람의 이슈 닫기는 관리 권한이 없으면 비활성화됩니다. 새로고침으로 현재 데이터를 다시 조회하며 실시간 푸시 갱신은 구현하지 않았습니다.

상단의 **스냅샷 모드**로 전환하면 기존 수집 데이터와 브라우저 내부 저장을 사용합니다. API 실패를 로컬 저장 성공으로 대체하지 않으며 두 모드의 데이터는 섞지 않습니다.

로컬 API는 `vite.config.mjs`의 플러그인과 `server/github-api.mjs`로 구동됩니다. 호스트·요청 출처와 쓰기 요청의 세션 헤더를 확인하고, 서버에서 `.git/gh-local` 인증만 사용합니다. 저장소 API의 `repository=owner/repo`는 형식을 검증하고 해당 계정 권한으로 요청합니다. 토큰을 브라우저에 전달하지 않습니다. **이 API는 Vite 개발 서버에서만 제공되며**, 정적 빌드나 Sites 배포에는 포함되지 않습니다.

파일별 최신 커밋, 전체 트리 검색, 브랜치 전환, PR·Actions·Projects 편집, GitHub의 완전한 README HTML 렌더링은 아직 연결하지 않았습니다. 파일 검색은 조회한 디렉터리까지를 대상으로 하며, 기본 파일 API로 읽을 수 없는 큰 파일은 원본 GitHub에서 확인합니다. 외부 앱·알림 설정·Fork는 원본 서비스 링크로 연결합니다.

## 저장소 전용 GitHub 인증

전역 GitHub CLI 계정과 시스템 키체인을 변경하지 않으려면 일반 터미널에서 실행합니다.

```bash
node scripts/github-local.mjs login
```

브라우저에서는 `YeonCheols` 계정으로 인증합니다. 토큰은 접근 권한을 제한한 `.git/gh-local` 파일에만 저장되며 Git 추적 대상에 들어가지 않습니다. Git 인증 helper 역시 이 저장소의 `.git/config`에만 설정됩니다.

기존에 저장소 전용 인증을 완료했다면 재인증할 필요가 없습니다. API 서버는 먼저 인증 계정이 `YeonCheols`인지 확인하고, 토큰이 없거나 만료된 경우에만 로그인 안내를 표시합니다. 전역 GitHub 계정·인증 helper는 변경하지 않습니다.

이후 확인 및 푸시:

```bash
node scripts/github-local.mjs status
node scripts/github-local.mjs push
```

## 검증 명령

```bash
npm run test:ui
npm run test:api
npm run test:routes
npm run build
npm run test:sites
```

DOM 통합 테스트는 스냅샷 모드와 API 대체 응답 기반의 파일 조회·이슈 생성·댓글·상태 변경, 오류 시 입력 보존, 재마운트 후 서버 데이터 재조회를 확인합니다. API 미들웨어 테스트는 계정·출처·세션 검사, 입력 검증, 페이지 처리와 기본·선택 저장소의 대상 경로와 잘못된 저장소 식별자 거부를 검증합니다. 테스트는 실제 GitHub에 글을 작성하지 않습니다. 실제 브라우저 검증과 원본 화면 비교의 진행 상황은 [design-qa.md](design-qa.md)에 기록합니다. 시각 검증은 아직 완료되지 않았습니다.

선택 사항인 `scripts/capture-preview.mjs`는 같은 상위 폴더의 `../rea` CLI와 디버깅 포트 9222에서 실행 중인 분석용 Chrome을 사용합니다. 원본·프리뷰 캡처와 임시 실행 결과는 로컬 `evidence/`에 보관하며 Git에는 포함하지 않습니다.

## 출처

- 화면·콘텐츠 참고: [morluto/rea](https://github.com/morluto/rea)
- REA 소스 및 README 스냅샷: [MIT 라이선스](public/REA-LICENSE.txt)
- 아이콘: GitHub의 `@primer/octicons-react`

이 프로젝트는 GitHub 공식 서비스가 아닌 로컬 학습용 재구현입니다.

## REA의 역할

기존 REA CLI로 수집한 화면·접근성 자료와 사용자가 추가 제공한 스크린샷을 재구현 근거로 사용했습니다. 공식 `reverse-engineer-anything` 스킬은 조사 지침이며 앱 런타임이나 코드 생성 엔진이 아닙니다. 스킬의 “When the user asks to build something, use normal coding tools and separate observed behavior from design choices” 지침에 따라 구현에는 일반 코딩 도구를 사용합니다. 수집하지 않은 원본 동작은 추가 관찰이 필요합니다.

공식 API 계약: [Repository contents](https://docs.github.com/en/rest/repos/contents), [Issues](https://docs.github.com/en/rest/issues/issues), [Issue comments](https://docs.github.com/en/rest/issues/comments).

## GitHub 앱 전체 조사 — 추가 수집

범위를 단일 `morluto/rea` 저장소에서 로그인 홈·전역 탐색과 GitHub 주요 기능으로 확장 중입니다. 현재 구현이 전체 GitHub 기능을 지원한다는 뜻은 아닙니다. 먼저 홈과 탐색 메뉴에서 출발하는 URL 목록과 화면 근거를 수집합니다.

```bash
node scripts/capture-github-app.mjs
```

기존 분석용 Chrome에서 `https://github.com/`을 YeonCheols 계정으로 열고 터미널 안내에 따라 진행합니다. GitHub API용 `.git/gh-local` 인증과 Chrome 웹사이트 로그인은 별개입니다. REA가 선언된 홈 이동·하단 스크롤·관찰된 전역/사용자 메뉴 클릭을 수행합니다. 스크린샷과 접근성 자료, URL·등장 위치·중복을 정리한 `links.json`, 제한과 누락을 기록한 `summary.json`이 `evidence/github-app-*`에 저장됩니다. 기존 수집은 유지합니다.

쿠키·스토리지·원시 HTML·응답 본문은 이 수집에서 요청하지 않습니다. 지연 로딩과 숨은 메뉴의 모든 링크를 발견했다는 보장은 하지 않으며, 링크 목록과 목적지 화면 분석 완료는 구분합니다. 링크 목적지를 자동으로 모두 방문하거나 설정·로그아웃·작성 동작을 실행하지 않습니다. 이후 목록을 바탕으로 저장소·Issues·PR·Actions·검색·프로필·설정을 단계적으로 분석·재구현합니다.

### 계정 홈

빈 주소 `http://127.0.0.1:4173/`와 `#/`는 이제 별도의 계정 Dashboard를 표시합니다. GitHub 로고도 계정 홈으로 이동합니다. 로그인 계정의 저장소 목록과 이슈·PR 요약을 `/api/github/dashboard`로 조회하고, 저장소 검색·더 보기·계정 메뉴를 제공합니다. 스냅샷 모드에서 홈의 계정 데이터는 저장하지 않습니다.

이제 `morluto/rea` 외에도 계정이 접근할 수 있는 저장소의 메인·기본 브랜치 파일·README·Issues를 같은 로컬 화면에서 탐색할 수 있습니다. 선택한 `owner/repo`를 검증해 API 대상으로 전달하며, Clone 주소와 기본 브랜치도 저장소별로 바뀝니다. 아직 구현하지 않은 PR·Actions·설정 등 다른 화면의 링크는 원본 GitHub로 이동합니다. Copilot 입력은 원본 Copilot 서비스로 연결하며 이 앱에서 모델 답변을 생성하지 않습니다. Top repositories 목록은 사용한 공개 API의 최신 push 순서이며 원본 홈의 개인화 순위와 다를 수 있습니다. Changelog는 수집 당시 문구입니다.

홈 프리뷰 비교와 주요 목적지의 다음 수집을 한 번에 진행하려면, 분석용 Chrome에서 원본 로그인 홈을 연 상태로 실행합니다.

```bash
node scripts/capture-github-app.mjs --preview-home --pages-from evidence/github-app-ABbieo/links.json
```

이 명령은 현재 프로젝트의 로컬 수집 폴더를 사용하므로 해당 원본 수집이 존재해야 합니다. 앱 프리뷰 서버도 실행 중이어야 합니다. 경로별 읽기 캡처이며 쓰기·로그아웃·설정 변경은 수행하지 않습니다. 목적지 캡처가 끝나도 GitHub 전체 앱 재구현이 완료된 것은 아닙니다.

### 두 번째 수집 결과 반영

`evidence/github-app-BugYCL/`에서 목적지 25개를 포함한 캡처 30개와 관찰된 URL 1,184개를 확인했습니다. SHA-256/크기를 확인하고 모든 목적지의 화면·접근성 구조를 검토했습니다. 전역 Issues·PR 경로는 각각 `/issues/assigned`, `/pulls/inbox`로 이동하는 것이 관찰됐습니다. 분석 요약·Evidence ID·화면별 범위는 같은 폴더의 `analysis.json`에 기록합니다. 링크를 관찰한 것과 해당 목적지의 기능을 구현한 것은 구분합니다.

홈 프리뷰의 대기 선택자가 여러 링크를 선택한 오류는 첫 번째 저장소 링크 하나만 가리키도록 수정했습니다. 스크린샷 자체는 이미 저장되어 원본과 비교했습니다. 홈 사이드바의 가로 넘침을 수정하고, 새로 확보한 전역 탐색 메뉴의 서랍 구조와 링크를 반영했습니다. 홈에서 본인 저장소와 파일 사이를 이동하는 흐름은 사용자가 실제 브라우저에서 확인했습니다. 다른 화면의 시각 검증까지 완료한 것은 아닙니다.

### 전역 저장소·Issues·PR

- `#/repos`: 기여·소유·Fork·관리 저장소 목록, 정렬·검색·페이지 이동·Star. 검색과 관리 권한 필터는 조회한 페이지 안에서 적용되며 화면에도 이 제한을 표시합니다. 활동 그래프는 구현하지 않았습니다.
- `#/issues/assigned`: 할당·작성·언급 이슈, 검색·열림/닫힘·정렬·페이지 이동. 새 이슈는 저장소를 선택한 뒤 해당 저장소의 기존 작성 화면으로 이동합니다.
- `#/pulls/inbox`: 리뷰 요청·초안·리뷰 대기·수정 요청·승인된 PR 그룹, 기간·저장소 필터와 작성/할당/관련/리뷰 목록. 공식 API 검색으로 분류하며 원본 Inbox의 모든 조건과 일치하지 않습니다. 팀 요청은 미조회로 표시하고 PR 상세·병합은 원본으로 연결합니다.

원본 캡처의 화면 구조와 접근성 자료를 바탕으로 재구현하고, 데이터는 `.git/gh-local`의 계정으로 공식 API에서 조회합니다. 프로필·설정은 아직 원본 GitHub로 연결합니다. 새 화면의 렌더링 비교를 위해 프리뷰 서버와 원본 로그인 홈을 분석용 Chrome에 준비한 뒤 실행합니다.

```bash
node scripts/capture-github-app.mjs --preview-account-pages
```

이 명령은 로컬 세 화면만 수집합니다. 원본 홈·메뉴까지 포함하려면 `--include-source`를 추가합니다. 자동 테스트의 모의 응답 검증과 실제 API·브라우저 검증은 구분합니다.

### 프로필과 공개 프로필 설정

`#/YeonCheols`에서 Overview·Repositories·Stars를 탐색합니다. 계정 공개 정보와 프로필 README, 고정 저장소·기여 달력, 소유 저장소·Star 목록을 공식 API에서 조회합니다. 조회가 거부된 선택 영역은 미조회로 표시합니다. 저장소 목록 검색·타입 필터는 조회한 페이지 안에서 적용됩니다. Stars에서 Unstar는 실제 GitHub에 반영됩니다. Lists·Achievements·활동 그래프·Projects·Packages는 원본 GitHub로 연결하며, README의 raw HTML은 렌더링하지 않습니다.

`#/settings/profile`에서는 이름·소개·URL·회사·위치·Twitter 사용자명·구직 여부를 편집합니다. **Update profile은 실제 계정의 공개 프로필을 변경합니다.** 바꾼 필드만 전송하며 권한 거부 시 입력을 유지합니다. 사진·이메일 공개·대명사·소셜 계정·활동 공개·테마·접근성·보안 설정은 원본에서 관리합니다. 계정 업데이트는 인증에 허용된 권한으로만 처리하며 전역 인증을 변경하지 않습니다. API 계약은 [Get/Update the authenticated user](https://docs.github.com/en/rest/users/users#update-the-authenticated-user)를 따릅니다.

새 네 화면만 읽기 수집하려면 분석용 Chrome에서 `http://127.0.0.1:4173/`를 열고 다음 명령을 사용합니다. 실제 프로필 저장이나 Unstar는 수집 스크립트에서 실행하지 않습니다. 이전 수집의 크기 차이를 줄이려면 분석용 Chrome의 로컬 프리뷰와 원본 GitHub에서 각각 `⌘0`으로 확대 비율을 초기화합니다.

```bash
node scripts/capture-github-app.mjs --preview-profile-pages
```

자동 테스트는 모의 API 응답을 사용합니다. 새 프로필 화면의 실제 API·렌더링 비교는 아직 완료되지 않았습니다.
