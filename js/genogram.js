/*
 * 가족 모델 → 가계도 SVG 문자열
 * 내보내기(PNG·PDF)에도 그대로 쓰도록 스타일은 모두 속성으로 넣는다.
 */
(function (global) {
  'use strict';

  var F = global.FamilyModel, L = global.GenogramLayout;
  var S = 46, H = S / 2;
  var FONT = "'IBM Plex Sans KR','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
  var INK = '#2B2724', MUTED = '#4F4842', PAPER = '#FFFFFF', HOUSE = '#5B8A69', SEL = '#E8877D', FAINT = '#ADA59D';

  var GREEN = '#24874F', RED = '#D93A2B', BLUE = '#2F5FD0', PURPLE = '#7454C2', BROWN = '#C47A30', TEAL = '#2A7C8E';
  var REL_COLOR = {
    close: GREEN, oneSided: GREEN, fused: RED, conflict: RED, conflictDark: '#8E1F16', hostile: RED, distant: INK,
    cutoff: RED, closeConflict: GREEN, fusedConflict: RED,
    'abuse:violence': RED, 'abuse:body': BLUE, 'abuse:emotion': PURPLE,
    care: GREEN, control: BROWN, focus: BROWN, cohabit: TEAL
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function r(n) { return Math.round(n * 10) / 10; }
  function attrs(o) { var s = ''; for (var k in o) if (o[k] != null) s += ' ' + k + '="' + o[k] + '"'; return s; }
  function path(d, o) { return '<path d="' + d + '"' + attrs(Object.assign({ fill: 'none', stroke: INK, 'stroke-width': 2 }, o || {})) + '/>'; }
  function line(x1, y1, x2, y2, o) { return path('M' + r(x1) + ' ' + r(y1) + 'L' + r(x2) + ' ' + r(y2), o); }
  function text(x, y, s, o) {
    return '<text' + attrs(Object.assign({ x: r(x), y: r(y), 'text-anchor': 'middle', 'font-family': FONT, 'font-size': 13, fill: INK }, o || {})) + '>' + esc(s) + '</text>';
  }
  function halo(o) { return Object.assign({ stroke: PAPER, 'stroke-width': 5, 'stroke-linejoin': 'round', 'paint-order': 'stroke' }, o || {}); }

  // ── 사람 기호 ───────────────────────────────────────────
  function shape(kind, gender, x, y, size, o) {
    var h = size / 2, st = Object.assign({ fill: PAPER, stroke: INK, 'stroke-width': 2 }, o || {});
    if (kind === 'pregnancy' || kind === 'miscarriage' || kind === 'abortion') {
      return '<polygon points="' + [x + ',' + r(y - h), r(x + h) + ',' + r(y + h * 0.8), r(x - h) + ',' + r(y + h * 0.8)].join(' ') + '"' + attrs(st) + '/>';
    }
    if (kind === 'pet' || gender === 'U') {
      var d = h + (kind === 'pet' ? 0 : 3);
      return '<polygon points="' + [x + ',' + r(y - d), r(x + d) + ',' + y, x + ',' + r(y + d), r(x - d) + ',' + y].join(' ') + '"' + attrs(st) + '/>';
    }
    if (gender === 'M') return '<rect' + attrs(Object.assign({ x: r(x - h), y: r(y - h), width: size, height: size }, st)) + '/>';
    return '<circle' + attrs(Object.assign({ cx: x, cy: y, r: h }, st)) + '/>';
  }

  function symbolSize(p) {
    if (p.kind === 'miscarriage' || p.kind === 'abortion' || p.kind === 'stillbirth') return 28;
    if (p.kind === 'pet') return 30;
    if (p.kind === 'pregnancy') return 38;
    return S;
  }

  function personSvg(p, at, opts) {
    var x = at.x, y = at.y, size = symbolSize(p), h = size / 2, out = [];
    var selected = opts.selected && opts.selected.type === 'person' && opts.selected.id === p.id;
    if (selected) out.push('<circle cx="' + x + '" cy="' + y + '" r="' + (h + 14) + '" fill="' + SEL + '" fill-opacity="0.22"/>');
    var fill = p.kind === 'pet' ? '#F3F0EA' : PAPER;
    var faint = p.implied && !p.client;
    out.push(shape(p.kind, p.gender, x, y, size, faint ? { fill: fill, stroke: FAINT, 'stroke-dasharray': '4 3' } : { fill: fill }));
    if (p.client) {
      if (p.gender === 'M') out.push('<rect' + attrs({ x: r(x - h - 5), y: r(y - h - 5), width: size + 10, height: size + 10, fill: 'none', stroke: INK, 'stroke-width': 1.5 }) + '/>');
      else if (p.gender === 'F') out.push('<circle' + attrs({ cx: x, cy: y, r: h + 5, fill: 'none', stroke: INK, 'stroke-width': 1.5 }) + '/>');
      else out.push(shape('person', 'U', x, y, size + 12, { fill: 'none', 'stroke-width': 1.5 }));
    }
    if (p.age != null && p.kind === 'person') out.push(text(x, y + 5, p.age, { 'font-size': 15, 'font-weight': 600 }));
    if (p.deceased || p.kind === 'miscarriage' || p.kind === 'abortion' || p.kind === 'stillbirth') {
      var e = h + (p.kind === 'person' ? 4 : 3);
      out.push(path('M' + r(x - e) + ' ' + r(y - e) + 'L' + r(x + e) + ' ' + r(y + e) + 'M' + r(x + e) + ' ' + r(y - e) + 'L' + r(x - e) + ' ' + r(y + e)));
    }
    if (p.kind === 'abortion') out.push(line(x - h, y + h + 5, x + h, y + h + 5));

    var ny = y + h + (p.client ? 24 : 18);
    var title = p.name || p.label || (p.client ? '내담자' : F.KIND[p.kind]);
    out.push(text(x, ny, title, halo(faint ? { 'font-size': 13, 'font-weight': 500, fill: MUTED } : { 'font-size': 14, 'font-weight': 600 })));
    var sub = [];
    if (p.name && p.label) sub.push(p.client ? (p.label || '내담자') : p.label);
    else if (p.name && p.client) sub.push(p.label || '내담자');
    if (sub.length) { ny += 16; out.push(text(x, ny, sub.join(''), halo({ 'font-size': 13, 'font-weight': 500, fill: MUTED }))); }
    var extra = [];
    if (p.grade) extra.push(p.grade);
    if (p.genderLabel) extra.push(p.genderLabel);
    if (p.kind !== 'person' && p.kind !== 'pet' && p.birthYear) extra.push(p.birthYear);
    else if (p.birthYear) extra.push(p.birthYear + '년생');
    if (p.deathYear) extra.push('사망 ' + p.deathYear);
    if (p.source) extra.push(p.source);
    if (p.note) extra.push(p.note.length > 14 ? p.note.slice(0, 13) + '…' : p.note);
    if (extra.length) { ny += 15; out.push(text(x, ny, extra.join(' · '), halo({ 'font-size': 12.5, 'font-weight': 500, fill: MUTED }))); }

    return '<g data-kind="person" data-id="' + p.id + '" tabindex="0" role="button" aria-label="' + esc(title) + ' 편집">' +
      '<rect x="' + r(x - 46) + '" y="' + r(y - h - 10) + '" width="92" height="' + r(ny - y + h + 16) + '" fill="transparent"/>' +
      out.join('') + '</g>';
  }

  // ── 관계선 곡선 ─────────────────────────────────────────
  function curve(a, b, bend) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len, nx = -uy, ny = ux, trim = H + 10;
    return {
      p0: { x: a.x + ux * trim, y: a.y + uy * trim },
      c: { x: (a.x + b.x) / 2 + nx * bend, y: (a.y + b.y) / 2 + ny * bend },
      p2: { x: b.x - ux * trim, y: b.y - uy * trim }
    };
  }
  // 기호 가운데에서 (ux,uy) 쪽으로 테두리까지의 거리
  function edgeDist(p, ux, uy) {
    var h = symbolSize(p) / 2 + (p.client ? 5 : 0);
    if (p.kind === 'pet' || (p.kind === 'person' && p.gender === 'U')) return (h + 3) / (Math.abs(ux) + Math.abs(uy) || 1);
    if (p.kind === 'person' && p.gender === 'M') return h / Math.max(Math.abs(ux), Math.abs(uy), 0.0001);
    return h;
  }
  // 두 기호의 테두리를 바로 잇는 선 (bend 가 있으면 살짝 휜 선, off 만큼 나란히 띄움)
  function straight(a, b, pa, pb, bend, off) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var ax = a.x + nx * off, ay = a.y + ny * off, bx = b.x + nx * off, by = b.y + ny * off;
    var ca = { x: (ax + bx) / 2 + nx * bend, y: (ay + by) / 2 + ny * bend };
    // 휜 선이면 시작·끝 방향은 조절점 쪽
    var sa = { x: ca.x - ax, y: ca.y - ay }, sb = { x: ca.x - bx, y: ca.y - by };
    var la = Math.sqrt(sa.x * sa.x + sa.y * sa.y) || 1, lb = Math.sqrt(sb.x * sb.x + sb.y * sb.y) || 1;
    sa.x /= la; sa.y /= la; sb.x /= lb; sb.y /= lb;
    var da = edgeDist(pa, sa.x, sa.y), db = edgeDist(pb, sb.x, sb.y);
    return { p0: { x: ax + sa.x * da, y: ay + sa.y * da }, c: ca, p2: { x: bx + sb.x * db, y: by + sb.y * db } };
  }
  function segDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    var x = a.x + t * dx - p.x, y = a.y + t * dy - p.y;
    return Math.sqrt(x * x + y * y);
  }
  function qp(q, t) {
    var mt = 1 - t;
    return { x: mt * mt * q.p0.x + 2 * mt * t * q.c.x + t * t * q.p2.x, y: mt * mt * q.p0.y + 2 * mt * t * q.c.y + t * t * q.p2.y };
  }
  function qt(q, t) {
    var x = 2 * (1 - t) * (q.c.x - q.p0.x) + 2 * t * (q.p2.x - q.c.x);
    var y = 2 * (1 - t) * (q.c.y - q.p0.y) + 2 * t * (q.p2.y - q.c.y);
    var l = Math.sqrt(x * x + y * y) || 1;
    return { x: x / l, y: y / l };
  }
  function qd(q) { return 'M' + r(q.p0.x) + ' ' + r(q.p0.y) + 'Q' + r(q.c.x) + ' ' + r(q.c.y) + ' ' + r(q.p2.x) + ' ' + r(q.p2.y); }
  function offset(q, o) {
    var n0 = qt(q, 0), n2 = qt(q, 1), nc = qt(q, 0.5);
    return {
      p0: { x: q.p0.x - n0.y * o, y: q.p0.y + n0.x * o },
      c: { x: q.c.x - nc.y * o, y: q.c.y + nc.x * o },
      p2: { x: q.p2.x - n2.y * o, y: q.p2.y + n2.x * o }
    };
  }
  function zig(q, amp, t0, t1) {
    t0 = t0 || 0; t1 = t1 == null ? 1 : t1;
    var span = Math.sqrt(Math.pow(q.p2.x - q.p0.x, 2) + Math.pow(q.p2.y - q.p0.y, 2)) * (t1 - t0);
    var n = Math.max(6, Math.round(span / 7)), p = qp(q, t0), d = 'M' + r(p.x) + ' ' + r(p.y);
    for (var i = 1; i < n; i++) {
      var t = t0 + (t1 - t0) * i / n, pt = qp(q, t), tg = qt(q, t), s = (i % 2 ? 1 : -1) * amp;
      d += 'L' + r(pt.x - tg.y * s) + ' ' + r(pt.y + tg.x * s);
    }
    p = qp(q, t1);
    return d + 'L' + r(p.x) + ' ' + r(p.y);
  }
  // 끝이 둥글지 않은 선 (자른 끝, 뾰족한 꺾임)
  var SHARP = { 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': 6 };
  var AL = 18, AW = 9; // 화살표 길이·반폭

  // 화살표 끝부분만큼 곡선을 줄인다 (선이 화살촉 밖으로 삐져나오지 않게)
  function trimEnd(q, len, atStart) {
    var t = qt(q, atStart ? 0 : 1);
    var nq = { p0: q.p0, c: q.c, p2: q.p2 };
    if (atStart) nq.p0 = { x: q.p0.x + t.x * len, y: q.p0.y + t.y * len };
    else nq.p2 = { x: q.p2.x - t.x * len, y: q.p2.y - t.y * len };
    return nq;
  }
  function arrowHead(q, c, atStart) {
    var tip = atStart ? q.p0 : q.p2, t = qt(q, atStart ? 0 : 1);
    if (atStart) t = { x: -t.x, y: -t.y };
    var bx = tip.x - t.x * AL, by = tip.y - t.y * AL;
    return '<path d="M' + r(tip.x) + ' ' + r(tip.y) + 'L' + r(bx - t.y * AW) + ' ' + r(by + t.x * AW) + 'L' + r(bx + t.y * AW) + ' ' + r(by - t.x * AW) + 'Z" fill="' + c + '"/>';
  }
  function midLabel(q, s, c) {
    var p = qp(q, 0.5);
    return text(p.x, p.y - 9, s, halo({ 'font-size': 11, 'font-weight': 600, fill: c }));
  }
  function relColor(rel, color) {
    if (rel.type === 'abuse') return color('abuse:' + (F.ABUSE_GROUP[rel.sub] || 'violence'));
    return color(rel.type);
  }

  // 보내 주신 관계선 범례 기준
  function relationSvg(rel, q, color) {
    var t = rel.type, c = relColor(rel, color), out = [];
    var dir = F.REL[t] && F.REL[t].dir;
    var body = q;
    if (dir) { body = trimEnd(body, AL - 1, false); if (rel.mutual) body = trimEnd(body, AL - 1, true); }
    var d = qd(body);
    function st(o) { return Object.assign({ stroke: c, 'stroke-width': 2 }, SHARP, o || {}); }
    function lines(offsets, o) { offsets.forEach(function (k) { out.push(path(qd(offset(body, k)), st(o))); }); }

    if (t === 'close' || t === 'oneSided') lines([-3, 3]);
    else if (t === 'fused') lines([-5, 0, 5]);
    else if (t === 'conflict') out.push(path(zig(body, 6), st({ 'stroke-width': 2.2 })));
    else if (t === 'hostile') out.push(path(zig(body, 7), st({ 'stroke-width': 4.2 })));
    else if (t === 'distant') out.push(path(d, st({ 'stroke-dasharray': '7 6' })));
    else if (t === 'cutoff') {
      out.push(path(d, st({ 'stroke-dasharray': '7 6' })));
      var tg = qt(body, 0.5);
      [0.46, 0.54].forEach(function (tt) {
        var m = qp(body, tt);
        out.push('<circle cx="' + r(m.x) + '" cy="' + r(m.y) + '" r="4" fill="' + PAPER + '"/>');
        out.push(line(m.x - tg.y * 10, m.y + tg.x * 10, m.x + tg.y * 10, m.y - tg.x * 10, st({ 'stroke-width': 2.6 })));
      });
    } else if (t === 'closeConflict') {
      lines([-3, 3]);
      out.push(path(zig(body, 7, 0.25, 0.75), st({ stroke: color('conflict'), 'stroke-width': 1.8 })));
    } else if (t === 'fusedConflict') {
      lines([-5, 0, 5]);
      out.push(path(zig(body, 9, 0.25, 0.75), st({ stroke: color('conflictDark'), 'stroke-width': 1.8 })));
    } else if (t === 'abuse') {
      var grp = F.ABUSE_GROUP[rel.sub] || 'violence';
      out.push(path(zig(body, 6), st({ 'stroke-width': 2.4, 'stroke-dasharray': grp === 'emotion' ? '3 3' : null })));
    } else if (t === 'control' || t === 'focus' || t === 'care') out.push(path(d, st({ 'stroke-width': 2.6 })));

    if (dir) {
      out.push(arrowHead(q, c, false));
      if (rel.mutual) out.push(arrowHead(q, c, true));
      var lab = t === 'abuse' ? (F.ABUSE_SUB[rel.sub] || '') : t === 'control' ? '통제' : t === 'focus' ? '초점' : t === 'care' ? '돌봄' : '애착';
      if (lab) out.push(midLabel(q, lab, c));
    }
    if (rel.note) { var np = qp(q, 0.5); out.push(text(np.x, np.y + 16, rel.note, halo({ 'font-size': 12, 'font-weight': 500, fill: MUTED }))); }
    if (rel.tentative) {
      var tp = qp(q, 0.5);
      out.push('<circle cx="' + r(tp.x) + '" cy="' + r(tp.y) + '" r="8" fill="' + PAPER + '" stroke="' + c + '" stroke-width="1.4"/>');
      out.push(text(tp.x, tp.y + 4, '?', { 'font-size': 11, 'font-weight': 700, fill: c }));
    }
    return out.join('');
  }

  // ── 여러 네모를 합친 테두리 (모서리 둥글게) ───────────────
  function outline(rects, radius) {
    var xs = [], ys = [];
    rects.forEach(function (q) { xs.push(q.x0, q.x1); ys.push(q.y0, q.y1); });
    xs = xs.filter(function (v, i) { return xs.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    ys = ys.filter(function (v, i) { return ys.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var W = xs.length - 1, Hh = ys.length - 1, filled = [];
    for (var j = 0; j < Hh; j++) {
      filled.push([]);
      for (var i = 0; i < W; i++) {
        var cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
        filled[j].push(rects.some(function (q) { return cx > q.x0 && cx < q.x1 && cy > q.y0 && cy < q.y1; }));
      }
    }
    function f(i, j) { return i >= 0 && j >= 0 && i < W && j < Hh && filled[j][i]; }
    // 시계 방향 테두리 조각
    var edges = {};
    function add(x1, y1, x2, y2) { (edges[x1 + ',' + y1] = edges[x1 + ',' + y1] || []).push([x2, y2]); }
    for (j = 0; j < Hh; j++) for (i = 0; i < W; i++) {
      if (!filled[j][i]) continue;
      if (!f(i, j - 1)) add(xs[i], ys[j], xs[i + 1], ys[j]);
      if (!f(i + 1, j)) add(xs[i + 1], ys[j], xs[i + 1], ys[j + 1]);
      if (!f(i, j + 1)) add(xs[i + 1], ys[j + 1], xs[i], ys[j + 1]);
      if (!f(i - 1, j)) add(xs[i], ys[j + 1], xs[i], ys[j]);
    }
    var d = '';
    var keys = Object.keys(edges);
    while (keys.length) {
      var start = keys[0], pts = [], cur = start;
      var sp = start.split(',').map(Number);
      pts.push(sp);
      while (true) {
        var list = edges[cur];
        if (!list || !list.length) break;
        var nx = list.shift();
        if (!list.length) delete edges[cur];
        cur = nx[0] + ',' + nx[1];
        if (cur === start) break;
        pts.push(nx);
      }
      keys = Object.keys(edges);
      // 같은 방향으로 이어지는 점 줄이기
      var simple = pts.filter(function (p, k) {
        var a = pts[(k - 1 + pts.length) % pts.length], b = pts[(k + 1) % pts.length];
        return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
      });
      if (simple.length < 3) continue;
      simple.forEach(function (p, k) {
        var a = simple[(k - 1 + simple.length) % simple.length], b = simple[(k + 1) % simple.length];
        var la = Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]), lb = Math.abs(b[0] - p[0]) + Math.abs(b[1] - p[1]);
        var rr = Math.min(radius, la / 2, lb / 2);
        var ax = p[0] + Math.sign(a[0] - p[0]) * rr, ay = p[1] + Math.sign(a[1] - p[1]) * rr;
        var bx = p[0] + Math.sign(b[0] - p[0]) * rr, by = p[1] + Math.sign(b[1] - p[1]) * rr;
        d += (k === 0 ? 'M' : 'L') + r(ax) + ' ' + r(ay) + 'Q' + r(p[0]) + ' ' + r(p[1]) + ' ' + r(bx) + ' ' + r(by);
      });
      d += 'Z';
    }
    return d;
  }

  // ── 범례 ────────────────────────────────────────────────
  function legendSvg(m, used, x0, y0, maxW, color) {
    var items = [];
    var cl = F.clientOf(m);
    items.push(['client', (cl && cl.label) || '내담자']);
    ['M', 'F', 'U'].forEach(function (g) { if (used.gender[g]) items.push(['g', g]); });
    if (used.dead) items.push(['dead']);
    Object.keys(used.kind).forEach(function (k) { items.push(['kind', k]); });
    ['married', 'cohabit', 'separated', 'divorced'].forEach(function (s) { if (used.union[s]) items.push(['union', s]); });
    ['adopted', 'foster', 'unknown'].forEach(function (t) { if (used.link[t]) items.push(['link', t]); });
    if (used.twin) items.push(['twin']);
    if (used.house) items.push(['house']);
    ['close', 'oneSided', 'fused', 'distant', 'cutoff', 'conflict', 'hostile', 'closeConflict', 'fusedConflict',
      'abuse:violence', 'abuse:body', 'abuse:emotion', 'care', 'control', 'focus'].forEach(function (t) { if (used.rel[t]) items.push(['rel', t]); });
    if (used.tentative) items.push(['tentative']);
    if (used.implied) items.push(['implied']);

    var out = [], colW = 156, rowH = 34, per = Math.max(1, Math.floor(maxW / colW));
    out.push(line(x0, y0 - 22, x0 + Math.min(maxW, per * colW) - 20, y0 - 22, { stroke: '#E4E0DB', 'stroke-width': 1 }));
    items.forEach(function (it, i) {
      var cx = x0 + (i % per) * colW, cy = y0 + Math.floor(i / per) * rowH, g = '', label = '', s = 9;
      var k = it[0];
      if (k === 'client') {
        g = '<rect x="' + cx + '" y="' + (cy - s) + '" width="18" height="18" fill="none" stroke="' + INK + '" stroke-width="1.6"/><rect x="' + (cx - 3) + '" y="' + (cy - s - 3) + '" width="24" height="24" fill="none" stroke="' + INK + '" stroke-width="1"/>';
        label = it[1] || '내담자';
      } else if (k === 'g') { g = shape('person', it[1], cx + s, cy, 18, { 'stroke-width': 1.6 }); label = { M: '남성', F: '여성', U: '성별 모름' }[it[1]]; }
      else if (k === 'dead') { g = shape('person', 'M', cx + s, cy, 18, { 'stroke-width': 1.6 }) + path('M' + (cx - 2) + ' ' + (cy - 11) + 'L' + (cx + 20) + ' ' + (cy + 11) + 'M' + (cx + 20) + ' ' + (cy - 11) + 'L' + (cx - 2) + ' ' + (cy + 11), { 'stroke-width': 1.6 }); label = '사망'; }
      else if (k === 'kind') {
        g = shape(it[1], 'U', cx + s, cy, it[1] === 'pet' ? 18 : 20, { 'stroke-width': 1.6, fill: it[1] === 'pet' ? '#F3F0EA' : PAPER });
        if (it[1] !== 'pregnancy' && it[1] !== 'pet') g += path('M' + (cx + 1) + ' ' + (cy - 8) + 'L' + (cx + 17) + ' ' + (cy + 8) + 'M' + (cx + 17) + ' ' + (cy - 8) + 'L' + (cx + 1) + ' ' + (cy + 8), { 'stroke-width': 1.4 });
        label = F.KIND[it[1]];
      } else if (k === 'union') {
        g = line(cx, cy, cx + 32, cy, it[1] === 'cohabit' ? { 'stroke-dasharray': '9 4 2 4', stroke: color('cohabit') } : {});
        var n = it[1] === 'divorced' ? 2 : it[1] === 'separated' ? 1 : 0;
        for (var j = 0; j < n; j++) { var ox = cx + 10 + j * 7 + (n === 1 ? 4 : 0); g += line(ox - 4, cy + 7, ox + 4, cy - 7); }
        label = F.UNION[it[1]];
      } else if (k === 'link') {
        g = line(cx + 14, cy - 11, cx + 14, cy + 11, { 'stroke-dasharray': it[1] === 'adopted' ? '6 4' : '2 4' });
        if (it[1] === 'unknown') g += text(cx + 24, cy + 4, '?', { 'font-size': 12, 'font-weight': 700 });
        label = F.LINK[it[1]];
      } else if (k === 'twin') { g = line(cx + 14, cy - 11, cx + 4, cy + 11) + line(cx + 14, cy - 11, cx + 24, cy + 11); label = '쌍둥이'; }
      else if (k === 'house') { g = '<rect x="' + cx + '" y="' + (cy - 10) + '" width="30" height="20" rx="7" fill="none" stroke="' + HOUSE + '" stroke-width="1.6" stroke-dasharray="4 3"/>'; label = '함께 사는 가족'; }
      else if (k === 'rel') {
        var parts = it[1].split(':'), sub = parts[1] ? { violence: 'violence', body: 'physical', emotion: 'emotional' }[parts[1]] : null;
        g = relationSvg({ type: parts[0], sub: sub }, { p0: { x: cx - 4, y: cy }, c: { x: cx + 18, y: cy }, p2: { x: cx + 40, y: cy } }, color).replace(/<text[^>]*>[^<]*<\/text>/g, '');
        label = parts[1] ? F.ABUSE_GROUP_LABEL[parts[1]] : F.REL[parts[0]].label;
      } else if (k === 'tentative') {
        g = '<circle cx="' + (cx + 14) + '" cy="' + cy + '" r="8" fill="' + PAPER + '" stroke="' + MUTED + '" stroke-width="1.4"/>' + text(cx + 14, cy + 4, '?', { 'font-size': 11, 'font-weight': 700, fill: MUTED });
        label = '확인 필요';
      } else if (k === 'implied') {
        g = shape('person', 'M', cx + s, cy, 18, { stroke: FAINT, 'stroke-dasharray': '3 2', 'stroke-width': 1.6 });
        label = '확인 안 된 자리';
      }
      out.push(g);
      out.push(text(cx + 48, cy + 5, label, { 'text-anchor': 'start' }));
    });
    return { svg: out.join(''), height: Math.ceil(items.length / per) * rowH + 10 };
  }

  // ── 전체 그리기 ─────────────────────────────────────────
  function render(m, opts) {
    opts = opts || {};
    var lay = L.layout(m);
    if (!lay) return null;
    var pos = lay.pos, out = [], hits = [], ulabels = [];
    var mono = !!opts.mono;
    var color = function (t) { return mono ? INK : (REL_COLOR[t] || INK); };
    var used = { gender: {}, kind: {}, union: {}, link: {}, rel: {}, dead: false, twin: false, house: false, tentative: false };
    var sel = opts.selected || {};

    m.persons.forEach(function (p) {
      if (p.kind === 'person') used.gender[p.gender] = 1;
      else used.kind[p.kind] = 1;
      if (p.deceased) used.dead = true;
      if (p.implied && !p.client) used.implied = true;
    });

    // 함께 사는 가족 경계 (맨 아래 층)
    var house = m.household.filter(function (id) { return pos[id]; });
    if (house.length) {
      used.house = true;
      var segs = [];
      lay.rows.forEach(function (row, g) {
        var seq = [];
        row.forEach(function (b) { b.ids.forEach(function (id) { seq.push(id); }); });
        seq.sort(function (a, b) { return pos[a].x - pos[b].x; });
        var cur = null;
        seq.forEach(function (id) {
          if (house.indexOf(id) >= 0) { if (!cur) { cur = []; segs.push(cur); } cur.push(id); }
          else cur = null;
        });
      });
      // 함께 사는 사람만 감싸는 칸 + 세대 사이를 잇는 좁은 통로 → 하나로 합친 테두리
      var boxes = segs.map(function (seg) {
        var xs = seg.map(function (id) { return pos[id].x; }), y = pos[seg[0]].y;
        return { x0: Math.min.apply(null, xs) - 48, x1: Math.max.apply(null, xs) + 48, y0: y - H - 14, y1: y + H + 44 };
      });
      var rects = boxes.slice();
      boxes.forEach(function (lo) {
        var ups = boxes.filter(function (u) { return u.y1 < lo.y0 && lo.y0 - u.y1 < lay.ROW; });
        if (!ups.length) return;
        ups.sort(function (p, q) {
          var op = Math.min(p.x1, lo.x1) - Math.max(p.x0, lo.x0), oq = Math.min(q.x1, lo.x1) - Math.max(q.x0, lo.x0);
          return oq - op;
        });
        var up = ups[0], ov0 = Math.max(up.x0, lo.x0), ov1 = Math.min(up.x1, lo.x1), w = 14;
        if (ov1 - ov0 >= 2 * w + 8) {
          var cx = (ov0 + ov1) / 2;
          rects.push({ x0: cx - w, x1: cx + w, y0: up.y1 - 1, y1: lo.y0 + 1 });
        } else {
          var midY = (up.y1 + lo.y0) / 2;
          var ux = lo.x0 > up.x1 ? up.x1 - w - 8 : up.x0 + w + 8;
          var lx = lo.x0 > up.x1 ? lo.x0 + w + 8 : lo.x1 - w - 8;
          rects.push({ x0: ux - w, x1: ux + w, y0: up.y1 - 1, y1: midY + w });
          rects.push({ x0: Math.min(ux, lx) - w, x1: Math.max(ux, lx) + w, y0: midY - w, y1: midY + w });
          rects.push({ x0: lx - w, x1: lx + w, y0: midY - w, y1: lo.y0 + 1 });
        }
      });
      var hs = { fill: HOUSE, 'fill-opacity': mono ? 0 : 0.05, stroke: mono ? INK : HOUSE, 'stroke-width': 1.6, 'stroke-dasharray': '5 4', 'stroke-linejoin': 'round' };
      out.push(path(outline(rects, 12), hs));
    }

    // 결합(부부)선
    var umid = {};
    m.unions.forEach(function (u) {
      var A = u.a && pos[u.a], B = u.b && pos[u.b];
      if (A && B) {
        used.union[u.status] = 1;
        var left = A.x <= B.x ? A : B, right = A.x <= B.x ? B : A;
        var between = m.persons.some(function (p) { var q = pos[p.id]; return q && q.y === left.y && q.x > left.x + 5 && q.x < right.x - 5; });
        var by = left.y + H + 62 + (between ? 14 : 0);
        var dash = u.status === 'cohabit' ? '9 4 2 4' : null;
        var isSel = sel.type === 'union' && sel.id === u.id;
        var st = { 'stroke-dasharray': dash, stroke: isSel ? SEL : u.status === 'cohabit' ? color('cohabit') : INK, 'stroke-width': isSel ? 3 : 2, 'stroke-linejoin': 'miter' };
        out.push(path('M' + r(left.x) + ' ' + r(left.y + H + 2) + 'V' + r(by) + 'H' + r(right.x) + 'V' + r(right.y + H + 2), st));
        var mx = (left.x + right.x) / 2;
        if (u.status === 'divorced' || u.status === 'separated') {
          var n = u.status === 'divorced' ? 2 : 1;
          for (var k = 0; k < n; k++) { var ox = mx - 10 + k * 9 + (n === 1 ? 4 : 0) + 18; out.push(line(ox - 5, by + 9, ox + 5, by - 9)); }
        }
        var lab = [];
        if (u.start) lab.push((u.status === 'cohabit' ? '동거 ' : '결혼 ') + u.start + (u.status === 'cohabit' && !u.end ? '~' : ''));
        if (u.end) lab.push((u.status === 'divorced' ? '이혼 ' : u.status === 'separated' ? '별거 ' : '') + u.end);
        if (lab.length) {
          // 부부선 가운데 위에. 선보다 길면 두 줄로 나눠 옆 부부의 글자와 겹치지 않게
          var one = lab.join(' · '), room = right.x - left.x - 24;
          var lines = lab.length === 2 && one.length * 7.6 > room ? lab : [one];
          var lx = mx - (u.status === 'divorced' || u.status === 'separated' ? 10 : 0);
          lines.forEach(function (s, li) {
            ulabels.push(text(lx, by - 12 - (lines.length - 1 - li) * 16, s, halo({ 'font-size': 12.5, 'font-weight': 500, fill: MUTED })));
          });
        }
        hits.push('<g data-kind="union" data-id="' + u.id + '"><path d="M' + r(left.x) + ' ' + r(by) + 'H' + r(right.x) + '" stroke="transparent" stroke-width="16" fill="none"/></g>');
        umid[u.id] = { x: mx, y: by };
      } else if (A || B) {
        var P = A || B;
        umid[u.id] = { x: P.x, y: P.y + H + 6, single: true };
      }
    });

    // 부모 → 자녀선
    m.unions.forEach(function (u) {
      var kids = m.links.filter(function (l) { return l.union === u.id && pos[l.child]; });
      if (!kids.length) return;
      var kidPos = kids.map(function (l) { return pos[l.child]; });
      var cy = Math.min.apply(null, kidPos.map(function (q) { return q.y; }));
      var barY = cy - H - 28;
      var from = umid[u.id];
      var xs = kidPos.map(function (q) { return q.x; });
      // 쌍둥이는 한 점에서 갈라진다
      var groups = [], twinSeen = {};
      kids.forEach(function (l) {
        if (l.twin) {
          if (twinSeen[l.twin]) { twinSeen[l.twin].push(l); return; }
          twinSeen[l.twin] = [l];
          groups.push(twinSeen[l.twin]);
        } else groups.push([l]);
      });
      var dropXs = groups.map(function (g) { return g.reduce(function (s, l) { return s + pos[l.child].x; }, 0) / g.length; });
      var minX = Math.min.apply(null, dropXs.concat(from ? [from.x] : [])), maxX = Math.max.apply(null, dropXs.concat(from ? [from.x] : []));
      if (from) out.push(line(from.x, from.y, from.x, barY));
      else out.push(line((minX + maxX) / 2, barY - 16, (minX + maxX) / 2, barY, { 'stroke-dasharray': '3 4' }));
      if (maxX > minX) out.push(line(minX, barY, maxX, barY));
      groups.forEach(function (g, gi) {
        if (g.length > 1) {
          used.twin = true;
          var tx = dropXs[gi], ty = barY + 20;
          out.push(line(tx, barY, tx, barY + 4));
          var ends = g.map(function (l) { var q = pos[l.child]; return { x: q.x, y: q.y - symbolSize(F.person(m, l.child)) / 2 - (F.person(m, l.child).client ? 5 : 0) }; });
          ends.forEach(function (e, ei) {
            out.push(line(tx, barY + 4, e.x, e.y, linkStyle(g[ei])));
            hits.push(linkHit(g[ei], tx, barY + 4, e.x, e.y));
          });
          if (g.some(function (l) { return l.identical; })) {
            var t = 0.45, a = ends[0], b = ends[ends.length - 1];
            out.push(line(tx + (a.x - tx) * t, barY + 4 + (a.y - barY - 4) * t, tx + (b.x - tx) * t, barY + 4 + (b.y - barY - 4) * t));
          }
          void ty;
        } else {
          var l = g[0], q = pos[l.child], cp = F.person(m, l.child);
          var top = q.y - symbolSize(cp) / 2 - (cp.client ? 5 : 0) - (cp.gender === 'U' && cp.kind === 'person' ? 3 : 0);
          out.push(line(q.x, barY, q.x, top, linkStyle(l)));
          if (l.type === 'unknown') out.push(text(q.x + 10, (barY + top) / 2 + 4, '?', { 'font-size': 13, 'font-weight': 700, 'text-anchor': 'start' }));
          hits.push(linkHit(l, q.x, barY, q.x, top));
        }
        g.forEach(function (l) { used.link[l.type] = 1; });
      });
    });
    function linkStyle(l) {
      var isSel = sel.type === 'link' && sel.id === l.id;
      var o = { stroke: isSel ? SEL : INK, 'stroke-width': isSel ? 3 : 2 };
      if (l.type === 'adopted') o['stroke-dasharray'] = '6 4';
      if (l.type === 'foster' || l.type === 'unknown') o['stroke-dasharray'] = '2 4';
      return o;
    }
    function linkHit(l, x1, y1, x2, y2) {
      return '<g data-kind="link" data-id="' + l.id + '"><path d="M' + r(x1) + ' ' + r(y1) + 'L' + r(x2) + ' ' + r(y2) + '" stroke="transparent" stroke-width="14" fill="none"/></g>';
    }

    // 반려동물 연결
    m.persons.forEach(function (p) {
      if (p.kind !== 'pet' || !p.owner || !pos[p.owner]) return;
      var a = pos[p.owner], b = pos[p.id];
      out.push(line(a.x + (b.x > a.x ? H : -H), a.y, b.x - (b.x > a.x ? 16 : -16), b.y, { 'stroke-width': 1.2, stroke: MUTED, 'stroke-dasharray': '2 3' }));
    });

    // 정서적 관계선
    var pairCount = {}, rels = [];
    var pairTotal = {};
    m.relations.forEach(function (rl) { var k = [rl.a, rl.b].sort().join('|'); pairTotal[k] = (pairTotal[k] || 0) + 1; });
    m.relations.forEach(function (rl) {
      var a = pos[rl.a], b = pos[rl.b];
      if (!a || !b) return;
      used.rel[rl.type === 'abuse' ? 'abuse:' + (F.ABUSE_GROUP[rl.sub] || 'violence') : rl.type] = 1;
      if (rl.tentative) used.tentative = true;
      var key = [rl.a, rl.b].sort().join('|');
      var n = pairCount[key] = (pairCount[key] || 0) + 1;
      // 같은 두 사람 사이 선이 여럿이면 나란히 띄운다
      var off = (n - (pairTotal[key] + 1) / 2) * 26;
      if ([rl.a, rl.b].sort()[0] !== rl.a) off = -off; // 방향이 반대인 선도 같은 기준으로 나란히
      // 곧은 선이 다른 사람 기호를 지나가면 그때만 살짝 휜다
      var bend = 0;
      m.persons.forEach(function (o) {
        if (bend || o.id === rl.a || o.id === rl.b || !pos[o.id]) return;
        if (segDist(pos[o.id], a, b) < symbolSize(o) / 2 + 8) bend = (a.y === b.y ? -1 : 1) * Math.min(56, 26 + Math.abs(b.x - a.x) * 0.08);
      });
      var q = straight(a, b, F.person(m, rl.a), F.person(m, rl.b), bend, off);
      var isSel = sel.type === 'rel' && sel.id === rl.id;
      var svg = relationSvg(rl, q, color);
      rels.push('<g data-kind="rel" data-id="' + rl.id + '"' + (rl.tentative ? ' opacity="0.55"' : '') + '>' +
        (isSel ? path(qd(q), { stroke: SEL, 'stroke-width': 14, 'stroke-opacity': 0.3 }) : '') +
        svg + path(qd(q), { stroke: 'transparent', 'stroke-width': 16 }) + '</g>');
    });

    var syms = m.persons.map(function (p) { return personSvg(p, pos[p.id], opts); });

    // 경계
    var xs = [], ys = [];
    Object.keys(pos).forEach(function (id) { xs.push(pos[id].x); ys.push(pos[id].y); });
    var minX = Math.min.apply(null, xs) - S - 40, maxX = Math.max.apply(null, xs) + S + 40;
    var minY = Math.min.apply(null, ys) - S - 34, maxY = Math.max.apply(null, ys) + S + 56;
    var genLabels = '';
    if (opts.generations) {
      minX -= 44;
      for (var g = 0; g <= lay.maxGen; g++) genLabels += text(minX + 20, g * lay.ROW + 5, (g + 1) + '세대', { 'font-size': 12, 'font-weight': 600, fill: MUTED, 'text-anchor': 'start' });
    }
    var w = Math.max(maxX - minX, 320);
    if (w > maxX - minX) { var add = (w - (maxX - minX)) / 2; minX -= add; maxX += add; }
    var leg = opts.legend === false ? { svg: '', height: 0 } : legendSvg(m, used, minX + 24, maxY + 30, w - 24, color);
    var title = opts.title ? text(minX + 24, minY + 8, opts.title, { 'font-size': 15, 'font-weight': 600, 'text-anchor': 'start' }) : '';
    if (title) minY -= 26;
    var h = maxY - minY + leg.height + (leg.height ? 30 : 0);

    return {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r(minX) + ' ' + r(minY) + ' ' + r(w) + ' ' + r(h) + '" width="' + r(w) + '" height="' + r(h) + '" role="img" aria-label="가계도">' +
        '<rect x="' + r(minX) + '" y="' + r(minY) + '" width="' + r(w) + '" height="' + r(h) + '" fill="' + PAPER + '"/>' +
        title + genLabels + out.join('') + hits.join('') + rels.join('') + ulabels.join('') + syms.join('') + leg.svg + '</svg>',
      width: w, height: h, layout: lay
    };
  }

  global.GenogramRender = { render: render, REL_COLOR: REL_COLOR };
})(typeof window !== 'undefined' ? window : globalThis);
