// 서버 함수 공용 도우미. 키와 비밀번호는 환경변수로만 읽는다(코드에 값을 적지 않는다).
const crypto = require('node:crypto');

const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

const sbHeaders = (extra) => Object.assign({
  apikey: SB_KEY,
  ...(String(SB_KEY).startsWith('eyJ') ? { Authorization: `Bearer ${SB_KEY}` } : {}),
  'Content-Type': 'application/json',
}, extra || {});

const ready = () => !!(SB_URL && SB_KEY);

// 글자·숫자·한글·기본 기호만 남기고 길이를 자른다
const clean = (v, n = 100) => {
  const s = String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  return s || null;
};
const cleanTag = (v, n = 100) => {
  const s = String(v ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}._\-+ /:]/gu, '').trim().slice(0, n);
  return s || null;
};

const body = (req) => {
  let b = req.body || {};
  if (Buffer.isBuffer(b)) { try { b = JSON.parse(b.toString('utf8')); } catch { b = {}; } }
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b;
};

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|headless|lighthouse/i;
const isBot = (req) => BOT.test(String(req.headers['user-agent'] || ''));

const same = (a, b) => {
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};

// 후기 보기 (화면과 같은 목록)
const LIKES = {
  time: '그리는 시간이 줄었어요',
  easy: '문장만 쓰면 돼서 쉬웠어요',
  meeting: '사례회의·수퍼비전 자료로 바로 썼어요',
  assignment: '수련·과제에 바로 붙였어요',
  symbols: '기호와 범례가 정리돼 있어 좋아요',
  choose: '애매한 관계를 직접 고를 수 있어 좋아요',
};
const JOBS = ['상담사', '사회복지사', '학생', '수련생', '기타'];

async function sb(path, opts) {
  const o = Object.assign({}, opts || {});
  o.headers = sbHeaders(o.headers || {});
  if (o.method && o.method !== 'GET' && !o.headers.Prefer) o.headers.Prefer = 'return=minimal';
  return fetch(`${SB_URL}/rest/v1/${path}`, o);
}

module.exports = { SB_URL, SB_KEY, sbHeaders, ready, clean, cleanTag, body, isBot, same, LIKES, JOBS, sb };
