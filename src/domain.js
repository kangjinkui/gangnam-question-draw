export const STATUSES = { SUBMITTED:'접수', APPROVED:'승인', HELD:'보류', EXCLUDED:'제외', DRAWN:'추첨 완료' };
export const DISCLOSURES = { ANONYMOUS:'익명', DEPARTMENT:'부서 공개', FULL:'입력 정보 공개' };

export function validateQuestion(value) {
  const text = String(value || '').trim();
  if (text.length < 10) return '질문을 10자 이상 입력해 주세요.';
  if (text.length > 100) return '질문은 100자까지 입력할 수 있어요.';
  return '';
}

export function publicAuthor(question) {
  if (question.disclosure === 'ANONYMOUS') return '익명의 직원';
  if (question.disclosure === 'DEPARTMENT') return question.department || '소속 비공개';
  return [question.department, question.position, question.name].filter(Boolean).join(' · ') || '익명의 직원';
}

export function drawCandidate(questions, random = Math.random) {
  const candidates = questions.filter(q => q.status === 'APPROVED' && !q.drawOrder);
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
