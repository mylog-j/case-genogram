/*
 * 첫 화면: 메모 카드 콜라주(마우스에 살짝 반응)와 타자기 예시
 * 움직임은 이 화면에만 쓴다. '동작 줄이기' 설정이면 완성된 화면을 바로 보여 준다.
 */
(function () {
  'use strict';

  var P = window.GenogramParser, R = window.GenogramRender;
  var EXAMPLE = window.GENOGRAM_EXAMPLE || [];
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = document.getElementById('hero');
  if (!hero) return;

  // ── 콜라주 카드 자리 ────────────────────────────────────
  var cards = [].slice.call(hero.querySelectorAll('.card'));
  cards.forEach(function (c) {
    var v = (c.getAttribute('data-pos') || '0 0 0 0').split(' ');
    c.style.setProperty('--x', v[0] + '%');
    c.style.setProperty('--y', v[1] + '%');
    c.style.setProperty('--rot', v[2] + 'deg');
    c.style.setProperty('--d', v[3] + 's');
  });
  if (!still) hero.classList.add('is-arriving');

  // 마우스에 따라 깊이만큼 살짝 움직인다 (마우스가 있는 기기에서만)
  if (!still && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, raf = null;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener('pointerleave', function () { target.x = 0; target.y = 0; if (!raf) raf = requestAnimationFrame(tick); });
    var tick = function () {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      cards.forEach(function (c) {
        var d = parseFloat(c.getAttribute('data-depth')) || 0.5;
        c.style.setProperty('--px', (cur.x * 16 * d).toFixed(2) + 'px');
        c.style.setProperty('--py', (cur.y * 12 * d).toFixed(2) + 'px');
      });
      if (Math.abs(target.x - cur.x) > 0.002 || Math.abs(target.y - cur.y) > 0.002) raf = requestAnimationFrame(tick);
      else raf = null;
    };
  }

  // ── 타자기 예시 ─────────────────────────────────────────
  var list = document.getElementById('demo-lines'), box = document.getElementById('demo-chart');
  if (!list || !box || !EXAMPLE.length) return;

  function draw(n) {
    var g = R.render(P.parse(EXAMPLE.slice(0, n).join('\n')), { legend: false });
    box.innerHTML = g ? g.svg : '';
  }

  if (still) {
    EXAMPLE.forEach(function (s) { var li = document.createElement('li'); li.textContent = s; list.appendChild(li); });
    draw(EXAMPLE.length);
    return;
  }

  // 다 그려지면 잠시 보여 준 뒤 처음부터 다시 (화면에 보일 때만 움직인다)
  var started = false, visible = true, HOLD = 4500;
  function start() {
    if (started) return;
    started = true;
    var i = 0;
    function restart() {
      if (!visible || document.hidden) { setTimeout(restart, 800); return; }
      list.classList.add('fading');
      box.classList.add('fading');
      setTimeout(function () {
        list.innerHTML = '';
        box.innerHTML = '';
        list.classList.remove('fading', 'done');
        box.classList.remove('fading');
        i = 0;
        setTimeout(nextSentence, 400);
      }, 450);
    }
    function nextSentence() {
      if (i >= EXAMPLE.length) { list.classList.add('done'); setTimeout(restart, HOLD); return; }
      var s = EXAMPLE[i], li = document.createElement('li'), k = 0;
      li.className = 'typing';
      list.appendChild(li);
      (function type() {
        k++;
        li.textContent = s.slice(0, k);
        if (k < s.length) {
          var ch = s[k - 1];
          setTimeout(type, ch === ',' ? 230 : ch === '.' ? 360 : 32 + Math.random() * 26);
        } else {
          li.className = '';
          i++;
          draw(i);
          setTimeout(nextSentence, 420);
        }
      })();
    }
    setTimeout(nextSentence, 500);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      visible = es.some(function (e) { return e.isIntersecting; });
      if (visible) start();
    }, { threshold: 0.25 });
    io.observe(box);
  } else start();
})();
