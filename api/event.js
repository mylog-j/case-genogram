// 이용 횟수 한 건 저장: 가계도 만들기(create) · 내려받기(download) · 예시 보기(example) · 직업 답(job)
// 횟수와 고른 직업만 저장한다. 사례 문장·가계도·이름은 받지 않는다.
const { ready, clean, body, isBot, sb, JOBS } = require('./_lib');
const KINDS = ['create', 'download', 'example', 'job'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  if (isBot(req) || !ready()) return res.status(204).end();
  const b = body(req);
  if (KINDS.indexOf(b.kind) < 0) return res.status(400).json({ error: '잘못된 요청이에요.' });
  const row = { kind: b.kind, job: null, job_other: null };
  if (b.kind === 'job') {
    if (JOBS.indexOf(b.job) < 0) return res.status(400).json({ error: '직업을 골라 주세요.' });
    row.job = b.job;
    if (b.job === '기타') row.job_other = clean(b.job_other, 30);
  }
  try { await sb('events', { method: 'POST', body: JSON.stringify(row) }); } catch (e) { /* 무시 */ }
  return res.status(204).end();
};
