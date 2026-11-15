/*
 * 화면 동작. 입력한 문장은 이 파일 밖으로 나가지 않는다.
 * (저장소·쿠키·네트워크를 쓰지 않는다)
 */
(function () {
  'use strict';

  var P = window.GenogramParser, R = window.GenogramRender, X = window.GenogramExport;

  var EXAMPLE = [
    '내담자는 김하늘(여, 16세)이다.',
    '아버지는 김정우(47세)이고, 어머니는 박선영(44세)이다.',
    '아버지와 어머니는 3년 전에 이혼했다.',
    '오빠 김바다(19세)가 있고, 남동생 김지후(12세)가 있다.',
    '외할머니는 2021년에 사망했다.',
    '하늘이는 어머니와 밀착되어 있다.',
    '하늘이와 아버지는 갈등이 심하다.',
    '오빠와 아버지는 연락이 끊겨 단절된 상태이다.'
  ];

  var ROLE_OPTIONS = [
    ['client', '내담자'],
    ['father', '아버지'],
    ['mother', '어머니'],
    ['sibling:older', '손위 형제자매'],
    ['sibling:younger', '손아래 형제자매'],
    ['spouse', '배우자'],
    ['child', '자녀'],
    ['pgf', '친할아버지'],
    ['pgm', '친할머니'],
    ['mgf', '외할아버지'],
    ['mgm', '외할머니']
  ];
  var GENDER_OPTIONS = [['M', '남성'], ['F', '여성'], ['U', '모름']];
  var REL_OPTIONS = ['close', 'fused', 'conflict', 'distant', 'cutoff', 'abuse'];
  var UNION_NAMES = { parents: '아버지 · 어머니', client: '내담자 · 배우자', paternal: '친할아버지 · 친할머니', maternal: '외할아버지 · 외할머니' };
  var UNION_ROLES = { parents: ['father', 'mother'], client: ['client', 'spouse'], paternal: ['pgf', 'pgm'], maternal: ['mgf', 'mgm'] };

  var $ = function (id) { return document.getElementById(id); };
  var text = $('case-text');
  var state = { model: P.newModel(), edited: false, graphic: null };

  // ── 그리기 ──────────────────────────────────────────────
  function drawChart() {
    var g = R.render(state.model);
    state.graphic = g;
    var chart = $('chart');
    if (!g) {
      chart.innerHTML = '<div class="empty"><p>사례 문장을 적으면 여기에 가계도가 그려져요.</p>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-load-example>예시 넣기</button></div>';
    } else {
      chart.innerHTML = g.svg;
    }
    $('dl-png').disabled = !g;
    $('dl-pdf').disabled = !g;
  }

  function drawFeedback() {
    var lines = state.model.lines;
    var ok = lines.filter(function (l) { return l.status === 'ok'; }).length;
    var status = $('parse-status');
    if (!lines.length) status.textContent = '';
    else if (ok === lines.length) status.textContent = '적은 내용을 모두 가계도에 반영했어요.';
    else status.textContent = '가계도에 넣지 못한 부분이 ' + (lines.length - ok) + '곳 있어요. 아래를 확인해 주세요.';
    var ul = $('issues');
    ul.innerHTML = '';
    lines.forEach(function (l) {
      if (l.status === 'ok') return;
      var li = document.createElement('li');
      li.className = l.status;
      var q = document.createElement('q');
      q.textContent = l.text;
      var s = document.createElement('span');
      s.textContent = l.hint;
      li.appendChild(q);
      li.appendChild(s);
      ul.appendChild(li);
    });
  }

  function personName(p) {
    var base = P.displayName(p);
    return p.name && p.role !== 'client' ? base + ' (' + p.label + ')' : (p.role === 'client' && p.name ? base + ' (내담자)' : base);
  }

  function select(options, value, cls) {
    var s = document.createElement('select');
    if (cls) s.className = cls;
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      if (o[0] === value) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  function delButton(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'del';
    b.setAttribute('aria-label', label);
    b.textContent = '×';
    b.addEventListener('click', onClick);
    return b;
  }

  function drawHelper() {
    var m = state.model;

    // 사람
    var people = $('people');
    people.innerHTML = '';
    if (!m.persons.length) {
      people.innerHTML = '<p class="helper-empty">아직 사람이 없어요. 문장을 적거나 사람을 더해 보세요.</p>';
    }
    m.persons.forEach(function (p) {
      var row = document.createElement('div');
      row.className = 'row row-person';

      var name = document.createElement('input');
      name.type = 'text';
      name.value = p.name;
      name.placeholder = p.label || '이름';
      name.setAttribute('aria-label', '이름');
      name.addEventListener('input', function () { p.name = name.value.trim(); touched(false); });
      name.addEventListener('change', function () { touched(true); });

      var roleVal = p.role === 'sibling' ? 'sibling:' + (p.order === 'older' ? 'older' : 'younger') : p.role;
      var role = select(ROLE_OPTIONS, roleVal);
      role.setAttribute('aria-label', '관계');
      role.addEventListener('change', function () {
        var v = role.value.split(':');
        p.role = v[0];
        p.order = v[1] || null;
        p.label = v[1] ? (v[1] === 'older' ? '손위 형제자매' : '손아래 형제자매') : P.ROLE_LABEL[v[0]];
        if (/^(father|pgf|mgf)$/.test(p.role)) p.gender = 'M';
        if (/^(mother|pgm|mgm)$/.test(p.role)) p.gender = 'F';
        touched(true);
      });

      var gender = select(GENDER_OPTIONS, p.gender);
      gender.setAttribute('aria-label', '성별');
      gender.addEventListener('change', function () { p.gender = gender.value; touched(true); });

      var age = document.createElement('input');
      age.type = 'number';
      age.min = '0';
      age.max = '120';
      age.className = 'age';
      age.placeholder = '나이';
      age.value = p.age == null ? '' : p.age;
      age.setAttribute('aria-label', '나이');
      age.addEventListener('input', function () {
        var n = parseInt(age.value, 10);
        p.age = isNaN(n) ? null : Math.max(0, Math.min(120, n));
        touched(false);
      });

      var deadLabel = document.createElement('label');
      deadLabel.className = 'check';
      var dead = document.createElement('input');
      dead.type = 'checkbox';
      dead.checked = p.deceased;
      dead.addEventListener('change', function () { p.deceased = dead.checked; touched(true); });
      deadLabel.appendChild(dead);
      deadLabel.appendChild(document.createTextNode('사망'));

      var del = delButton(P.displayName(p) + ' 지우기', function () {
        m.persons = m.persons.filter(function (q) { return q !== p; });
        m.relations = m.relations.filter(function (r) { return r.a !== p.id && r.b !== p.id; });
        touched(true);
      });

      [name, role, gender, age, deadLabel, del].forEach(function (el) { row.appendChild(el); });
      people.appendChild(row);
    });

    // 부부 관계
    var unions = $('unions');
    unions.innerHTML = '';
    var anyUnion = false;
    Object.keys(UNION_ROLES).forEach(function (key) {
      var rs = UNION_ROLES[key];
      if (!P.findRole(m, rs[0]) || !P.findRole(m, rs[1])) return;
      anyUnion = true;
      var row = document.createElement('div');
      row.className = 'row row-union';
      var label = document.createElement('span');
      label.textContent = UNION_NAMES[key];
      var s = select(Object.keys(P.UNION_LABEL).map(function (k) { return [k, P.UNION_LABEL[k]]; }), m.unions[key] || 'married');
      s.setAttribute('aria-label', UNION_NAMES[key] + ' 부부 관계');
      s.addEventListener('change', function () { m.unions[key] = s.value; touched(true); });
      row.appendChild(label);
      row.appendChild(s);
      unions.appendChild(row);
    });
    $('unions-wrap').hidden = !anyUnion;

    // 정서적 관계
    var rels = $('relations');
    rels.innerHTML = '';
    var personOpts = m.persons.map(function (p) { return [p.id, personName(p)]; });
    var relOpts = REL_OPTIONS.map(function (t) { return [t, P.REL_LABEL[t]]; });
    if (!m.relations.length) rels.innerHTML = '<p class="helper-empty">아직 그려진 관계가 없어요.</p>';
    m.relations.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'row row-relation';
      var a = select(personOpts, r.a);
      var t = select(relOpts, r.type);
      var b = select(personOpts, r.b);
      a.setAttribute('aria-label', '첫째 사람');
      t.setAttribute('aria-label', '관계 종류');
      b.setAttribute('aria-label', '둘째 사람');
      a.addEventListener('change', function () { r.a = a.value; touched(true); });
      t.addEventListener('change', function () { r.type = t.value; touched(true); });
      b.addEventListener('change', function () { r.b = b.value; touched(true); });
      var del = delButton('이 관계 지우기', function () {
        m.relations = m.relations.filter(function (q) { return q !== r; });
        touched(true);
      });
      [a, t, b, del].forEach(function (el) { row.appendChild(el); });
      rels.appendChild(row);
    });
    $('add-relation').hidden = m.persons.length < 2;
  }

  // 직접 고친 경우
  function touched(rebuild) {
    if (!state.edited) {
      state.edited = true;
      $('edited-banner').hidden = false;
    }
    drawChart();
    if (rebuild) drawHelper();
  }

  // ── 문장 → 가계도 ───────────────────────────────────────
  function fromText() {
    state.model = P.parse(text.value);
    state.edited = false;
    $('edited-banner').hidden = true;
    drawChart();
    drawFeedback();
    drawHelper();
  }

  var timer = null;
  text.addEventListener('input', function () {
    if (state.edited) return;
    clearTimeout(timer);
    timer = setTimeout(fromText, 220);
  });

  $('reparse').addEventListener('click', fromText);

  $('clear-text').addEventListener('click', function () {
    text.value = '';
    fromText();
    text.focus();
  });

  function loadExample() {
    text.value = EXAMPLE.join('\n');
    fromText();
    var make = $('make');
    make.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-load-example]');
    if (t) loadExample();
  });

  $('add-person').addEventListener('click', function () {
    var m = state.model;
    if (!P.findRole(m, 'client')) P.addPerson(m, 'client', {});
    else P.addPerson(m, 'sibling', { order: 'younger', label: '손아래 형제자매' });
    $('helper').open = true;
    touched(true);
    var inputs = $('people').querySelectorAll('input[type=text]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $('add-relation').addEventListener('click', function () {
    var m = state.model;
    if (m.persons.length < 2) return;
    var a = P.findRole(m, 'client') || m.persons[0];
    var b = m.persons.filter(function (p) { return p !== a; })[0];
    m.relations.push({ a: a.id, b: b.id, type: 'close' });
    touched(true);
  });

  function busy(btn, fn) {
    if (!state.graphic) return;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '만드는 중…';
    fn(state.graphic).catch(function (err) {
      $('parse-status').textContent = err.message || '내려받기를 만들지 못했어요. 다시 눌러 주세요.';
    }).then(function () {
      btn.disabled = false;
      btn.textContent = label;
    });
  }
  $('dl-png').addEventListener('click', function () { busy(this, X.png); });
  $('dl-pdf').addEventListener('click', function () { busy(this, X.pdf); });

  // ── 첫 화면 예시: 문장이 하나씩 읽히며 가계도가 자란다 ──
  (function demo() {
    var list = $('demo-lines'), box = $('demo-chart');
    if (!list || !box) return;
    EXAMPLE.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = s;
      list.appendChild(li);
    });
    var items = list.children;
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(n) {
      var g = R.render(P.parse(EXAMPLE.slice(0, n).join('\n')), { legend: false });
      box.innerHTML = g ? g.svg : '';
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('on', i < n);
        items[i].classList.toggle('now', i === n - 1 && n < items.length);
      }
    }
    if (still) { show(EXAMPLE.length); return; }
    var n = 0;
    show(0);
    function step() {
      n++;
      show(n);
      if (n < EXAMPLE.length) setTimeout(step, 900);
    }
    setTimeout(step, 500);
  })();

  drawHelper();
})();
