const SHEETS = { SETTINGS:'설정', QUESTIONS:'질문', DRAWS:'추첨이력', AUDIT:'감사로그', OPERATORS:'운영자' };
const QUESTION_HEADERS = ['질문ID','접수시각','질문원문','공개용질문','부서명','직급','이름','공개범위','상태','검토사유','검토자','검토시각','추첨순번','추첨시각','답변상태'];

function doGet(e) {
  return json_({ ok:true, service:'gangnam-question-draw', time:new Date().toISOString() });
}
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const actions = { submit:submitQuestion, list:listQuestions, moderate:moderateQuestion, draw:drawQuestion, finish:finishQuestion, seedTest:seedTestQuestions };
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
  if(text.length<10||text.length>100) throw new Error('질문은 10~100자로 입력해 주세요.');
  if(!['ANONYMOUS','DEPARTMENT','FULL'].includes(p.disclosure)) throw new Error('공개 범위를 선택해 주세요.');
  const sh=sheet_(SHEETS.QUESTIONS), id='Q-'+String(Math.max(0,sh.getLastRow()-1)+1).padStart(6,'0');
  sh.appendRow([id,new Date(),text,text,p.department||'',p.position||'',p.name||'',p.disclosure,'SUBMITTED','','','', '', '', 'PENDING']);
  audit_('PUBLIC','SUBMIT',id,'','SUBMITTED',''); return {id};
}
function listQuestions(p) { requireOperatorPin_(p); const rows=sheet_(SHEETS.QUESTIONS).getDataRange().getValues(); return rows.slice(1).map(questionFromRow_); }
function moderateQuestion(p) { const user=requireOperatorPin_(p); if(!['APPROVED','HELD','EXCLUDED'].includes(p.status)) throw new Error('올바르지 않은 상태입니다.'); const sh=sheet_(SHEETS.QUESTIONS),row=findQuestionRow_(sh,p.id),before=sh.getRange(row,9).getValue(); if(p.displayText) sh.getRange(row,4).setValue(String(p.displayText)); sh.getRange(row,9,1,4).setValues([[p.status,p.reason||'',user,new Date()]]); audit_(user,p.status,p.id,before,p.status,p.reason||''); return {id:p.id,status:p.status}; }
function drawQuestion(p) { const user=requireOperatorPin_(p),lock=LockService.getScriptLock(); lock.waitLock(5000); try { const sh=sheet_(SHEETS.QUESTIONS),values=sh.getDataRange().getValues(),candidates=[]; values.slice(1).forEach((r,i)=>{if(r[8]==='APPROVED'&&!r[12])candidates.push(i+2)}); if(!candidates.length)return null; const row=candidates[Math.floor(Math.random()*candidates.length)],id=sh.getRange(row,1).getValue(),order=sheet_(SHEETS.DRAWS).getLastRow(); sh.getRange(row,9).setValue('DRAWN');sh.getRange(row,13,1,2).setValues([[order,new Date()]]);sheet_(SHEETS.DRAWS).appendRow([order,new Date(),id,p.effect||'DICE','REVEALED',user]);setSetting_('현재추첨질문ID',id);setSetting_('현재화면상태','REVEALED');audit_(user,'DRAW',id,'APPROVED','DRAWN',''); const r=sh.getRange(row,1,1,15).getValues()[0]; return {id,text:r[3],author:publicAuthor_(r),order}; } finally { lock.releaseLock(); } }
function finishQuestion(p){ const user=requireOperatorPin_(p); if(!['ANSWERED','HELD'].includes(p.status))throw new Error('올바르지 않은 결과입니다.');const sh=sheet_(SHEETS.QUESTIONS),row=findQuestionRow_(sh,p.id);sh.getRange(row,15).setValue(p.status);audit_(user,p.status,p.id,'PENDING',p.status,'');setSetting_('현재추첨질문ID','');setSetting_('현재화면상태','IDLE');return {id:p.id,status:p.status}; }

