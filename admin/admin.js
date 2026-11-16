/* 관리자 화면. 비밀번호는 sessionStorage(탭을 닫으면 사라짐)에만 잠깐 둔다. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'admin-pass', days = 30, data = null;

  function pass() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function setPass(v) { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch (e) {} }

  function api(method, query, bodyObj) {
    return fetch('/api/admin' + (query || ''), {
      method: method,
      headers: { 'x-admin-password': pass(), 'Content-Type': 'application/json' },
      body: bodyObj ? JSON.stringify(bodyObj) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var err = new Error(j.error || '불러오지 못했어요.'); err.status = r.status; throw err; }
        return j;
      });
    });
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rows(box, list, empty) {
    box.innerHTML = '';
    if (!list || !list.length) { box.appendChild(el('p', 'empty', empty || '아직 없어요.')); return; }
    var max = Math.max.apply(null, list.map(function (x) { return x.count; }));
    var wrap = el('div', 'rows');
    list.slice(0, 12).forEach(function (x) {
      var r = el('div', 'row');
      r.appendChild(el('span', '', x.key || x.text));
      r.appendChild(el('b', '', x.count));
      var t = el('div', 'track'), f = el('div', 'fill');
      f.style.width = (max ? x.count / max * 100 : 0) + '%';
      t.appendChild(f); r.appendChild(t); wrap.appendChild(r);
    });
    box.appendChild(wrap);
  }
  function fmt(iso) {
    var d = new Date(iso);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function render() {
    var d = data, t = d.totals;
    var totals = $('totals');
    totals.innerHTML = '';
    [['방문', t.visits], ['가계도 만들기', t.create], ['내려받기', t.download], ['예시 보기', t.example], ['후기 (전체)', t.reviews]].forEach(function (x) {
      var c = el('div', 'total'); c.appendChild(el('b', '', x[1])); c.appendChild(el('span', '', x[0])); totals.appendChild(c);
    });
    var bars = $('bars'), max = Math.max.apply(null, d.daily.visits.concat([1]));
    bars.innerHTML = '';
    d.daily.visits.forEach(function (v, i) {
      var b = el('div', 'bar'); b.style.height = (v / max * 100) + '%'; b.setAttribute('data-tip', d.dates[i].slice(5) + ' · ' + v); bars.appendChild(b);
    });
    rows($('channels'), d.channels);
    rows($('utm'), d.sourceMedium, 'UTM 링크로 들어온 방문이 아직 없어요.');
    rows($('campaigns'), d.campaigns, '캠페인이 없어요.');
    rows($('jobs'), d.jobs, '아직 답한 분이 없어요.');
    rows($('jobOthers'), d.jobOthers, '없어요.');
    rows($('likes'), d.likeCounts.filter(function (x) { return x.count; }), '아직 고른 후기가 없어요.');

    var others = $('others');
    others.innerHTML = '';
    var withOther = d.reviews.filter(function (r) { return r.like_other; });
    if (!withOther.length) others.appendChild(el('li', 'empty', '아직 없어요.'));
    withOther.forEach(function (r) {
      var li = el('li');
      li.appendChild(el('span', 'meta', fmt(r.created_at) + (r.job ? ' · ' + r.job + (r.job_other ? '(' + r.job_other + ')' : '') : '')));
      li.appendChild(el('span', 'text', r.like_other));
      var st = el('div', 'status');
      ['대기', '게시', '숨김'].forEach(function (s) {
        var b = el('button', '', s); b.type = 'button'; b.setAttribute('aria-pressed', r.other_status === s ? 'true' : 'false');
        b.addEventListener('click', function () {
          api('PATCH', '', { id: r.id, other_status: s }).then(function () { r.other_status = s; render(); }).catch(function (e) { alert(e.message); });
        });
        st.appendChild(b);
      });
      li.appendChild(st);
      others.appendChild(li);
    });

    var dis = $('dislikes');
    dis.innerHTML = '';
    var withDis = d.reviews.filter(function (r) { return r.dislike; });
    if (!withDis.length) dis.appendChild(el('li', 'empty', '아직 없어요.'));
    withDis.forEach(function (r) {
      var li = el('li');
      li.appendChild(el('span', 'meta', fmt(r.created_at) + (r.job ? ' · ' + r.job : '')));
      li.appendChild(el('span', 'text', r.dislike));
      dis.appendChild(li);
    });
  }

  function load() {
    return api('GET', '?days=' + days).then(function (j) {
      data = j;
      $('login').hidden = true; $('dash').hidden = false; $('logout').hidden = false;
      render();
    }).catch(function (e) {
      if (e.status === 401) { setPass(''); $('login').hidden = false; $('dash').hidden = true; $('err').textContent = '비밀번호가 맞지 않아요.'; $('pw').value = ''; $('pw').focus(); }
      else { $('err').textContent = e.message; $('login').hidden = false; }
    });
  }

  $('login').addEventListener('submit', function (e) {
    e.preventDefault();
    $('err').textContent = '';
    setPass($('pw').value);
    load();
  });
  $('logout').addEventListener('click', function () { setPass(''); location.reload(); });
  document.querySelectorAll('.period button').forEach(function (b) {
    b.addEventListener('click', function () {
      days = +b.getAttribute('data-days');
      document.querySelectorAll('.period button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      load();
    });
  });

  // 후기 CSV (엑셀 한글 깨짐 방지 BOM)
  $('csv').addEventListener('click', function () {
    if (!data) return;
    var LIKES = {}; data.likeCounts.forEach(function (x) { LIKES[x.key] = x.text; });
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; };
    var lines = [['날짜', '직업', '기타 직업', '좋았던 점', '기타 한 줄', '게시 상태', '아쉬웠던 점'].map(q).join(',')];
    data.reviews.forEach(function (r) {
      lines.push([fmt(r.created_at), r.job, r.job_other, (r.likes || []).map(function (k) { return LIKES[k] || k; }).join(' / '), r.like_other, r.other_status, r.dislike].map(q).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '후기_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });

  // UTM 링크 만들기
  function makeLink() {
    var p = new URLSearchParams();
    var s = $('u-src').value.trim(), m = $('u-med').value.trim(), c = $('u-cmp').value.trim();
    if (s) p.set('utm_source', s);
    if (m) p.set('utm_medium', m);
    if (c) p.set('utm_campaign', c);
    $('u-link').value = location.origin + '/' + (p.toString() ? '?' + p.toString() : '');
  }
  ['u-src', 'u-med', 'u-cmp'].forEach(function (id) { $(id).addEventListener('input', makeLink); });
  $('u-copy').addEventListener('click', function () {
    var v = $('u-link').value;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { $('u-copy').textContent = '복사됨'; setTimeout(function () { $('u-copy').textContent = '복사'; }, 1500); })
      .catch(function () { $('u-link').select(); });
  });
  makeLink();

  if (pass()) load();
})();
