const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim();

export async function submitQuestion(payload) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL 환경변수가 설정되지 않았습니다.');
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'submit', payload })
  });

  if (!response.ok) {
    throw new Error(`질문 접수 서버가 응답하지 않습니다. (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Apps Script 웹 앱을 로그인 없이 접근할 수 있도록 배포해 주세요.');
  }

  const result = await response.json();
  if (!result.ok) throw new Error(result.error || '질문 접수에 실패했습니다.');
  return result.data;
}
