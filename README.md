# 강남, 묻고 답하다

직원 질문을 접수·검토하고 정례조례 현장에서 중복 없이 추첨하는 웹앱입니다.

## 화면

- `/#submit`: 직원 모바일 질문 접수
- `/#admin`: 운영자 질문 검토 및 상태 관리
- `/#stage`: 추첨 조작 및 행사 송출 화면

데이터는 Neon PostgreSQL에 저장됩니다. 행사 화면 상태도 DB에서 공유하므로 여러 컴퓨터에서 `/#stage`를 열면 추첨 애니메이션과 공개 질문이 자동으로 동기화됩니다. 운영자 PIN이 저장된 컴퓨터에만 추첨 및 완료 버튼이 보이며, 송출용 컴퓨터는 PIN 없이 화면만 표시할 수 있습니다.

## 로컬 개발

```bash
npm install
copy .env.example .env.local
vercel dev
```

## Vercel + Neon 설정

Vercel 프로젝트의 Environment Variables에 다음 값을 설정합니다.

- `DATABASE_URL`: Neon이 제공하는 PostgreSQL 연결 문자열
- `OPERATOR_PIN`: 운영자만 아는 PIN

첫 API 요청 시 `questions`, `event_state`, `audit_logs` 테이블이 자동 생성됩니다. 운영자는 관리자 화면에서 PIN을 입력한 뒤 질문을 승인하고, 행사 화면에서 추첨합니다. 사회자/송출 컴퓨터는 같은 배포 주소의 `/#stage`만 열어 두면 됩니다.

## 동기화 및 중복 방지

- 행사 화면은 서버 상태를 0.5초마다 확인합니다.
- 추첨 상태는 `IDLE → DRAWING → REVEALED` 순서로 모든 컴퓨터에 공유됩니다.
- PostgreSQL 행 잠금과 단일 SQL 트랜잭션으로 동시 추첨 및 중복 당첨을 차단합니다.
- `답변 완료` 또는 `현장 보류` 후에만 다음 추첨이 가능합니다.
