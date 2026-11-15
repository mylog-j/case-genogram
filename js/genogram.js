/*
 * 가계도 모델 → SVG 문자열
 * 내보내기(PNG·PDF)에도 그대로 쓰도록 스타일은 모두 속성으로 넣는다.
 */
(function (global) {
  'use strict';

  var S = 46;            // 기호 크기
  var GAP = 104;         // 같은 세대 간격
  var ROW = 150;         // 세대 간격
  var PAD = 48;
  var FONT = "'IBM Plex Sans KR','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
  var INK = '#2B2724';
  var MUTED = '#77706A';
  var PAPER = '#FFFFFF';

  var REL_STYLE = {
    close: { color: '#4F8A63', label: '친밀' },
    fused: { color: '#6E5FA8', label: '밀착' },
    conflict: { color: '#D2554B', label: '갈등' },
    distant: { color: '#8F8780', label: '소원' },
    cutoff: { color: '#3D3835', label: '단절' },
    abuse: { color: '#A3201F', label: '폭력·학대' }
  };
  var UNION_LABEL = { married: '결혼', divorced: '이혼', separated: '별거', cohabit: '동거' };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function byRole(model, role) { return model.persons.filter(function (p) { return p.role === role; }); }
  function first(model, role) { return byRole(model, role)[0] || null; }

  // ── 자리 잡기 ───────────────────────────────────────────
  function layout(model) {
    var pos = {};
    var client = first(model, 'client');
    var spouse = first(model, 'spouse');
    var father = first(model, 'father'), mother = first(model, 'mother');
    var pgf = first(model, 'pgf'), pgm = first(model, 'pgm'), mgf = first(model, 'mgf'), mgm = first(model, 'mgm');
    var siblings = byRole(model, 'sibling');
    var children = byRole(model, 'child');

    // 0세대: 나이 많은 쪽이 왼쪽
    var gen0 = siblings.slice();
    if (client) gen0.push(client);
    var allAges = gen0.every(function (p) { return p.age != null; });
    var rank = function (p) {
      if (p === client) return 1;
      if (p.order === 'older') return 0;
      if (p.order === 'younger') return 2;
      return 1.5;
    };
    gen0.sort(function (a, b) {
      if (allAges && a.age !== b.age) return b.age - a.age;
      var d = rank(a) - rank(b);
      if (d) return d;
      if (a.age != null && b.age != null) return b.age - a.age;
      return model.persons.indexOf(a) - model.persons.indexOf(b);
    });

    var y0 = 2 * ROW, x = 0;
    var row0 = [];
    gen0.forEach(function (p) {
      pos[p.id] = { x: x, y: y0 };
      row0.push(p);
      x += GAP;
      if (p === client && spouse) {
        pos[spouse.id] = { x: x, y: y0 };
        x += GAP;
      }
    });
    if (!client && spouse) { pos[spouse.id] = { x: x, y: y0 }; }

    // 부모: 형제 줄 가운데 위
    var sibXs = row0.map(function (p) { return pos[p.id].x; });
    var cx = sibXs.length ? (Math.min.apply(null, sibXs) + Math.max.apply(null, sibXs)) / 2 : 0;
    var hasPGP = pgf || pgm, hasMGP = mgf || mgm;
    var pgap = hasPGP && hasMGP ? 2.1 * GAP : 1.3 * GAP;
    if (father && mother) {
      pos[father.id] = { x: cx - pgap / 2, y: ROW };
      pos[mother.id] = { x: cx + pgap / 2, y: ROW };
    } else if (father) pos[father.id] = { x: cx, y: ROW };
    else if (mother) pos[mother.id] = { x: cx, y: ROW };

    // 조부모
    function placeGP(gf, gm, child) {
      if (!child) return;
      var cxp = pos[child.id].x, half = 0.65 * GAP;
      if (gf && gm) { pos[gf.id] = { x: cxp - half, y: 0 }; pos[gm.id] = { x: cxp + half, y: 0 }; }
      else if (gf) pos[gf.id] = { x: cxp, y: 0 };
      else if (gm) pos[gm.id] = { x: cxp, y: 0 };
    }
    placeGP(pgf, pgm, father);
    placeGP(mgf, mgm, mother);

    // 자녀
    if (children.length && client) {
      var base = spouse ? (pos[client.id].x + pos[spouse.id].x) / 2 : pos[client.id].x;
      children.sort(function (a, b) {
        if (a.age != null && b.age != null) return b.age - a.age;
        return model.persons.indexOf(a) - model.persons.indexOf(b);
      });
      var start = base - (children.length - 1) * GAP / 2;
      children.forEach(function (c, i) { pos[c.id] = { x: start + i * GAP, y: 3 * ROW }; });
    }

    // 자리 없는 사람(역할이 겹친 경우 등)은 맨 아래 줄에
    var extra = model.persons.filter(function (p) { return !pos[p.id]; });
    if (extra.length) {
      var maxY = 0;
      Object.keys(pos).forEach(function (k) { maxY = Math.max(maxY, pos[k].y); });
      extra.forEach(function (p, i) { pos[p.id] = { x: i * GAP, y: maxY + ROW }; });
    }

    // 겹침 풀기: 같은 줄에서 너무 가까우면 오른쪽으로 민다
    var rows = {};
    Object.keys(pos).forEach(function (id) { (rows[pos[id].y] = rows[pos[id].y] || []).push(id); });
    Object.keys(rows).forEach(function (y) {
      var ids = rows[y].sort(function (a, b) { return pos[a].x - pos[b].x; });
      for (var i = 1; i < ids.length; i++) {
        var min = pos[ids[i - 1]].x + 0.85 * GAP;
        if (pos[ids[i]].x < min) pos[ids[i]].x = min;
      }
    });

    return pos;
  }

  // ── 그리기 도우미 ───────────────────────────────────────
  function symbol(p, at, isClient) {
    var x = at.x, y = at.y, h = S / 2, out = [];
    var sw = 2;
    if (p.gender === 'M') {
      out.push('<rect x="' + (x - h) + '" y="' + (y - h) + '" width="' + S + '" height="' + S + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="' + sw + '"/>');
      if (isClient) out.push('<rect x="' + (x - h - 5) + '" y="' + (y - h - 5) + '" width="' + (S + 10) + '" height="' + (S + 10) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>');
    } else if (p.gender === 'F') {
      out.push('<circle cx="' + x + '" cy="' + y + '" r="' + h + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="' + sw + '"/>');
      if (isClient) out.push('<circle cx="' + x + '" cy="' + y + '" r="' + (h + 5) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>');
    } else {
      var d = h + 3;
      var pts = [x + ',' + (y - d), (x + d) + ',' + y, x + ',' + (y + d), (x - d) + ',' + y].join(' ');
      out.push('<polygon points="' + pts + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="' + sw + '"/>');
      if (isClient) {
        var d2 = d + 6;
        out.push('<polygon points="' + [x + ',' + (y - d2), (x + d2) + ',' + y, x + ',' + (y + d2), (x - d2) + ',' + y].join(' ') + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>');
      }
    }
    if (p.age != null) {
      out.push('<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-family="' + FONT + '" font-size="15" font-weight="600" fill="' + INK + '">' + esc(p.age) + '</text>');
    }
    if (p.deceased) {
      var e = h + 4;
      out.push('<path d="M' + (x - e) + ' ' + (y - e) + 'L' + (x + e) + ' ' + (y + e) + 'M' + (x + e) + ' ' + (y - e) + 'L' + (x - e) + ' ' + (y + e) + '" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>');
    }
    var nameY = y + h + (isClient ? 24 : 18);
    var title = p.name || p.label || '';
    var halo = ' stroke="' + PAPER + '" stroke-width="5" stroke-linejoin="round" paint-order="stroke"';
    out.push('<text x="' + x + '" y="' + nameY + '" text-anchor="middle" font-family="' + FONT + '" font-size="14" font-weight="600" fill="' + INK + '"' + halo + '>' + esc(title) + '</text>');
    var sub = p.name ? (p.role === 'client' ? '내담자' : p.label) : '';
    if (sub) out.push('<text x="' + x + '" y="' + (nameY + 16) + '" text-anchor="middle" font-family="' + FONT + '" font-size="12" fill="' + MUTED + '"' + halo + '>' + esc(sub) + '</text>');
    return out.join('');
  }

  function line(x1, y1, x2, y2, extra) {
    return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="' + INK + '" stroke-width="2" fill="none"' + (extra || '') + '/>';
  }

  // 부부선: 두 기호 아래에서 내려와 가로로 잇는다. 가운데 x 와 가로선 y 를 돌려준다.
  function union(a, b, status, out) {
    var left = a.x <= b.x ? a : b, right = a.x <= b.x ? b : a;
    var top = left.y + S / 2 + 2, by = left.y + S / 2 + 50;
    var dash = status === 'cohabit' ? ' stroke-dasharray="6 5"' : '';
    out.push(line(left.x, top, left.x, by, dash));
    out.push(line(right.x, top, right.x, by, dash));
    out.push(line(left.x, by, right.x, by, dash));
    var mx = (left.x + right.x) / 2;
    if (status === 'divorced' || status === 'separated') {
      var n = status === 'divorced' ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var ox = mx - 10 + i * 9 + (n === 1 ? 4 : 0);
        out.push(line(ox - 5, by + 9, ox + 5, by - 9, ' stroke-linecap="round"'));
      }
    }
    return { x: mx, y: by };
  }

  // 자식 묶음 선
  function descent(from, kids, pos, out) {
    if (!kids.length) return;
    var barY = pos[kids[0].id].y - S / 2 - 26;
    var xs = kids.map(function (k) { return pos[k.id].x; });
    var minX = Math.min.apply(null, xs.concat(from.x)), maxX = Math.max.apply(null, xs.concat(from.x));
    out.push(line(from.x, from.y, from.x, barY));
    if (maxX > minX) out.push(line(minX, barY, maxX, barY));
    kids.forEach(function (k) {
      var p = pos[k.id];
      var top = p.y - S / 2 - (k.role === 'client' ? 5 : 0) - (k.gender === 'U' ? 3 : 0);
      out.push(line(p.x, barY, p.x, top));
    });
  }

  // 정서적 관계선 (두 기호를 잇는 완만한 곡선)
  function relationPath(a, b, bend) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var trim = S / 2 + 10;
    var p0 = { x: a.x + ux * trim, y: a.y + uy * trim };
    var p2 = { x: b.x - ux * trim, y: b.y - uy * trim };
    var c = { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend };
    return { p0: p0, c: c, p2: p2 };
  }
  function qPoint(q, t) {
    var mt = 1 - t;
    return {
      x: mt * mt * q.p0.x + 2 * mt * t * q.c.x + t * t * q.p2.x,
      y: mt * mt * q.p0.y + 2 * mt * t * q.c.y + t * t * q.p2.y
    };
  }
  function qTangent(q, t) {
    var x = 2 * (1 - t) * (q.c.x - q.p0.x) + 2 * t * (q.p2.x - q.c.x);
    var y = 2 * (1 - t) * (q.c.y - q.p0.y) + 2 * t * (q.p2.y - q.c.y);
    var l = Math.sqrt(x * x + y * y) || 1;
    return { x: x / l, y: y / l };
  }
  function qD(q) { return 'M' + r(q.p0.x) + ' ' + r(q.p0.y) + 'Q' + r(q.c.x) + ' ' + r(q.c.y) + ' ' + r(q.p2.x) + ' ' + r(q.p2.y); }
  function r(n) { return Math.round(n * 10) / 10; }

  function zigzag(q, amp) {
    var n = 22, d = 'M' + r(q.p0.x) + ' ' + r(q.p0.y);
    for (var i = 1; i < n; i++) {
      var t = i / n, p = qPoint(q, t), tg = qTangent(q, t), s = (i % 2 ? 1 : -1) * amp;
      d += 'L' + r(p.x - tg.y * s) + ' ' + r(p.y + tg.x * s);
    }
    return d + 'L' + r(q.p2.x) + ' ' + r(q.p2.y);
  }

  function drawRelation(type, q) {
    var c = REL_STYLE[type].color, d = qD(q), out = [];
    var base = ' fill="none" stroke-linecap="round"';
    if (type === 'close') {
      out.push('<path d="' + d + '" stroke="' + c + '" stroke-width="7"' + base + '/>');
      out.push('<path d="' + d + '" stroke="' + PAPER + '" stroke-width="2.6"' + base + '/>');
    } else if (type === 'fused') {
      out.push('<path d="' + d + '" stroke="' + c + '" stroke-width="11"' + base + '/>');
      out.push('<path d="' + d + '" stroke="' + PAPER + '" stroke-width="7"' + base + '/>');
      out.push('<path d="' + d + '" stroke="' + c + '" stroke-width="2.4"' + base + '/>');
    } else if (type === 'conflict') {
      out.push('<path d="' + zigzag(q, 5) + '" stroke="' + c + '" stroke-width="2"' + base + ' stroke-linejoin="round"/>');
    } else if (type === 'distant') {
      out.push('<path d="' + d + '" stroke="' + c + '" stroke-width="2" stroke-dasharray="3 6"' + base + '/>');
    } else if (type === 'cutoff') {
      var m1 = qPoint(q, 0.44), m2 = qPoint(q, 0.56), tg = qTangent(q, 0.5);
      out.push('<path d="' + d + '" stroke="' + c + '" stroke-width="2"' + base + '/>');
      // 가운데를 비우고 양쪽에 짧은 막대
      var mid = qPoint(q, 0.5);
      out.push('<circle cx="' + r(mid.x) + '" cy="' + r(mid.y) + '" r="9" fill="' + PAPER + '"/>');
      [m1, m2].forEach(function (m) {
        out.push('<path d="M' + r(m.x - tg.y * 9) + ' ' + r(m.y + tg.x * 9) + 'L' + r(m.x + tg.y * 9) + ' ' + r(m.y - tg.x * 9) + '" stroke="' + c + '" stroke-width="2.4"' + base + '/>');
      });
    } else if (type === 'abuse') {
      out.push('<path d="' + zigzag(q, 5) + '" stroke="' + c + '" stroke-width="2.4"' + base + ' stroke-linejoin="round"/>');
      var end = q.p2, t2 = qTangent(q, 1), w = 7, L = 13;
      var bx = end.x - t2.x * L, by = end.y - t2.y * L;
      out.push('<path d="M' + r(end.x) + ' ' + r(end.y) + 'L' + r(bx - t2.y * w) + ' ' + r(by + t2.x * w) + 'L' + r(bx + t2.y * w) + ' ' + r(by - t2.x * w) + 'Z" fill="' + c + '"/>');
    }
    return out.join('');
  }

  // ── 범례 ────────────────────────────────────────────────
  function legend(model, x0, y0, maxW) {
    var items = [];
    var genders = {};
    model.persons.forEach(function (p) { genders[p.gender] = 1; });
    items.push({ kind: 'client' });
    if (genders.M) items.push({ kind: 'M' });
    if (genders.F) items.push({ kind: 'F' });
    if (genders.U) items.push({ kind: 'U' });
    if (model.persons.some(function (p) { return p.deceased; })) items.push({ kind: 'dead' });
    var unionsUsed = {};
    activeUnions(model).forEach(function (u) { if (u.status !== 'married') unionsUsed[u.status] = 1; });
    Object.keys(unionsUsed).forEach(function (s) { items.push({ kind: 'union', status: s }); });
    var relUsed = {};
    model.relations.forEach(function (rl) { relUsed[rl.type] = 1; });
    Object.keys(REL_STYLE).forEach(function (t) { if (relUsed[t]) items.push({ kind: 'rel', type: t }); });

    var out = [], colW = 128, rowH = 34;
    var perRow = Math.max(1, Math.floor(maxW / colW));
    out.push('<line x1="' + x0 + '" y1="' + (y0 - 22) + '" x2="' + (x0 + Math.min(maxW, perRow * colW) - 20) + '" y2="' + (y0 - 22) + '" stroke="#E4E0DB" stroke-width="1"/>');
    items.forEach(function (it, i) {
      var cx = x0 + (i % perRow) * colW, cy = y0 + Math.floor(i / perRow) * rowH;
      var g = '', label = '';
      var s = 9;
      if (it.kind === 'client') {
        g = '<rect x="' + (cx) + '" y="' + (cy - s) + '" width="' + 2 * s + '" height="' + 2 * s + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/><rect x="' + (cx - 3) + '" y="' + (cy - s - 3) + '" width="' + (2 * s + 6) + '" height="' + (2 * s + 6) + '" fill="none" stroke="' + INK + '" stroke-width="1"/>';
        label = '내담자';
      } else if (it.kind === 'M') { g = '<rect x="' + cx + '" y="' + (cy - s) + '" width="' + 2 * s + '" height="' + 2 * s + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>'; label = '남성'; }
      else if (it.kind === 'F') { g = '<circle cx="' + (cx + s) + '" cy="' + cy + '" r="' + s + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>'; label = '여성'; }
      else if (it.kind === 'U') { g = '<polygon points="' + (cx + s) + ',' + (cy - s - 1) + ' ' + (cx + 2 * s + 1) + ',' + cy + ' ' + (cx + s) + ',' + (cy + s + 1) + ' ' + (cx - 1) + ',' + cy + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>'; label = '성별 모름'; }
      else if (it.kind === 'dead') { g = '<rect x="' + cx + '" y="' + (cy - s) + '" width="' + 2 * s + '" height="' + 2 * s + '" fill="none" stroke="' + INK + '" stroke-width="1.6"/><path d="M' + (cx - 2) + ' ' + (cy - s - 2) + 'L' + (cx + 2 * s + 2) + ' ' + (cy + s + 2) + 'M' + (cx + 2 * s + 2) + ' ' + (cy - s - 2) + 'L' + (cx - 2) + ' ' + (cy + s + 2) + '" stroke="' + INK + '" stroke-width="1.6"/>'; label = '사망'; }
      else if (it.kind === 'union') {
        g = '<path d="M' + cx + ' ' + cy + 'L' + (cx + 26) + ' ' + cy + '" stroke="' + INK + '" stroke-width="2"' + (it.status === 'cohabit' ? ' stroke-dasharray="5 4"' : '') + '/>';
        var n = it.status === 'divorced' ? 2 : it.status === 'separated' ? 1 : 0;
        for (var k = 0; k < n; k++) { var ox = cx + 10 + k * 7 + (n === 1 ? 3 : 0); g += '<path d="M' + (ox - 4) + ' ' + (cy + 7) + 'L' + (ox + 4) + ' ' + (cy - 7) + '" stroke="' + INK + '" stroke-width="2"/>'; }
        label = UNION_LABEL[it.status];
      } else if (it.kind === 'rel') {
        var q = { p0: { x: cx, y: cy }, c: { x: cx + 16, y: cy }, p2: { x: cx + 32, y: cy } };
        g = drawRelation(it.type, q);
        label = REL_STYLE[it.type].label;
      }
      out.push(g);
      out.push('<text x="' + (cx + 40) + '" y="' + (cy + 5) + '" font-family="' + FONT + '" font-size="13" fill="' + INK + '">' + esc(label) + '</text>');
    });
    var rows = Math.ceil(items.length / perRow);
    return { svg: out.join(''), height: rows * rowH + 10 };
  }

  function activeUnions(model) {
    var list = [];
    function add(key, a, b) { if (a && b) list.push({ key: key, a: a, b: b, status: model.unions[key] || 'married' }); }
    add('parents', first(model, 'father'), first(model, 'mother'));
    add('client', first(model, 'client'), first(model, 'spouse'));
    add('paternal', first(model, 'pgf'), first(model, 'pgm'));
    add('maternal', first(model, 'mgf'), first(model, 'mgm'));
    return list;
  }

  // ── 전체 그리기 ─────────────────────────────────────────
  function render(model, opts) {
    opts = opts || {};
    if (!model.persons.length) return null;
    var pos = layout(model);
    var client = first(model, 'client');
    var father = first(model, 'father'), mother = first(model, 'mother');
    var spouse = first(model, 'spouse');
    var out = [];

    var unionMid = {};
    activeUnions(model).forEach(function (u) {
      unionMid[u.key] = union(pos[u.a.id], pos[u.b.id], u.status, out);
    });

    function parentPoint(a, b, key) {
      if (unionMid[key]) return unionMid[key];
      var p = a || b;
      if (!p) return null;
      var q = pos[p.id];
      return { x: q.x, y: q.y + S / 2 + 2 };
    }

    // 형제 줄
    var sibs = model.persons.filter(function (p) { return p.role === 'sibling' || p.role === 'client'; });
    var fromParents = parentPoint(father, mother, 'parents');
    if (fromParents && sibs.length) descent(fromParents, sibs, pos, out);
    else if (sibs.length > 1) {
      // 부모를 모를 때: 형제끼리만 묶는다
      var bar = pos[sibs[0].id].y - S / 2 - 26;
      var xs = sibs.map(function (p) { return pos[p.id].x; });
      var mid = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
      descent({ x: mid, y: bar - 18 }, sibs, pos, out);
    }

    // 조부모 → 부모
    var pg = parentPoint(first(model, 'pgf'), first(model, 'pgm'), 'paternal');
    if (pg && father) descent(pg, [father], pos, out);
    var mg = parentPoint(first(model, 'mgf'), first(model, 'mgm'), 'maternal');
    if (mg && mother) descent(mg, [mother], pos, out);

    // 자녀
    var kids = model.persons.filter(function (p) { return p.role === 'child'; });
    if (kids.length && client) {
      var cp = spouse ? parentPoint(client, spouse, 'client') : { x: pos[client.id].x, y: pos[client.id].y + S / 2 + 50 };
      descent(cp, kids, pos, out);
    }

    // 정서적 관계선 (구조선 위, 기호 아래)
    var pairCount = {};
    var relSvg = [];
    model.relations.forEach(function (rl) {
      var a = pos[rl.a], b = pos[rl.b];
      if (!a || !b) return;
      var key = [rl.a, rl.b].sort().join('|');
      var n = pairCount[key] = (pairCount[key] || 0) + 1;
      var dist = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
      var bend = (a.y === b.y ? -1 : 1) * Math.min(48, 14 + dist * 0.12) * (n % 2 ? 1 : -1) * (1 + Math.floor((n - 1) / 2) * 0.7);
      relSvg.push(drawRelation(rl.type, relationPath(a, b, bend)));
    });

    var syms = model.persons.map(function (p) { return symbol(p, pos[p.id], p === client); });

    // 경계 계산
    var xs = [], ys = [];
    Object.keys(pos).forEach(function (id) { xs.push(pos[id].x); ys.push(pos[id].y); });
    var minX = Math.min.apply(null, xs) - S - 30, maxX = Math.max.apply(null, xs) + S + 30;
    var minY = Math.min.apply(null, ys) - S - 40, maxY = Math.max.apply(null, ys) + S + 40;
    var w = Math.max(maxX - minX, 300);
    if (w > maxX - minX) { var add = (w - (maxX - minX)) / 2; minX -= add; maxX += add; }

    var leg = opts.legend === false ? { svg: '', height: 0 } : legend(model, minX + 20, maxY + 30, w - 20);
    var title = opts.title ? '<text x="' + (minX + 20) + '" y="' + (minY + 6) + '" font-family="' + FONT + '" font-size="15" font-weight="600" fill="' + INK + '">' + esc(opts.title) + '</text>' : '';
    if (title) minY -= 24;
    var h = maxY - minY + leg.height + (leg.height ? 30 : 0);

    return {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r(minX) + ' ' + r(minY) + ' ' + r(w) + ' ' + r(h) + '" width="' + r(w) + '" height="' + r(h) + '" role="img" aria-label="가계도">' +
        '<rect x="' + r(minX) + '" y="' + r(minY) + '" width="' + r(w) + '" height="' + r(h) + '" fill="' + PAPER + '"/>' +
        title + out.join('') + relSvg.join('') + syms.join('') + leg.svg + '</svg>',
      width: w,
      height: h
    };
  }

  global.GenogramRender = { render: render, REL_STYLE: REL_STYLE, UNION_LABEL: UNION_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
