// 관리자: 비밀번호(ADMIN_PASSWORD 환경변수) 확인 후 통계·후기를 돌려주고, 기타 후기 게시 여부를 바꾼다.
const { ready, body, same, sb, LIKES } = require('./_lib');

const kstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const countBy = (rows, fn) => {
  const m = new Map();
  rows.forEach((r) => { const k = fn(r); if (k == null) return; m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
};
const channelOf = (r) => r.utm_source || (r.referrer_host ? r.referrer_host.replace(/^www\./, '') + ' (링크)' : '직접 방문');
const STATUSES = ['대기', '게시', '숨김'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(500).json({ error: 'Vercel 환경변수에 ADMIN_PASSWORD를 넣고 Redeploy 해 주세요.' });
  if (!same(req.headers['x-admin-password'] || '', pass)) return res.status(401).json({ error: '비밀번호가 맞지 않아요.' });
  if (!ready()) return res.status(500).json({ error: 'Supabase 연결 정보가 없어요.' });

  if (req.method === 'PATCH') {
    const b = body(req);
    const id = Number(b.id);
    if (!Number.isInteger(id) || STATUSES.indexOf(b.other_status) < 0) return res.status(400).json({ error: '잘못된 요청이에요.' });
    const r = await sb(`reviews?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ other_status: b.other_status }) });
    if (!r.ok) return res.status(500).json({ error: '바꾸지 못했어요.' });
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: '지원하지 않는 요청이에요.' });

  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const since = encodeURIComponent(new Date(Date.now() - days * 86400 * 1000).toISOString());
  const [vr, er, rr] = await Promise.all([
    sb(`visits?select=created_at,utm_source,utm_medium,utm_campaign,utm_content,referrer_host&created_at=gte.${since}&order=created_at.desc&limit=20000`),
    sb(`events?select=created_at,kind,job,job_other&created_at=gte.${since}&order=created_at.desc&limit=20000`),
    sb('reviews?select=id,created_at,job,job_other,likes,like_other,other_status,dislike&order=created_at.desc&limit=2000'),
  ]);
  if (!vr.ok || !er.ok || !rr.ok) return res.status(500).json({ error: '불러오지 못했어요. Supabase에 표가 있는지 확인해 주세요.' });
  const visits = await vr.json(), events = await er.json(), reviews = await rr.json();

  const dayList = [];
  for (let i = days - 1; i >= 0; i--) dayList.push(kstDate(new Date(Date.now() - i * 86400 * 1000).toISOString()));
  const perDay = (rows) => { const m = new Map(countBy(rows, (x) => kstDate(x.created_at)).map((d) => [d.key, d.count])); return dayList.map((d) => m.get(d) || 0); };
  const ev = (k) => events.filter((x) => x.kind === k);
  const jobs = ev('job');

  const likeCounts = Object.keys(LIKES).map((k) => ({ key: k, text: LIKES[k], count: reviews.filter((r) => (r.likes || []).indexOf(k) >= 0).length }));

  return res.status(200).json({
    days,
    dates: dayList,
    totals: { visits: visits.length, create: ev('create').length, download: ev('download').length, example: ev('example').length, reviews: reviews.length },
    daily: { visits: perDay(visits), create: perDay(ev('create')), download: perDay(ev('download')) },
    channels: countBy(visits, channelOf),
    sourceMedium: countBy(visits.filter((x) => x.utm_source), (x) => `${x.utm_source} / ${x.utm_medium || '(medium 없음)'}`),
    campaigns: countBy(visits.filter((x) => x.utm_campaign), (x) => x.utm_campaign),
    jobs: countBy(jobs, (x) => x.job),
    jobOthers: countBy(jobs.filter((x) => x.job_other), (x) => x.job_other),
    likeCounts,
    reviews,
  });
};
