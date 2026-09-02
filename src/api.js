async function callApi(action, payload = {}) {
  const response = await fetch('/api', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.error || `서버가 응답하지 않습니다. (${response.status})`);
  return result.data;
}
export function submitQuestion(payload) { return callApi('submit', payload); }
export function listQuestions(operatorPin) { return callApi('list', { operatorPin }); }
export function moderateQuestion(operatorPin, id, status) { return callApi('moderate', { operatorPin, id, status }); }
export function updateQuestion(operatorPin, id, text) { return callApi('updateQuestion', { operatorPin, id, text }); }
export function deleteQuestion(operatorPin, id) { return callApi('deleteQuestion', { operatorPin, id }); }
export function approveQuestions(operatorPin, ids) { return callApi('approveBatch', { operatorPin, ids }); }
export function drawQuestion(operatorPin) { return callApi('draw', { operatorPin }); }
export function finishQuestion(operatorPin, id, status) { return callApi('finish', { operatorPin, id, status }); }
export function seedTestQuestions(operatorPin, count = 100) { return callApi('seedTest', { operatorPin, count }); }
export function getStageState() { return callApi('stageState'); }
