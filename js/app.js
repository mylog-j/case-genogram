/*
 * 가계도 만들기 화면: 문장 → 가계도, 골라 주세요, 직접 고치기, 되돌리기, 내려받기
 * 입력한 내용은 이 파일 밖으로 나가지 않는다 (저장소·쿠키·네트워크를 쓰지 않는다).
 */
(function () {
  'use strict';

  var F = window.FamilyModel, P = window.GenogramParser, R = window.GenogramRender, X = window.GenogramExport;

  var EXAMPLE = [
    '내담자는 김하늘(여, 16세)이다.',
    '아버지는 김정우(47세)이고, 어머니는 박선영(44세)이다.',
    '아버지와 어머니는 2021년에 이혼했다.',
    '오빠 김바다(19세)가 있고, 남동생 김지후(12세)가 있다.',
    '외할머니는 2021년에 사망했다.',
    '하늘이는 어머니와 밀착되어 있다.',
    '하늘이와 아버지는 갈등이 심하다.',
    '오빠와 아버지는 연락이 끊겨 단절된 상태이다.'
  ];
  window.GENOGRAM_EXAMPLE = EXAMPLE;

  var $ = function (id) { return document.getElementById(id); };
  var text = $('case-text');
  var state = {
    model: F.create(), choices: [], answers: {}, edited: false,
    deleted: {}, selected: null, undo: [], redo: [],
    settings: { mono: false, generations: false, legend: true }
  };

  // ── 되돌리기 ────────────────────────────────────────────
  function snapshot() {
    return JSON.stringify({ model: state.model, answers: state.answers, edited: state.edited, deleted: state.deleted, text: text.value });
  }
  function restore(s) {
    var o = JSON.parse(s);
    state.model = o.model; state.answers = o.answers; state.edited = o.edited; state.deleted = o.deleted;
    text.value = o.text;
    state.selected = null;
    var parsed = P.parse(text.value, state.answers);
    state.choices = parsed.choices;
    state.lines = parsed.lines;
    drawAll();
  }
  function checkpoint() {
    state.undo.push(snapshot());
    if (state.undo.length > 60) state.undo.shift();
    state.redo = [];
  }
  function undo() { if (!state.undo.length) return; state.redo.push(snapshot()); restore(state.undo.pop()); }
  function redo() { if (!state.redo.length) return; state.undo.push(snapshot()); restore(state.redo.pop()); }

  // ── 문장 → 모델 ─────────────────────────────────────────
  function personKeys(p) {
    var ks = [];
    if (p.key) ks.push('k:' + p.key);
    if (p.name) ks.push('n:' + p.name);
    return ks;
  }

  function merge(parsed) {
    var cur = state.model, map = {}, umap = {};
    parsed.persons.forEach(function (p) {
      if (personKeys(p).some(function (k) { return state.deleted[k]; })) return;
      var c = cur.persons.filter(function (q) { return (p.name && q.name === p.name) || (p.key && q.key === p.key); })[0];
      if (!c) {
        c = F.addPerson(cur, p);
        c.key = p.key;
      } else if (!c.edited) {
        ['name', 'label', 'age', 'grade', 'birthYear', 'deathYear', 'genderLabel'].forEach(function (k) { if ((c[k] == null || c[k] === '') && p[k] != null && p[k] !== '') c[k] = p[k]; });
        if (c.gender === 'U' && p.gender !== 'U') c.gender = p.gender;
        if (p.deceased) c.deceased = true;
        if (p.client && !cur.persons.some(function (q) { return q.client; })) c.client = true;
        if (!c.key) c.key = p.key;
      }
      if (p.owner && map[p.owner]) c.owner = map[p.owner];
      map[p.id] = c.id;
    });
    parsed.unions.forEach(function (u) {
      var a = u.a && map[u.a], b = u.b && map[u.b];
      if ((u.a && !a) || (u.b && !b)) return;
      var ex = null;
      if (a && b) ex = cur.unions.filter(function (x) { return (x.a === a && x.b === b) || (x.a === b && x.b === a); })[0];
      if (ex) {
        if (!ex.edited) { ex.status = u.status; if (u.start) ex.start = u.start; if (u.end) ex.end = u.end; }
        umap[u.id] = ex.id;
      } else if (a && b) {
        umap[u.id] = F.addUnion(cur, a, b, u.status, { start: u.start, end: u.end }).id;
      } else umap[u.id] = null; // 한쪽·빈 결합은 자녀 연결 때 정한다
    });
    parsed.links.forEach(function (l) {
      var child = map[l.child];
      if (!child) return;
      var have = F.linkOf(cur, child);
      if (have) { if (!have.edited && have.type !== l.type) have.type = l.type; return; }
      var uid = umap[l.union];
      if (!uid) {
        var pu = F.union(parsed, l.union);
        var a = pu.a && map[pu.a], b = pu.b && map[pu.b];
        var found = cur.unions.filter(function (x) {
          return (a && (x.a === a || x.b === a) && !F.partnerIn(x, a)) || (!a && !b && F.childrenOf(cur, x.id).some(function (k) { return F.siblingsOf(parsed, l.child).some(function (s) { return map[s.id] === k.id; }); }));
        })[0];
        uid = found ? found.id : F.addUnion(cur, a || null, b || null, pu.status).id;
        umap[l.union] = uid;
      }
      var nl = F.addLink(cur, uid, child, l.type);
      nl.twin = l.twin; nl.identical = l.identical;
    });
    // 문장에서 더는 나오지 않는 사람(고르기 답을 바꿨거나 문장을 지운 경우)은, 직접 고치지 않았다면 지운다
    var parsedKeys = {};
    parsed.persons.forEach(function (p) { personKeys(p).forEach(function (k) { parsedKeys[k] = 1; }); });
    cur.persons.slice().forEach(function (c) {
      if (c.edited || !c.key || /^u:/.test(c.key) || c.client) return;
      if (personKeys(c).some(function (k) { return parsedKeys[k]; })) return;
      F.removePerson(cur, c.id);
    });
    // 문장에서 나온 관계선도 마찬가지
    var parsedRel = {};
    parsed.relations.forEach(function (r) { if (map[r.a] && map[r.b]) parsedRel[map[r.a] + '|' + r.type + '|' + map[r.b]] = 1; });
    cur.relations = cur.relations.filter(function (r) { return r.edited || r.key || parsedRel[r.a + '|' + r.type + '|' + r.b] || parsedRel[r.b + '|' + r.type + '|' + r.a]; });
    // 고르기로 정한 관계는 답이 바뀌면 따라 바뀐다
    var parsedKeyed = {};
    parsed.relations.forEach(function (r) { if (r.key) parsedKeyed[r.key] = r; });
    cur.relations = cur.relations.filter(function (r) {
      if (!r.key || r.edited) return true;
      var pr = parsedKeyed[r.key];
      if (!pr) return false;
      r.type = pr.type;
      return true;
    });
    parsed.relations.forEach(function (r) {
      var a = map[r.a], b = map[r.b];
      if (!a || !b || state.deleted['r:' + r.a + r.type + r.b] || state.deleted['r:' + relKey(parsed, r)]) return;
      if (r.key && cur.relations.some(function (x) { return x.key === r.key; })) return;
      F.addRelation(cur, a, b, r.type, r);
    });
    parsed.household.forEach(function (id) { var c = map[id]; if (c && cur.household.indexOf(c) < 0) cur.household.push(c); });
    F.cleanup(cur);
  }

  function relKey(m, r) {
    var a = F.person(m, r.a), b = F.person(m, r.b);
    return (a && (a.key || a.name)) + '|' + r.type + '|' + (b && (b.key || b.name));
  }

  function fromText(reset) {
    var parsed = P.parse(text.value, state.answers);
    state.choices = parsed.choices;
    state.lines = parsed.lines;
    if (reset || !state.edited) {
      state.model = parsed;
      state.edited = false;
      state.deleted = {};
    } else merge(parsed);
    if (state.selected && !exists(state.selected)) state.selected = null;
    drawAll();
  }

  function exists(sel) {
    var m = state.model;
    if (sel.type === 'person') return !!F.person(m, sel.id);
    if (sel.type === 'union') return !!F.union(m, sel.id);
    if (sel.type === 'rel') return m.relations.some(function (r) { return r.id === sel.id; });
    if (sel.type === 'link') return m.links.some(function (l) { return l.id === sel.id; });
    return false;
  }

  // 직접 고친 뒤 호출
  function changed(obj) {
    if (obj) obj.edited = true;
    if (!state.edited) state.edited = true;
    drawAll();
  }

  // ── 그리기 ──────────────────────────────────────────────
  function graphic(forExport) {
    return R.render(state.model, {
      mono: state.settings.mono, generations: state.settings.generations, legend: state.settings.legend,
      selected: forExport ? null : state.selected
    });
  }

  function drawAll() {
    drawChart();
    drawStatus();
    drawChoices();
    drawRoster();
    if (dlg.open) drawEditor();
    $('edited-banner').hidden = !state.edited;
    $('undo').disabled = !state.undo.length;
    $('redo').disabled = !state.redo.length;
  }

  function drawChart() {
    var g = graphic(false);
    var chart = $('chart');
    if (!g) {
      chart.innerHTML = '<div class="empty"><span class="hand-note hn-empty" aria-hidden="true">여기에 그려져요 ↓</span><p>사례 문장을 적으면 여기에 가계도가 그려져요.</p>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-load-example>예시 넣기</button></div>';
    } else chart.innerHTML = g.svg;
    // 확대·축소: zoom 이 없으면 칸에 맞춤
    chart.classList.toggle('zoomed', !!(g && state.zoom));
    if (g && state.zoom) {
      var svgEl = chart.querySelector('svg');
      svgEl.style.width = Math.round(g.width * state.zoom) + 'px';
      svgEl.style.maxHeight = 'none';
    }
    $('zoom-label').textContent = state.zoom ? Math.round(state.zoom * 100) + '%' : '맞춤';
    $('dl-png').disabled = !g;
    $('chart-tip').hidden = !g;
  }

  function drawStatus() {
    var lines = state.lines || [];
    var bad = lines.filter(function (l) { return l.status === 'partial' || l.status === 'none'; });
    var warns = lines.filter(function (l) { return l.status === 'warn'; });
    var status = $('parse-status');
    if (!lines.length) status.textContent = '';
    else if (!bad.length && !state.choices.some(function (c) { return !c.value; })) status.textContent = '적은 내용을 모두 가계도에 반영했어요.';
    else if (bad.length) status.textContent = '가계도에 넣지 못한 부분이 ' + bad.length + '곳 있어요. 아래를 확인해 주세요.';
    else status.textContent = '고를 것이 남아 있어요.';
    var ul = $('issues');
    ul.innerHTML = '';
    bad.concat(warns).forEach(function (l) {
      var li = el('li', { className: l.status });
      li.appendChild(el('q', { textContent: l.text }));
      li.appendChild(el('span', { textContent: l.hint }));
      ul.appendChild(li);
    });
  }

  function drawChoices() {
    var list = $('choice-list');
    list.innerHTML = '';
    $('choices').hidden = !state.choices.length;
    state.choices.forEach(function (c) {
      var card = el('div', { className: 'choice' + (c.value ? ' done' : '') });
      card.appendChild(el('q', { textContent: c.text }));
      card.appendChild(el('p', { className: 'choice-q', textContent: c.question }));
      var opts = el('div', { className: 'choice-opts', role: 'group' });
      opts.setAttribute('aria-label', c.question);
      c.options.forEach(function (o) {
        var b = el('button', { type: 'button', className: 'chip', textContent: o[1] });
        b.setAttribute('aria-pressed', c.value === o[0] ? 'true' : 'false');
        b.addEventListener('click', function () {
          checkpoint();
          state.answers[c.key] = o[0];
          fromText(false);
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
      list.appendChild(card);
    });
  }

  // ── 편집 칸 ─────────────────────────────────────────────
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in props || {}) {
      if (k === 'className' || k === 'textContent' || k === 'value' || k === 'checked' || k === 'disabled' || k === 'type' || k === 'hidden') e[k] = props[k];
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function field(label, input, wide) {
    var id = 'f' + Math.random().toString(36).slice(2, 8);
    input.id = id;
    return el('div', { className: 'field' + (wide ? ' wide' : '') }, [el('label', { for: id, textContent: label }), input]);
  }
  function select(options, value, onChange) {
    var s = el('select');
    options.forEach(function (o) {
      var op = el('option', { value: o[0], textContent: o[1] });
      if (String(o[0]) === String(value)) op.selected = true;
      s.appendChild(op);
    });
    s.addEventListener('change', function () { onChange(s.value); });
    return s;
  }
  function input(type, value, onCommit, attrs) {
    var i = el('input', Object.assign({ type: type }, attrs || {}));
    i.value = value == null ? '' : value;
    var before = null;
    i.addEventListener('focus', function () { before = snapshot(); });
    i.addEventListener('change', function () {
      if (before) { state.undo.push(before); state.redo = []; before = null; }
      onCommit(i.value);
    });
    return i;
  }
  function numOrNull(v, min, max) {
    var n = parseInt(v, 10);
    return isNaN(n) ? null : Math.max(min, Math.min(max, n));
  }
  function button(label, onClick, cls) {
    var b = el('button', { type: 'button', className: cls || 'btn btn-ghost btn-sm', textContent: label });
    b.addEventListener('click', onClick);
    return b;
  }
  function act(fn) { return function () { checkpoint(); fn(); }; }
  function personOptions() {
    return state.model.persons.filter(function (p) { return p.kind === 'person'; }).map(function (p) {
      var n = F.displayName(p);
      return [p.id, p.name && p.label ? n + ' (' + (p.client ? (p.label || '내담자') : p.label) + ')' : n];
    });
  }

  // ── 구성원·관계선 목록 (늘 보이는 편집 입구) ─────────────
  var ui = { addMember: false, addRel: false };

  function miniSymbol(p) {
    var s = '<svg viewBox="0 0 20 20" aria-hidden="true" class="mini' + (p.implied && !p.client ? ' faint' : '') + '">';
    if (p.kind === 'pregnancy' || p.kind === 'miscarriage' || p.kind === 'abortion') s += '<polygon points="10,3 17,16 3,16"/>';
    else if (p.kind === 'pet' || p.gender === 'U') s += '<polygon points="10,2 18,10 10,18 2,10"/>';
    else if (p.gender === 'M') s += '<rect x="3" y="3" width="14" height="14"/>';
    else s += '<circle cx="10" cy="10" r="7"/>';
    if (p.client) s += p.gender === 'M' ? '<rect x="1" y="1" width="18" height="18" class="thin"/>' : '<circle cx="10" cy="10" r="9.3" class="thin"/>';
    if (p.deceased) s += '<path d="M3 3l14 14M17 3L3 17"/>';
    return s + '</svg>';
  }
  var RELATIVES = [
    ['father', '아버지'], ['mother', '어머니'], ['sibling', '형제자매'], ['partner', '배우자·파트너'],
    ['ex', '전 배우자'], ['child', '자녀'], ['pet', '반려동물']
  ];
  // p 기준으로 가족 한 명 더하기. 새 사람을 돌려준다.
  function addRelative(p, kind) {
    var m = state.model, pre = p.client ? '' : F.displayName(p) + '의 ', key = 'u:' + Date.now() + Math.random().toString(36).slice(2, 5), q;
    if (kind === 'father' || kind === 'mother') {
      q = F.parentOf(m, p.id, kind === 'father' ? 'M' : 'F', { label: pre + (kind === 'father' ? '아버지' : '어머니'), key: key }, true);
      if (!q) return null;
    } else if (kind === 'sibling') {
      var u = F.ensureParentUnion(m, p.id);
      q = F.addPerson(m, { label: pre + '형제자매', key: key });
      F.addLink(m, u.id, q.id, 'bio');
    } else if (kind === 'partner' || kind === 'ex') {
      q = F.addPerson(m, { label: pre + (kind === 'ex' ? '전 배우자' : '배우자'), gender: p.gender === 'M' ? 'F' : p.gender === 'F' ? 'M' : 'U', key: key });
      F.addUnion(m, p.id, q.id, kind === 'ex' ? 'divorced' : 'married');
    } else if (kind === 'child') {
      var cu = F.childUnion(m, p.id);
      q = F.addPerson(m, { label: pre + '자녀', key: key });
      F.addLink(m, cu.id, q.id, 'bio');
    } else if (kind === 'pet') {
      q = F.addPerson(m, { kind: 'pet', owner: p.id, label: '반려동물', key: key });
    }
    if (q) q.edited = true;
    return q;
  }

  function drawRoster() {
    var box = $('roster');
    box.innerHTML = '';
    var m = state.model;
    if (!m.persons.length) {
      box.appendChild(el('div', { className: 'roster-empty' }, [
        el('p', { textContent: '문장 없이 직접 그리고 싶다면 내담자부터 더해 보세요.' }),
        button('+ 내담자 더하기', act(function () {
          var c = F.addPerson(m, { client: true, label: '내담자', key: 'u:client' });
          state.selected = { type: 'person', id: c.id };
          changed(c);
          openEditor();
        }), 'btn btn-ink btn-sm')
      ]));
      return;
    }

    // 구성원
    var people = m.persons;
    var col1 = el('section', { className: 'roster-col', 'aria-label': '구성원 목록' });
    var h1 = el('div', { className: 'roster-head' }, [el('h3', {}, ['구성원 목록 ', el('span', { textContent: people.length + '명' })])]);
    var addBtn = button(ui.addMember ? '닫기' : '+ 구성원 추가', function () { ui.addMember = !ui.addMember; drawRoster(); }, 'btn btn-ghost btn-sm');
    addBtn.setAttribute('aria-expanded', ui.addMember ? 'true' : 'false');
    h1.appendChild(addBtn);
    col1.appendChild(h1);
    if (ui.addMember) {
      var base = select(personOptions(), (F.clientOf(m) || people[0]).id, function () {});
      var kind = select(RELATIVES, 'sibling', function () {});
      base.setAttribute('aria-label', '누구의');
      kind.setAttribute('aria-label', '어떤 가족');
      col1.appendChild(el('div', { className: 'roster-add' }, [
        el('span', { textContent: '누구의' }), base, kind,
        button('추가', act(function () {
          var q = addRelative(F.person(m, base.value), kind.value);
          if (!q) { alert('이미 부모가 두 명 있어요.'); return; }
          ui.addMember = false;
          state.selected = { type: 'person', id: q.id };
          changed(q);
          openEditor();
        }), 'btn btn-ink btn-sm')
      ]));
    }
    var ul = el('ul', { className: 'roster-list' });
    people.forEach(function (p) {
      var li = el('li', { className: state.selected && state.selected.id === p.id ? 'on' : '' });
      var sym = el('span', { className: 'roster-sym' });
      sym.innerHTML = miniSymbol(p);
      var meta = [];
      if (p.name && (p.label || p.client)) meta.push(p.client ? (p.label || '내담자') : p.label);
      if (p.age != null) meta.push(p.age + '세');
      if (p.deceased) meta.push('사망' + (p.deathYear ? ' ' + p.deathYear : ''));
      if (p.implied && !p.client) meta.push('확인 안 된 자리');
      li.appendChild(sym);
      li.appendChild(el('span', { className: 'roster-name' }, [el('strong', { textContent: F.displayName(p) }), meta.length ? el('small', { textContent: meta.join(' · ') }) : null]));
      li.appendChild(button('수정', function () { select_({ type: 'person', id: p.id }); }, 'btn-edit'));
      ul.appendChild(li);
    });
    col1.appendChild(ul);

    // 관계선
    var col2 = el('section', { className: 'roster-col', 'aria-label': '관계선 목록' });
    var lines = [];
    m.unions.filter(function (u) { return u.a && u.b; }).forEach(function (u) {
      lines.push({ sel: { type: 'union', id: u.id }, text: F.displayName(F.person(m, u.a)) + ' · ' + F.displayName(F.person(m, u.b)), tag: F.UNION[u.status] + (u.start || u.end ? ' ' + [u.start, u.end].filter(Boolean).join('–') : '') });
    });
    m.relations.forEach(function (r) {
      var arrowTxt = F.REL[r.type].dir ? (r.mutual ? ' ⇄ ' : ' → ') : ' ↔ ';
      var lab = r.type === 'abuse' ? F.ABUSE_GROUP_LABEL[F.ABUSE_GROUP[r.sub] || 'violence'] + (F.ABUSE_SUB[r.sub] && r.sub !== 'violence' ? ' (' + F.ABUSE_SUB[r.sub] + ')' : '') : F.REL[r.type].label;
      lines.push({ sel: { type: 'rel', id: r.id }, rel: r, text: F.displayName(F.person(m, r.a)) + arrowTxt + F.displayName(F.person(m, r.b)), tag: lab + (r.tentative ? ' (확인 필요)' : '') });
    });
    var h2 = el('div', { className: 'roster-head' }, [el('h3', {}, ['관계선 목록 ', el('span', { textContent: lines.length + '개' })])]);
    var addRel = button(ui.addRel ? '닫기' : '+ 관계선 추가', function () { ui.addRel = !ui.addRel; drawRoster(); }, 'btn btn-ghost btn-sm');
    addRel.setAttribute('aria-expanded', ui.addRel ? 'true' : 'false');
    h2.appendChild(addRel);
    col2.appendChild(h2);
    var opts = personOptions();
    if (ui.addRel && opts.length >= 2) {
      var a = select(opts, opts[0][0], function () {}), b = select(opts, opts[1][0], function () {});
      var t = select(Object.keys(F.REL).map(function (k) { return [k, F.REL[k].label]; }), 'close', function () {});
      a.setAttribute('aria-label', '사람 1'); b.setAttribute('aria-label', '사람 2'); t.setAttribute('aria-label', '관계 종류');
      col2.appendChild(el('div', { className: 'roster-add' }, [a, t, b,
        button('추가', act(function () {
          if (a.value === b.value) { alert('서로 다른 두 사람을 골라 주세요.'); return; }
          var r = F.addRelation(m, a.value, b.value, t.value, { sub: t.value === 'abuse' ? 'violence' : null });
          if (r) r.edited = true;
          ui.addRel = false;
          changed();
        }), 'btn btn-ink btn-sm')]));
    }
    var ul2 = el('ul', { className: 'roster-list' });
    if (!lines.length) ul2.appendChild(el('li', { className: 'roster-none', textContent: '아직 관계선이 없어요.' }));
    lines.forEach(function (ln) {
      var li = el('li', { className: state.selected && state.selected.id === ln.sel.id ? 'on' : '' });
      li.appendChild(el('span', { className: 'roster-name' }, [el('strong', { textContent: ln.text }), el('small', { textContent: ln.tag })]));
      li.appendChild(button('수정', function () { select_(ln.sel); }, 'btn-edit'));
      if (ln.rel) li.appendChild(button('지우기', act(function () {
        state.deleted['r:' + relKey(m, ln.rel)] = 1;
        m.relations = m.relations.filter(function (x) { return x !== ln.rel; });
        changed();
      }), 'btn-edit danger'));
      ul2.appendChild(li);
    });
    col2.appendChild(ul2);
    box.appendChild(col1);
    box.appendChild(col2);
  }

  // ── 수정창 ──────────────────────────────────────────────
  var dlg = $('editor');
  function openEditor() {
    drawEditor();
    if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } }
  }
  function drawEditor() {
    var m = state.model, sel = state.selected, box = $('editor-body');
    box.innerHTML = '';
    if (!sel || !exists(sel)) { if (dlg.open) dlg.close(); return; }
    if (sel.type === 'person') personForm(box, F.person(m, sel.id));
    else if (sel.type === 'rel') relForm(box, m.relations.filter(function (r) { return r.id === sel.id; })[0]);
    else if (sel.type === 'union') unionForm(box, F.union(m, sel.id));
    else if (sel.type === 'link') linkForm(box, m.links.filter(function (l) { return l.id === sel.id; })[0]);
  }
  function head(box, title, sub) {
    $('editor-title').textContent = title + ' 수정';
    $('editor-sub').textContent = sub || '';
  }
  $('editor-close').addEventListener('click', function () { dlg.close(); });
  $('editor-done').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('close', function () { state.selected = null; drawChart(); drawRoster(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  function personForm(box, p) {
    if (!p) return;
    var m = state.model;
    head(box, F.displayName(p), p.client ? (p.label || '내담자') : p.label || '');
    var grid = el('div', { className: 'form-grid' });
    grid.appendChild(field('이름', input('text', p.name, function (v) { p.name = v.trim().slice(0, 20); changed(p); }, { maxlength: 20, placeholder: '가명이나 머리글자' })));
    grid.appendChild(field('관계 이름', input('text', p.label, function (v) { p.label = v.trim().slice(0, 20); changed(p); }, { maxlength: 20, placeholder: '예: 고모, 새아버지' })));
    grid.appendChild(field('종류', select(Object.keys(F.KIND).map(function (k) { return [k, F.KIND[k]]; }), p.kind, function (v) {
      checkpoint();
      p.kind = v;
      if (v === 'pet' && !p.owner) { var c = F.clientOf(m); p.owner = c && c.id !== p.id ? c.id : null; }
      changed(p);
    })));
    grid.appendChild(field('성별', select([['M', '남성'], ['F', '여성'], ['U', '모름·기타']], p.gender, function (v) { checkpoint(); p.gender = v; changed(p); })));
    grid.appendChild(field('성별 표현(선택)', input('text', p.genderLabel, function (v) { p.genderLabel = v.trim().slice(0, 12); changed(p); }, { maxlength: 12, placeholder: '예: 논바이너리' })));
    grid.appendChild(field('나이', input('number', p.age, function (v) { p.age = numOrNull(v, 0, 120); changed(p); }, { min: 0, max: 120 })));
    if (p.kind === 'person') grid.appendChild(field('학년', input('text', p.grade, function (v) { p.grade = v.trim().slice(0, 10); changed(p); }, { maxlength: 10, placeholder: '예: 초5, 중2' })));
    grid.appendChild(field(p.kind === 'person' || p.kind === 'pet' ? '출생 연도' : '연도', input('number', p.birthYear, function (v) { p.birthYear = numOrNull(v, 1850, 2100); changed(p); }, { min: 1850, max: 2100 })));
    grid.appendChild(field('사망 연도', input('number', p.deathYear, function (v) { p.deathYear = numOrNull(v, 1850, 2100); if (p.deathYear) p.deceased = true; changed(p); }, { min: 1850, max: 2100 })));
    grid.appendChild(field('정보 출처', select([['', '표시 안 함'], ['내담자 진술', '내담자 진술'], ['가족 진술', '가족 진술'], ['기관 기록', '기관 기록'], ['확인됨', '확인됨']], p.source, function (v) { checkpoint(); p.source = v; changed(p); })));
    grid.appendChild(field('메모', input('text', p.note, function (v) { p.note = v.trim().slice(0, 30); changed(p); }, { maxlength: 30, placeholder: '짧게, 실명·주민번호는 적지 마세요' }), true));
    box.appendChild(grid);

    var checks = el('div', { className: 'checks' });
    var dead = el('input', { type: 'checkbox', checked: p.deceased });
    dead.addEventListener('change', act(function () { p.deceased = dead.checked; if (!dead.checked) p.deathYear = null; changed(p); }));
    checks.appendChild(el('label', {}, [dead, ' 사망']));
    var house = el('input', { type: 'checkbox', checked: m.household.indexOf(p.id) >= 0 });
    house.addEventListener('change', act(function () {
      if (house.checked) m.household.push(p.id); else m.household = m.household.filter(function (id) { return id !== p.id; });
      changed(p);
    }));
    checks.appendChild(el('label', {}, [house, ' 함께 사는 가족']));
    box.appendChild(checks);

    // 더하기
    var add = el('div', { className: 'insp-actions' });
    add.appendChild(el('p', { className: 'insp-label', textContent: F.displayName(p) + ' 기준으로 더하기' }));
    var parents = F.parentsOf(m, p.id);
    var hasF = parents.some(function (q) { return q.gender === 'M'; }), hasM = parents.some(function (q) { return q.gender === 'F'; });
    var full = parents.length >= 2;
    RELATIVES.forEach(function (rk) {
      var b = button('+ ' + rk[1], act(function () { var q = addRelative(p, rk[0]); if (q) pick(q); }));
      if (rk[0] === 'father') b.disabled = hasF || full;
      if (rk[0] === 'mother') b.disabled = hasM || full;
      add.appendChild(b);
    });
    box.appendChild(add);

    // 관계선 더하기
    var others = personOptions().filter(function (o) { return o[0] !== p.id; });
    if (others.length) {
      var rel = el('div', { className: 'insp-actions rel-add' });
      rel.appendChild(el('p', { className: 'insp-label', textContent: '관계선 더하기' }));
      var target = select(others, others[0][0], function () {});
      var type = select(Object.keys(F.REL).map(function (k) { return [k, F.REL[k].label]; }), 'close', function () {});
      target.setAttribute('aria-label', '상대');
      type.setAttribute('aria-label', '관계 종류');
      rel.appendChild(target); rel.appendChild(type);
      rel.appendChild(button('더하기', act(function () {
        var r = F.addRelation(m, p.id, target.value, type.value, { sub: type.value === 'abuse' ? 'violence' : null });
        if (r) { r.edited = true; state.selected = { type: 'rel', id: r.id }; }
        changed();
      }), 'btn btn-ink btn-sm'));
      box.appendChild(rel);
    }

    var tail = el('div', { className: 'insp-tail' });
    if (!p.client && p.kind === 'person') tail.appendChild(button('내담자로 지정', act(function () {
      m.persons.forEach(function (q) { q.client = false; });
      p.client = true;
      changed(p);
    }), 'btn-text'));
    if (p.dx) tail.appendChild(button('자리 되돌리기', act(function () { p.dx = 0; changed(); }), 'btn-text'));
    tail.appendChild(button('이 사람 지우기', act(function () {
      personKeys(p).forEach(function (k) { state.deleted[k] = 1; });
      F.removePerson(m, p.id);
      state.selected = null;
      changed();
    }), 'btn-text danger'));
    box.appendChild(tail);
  }

  function pick(q) { q.edited = true; state.selected = { type: 'person', id: q.id }; changed(q); }

  function relForm(box, r) {
    if (!r) return;
    var m = state.model;
    var a = F.person(m, r.a), b = F.person(m, r.b);
    head(box, F.REL[r.type].label, F.displayName(a) + (F.REL[r.type].dir ? ' → ' : ' ↔ ') + F.displayName(b));
    var grid = el('div', { className: 'form-grid' });
    grid.appendChild(field('종류', select(Object.keys(F.REL).map(function (k) { return [k, F.REL[k].label]; }), r.type, function (v) {
      checkpoint(); r.type = v; if (v === 'abuse' && !r.sub) r.sub = 'violence'; changed(r);
    })));
    if (r.type === 'abuse') grid.appendChild(field('폭력·학대 종류', select([
      ['violence', '폭력 (빨강)'], ['physical', '신체 학대 (파랑)'], ['sexual', '성적 학대 (파랑)'],
      ['emotional', '정서 학대 (보라)'], ['neglect', '방임 (보라)']
    ], r.sub, function (v) { checkpoint(); r.sub = v; changed(r); })));
    var opts = personOptions();
    var isDir = F.REL[r.type].dir, isAbuse = r.type === 'abuse';
    grid.appendChild(field(isDir ? (isAbuse ? '한 사람 (화살표 시작)' : '하는 사람 (화살표 시작)') : '한쪽', select(opts, r.a, function (v) { checkpoint(); r.a = v; changed(r); })));
    grid.appendChild(field(isDir ? (isAbuse ? '당한 사람 (화살표 끝)' : '받는 사람 (화살표 끝)') : '다른 쪽', select(opts, r.b, function (v) { checkpoint(); r.b = v; changed(r); })));
    grid.appendChild(field('메모', input('text', r.note, function (v) { r.note = v.trim().slice(0, 20); changed(r); }, { maxlength: 20, placeholder: '예: 진술, 2023년부터' }), true));
    box.appendChild(grid);
    var checks = el('div', { className: 'checks' });
    var tent = el('input', { type: 'checkbox', checked: r.tentative });
    tent.addEventListener('change', act(function () { r.tentative = tent.checked; changed(r); }));
    checks.appendChild(el('label', {}, [tent, ' 확인 필요로 표시']));
    if (isDir) {
      var mu = el('input', { type: 'checkbox', checked: !!r.mutual });
      mu.addEventListener('change', act(function () { r.mutual = mu.checked; changed(r); }));
      checks.appendChild(el('label', {}, [mu, ' 서로 (양쪽 화살표)']));
    }
    box.appendChild(checks);
    var tail = el('div', { className: 'insp-tail' });
    if (isDir) tail.appendChild(button('⇄ 화살표 방향 바꾸기', act(function () { var t = r.a; r.a = r.b; r.b = t; changed(r); }), 'btn btn-ghost btn-sm'));
    tail.appendChild(button('이 선 지우기', act(function () {
      state.deleted['r:' + relKey(m, r)] = 1;
      m.relations = m.relations.filter(function (x) { return x !== r; });
      state.selected = null;
      changed();
    }), 'btn-text danger'));
    box.appendChild(tail);
  }

  function unionForm(box, u) {
    if (!u) return;
    var m = state.model;
    head(box, '부부·파트너 관계', F.displayName(F.person(m, u.a)) + ' · ' + F.displayName(F.person(m, u.b)));
    var grid = el('div', { className: 'form-grid' });
    grid.appendChild(field('상태', select(Object.keys(F.UNION).map(function (k) { return [k, F.UNION[k]]; }), u.status, function (v) { checkpoint(); u.status = v; changed(u); })));
    grid.appendChild(field(u.status === 'cohabit' ? '동거 시작 연도' : '결혼 연도', input('number', u.start, function (v) { u.start = numOrNull(v, 1850, 2100); changed(u); }, { min: 1850, max: 2100 })));
    if (u.status === 'divorced' || u.status === 'separated' || u.end) grid.appendChild(field(u.status === 'separated' ? '별거 연도' : u.status === 'divorced' ? '이혼 연도' : '끝난 연도', input('number', u.end, function (v) { u.end = numOrNull(v, 1850, 2100); changed(u); }, { min: 1850, max: 2100 })));
    box.appendChild(grid);
    var tail = el('div', { className: 'insp-tail' });
    tail.appendChild(button('좌우 바꾸기', act(function () {
      // 덩어리 안 순서는 결합 순서와 성별로 정해지므로, 두 사람 자리만 맞바꾼다
      var A = F.person(m, u.a), B = F.person(m, u.b);
      var pos = window.GenogramLayout.layout(m).pos;
      var d = pos[B.id].x - pos[A.id].x;
      A.dx = (A.dx || 0) + d;
      B.dx = (B.dx || 0) - d;
      changed(u);
    }), 'btn-text'));
    var kids = F.childrenOf(m, u.id).length;
    var del = button('이 관계 지우기', act(function () {
      m.unions = m.unions.filter(function (x) { return x !== u; });
      state.selected = null;
      changed();
    }), 'btn-text danger');
    if (kids) { del.disabled = true; del.title = '자녀가 있는 관계는 지울 수 없어요. 상태를 바꿔 주세요.'; }
    tail.appendChild(del);
    if (kids) tail.appendChild(el('span', { className: 'insp-note', textContent: '자녀가 있는 관계는 지우지 않고 상태를 바꿔 주세요.' }));
    box.appendChild(tail);
  }

  function linkForm(box, l) {
    if (!l) return;
    var m = state.model, child = F.person(m, l.child), u = F.union(m, l.union);
    head(box, '부모-자녀 연결', F.displayName(child));
    var grid = el('div', { className: 'form-grid' });
    grid.appendChild(field('종류', select(Object.keys(F.LINK).map(function (k) { return [k, F.LINK[k]]; }), l.type, function (v) { checkpoint(); l.type = v; changed(l); })));
    var unionOpts = m.unions.filter(function (x) { return x.a || x.b; }).map(function (x) {
      return [x.id, [x.a, x.b].map(function (id) { return id ? F.displayName(F.person(m, id)) : '모름'; }).join(' · ')];
    });
    grid.appendChild(field('부모', select(unionOpts, l.union, function (v) { checkpoint(); l.union = v; F.cleanup(m); changed(l); })));
    var sibs = F.childrenOf(m, l.union).filter(function (s) { return s.id !== l.child; });
    if (sibs.length) {
      var cur = sibs.filter(function (s) { var sl = F.linkOf(m, s.id); return l.twin && sl.twin === l.twin; })[0];
      grid.appendChild(field('쌍둥이', select([['', '아님']].concat(sibs.map(function (s) { return [s.id, F.displayName(s) + '와 쌍둥이']; })), cur ? cur.id : '', function (v) {
        checkpoint();
        if (l.twin) m.links.forEach(function (x) { if (x.twin === l.twin && x !== l) { var others = m.links.filter(function (y) { return y.twin === l.twin; }); if (others.length <= 2) x.twin = null; } });
        l.twin = null; l.identical = false;
        if (v) { var sl = F.linkOf(m, v); var tg = sl.twin || 't' + l.id; l.twin = sl.twin = tg; }
        changed(l);
      })));
    }
    box.appendChild(grid);
    if (l.twin) {
      var checks = el('div', { className: 'checks' });
      var idc = el('input', { type: 'checkbox', checked: l.identical });
      idc.addEventListener('change', act(function () { m.links.forEach(function (x) { if (x.twin === l.twin) x.identical = idc.checked; }); changed(l); }));
      checks.appendChild(el('label', {}, [idc, ' 일란성']));
      box.appendChild(checks);
    }
    void u;
  }

  function select_(sel) {
    state.selected = sel;
    drawChart();
    drawRoster();
    if (sel) openEditor();
    else if (dlg.open) dlg.close();
  }

  // ── 가계도 누르기·끌기 ──────────────────────────────────
  var drag = null;
  $('chart').addEventListener('pointerdown', function (e) {
    var g = e.target.closest('[data-kind]');
    if (!g) { if (state.selected && e.target.closest('svg')) select_(null); return; }
    var svg = $('chart').querySelector('svg');
    drag = { g: g, kind: g.getAttribute('data-kind'), id: g.getAttribute('data-id'), x0: e.clientX, y0: e.clientY, moved: false, svg: svg };
    if (drag.kind === 'person') { try { g.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } }
  });
  $('chart').addEventListener('pointermove', function (e) {
    if (!drag || drag.kind !== 'person') return;
    var dxPx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dxPx) < 5) return;
    drag.moved = true;
    var ctm = drag.svg.getScreenCTM();
    drag.dx = dxPx / (ctm ? ctm.a : 1);
    drag.g.setAttribute('transform', 'translate(' + drag.dx + ' 0)');
    drag.g.classList.add('dragging');
  });
  function endDrag() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.kind === 'person' && d.moved) {
      checkpoint();
      var p = F.person(state.model, d.id);
      p.dx = (p.dx || 0) + d.dx;
      state.selected = { type: 'person', id: p.id };
      changed();
    } else select_({ type: d.kind, id: d.id });
  }
  $('chart').addEventListener('pointerup', endDrag);
  $('chart').addEventListener('pointercancel', function () { drag = null; drawChart(); });
  $('chart').addEventListener('keydown', function (e) {
    var g = e.target.closest && e.target.closest('[data-kind]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select_({ type: g.getAttribute('data-kind'), id: g.getAttribute('data-id') }); }
  });

  // ── 입력·버튼 ───────────────────────────────────────────
  var timer = null, typingSnap = null;
  text.addEventListener('focus', function () { typingSnap = snapshot(); });
  text.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (typingSnap) { state.undo.push(typingSnap); state.redo = []; typingSnap = snapshot(); }
      fromText(false);
      if (state.model.persons.length && !state.createdSent && window.SiteStats) { state.createdSent = true; window.SiteStats.event('create'); }
    }, 250);
  });
  $('reparse').addEventListener('click', act(function () { fromText(true); }));
  $('clear-text').addEventListener('click', act(function () {
    text.value = '';
    state.answers = {};
    fromText(true);
    text.focus();
  }));
  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    var k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });

  function toggle(id, key) {
    var b = $(id);
    b.addEventListener('click', function () {
      state.settings[key] = !state.settings[key];
      b.setAttribute('aria-pressed', state.settings[key] ? 'true' : 'false');
      drawChart();
    });
  }
  toggle('opt-mono', 'mono');
  toggle('opt-gen', 'generations');
  toggle('opt-legend', 'legend');

  function loadExample() {
    if (window.SiteStats) window.SiteStats.event('example');
    checkpoint();
    text.value = EXAMPLE.join('\n');
    state.answers = {};
    fromText(true);
    $('make').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-load-example]');
    if (t) loadExample();
  });

  function busy(btn, fn) {
    var g = graphic(true);
    if (!g) return;
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '만드는 중…';
    fn(g, state.title).catch(function (err) {
      $('parse-status').textContent = err.message || '내려받기를 만들지 못했어요. 다시 눌러 주세요.';
    }).then(function () {
      btn.disabled = false;
      btn.textContent = label;
    });
  }
  // 내려받기: 처음 한 번만 직업을 묻는다 (건너뛰어도 바로 내려받아진다)
  function asked() { try { return localStorage.getItem('job-asked') === '1'; } catch (e) { return true; } }
  function markAsked() { try { localStorage.setItem('job-asked', '1'); } catch (e) {} }
  var jobDlg = $('job-dialog');
  function download() {
    busy($('dl-png'), X.png);
    if (window.SiteStats) window.SiteStats.event('download');
    document.dispatchEvent(new CustomEvent('genogram:downloaded'));
  }
  $('dl-png').addEventListener('click', function () {
    if (asked() || !jobDlg || !jobDlg.showModal) { download(); return; }
    jobDlg.querySelectorAll('input[name=job]').forEach(function (r) { r.checked = false; });
    $('job-other').value = '';
    $('job-other-wrap').hidden = true;
    jobDlg.showModal();
  });
  if (jobDlg) {
    jobDlg.addEventListener('change', function (e) {
      if (e.target.name === 'job') $('job-other-wrap').hidden = e.target.value !== '기타';
    });
    $('job-skip').addEventListener('click', function () { markAsked(); jobDlg.close(); download(); });
    $('job-send').addEventListener('click', function () {
      var picked = jobDlg.querySelector('input[name=job]:checked');
      if (picked && window.SiteStats) window.SiteStats.event('job', { job: picked.value, job_other: picked.value === '기타' ? $('job-other').value.trim().slice(0, 30) : '' });
      markAsked();
      jobDlg.close();
      download();
    });
  }

  // 확대·축소
  var ZOOMS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];
  function currentScale() {
    var svgEl = $('chart').querySelector('svg');
    var g = graphic(false);
    if (!svgEl || !g) return 1;
    return svgEl.getBoundingClientRect().width / g.width;
  }
  $('zoom-in').addEventListener('click', function () {
    var s = state.zoom || currentScale();
    state.zoom = ZOOMS.filter(function (z) { return z > s + 0.01; })[0] || ZOOMS[ZOOMS.length - 1];
    drawChart();
  });
  $('zoom-out').addEventListener('click', function () {
    var s = state.zoom || currentScale();
    var smaller = ZOOMS.filter(function (z) { return z < s - 0.01; });
    state.zoom = smaller.length ? smaller[smaller.length - 1] : ZOOMS[0];
    drawChart();
  });
  $('zoom-fit').addEventListener('click', function () { state.zoom = null; drawChart(); });

  // 사례 제목 → 내려받는 파일 이름
  $('case-title').addEventListener('input', function () { state.title = this.value.trim().slice(0, 40); });

  drawAll();
})();
