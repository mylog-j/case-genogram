// 써 본 분들의 이야기
// GET  : 보기마다 고른 사람 수 + 관리자가 '게시'로 정한 기타 한 줄 후기
// POST : 직업, 좋았던 점(여러 개), 기타 한 줄(40자), 아쉬웠던 점(관리자만 봄, 300자)
const { ready, clean, body, isBot, sb, LIKES, JOBS } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!ready()) return res.status(503).json({ error: '후기 저장소가 아직 연결되지 않았어요.' });

  if (req.method === 'GET') {
    const r = await sb('reviews?select=likes,like_other,other_status,job,created_at&order=created_at.desc&limit=5000');
    if (!r.ok) return res.status(500).json({ error: '후기를 불러오지 못했어요.' });
    const rows = await r.json();
    const counts = {};
    Object.keys(LIKES).forEach((k) => { counts[k] = 0; });
    rows.forEach((x) => (x.likes || []).forEach((k) => { if (k in counts) counts[k]++; }));
    const others = rows.filter((x) => x.like_other && x.other_status === '게시').slice(0, 12)
      .map((x) => ({ text: x.like_other, job: x.job }));
    return res.status(200).json({
      total: rows.length,
      likes: Object.keys(LIKES).map((k) => ({ key: k, text: LIKES[k], count: counts[k] })),
      others,
    });
  }

  if (req.method === 'POST') {
    if (isBot(req)) return res.status(204).end();
    const b = body(req);
    if (b.website) return res.status(200).json({ ok: true }); // 스팸 함정 칸
    const likes = Array.isArray(b.likes) ? b.likes.filter((k) => Object.prototype.hasOwnProperty.call(LIKES, k)).slice(0, 6) : [];
    const row = {
      job: JOBS.indexOf(b.job) >= 0 ? b.job : null,
      job_other: b.job === '기타' ? clean(b.job_other, 30) : null,
      likes,
      like_other: clean(b.like_other, 40),
      dislike: clean(b.dislike, 300),
      other_status: '게시', // 기타 한 줄도 바로 게시 (관리자가 숨김 가능)
    };
    if (!row.likes.length && !row.like_other && !row.dislike) return res.status(400).json({ error: '좋았던 점이나 아쉬웠던 점을 하나 이상 남겨 주세요.' });
    const r = await sb('reviews', { method: 'POST', body: JSON.stringify(row) });
    if (!r.ok) return res.status(500).json({ error: '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: '지원하지 않는 요청이에요.' });
};
