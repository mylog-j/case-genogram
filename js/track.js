/*
 * 익명 이용 통계 (이 사이트 서버로만 보낸다)
 * 보내는 것: 들어온 경로(UTM·유입 사이트 주소), 만들기·내려받기·예시 보기 횟수, 고른 직업
 * 보내지 않는 것: 입력한 사례 문장, 가계도, 이름, 쿠키. 이 파일은 사례 입력칸을 읽지 않는다.
 */
(function (global) {
  'use strict';
  var off = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || navigator.globalPrivacyControl;

  function send(url, data) {
    if (off) return;
    try {
      var body = JSON.stringify(data);
      var ok = navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      if (!ok) fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* 통계 실패는 화면에 영향 없음 */ }
  }

  // 방문 경로
  try {
    var params = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var data = {}, hasUtm = false;
    keys.forEach(function (k) { var v = params.get(k); if (v) { data[k] = v.slice(0, 100); hasUtm = true; } });
    var refHost = '';
    try { if (document.referrer) { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) refHost = h; } } catch (e) {}
    data.referrer_host = refHost;
    data.landing_path = location.pathname;
    var seen = false;
    try { seen = sessionStorage.getItem('visit-sent') === '1'; } catch (e) {}
    if (!seen || hasUtm) {
      send('/api/visit', data);
      try { sessionStorage.setItem('visit-sent', '1'); } catch (e) {}
    }
    // 주소창의 UTM 꼬리를 지워, 복사한 링크가 다른 경로를 흐리지 않게
    if (hasUtm && history.replaceState) {
      keys.forEach(function (k) { params.delete(k); });
      var q = params.toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    }
  } catch (e) {}

  global.SiteStats = {
    event: function (kind, extra) { send('/api/event', Object.assign({ kind: kind }, extra || {})); }
  };
})(window);
