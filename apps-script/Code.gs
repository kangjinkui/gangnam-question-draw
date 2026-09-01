const SHEETS = { SETTINGS:'설정', QUESTIONS:'질문', DRAWS:'추첨이력', AUDIT:'감사로그', OPERATORS:'운영자' };
const QUESTION_HEADERS = ['질문ID','접수시각','질문원문','공개용질문','부서명','직급','이름','공개범위','상태','검토사유','검토자','검토시각','추첨순번','추첨시각','답변상태'];

function doGet(e) {
  return json_({ ok:true, service:'gangnam-question-draw', time:new Date().toISOString() });
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const actions = { submit:submitQuestion, list:listQuestions, moderate:moderateQuestion, draw:drawQuestion, finish:finishQuestion };
    if (!actions[body.action]) throw new Error('지원하지 않는 요청입니다.');
    return json_({ ok:true, data:actions[body.action](body.payload || {}) });
  } catch (error) { return json_({ ok:false, error:error.message }); }
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActive();
  const specs = [
    [SHEETS.SETTINGS,['항목','설정값'],[['행사명','직원 정례조례'],['접수상태','OPEN'],['추첨상태','READY'],['추첨대상잠금','FALSE'],['현재추첨질문ID',''],['현재화면상태','IDLE']]],
    [SHEETS.QUESTIONS,QUESTION_HEADERS,[]],
    [SHEETS.DRAWS,['추첨순번','추첨시각','질문ID','연출유형','결과상태','진행자'],[]],
    [SHEETS.AUDIT,['기록시각','처리자','행동','질문ID','변경전','변경후','사유'],[]],
    [SHEETS.OPERATORS,['이메일','역할','활성여부'],[]]
  ];
  specs.forEach(([name,headers,rows])=>{ let sh=ss.getSheetByName(name)||ss.insertSheet(name); sh.clear(); sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#07142b').setFontColor('#ffffff'); if(rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows); sh.setFrozenRows(1); sh.autoResizeColumns(1,headers.length); });
}

function submitQuestion(p) {
  const text=String(p.text||'').trim();
  if(text.length<10||text.length>500) throw new Error('질문은 10~500자로 입력해 주세요.');
  if(!['ANONYMOUS','DEPARTMENT','FULL'].includes(p.disclosure)) throw new Error('공개 범위를 선택해 주세요.');
  const sh=sheet_(SHEETS.QUESTIONS), id='Q-'+String(Math.max(0,sh.getLastRow()-1)+1).padStart(6,'0');
  sh.appendRow([id,new Date(),text,text,p.department||'',p.position||'',p.name||'',p.disclosure,'SUBMITTED','','','', '', '', 'PENDING']);
  audit_('PUBLIC','SUBMIT',id,'','SUBMITTED',''); return {id};
}
function listQuestions() { requireRole_(['REVIEWER','ADMIN']); const rows=sheet_(SHEETS.QUESTIONS).getDataRange().getValues(); return rows.slice(1).map(r=>Object.fromEntries(QUESTION_HEADERS.map((h,i)=>[h,r[i]]))); }
function moderateQuestion(p) { const user=requireRole_(['REVIEWER','ADMIN']); if(!['APPROVED','HELD','EXCLUDED'].includes(p.status)) throw new Error('올바르지 않은 상태입니다.'); const sh=sheet_(SHEETS.QUESTIONS),row=findQuestionRow_(sh,p.id),before=sh.getRange(row,9).getValue(); if(p.displayText) sh.getRange(row,4).setValue(String(p.displayText)); sh.getRange(row,9,1,4).setValues([[p.status,p.reason||'',user,new Date()]]); audit_(user,p.status,p.id,before,p.status,p.reason||''); return {id:p.id,status:p.status}; }
function drawQuestion(p) { const user=requireRole_(['DRAW_OPERATOR','ADMIN']),lock=LockService.getScriptLock(); lock.waitLock(5000); try { const sh=sheet_(SHEETS.QUESTIONS),values=sh.getDataRange().getValues(),candidates=[]; values.slice(1).forEach((r,i)=>{if(r[8]==='APPROVED'&&!r[12])candidates.push(i+2)}); if(!candidates.length)return null; const row=candidates[Math.floor(Math.random()*candidates.length)],id=sh.getRange(row,1).getValue(),order=sheet_(SHEETS.DRAWS).getLastRow(); sh.getRange(row,9).setValue('DRAWN');sh.getRange(row,13,1,2).setValues([[order,new Date()]]);sheet_(SHEETS.DRAWS).appendRow([order,new Date(),id,p.effect||'DICE','REVEALED',user]);setSetting_('현재추첨질문ID',id);setSetting_('현재화면상태','REVEALED');audit_(user,'DRAW',id,'APPROVED','DRAWN',''); const r=sh.getRange(row,1,1,15).getValues()[0]; return {id,text:r[3],author:publicAuthor_(r),order}; } finally { lock.releaseLock(); } }
function finishQuestion(p){ const user=requireRole_(['DRAW_OPERATOR','ADMIN']); if(!['ANSWERED','HELD'].includes(p.status))throw new Error('올바르지 않은 결과입니다.');const sh=sheet_(SHEETS.QUESTIONS),row=findQuestionRow_(sh,p.id);sh.getRange(row,15).setValue(p.status);audit_(user,p.status,p.id,'PENDING',p.status,'');setSetting_('현재추첨질문ID','');setSetting_('현재화면상태','IDLE');return {id:p.id,status:p.status}; }

function sheet_(name){const sh=SpreadsheetApp.getActive().getSheetByName(name);if(!sh)throw new Error(name+' 시트가 없습니다. 초기 설정을 실행하세요.');return sh}
function findQuestionRow_(sh,id){const f=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),1).createTextFinder(id).matchEntireCell(true).findNext();if(!f)throw new Error('질문을 찾을 수 없습니다.');return f.getRow()}
function requireRole_(roles){const email=Session.getActiveUser().getEmail();if(!email)throw new Error('Google 로그인이 필요합니다.');const rows=sheet_(SHEETS.OPERATORS).getDataRange().getValues().slice(1),hit=rows.find(r=>String(r[0]).toLowerCase()===email.toLowerCase()&&r[2]===true);if(!hit||!roles.includes(hit[1]))throw new Error('권한이 없습니다.');return email}
function audit_(user,action,id,before,after,reason){sheet_(SHEETS.AUDIT).appendRow([new Date(),user,action,id,JSON.stringify(before),JSON.stringify(after),reason])}
function setSetting_(key,value){const sh=sheet_(SHEETS.SETTINGS),f=sh.getRange(1,1,sh.getLastRow(),1).createTextFinder(key).matchEntireCell(true).findNext();if(f)sh.getRange(f.getRow(),2).setValue(value)}
function publicAuthor_(r){if(r[7]==='ANONYMOUS')return '익명의 직원';if(r[7]==='DEPARTMENT')return r[4]||'소속 비공개';return [r[4],r[5],r[6]].filter(Boolean).join(' · ')||'익명의 직원'}
