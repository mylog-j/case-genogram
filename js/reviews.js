/*
 * 써 본 분들의 이야기: 고른 후기를 메모 쪽지로 보여 주고, 후기를 남긴다.
 * 이름·연락처는 받지 않는다. 사례 문장·가계도는 보내지 않는다.
 */
(function () {
  'use strict';
  var LIKES = [
    ['time', '그리는 시간이 줄었어요'],
    ['easy', '문장만 쓰면 돼서 쉬웠어요'],
    ['meeting', '사례회의·수퍼비전 자료로 바로 썼어요'],
    ['assignment', '수련·과제에 바로 붙였어요'],
    ['symbols', '기호와 범례가 정리돼 있어 좋아요'],
    ['choose', '애매한 관계를 직접 고를 수 있어 좋아요']
  ];
  var TINTS = ['tint-coral', 'tint-sage', 'tint-lav', 'tint-paper'];
  var $ = function (id) { return document.getElementById(id); };
  var board = $('memo-board'), dlg = $('review-dialog');
  if (!board || !dlg) return;

  function memo(text, sign, i, cls) {
    var d = document.createElement('div');
    d.className = 'memo ' + TINTS[i % TINTS.length] + (cls ? ' ' + cls : '');
    var p = document.createElement('p');
    p.textContent = text;
    d.appendChild(p);
    if (sign) {
      var s = document.createElement('span');
      s.className = 'memo-sign';
      s.textContent = sign;
      d.appendChild(s);
    }
    return d;
  }

  function load() {
    fetch('/api/reviews', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var notes = [];
        data.likes.filter(function (l) { return l.count > 0; })
          .sort(function (a, b) { return b.count - a.count; })
          .forEach(function (l) { notes.push([l.text, '✓ ' + l.count + '명이 골랐어요']); });
        data.others.forEach(function (o) { notes.push([o.text, o.job ? '— ' + o.job : '']); });
        if (!notes.length) return;
        board.innerHTML = '';
        notes.forEach(function (n, i) { board.appendChild(memo(n[0], n[1], i)); });
      })
      .catch(function () { /* 불러오지 못하면 기본 쪽지 그대로 */ });
  }

  // 남기기 창
  var list = $('like-list');
  LIKES.forEach(function (l) {
    var lab = document.createElement('label');
    lab.innerHTML = '<input type="checkbox" name="like"><span></span>';
    lab.querySelector('input').value = l[0];
    lab.querySelector('span').textContent = l[1];
    list.appendChild(lab);
  });
  $('review-open').addEventListener('click', function () {
    $('review-form').reset();
    $('rjob-other').hidden = true;
    $('review-msg').textContent = '';
    $('review-send').disabled = false;
    dlg.showModal();
  });
  $('review-close').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('change', function (e) { if (e.target.name === 'rjob') $('rjob-other').hidden = e.target.value !== '기타'; });

  $('review-send').addEventListener('click', function () {
    var job = dlg.querySelector('input[name=rjob]:checked');
    var payload = {
      job: job ? job.value : null,
      job_other: job && job.value === '기타' ? $('rjob-other').value.trim() : '',
      likes: [].map.call(dlg.querySelectorAll('input[name=like]:checked'), function (c) { return c.value; }),
      like_other: $('like-other').value.trim(),
      dislike: $('review-dislike').value.trim(),
      website: $('review-website').value
    };
    var msg = $('review-msg');
    if (!payload.likes.length && !payload.like_other && !payload.dislike) {
      msg.textContent = '좋았던 점을 하나 고르거나, 아쉬웠던 점을 적어 주세요.';
      return;
    }
    var btn = $('review-send');
    btn.disabled = true;
    msg.textContent = '보내는 중…';
    fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        msg.textContent = '고마워요! 고른 후기는 바로 붙고, 기타 한 줄은 확인 후 실려요.';
        load();
        setTimeout(function () { dlg.close(); }, 1600);
      })
      .catch(function (err) { msg.textContent = err.message; btn.disabled = false; });
  });

  load();
})();
