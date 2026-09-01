# 강남, 묻고 답하다

직원 질문을 접수·검토하고 정례조례 현장에서 중복 없이 추첨하는 웹앱입니다.

## 화면

- `/#submit` 직원용 모바일 질문 접수
- `/#admin` 운영자 질문 검토 및 상태 관리
- `/#stage` 16:9 행사 추첨 화면

현재 Vercel 배포본은 브라우저 `localStorage` 기반의 완전한 데모입니다. 운영 데이터는 [`apps-script/Code.gs`](apps-script/Code.gs)를 Google 스프레드시트에 연결해 사용할 수 있습니다. 운영자 인증과 역할 검사는 Apps Script 서버에서 수행하도록 구현되어 있습니다.

## 개발

```bash
npm install
npm run dev
npm test
npm run build
```

## Apps Script 운영 연결

1. 빈 Google 스프레드시트에서 Apps Script 프로젝트를 엽니다.
2. `apps-script/Code.gs`, `appsscript.json`을 복사합니다.
3. `setupSpreadsheet()`를 한 번 실행합니다.
4. `운영자` 시트에 이메일, 역할(`REVIEWER`, `DRAW_OPERATOR`, `ADMIN`), `TRUE`를 입력합니다.
5. 웹 앱으로 배포합니다. 접수는 공개 가능하지만 운영 API는 로그인 이메일과 역할을 서버에서 검증합니다.

> 실제 운영 전 개인정보 보유기간, 검토 기준, 허용 계정 및 Google Workspace의 `Session.getActiveUser()` 정책을 담당자와 확인하세요.
