// 방문 경로(UTM·유입 사이트) 한 건 저장. 사례 문장·이름·IP·브라우저 정보는 받지도 저장하지도 않는다.
const { ready, cleanTag, body, isBot, sb } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  if (isBot(req) || !ready()) return res.status(204).end();
  const b = body(req);
  const row = {
    utm_source: cleanTag(b.utm_source),
    utm_medium: cleanTag(b.utm_medium),
    utm_campaign: cleanTag(b.utm_campaign),
    utm_term: cleanTag(b.utm_term),
    utm_content: cleanTag(b.utm_content),
    referrer_host: cleanTag(b.referrer_host, 120),
    landing_path: cleanTag(b.landing_path, 120) || '/',
  };
  try { await sb('visits', { method: 'POST', body: JSON.stringify(row) }); } catch (e) { /* 통계 실패는 방문자에게 영향 없음 */ }
  return res.status(204).end();
};
