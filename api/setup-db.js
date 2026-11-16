// 한 번만 쓰는 표 만들기 통로 — 표가 생기면 이 파일은 지운다. 데이터는 읽지도 보내지도 않는다.
const { Client } = require('pg');
const SQL = `
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  referrer_host text, landing_path text
);
create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('create','download','example','job')),
  job text, job_other text
);
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  job text, job_other text,
  likes text[] not null default '{}',
  like_other text,
  other_status text not null default '게시' check (other_status in ('대기','게시','숨김')),
  dislike text
);
alter table public.visits enable row level security;
alter table public.events enable row level security;
alter table public.reviews enable row level security;
revoke all on public.visits from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
`;
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) return res.status(500).json({ error: '데이터베이스 연결 정보가 없어요. Vercel Storage에서 Supabase를 연결해 주세요.' });
  const client = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } });
  try { await client.connect(); await client.query(SQL); return res.status(200).json({ ok: true }); }
  catch (e) { return res.status(500).json({ error: '표를 만들지 못했어요', detail: String(e.message).slice(0, 200) }); }
  finally { await client.end().catch(() => {}); }
};
