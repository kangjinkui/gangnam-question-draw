import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

const DISCLOSURES = ['ANONYMOUS', 'DEPARTMENT', 'FULL'];
const MODERATION_STATUSES = ['APPROVED', 'HELD', 'EXCLUDED'];
const ANSWER_STATUSES = ['ANSWERED', 'HELD'];
let schemaReady;

function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 환경변수가 없습니다.');
  return neon(process.env.DATABASE_URL);
}
function requireOperator(payload) {
  const expected = process.env.OPERATOR_PIN;
  const received = String(payload?.operatorPin || '');
  if (!expected) throw new Error('OPERATOR_PIN 환경변수가 없습니다.');
  const a = Buffer.from(received), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const error = new Error('운영자 PIN이 올바르지 않습니다.'); error.status = 401; throw error;
  }
}
async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    text VARCHAR(500) NOT NULL, display_text VARCHAR(500) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT '', position VARCHAR(100) NOT NULL DEFAULT '', name VARCHAR(100) NOT NULL DEFAULT '',
    disclosure VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED', reason TEXT NOT NULL DEFAULT '',
    reviewer VARCHAR(100) NOT NULL DEFAULT '', reviewed_at TIMESTAMPTZ, draw_order INTEGER UNIQUE,
    drawn_at TIMESTAMPTZ, answer_status VARCHAR(20)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS event_state (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton), screen_state VARCHAR(20) NOT NULL DEFAULT 'IDLE',
    current_question_id BIGINT REFERENCES questions(id), reveal_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`INSERT INTO event_state (singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), action VARCHAR(40) NOT NULL,
    question_id BIGINT, detail JSONB NOT NULL DEFAULT '{}'::jsonb
  )`;
}
function initialize(sql) {
  if (!schemaReady) schemaReady = ensureSchema(sql).catch(error => { schemaReady = undefined; throw error; });
  return schemaReady;
}
function question(row) {
  return {id:`Q-${String(row.id).padStart(6,'0')}`,createdAt:row.created_at,text:row.text,displayText:row.display_text,
    department:row.department,position:row.position,name:row.name,disclosure:row.disclosure,status:row.status,
    reason:row.reason,reviewer:row.reviewer,reviewedAt:row.reviewed_at,drawOrder:row.draw_order,drawnAt:row.drawn_at,answerStatus:row.answer_status};
}
function numericId(value) {
  const match=String(value||'').match(/^(?:Q-)?(\d+)$/); if(!match) throw new Error('올바르지 않은 질문 ID입니다.'); return Number(match[1]);
}
function author(row) {
  if(row.disclosure==='ANONYMOUS') return '익명의 직원';
  if(row.disclosure==='DEPARTMENT') return row.department||'소속 비공개';
  return [row.department,row.position,row.name].filter(Boolean).join(' · ')||'익명의 직원';
}
async function handle(action,payload,sql) {
  if(action==='submit') {
    const text=String(payload.text||'').trim();
    if(text.length<10||text.length>500) throw new Error('질문은 10자 이상 500자 이하로 입력해 주세요.');
    if(!DISCLOSURES.includes(payload.disclosure)) throw new Error('공개 범위가 올바르지 않습니다.');
    const rows=await sql`INSERT INTO questions(text,display_text,department,position,name,disclosure) VALUES
      (${text},${text},${String(payload.department||'').slice(0,100)},${String(payload.position||'').slice(0,100)},${String(payload.name||'').slice(0,100)},${payload.disclosure}) RETURNING id`;
    return {id:`Q-${String(rows[0].id).padStart(6,'0')}`};
  }
  if(action==='stageState') {
    const rows=await sql`SELECT e.screen_state,e.reveal_at,e.updated_at,q.id,q.display_text,q.department,q.position,q.name,q.disclosure,q.draw_order,
      (SELECT count(*)::int FROM questions WHERE status='APPROVED' AND draw_order IS NULL) eligible
      FROM event_state e LEFT JOIN questions q ON q.id=e.current_question_id WHERE e.singleton=TRUE`;
    const row=rows[0], revealed=row.screen_state==='DRAWING'&&row.reveal_at&&new Date(row.reveal_at)<=new Date();
    const screenState=revealed?'REVEALED':row.screen_state;
    if(revealed) await sql`UPDATE event_state SET screen_state='REVEALED',updated_at=now() WHERE singleton=TRUE AND screen_state='DRAWING'`;
    return {screenState,eligible:row.eligible,revealAt:row.reveal_at,updatedAt:row.updated_at,
      current:row.id?{id:`Q-${String(row.id).padStart(6,'0')}`,displayText:row.display_text,author:author(row),drawOrder:row.draw_order}:null};
  }
  requireOperator(payload);
  if(action==='importQuestions') {
    if(!Array.isArray(payload.questions)||!payload.questions.length||payload.questions.length>1000) throw new Error('가져올 질문 목록이 올바르지 않습니다.');
    const allowedStatuses=['SUBMITTED','APPROVED','HELD','EXCLUDED','DRAWN'];
    const normalized=payload.questions.map(item=>{
      const id=numericId(item.id), text=String(item.text||'').trim(), disclosure=String(item.disclosure||''), status=String(item.status||'');
      if(!text||text.length>500||!DISCLOSURES.includes(disclosure)||!allowedStatuses.includes(status)) throw new Error(`${item.id} 데이터가 올바르지 않습니다.`);
      return {id,created_at:item.createdAt||null,text,display_text:String(item.displayText||text).slice(0,500),department:String(item.department||'').slice(0,100),
        position:String(item.position||'').slice(0,100),name:String(item.name||'').slice(0,100),disclosure,status,reason:String(item.reason||''),
        reviewer:String(item.reviewer||''),reviewed_at:item.reviewedAt||null,draw_order:item.drawOrder?Number(item.drawOrder):null,
        drawn_at:item.drawnAt||null,answer_status:item.answerStatus&&item.answerStatus!=='PENDING'?String(item.answerStatus):null};
    });
    const rows=await sql`INSERT INTO questions(id,created_at,text,display_text,department,position,name,disclosure,status,reason,reviewer,reviewed_at,draw_order,drawn_at,answer_status)
      SELECT x.id,COALESCE(x.created_at,now()),x.text,x.display_text,x.department,x.position,x.name,x.disclosure,x.status,x.reason,x.reviewer,
        x.reviewed_at,x.draw_order,x.drawn_at,x.answer_status
      FROM jsonb_to_recordset(${JSON.stringify(normalized)}::jsonb) AS x(id bigint,created_at timestamptz,text varchar,display_text varchar,department varchar,
        position varchar,name varchar,disclosure varchar,status varchar,reason text,reviewer varchar,reviewed_at timestamptz,draw_order integer,drawn_at timestamptz,answer_status varchar)
      ON CONFLICT(id) DO UPDATE SET created_at=EXCLUDED.created_at,text=EXCLUDED.text,display_text=EXCLUDED.display_text,department=EXCLUDED.department,
        position=EXCLUDED.position,name=EXCLUDED.name,disclosure=EXCLUDED.disclosure,status=EXCLUDED.status,reason=EXCLUDED.reason,reviewer=EXCLUDED.reviewer,
        reviewed_at=EXCLUDED.reviewed_at,draw_order=EXCLUDED.draw_order,drawn_at=EXCLUDED.drawn_at,answer_status=EXCLUDED.answer_status RETURNING status`;
    await sql`SELECT setval(pg_get_serial_sequence('questions','id'),(SELECT max(id) FROM questions),true)`;
    await sql`INSERT INTO audit_logs(action,detail) VALUES ('IMPORT',${JSON.stringify({count:rows.length})}::jsonb)`;
    return {count:rows.length,statuses:Object.fromEntries(allowedStatuses.map(status=>[status,rows.filter(row=>row.status===status).length]))};
  }
  if(action==='list') return (await sql`SELECT * FROM questions ORDER BY created_at DESC`).map(question);
  if(action==='moderate') {
    if(!MODERATION_STATUSES.includes(payload.status)) throw new Error('올바르지 않은 상태입니다.');
    const id=numericId(payload.id);
    const rows=await sql`UPDATE questions SET status=${payload.status},reviewer='operator',reviewed_at=now() WHERE id=${id} AND draw_order IS NULL RETURNING id`;
    if(!rows.length) throw new Error('질문을 찾을 수 없거나 이미 추첨되었습니다.');
    await sql`INSERT INTO audit_logs(action,question_id,detail) VALUES ('MODERATE',${id},${JSON.stringify({status:payload.status})}::jsonb)`;
    return {id:payload.id,status:payload.status};
  }
  if(action==='draw') {
    const rows=await sql`WITH locked_state AS (SELECT singleton FROM event_state WHERE singleton=TRUE AND screen_state='IDLE' FOR UPDATE),
      candidate AS (SELECT id FROM questions WHERE status='APPROVED' AND draw_order IS NULL ORDER BY random() LIMIT 1 FOR UPDATE SKIP LOCKED),
      picked AS (UPDATE questions q SET status='DRAWN',draw_order=(SELECT COALESCE(max(draw_order),0)+1 FROM questions),drawn_at=now()
        FROM candidate c,locked_state l WHERE q.id=c.id RETURNING q.*),
      state AS (UPDATE event_state SET screen_state='DRAWING',current_question_id=p.id,reveal_at=now()+interval '1.8 seconds',updated_at=now()
        FROM picked p WHERE singleton=TRUE RETURNING p.id)
      SELECT p.* FROM picked p JOIN state s ON s.id=p.id`;
    if(!rows.length) return null;
    const row=rows[0];
    await sql`INSERT INTO audit_logs(action,question_id,detail) VALUES ('DRAW',${row.id},${JSON.stringify({order:row.draw_order})}::jsonb)`;
    return {id:`Q-${String(row.id).padStart(6,'0')}`,text:row.display_text,author:author(row),order:row.draw_order};
  }
  if(action==='finish') {
    if(!ANSWER_STATUSES.includes(payload.status)) throw new Error('올바르지 않은 결과입니다.');
    const id=numericId(payload.id);
    const rows=await sql`WITH updated AS (UPDATE questions SET answer_status=${payload.status} WHERE id=${id} AND status='DRAWN' RETURNING id)
      UPDATE event_state SET screen_state='IDLE',current_question_id=NULL,reveal_at=NULL,updated_at=now()
      WHERE singleton=TRUE AND current_question_id=(SELECT id FROM updated) RETURNING singleton`;
    if(!rows.length) throw new Error('현재 추첨 질문과 일치하지 않습니다.');
    await sql`INSERT INTO audit_logs(action,question_id,detail) VALUES ('FINISH',${id},${JSON.stringify({status:payload.status})}::jsonb)`;
    return {id:payload.id,status:payload.status};
  }
  if(action==='seedTest') {
    const count=Math.min(500,Math.max(1,Number(payload.count)||100));
    const rows=await sql`INSERT INTO questions(text,display_text,department,position,name,disclosure,status)
      SELECT '테스트 질문 '||n||': 강남구의 더 나은 조직문화를 위해 가장 먼저 바꾸고 싶은 것은 무엇인가요?',
      '강남구의 더 나은 조직문화를 위해 가장 먼저 바꾸고 싶은 것은 무엇인가요?','테스트부서','주무관','테스트','ANONYMOUS',
      CASE WHEN n%5=0 THEN 'SUBMITTED' ELSE 'APPROVED' END FROM generate_series(1,${count}) n RETURNING status`;
    return {count:rows.length,approved:rows.filter(r=>r.status==='APPROVED').length};
  }
  throw new Error('지원하지 않는 요청입니다.');
}
export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'POST 요청만 지원합니다.'});
  try {const sql=db();await initialize(sql);const {action,payload={}}=req.body||{};const data=await handle(action,payload,sql);
    res.setHeader('Cache-Control','no-store');return res.status(200).json({ok:true,data});}
  catch(error){console.error(error);return res.status(error.status||400).json({ok:false,error:error.message||'서버 오류가 발생했습니다.'});}
}
