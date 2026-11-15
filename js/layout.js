/*
 * 가계도 자리 잡기
 * 1) 세대 정하기  2) 부부를 한 덩어리(블록)로 묶기  3) 위아래 세대를 보며 순서 정하기
 * 4) 부모는 자녀 위 가운데, 자녀는 부모 아래로 오도록 여러 번 맞추기
 */
(function (global) {
  'use strict';

  var F = global.FamilyModel;
  var GAP = 104;   // 같은 블록 안 사람 간격
  var BGAP = 120;  // 블록 사이 간격
  var ROW = 172;   // 세대 간격

  function layout(m) {
    var persons = m.persons;
    if (!persons.length) return null;
    var byId = {}, index = {};
    persons.forEach(function (p, i) { byId[p.id] = p; index[p.id] = i; });

    var linkByChild = {}, kidsByUnion = {}, unionsByPerson = {};
    m.links.forEach(function (l) { linkByChild[l.child] = l; (kidsByUnion[l.union] = kidsByUnion[l.union] || []).push(l.child); });
    m.unions.forEach(function (u) {
      [u.a, u.b].forEach(function (id) { if (id) (unionsByPerson[id] = unionsByPerson[id] || []).push(u); });
    });
    var unionById = {};
    m.unions.forEach(function (u) { unionById[u.id] = u; });

    // ── 1. 세대
    var gen = {}, ugen = {};
    function bfs(start, g0) {
      var q = [['p', start, g0]];
      gen[start] = g0;
      while (q.length) {
        var it = q.shift(), t = it[0], id = it[1], g = it[2];
        if (t === 'p') {
          (unionsByPerson[id] || []).forEach(function (u) { if (ugen[u.id] == null) { ugen[u.id] = g; q.push(['u', u.id, g]); } });
          var l = linkByChild[id];
          if (l && ugen[l.union] == null) { ugen[l.union] = g - 1; q.push(['u', l.union, g - 1]); }
        } else {
          var u = unionById[id];
          [u.a, u.b].forEach(function (pid) { if (pid && gen[pid] == null) { gen[pid] = g; q.push(['p', pid, g]); } });
          (kidsByUnion[id] || []).forEach(function (c) { if (gen[c] == null) { gen[c] = g + 1; q.push(['p', c, g + 1]); } });
        }
      }
    }
    var client = F.clientOf(m);
    var people = persons.filter(function (p) { return p.kind !== 'pet'; });
    if (people.length) bfs((client && client.kind !== 'pet' ? client : people[0]).id, 0);
    people.forEach(function (p) { if (gen[p.id] == null) bfs(p.id, 0); });
    persons.forEach(function (p) { if (p.kind === 'pet') gen[p.id] = p.owner && gen[p.owner] != null ? gen[p.owner] : 0; });
    var minG = Infinity, maxG = -Infinity;
    persons.forEach(function (p) { minG = Math.min(minG, gen[p.id]); maxG = Math.max(maxG, gen[p.id]); });
    persons.forEach(function (p) { gen[p.id] -= minG; });
    maxG -= minG;

    // ── 2. 부부 덩어리
    function partnerUnions(id) {
      return (unionsByPerson[id] || []).filter(function (u) { return u.a && u.b && gen[u.a] === gen[u.b]; });
    }
    function partnerOf(u, id) { return u.a === id ? u.b : u.a; }
    var blockOf = {}, blocks = [];
    persons.forEach(function (p) {
      if (blockOf[p.id] || p.kind === 'pet') return;
      // 연결된 부부 묶음 찾기
      var comp = [], stack = [p.id], seen = {};
      seen[p.id] = 1;
      while (stack.length) {
        var id = stack.pop();
        comp.push(id);
        partnerUnions(id).forEach(function (u) { var q = partnerOf(u, id); if (!seen[q]) { seen[q] = 1; stack.push(q); } });
      }
      var ids = chain(comp);
      var b = { ids: ids, g: gen[p.id] };
      ids.forEach(function (id) { blockOf[id] = b; });
      blocks.push(b);
    });
    // 반려동물은 주인 블록 끝에
    persons.forEach(function (p) {
      if (p.kind !== 'pet') return;
      var ob = p.owner && blockOf[p.owner];
      if (ob) { ob.ids.push(p.id); blockOf[p.id] = ob; }
      else { var b = { ids: [p.id], g: gen[p.id] }; blockOf[p.id] = b; blocks.push(b); }
    });

    function chain(comp) {
      if (comp.length === 1) return comp.slice();
      comp.sort(function (a, b) {
        var d = partnerUnions(b).length - partnerUnions(a).length;
        if (d) return d;
        if (byId[a].client !== byId[b].client) return byId[a].client ? -1 : 1;
        if (byId[a].gender !== byId[b].gender) return byId[a].gender === 'M' ? -1 : 1;
        return index[a] - index[b];
      });
      var root = comp[0], left = [], right = [], placed = {};
      placed[root] = 1;
      (function extend(pid, side) {
        var us = partnerUnions(pid).filter(function (u) { return !placed[partnerOf(u, pid)]; })
          .sort(function (a, b) { return a.seq - b.seq; });
        us.forEach(function (u, i) {
          var q = partnerOf(u, pid), s = side;
          if (!s) {
            // 남편 왼쪽·아내 오른쪽. 결합이 여럿이면 첫 결합 반대편에 다음 결합
            var me = byId[pid], other = byId[q];
            if (us.length === 1) s = me.gender === 'M' ? 'R' : other.gender === 'M' ? 'L' : 'R';
            else {
              var firstSide = me.gender === 'M' ? 'R' : 'L';
              s = i % 2 === 0 ? firstSide : (firstSide === 'R' ? 'L' : 'R');
            }
          }
          placed[q] = 1;
          (s === 'L' ? left : right).push(q);
          extend(q, s);
        });
      })(root, null);
      return left.reverse().concat([root], right);
    }

    // ── 3. 순서
    var rows = [];
    for (var g = 0; g <= maxG; g++) rows.push([]);
    blocks.forEach(function (b) { rows[b.g].push(b); });
    rows.forEach(function (row) { row.sort(function (a, b) { return minIndex(a) - minIndex(b); }); });
    function minIndex(b) { return Math.min.apply(null, b.ids.map(function (id) { return index[id]; })); }

    var x = {};
    function placeSeq(row) {
      var cx = 0;
      row.forEach(function (b) {
        b.ids.forEach(function (id, i) { x[id] = cx + i * GAP; });
        cx += (b.ids.length - 1) * GAP + BGAP;
      });
    }
    rows.forEach(placeSeq);

    function birthCmp(a, b) {
      var pa = byId[a], pb = byId[b];
      if (pa.age != null && pb.age != null && pa.age !== pb.age) return pb.age - pa.age;
      if (pa.birthYear && pb.birthYear && pa.birthYear !== pb.birthYear) return pa.birthYear - pb.birthYear;
      var oa = pa.order === 'older' ? -1 : pa.order === 'younger' ? 1 : 0;
      var ob = pb.order === 'older' ? -1 : pb.order === 'younger' ? 1 : 0;
      if (oa !== ob) return oa - ob;
      return index[a] - index[b];
    }
    function rankOf(id) {
      var l = linkByChild[id];
      if (!l) return 0;
      var sib = (kidsByUnion[l.union] || []).slice().sort(birthCmp);
      return sib.indexOf(id);
    }
    function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
    function center(b) { return (x[b.ids[0]] + x[b.ids[b.ids.length - 1]]) / 2; }
    function unionMid(u) {
      var xs = [u.a, u.b].filter(function (id) { return id && x[id] != null; }).map(function (id) { return x[id]; });
      if (xs.length) return mean(xs);
      var kids = kidsByUnion[u.id] || [];
      return kids.length ? mean(kids.map(function (k) { return x[k]; })) : null;
    }
    function parentMid(id) {
      var l = linkByChild[id];
      return l ? unionMid(unionById[l.union]) : null;
    }
    function childCenters(id) {
      var out = [];
      (unionsByPerson[id] || []).forEach(function (u) {
        var kids = kidsByUnion[u.id] || [];
        if (kids.length) out.push(mean(kids.map(function (k) { return x[k]; })));
      });
      return out;
    }

    function orderDown(g) {
      var row = rows[g];
      row.forEach(function (b) {
        var vals = b.ids.map(parentMid).filter(function (v) { return v != null; });
        b.key = vals.length ? mean(vals) : center(b);
        var withLink = b.ids.filter(function (id) { return linkByChild[id]; })[0];
        b.rank = withLink ? rankOf(withLink) : 0;
        b.c = center(b);
      });
      row.sort(function (a, b) { return (a.key - b.key) || (a.rank - b.rank) || (a.c - b.c); });
      placeSeq(row);
    }
    function orderUp(g) {
      var row = rows[g];
      row.forEach(function (b) {
        var vals = [];
        b.ids.forEach(function (id) { vals = vals.concat(childCenters(id)); });
        b.key = vals.length ? mean(vals) : center(b);
        b.c = center(b);
      });
      row.sort(function (a, b) { return (a.key - b.key) || (a.c - b.c); });
      placeSeq(row);
    }
    for (var it = 0; it < 4; it++) {
      for (g = 1; g <= maxG; g++) orderDown(g);
      for (g = maxG - 1; g >= 0; g--) orderUp(g);
    }
    for (g = 1; g <= maxG; g++) orderDown(g);

    // ── 4. 자리 맞추기
    function width(b) { return (b.ids.length - 1) * GAP; }
    function resolve(row, desired) {
      var n = row.length, s = [], t = [], i;
      for (i = 0; i < n; i++) s[i] = i === 0 ? desired[i] : Math.max(desired[i], s[i - 1] + width(row[i - 1]) + BGAP);
      for (i = n - 1; i >= 0; i--) t[i] = i === n - 1 ? desired[i] : Math.min(desired[i], t[i + 1] - width(row[i]) - BGAP);
      var f = [];
      for (i = 0; i < n; i++) f[i] = (s[i] + t[i]) / 2;
      for (i = 1; i < n; i++) f[i] = Math.max(f[i], f[i - 1] + width(row[i - 1]) + BGAP);
      row.forEach(function (b, k) {
        var start = f[k], old = x[b.ids[0]];
        b.ids.forEach(function (id) { x[id] = x[id] - old + start; });
      });
    }
    function balanceDown(g) {
      var row = rows[g];
      var desired = row.map(function (b) {
        var shifts = [];
        b.ids.forEach(function (id) {
          var l = linkByChild[id];
          if (!l) return;
          var pm = unionMid(unionById[l.union]);
          var u = unionById[l.union];
          if (pm == null || (!u.a && !u.b)) return;
          var kids = kidsByUnion[l.union];
          shifts.push(pm - mean(kids.map(function (k) { return x[k]; })));
        });
        return x[b.ids[0]] + (shifts.length ? mean(shifts) : 0);
      });
      resolve(row, desired);
    }
    function balanceUp(g) {
      var row = rows[g];
      var desired = row.map(function (b) {
        var shifts = [];
        var seenU = {};
        b.ids.forEach(function (id) {
          (unionsByPerson[id] || []).forEach(function (u) {
            if (seenU[u.id]) return;
            seenU[u.id] = 1;
            var kids = kidsByUnion[u.id] || [];
            if (!kids.length) return;
            shifts.push(mean(kids.map(function (k) { return x[k]; })) - unionMid(u));
          });
        });
        return x[b.ids[0]] + (shifts.length ? mean(shifts) : 0);
      });
      resolve(row, desired);
    }
    for (it = 0; it < 6; it++) {
      for (g = maxG - 1; g >= 0; g--) balanceUp(g);
      for (g = 1; g <= maxG; g++) balanceDown(g);
    }

    var pos = {};
    persons.forEach(function (p) { pos[p.id] = { x: x[p.id] + (p.dx || 0), y: gen[p.id] * ROW }; });
    return { pos: pos, gen: gen, rows: rows, maxGen: maxG, ROW: ROW, GAP: GAP };
  }

  global.GenogramLayout = { layout: layout };
})(typeof window !== 'undefined' ? window : globalThis);
