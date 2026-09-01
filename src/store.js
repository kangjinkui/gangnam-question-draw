const KEY = 'gangnam-question-draw-v1';
const seed = [
  ['Q-000001','우리 구가 앞으로 가장 먼저 준비해야 할 변화는 무엇이라고 생각하시나요?','미래전략과','주무관','김강남','FULL','APPROVED'],
  ['Q-000002','직원들이 더 즐겁게 협업할 수 있도록 바꾸고 싶은 조직문화가 있으신가요?','스마트도시과','','','DEPARTMENT','APPROVED'],
  ['Q-000003','구청장님께서 출근길에 가장 자주 떠올리는 생각이 궁금합니다.','','','','ANONYMOUS','SUBMITTED'],
  ['Q-000004','강남의 미래를 한 단어로 표현한다면 무엇인가요?','문화도시과','주무관','이한강','FULL','HELD'],
  ['Q-000005','공직 생활 중 가장 보람 있었던 순간을 들려주세요.','','','','ANONYMOUS','APPROVED']
].map(([id,text,department,position,name,disclosure,status],i)=>({id,text,displayText:text,department,position,name,disclosure,status,createdAt:new Date(Date.now()-i*3600000).toISOString(),drawOrder:null}));

function initial(){ return { questions:seed, current:null, drawCount:0, drawLocked:false, audit:[] }; }
export function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || initial(); } catch { return initial(); } }
export function save(state){ localStorage.setItem(KEY, JSON.stringify(state)); window.dispatchEvent(new Event('question-store')); }
export function reset(){ localStorage.removeItem(KEY); return initial(); }