function seedTestQuestions(p) {
  const user=requireOperatorPin_(p), count=Math.max(1,Math.min(500,Number(p.count)||100));
  const sh=sheet_(SHEETS.QUESTIONS), start=Math.max(0,sh.getLastRow()-1)+1, now=Date.now();
  const topics=['직원들이 더 효율적으로 협업할 수 있는 방법은 무엇인가요?','강남구가 미래를 위해 가장 먼저 준비해야 할 정책은 무엇인가요?','일과 삶의 균형을 위해 개선하고 싶은 제도가 있으신가요?','주민에게 더 가까이 다가가기 위해 어떤 노력이 필요할까요?','구청장님이 공직생활에서 가장 중요하게 생각하는 가치는 무엇인가요?','조직문화를 더 즐겁게 만들 수 있는 아이디어가 궁금합니다.','디지털 기술을 행정에 어떻게 활용하면 좋을까요?','직원들의 성장을 지원하기 위해 어떤 기회를 만들고 싶으신가요?'];
  const departments=['기획예산과','스마트도시과','복지정책과','문화도시과','총무과','민원여권과'];
  const rows=[];
  for(let i=0;i<count;i++){
    const n=start+i,id='Q-'+String(n).padStart(6,'0'),text='[테스트 '+String(i+1).padStart(3,'0')+'] '+topics[i%topics.length];
    const disclosure=['ANONYMOUS','DEPARTMENT','FULL'][i%3],status=i%10<8?'APPROVED':i%10===8?'SUBMITTED':'HELD';
    rows.push([id,new Date(now-i*60000),text,text,departments[i%departments.length],i%2?'주무관':'팀장','테스트직원'+(i+1),disclosure,status,'',user,status==='APPROVED'?new Date():'','','','PENDING']);
  }
  sh.getRange(sh.getLastRow()+1,1,rows.length,QUESTION_HEADERS.length).setValues(rows);
  audit_(user,'SEED_TEST','',{}, {count:count},'테스트 질문 생성');
  return {count:count,approved:rows.filter(r=>r[8]==='APPROVED').length};
}

function sheet_(name){const sh=SpreadsheetApp.getActive().getSheetByName(name);if(!sh)throw new Error(name+' 시트가 없습니다. 초기 설정을 실행하세요.');return sh}
function findQuestionRow_(sh,id){const f=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),1).createTextFinder(id).matchEntireCell(true).findNext();if(!f)throw new Error('질문을 찾을 수 없습니다.');return f.getRow()}
function requireOperatorPin_(p){const saved=PropertiesService.getScriptProperties().getProperty('OPERATOR_PIN');if(!saved)throw new Error('Apps Script에 OPERATOR_PIN 스크립트 속성을 설정해 주세요.');if(!p||String(p.operatorPin||'')!==saved)throw new Error('운영자 PIN이 올바르지 않습니다.');return 'PIN_OPERATOR'}
function questionFromRow_(r){return {id:r[0],createdAt:r[1],text:r[2],displayText:r[3],department:r[4],position:r[5],name:r[6],disclosure:r[7],status:r[8],reason:r[9],reviewer:r[10],reviewedAt:r[11],drawOrder:r[12],drawnAt:r[13],answerStatus:r[14]}}
function audit_(user,action,id,before,after,reason){sheet_(SHEETS.AUDIT).appendRow([new Date(),user,action,id,JSON.stringify(before),JSON.stringify(after),reason])}
function setSetting_(key,value){const sh=sheet_(SHEETS.SETTINGS),f=sh.getRange(1,1,sh.getLastRow(),1).createTextFinder(key).matchEntireCell(true).findNext();if(f)sh.getRange(f.getRow(),2).setValue(value)}
function publicAuthor_(r){if(r[7]==='ANONYMOUS')return '익명의 직원';if(r[7]==='DEPARTMENT')return r[4]||'소속 비공개';return [r[4],r[5],r[6]].filter(Boolean).join(' · ')||'익명의 직원'}
