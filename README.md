# github_clone

REA로 수집한 `morluto/rea` 공개 저장소 화면을 기반으로 만든 React 프론트엔드 프로토타입입니다.

## 실행

Node.js 24 이상을 권장합니다.

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

브라우저에서 `http://127.0.0.1:4173/#/morluto/rea`를 엽니다.

## 구현 범위

- 저장소 메인, 디렉터리·파일 탐색, README 미리보기와 코드 보기
- 이슈 목록·검색·상태 및 라벨 필터, 이슈 상세
- 로컬 이슈 생성·댓글·닫기 및 재열기, 브라우저 저장
- 파일 검색, 복사·다운로드, 원본 GitHub 외부 링크

초기 데이터는 수집 당시의 공개 데이터 스냅샷입니다. GitHub API 실시간 연동 및 원본 저장소에 쓰는 기능은 구현하지 않았습니다. 작성·수정은 브라우저의 localStorage에만 저장됩니다.

## 검증

```bash
npm run test:ui
npm run build
npm run test:sites
```

DOM 통합 테스트는 저장소→파일 이동, 이슈 검색, 생성·댓글·상태 변경, 재마운트 후 로컬 저장 유지를 확인합니다. 실제 브라우저 검증과 원본 화면 비교의 진행 상황은 [design-qa.md](design-qa.md)에 기록합니다. 시각 검증은 아직 완료되지 않았습니다.

선택 사항인 `scripts/capture-preview.mjs`는 같은 상위 폴더의 `../rea` CLI와 디버깅 포트 9222에서 실행 중인 분석용 Chrome을 사용합니다. 원본·프리뷰 캡처와 임시 실행 결과는 로컬 `evidence/`에 보관하며 Git에는 포함하지 않습니다.

## 출처

- 화면·콘텐츠 참고: [morluto/rea](https://github.com/morluto/rea)
- REA 소스 및 README 스냅샷: [MIT 라이선스](public/REA-LICENSE.txt)
- 아이콘: GitHub의 `@primer/octicons-react`

이 프로젝트는 GitHub 공식 서비스가 아닌 로컬 학습용 재구현입니다.
