/*
 * 가족 모델: 사람 · 부부(결합) · 부모-자녀 연결 · 정서적 관계 · 함께 사는 가족
 * 브라우저 안에서만 쓰인다.
 */
(function (global) {
  'use strict';

  var REL = {
    close: { label: '친밀' },
    fused: { label: '밀착' },
    conflict: { label: '갈등' },
    hostile: { label: '적대' },
    distant: { label: '소원' },
    cutoff: { label: '단절' },
    closeConflict: { label: '친밀하면서 갈등' },
    fusedConflict: { label: '밀착하면서 갈등' },
    abuse: { label: '폭력·학대', dir: true },
    control: { label: '통제', dir: true },
    focus: { label: '부정적 초점', dir: true },
    care: { label: '돌봄', dir: true },
    oneSided: { label: '일방적 애착', dir: true }
  };
  var ABUSE_SUB = { physical: '신체', sexual: '성', emotional: '정서', neglect: '방임' };
  var UNION = { married: '결혼', cohabit: '동거', separated: '별거', divorced: '이혼' };
  var LINK = { bio: '친자', adopted: '입양', foster: '위탁', unknown: '친자 미상' };
  var KIND = { person: '사람', pregnancy: '임신', miscarriage: '유산', abortion: '임신중절', stillbirth: '사산', pet: '반려동물' };

  function create() {
    return { persons: [], unions: [], links: [], relations: [], household: [], nextId: 1, lines: [], choices: [] };
  }

  function nid(m, p) { return p + (m.nextId++); }

  function person(m, id) {
    for (var i = 0; i < m.persons.length; i++) if (m.persons[i].id === id) return m.persons[i];
    return null;
  }
  function union(m, id) {
    for (var i = 0; i < m.unions.length; i++) if (m.unions[i].id === id) return m.unions[i];
    return null;
  }

  function addPerson(m, props) {
    props = props || {};
    var p = {
      id: nid(m, 'p'),
      key: props.key || null,
      kind: props.kind || 'person',
      gender: props.gender || 'U',
      genderLabel: props.genderLabel || '',
      name: props.name || '',
      label: props.label || '',
      age: props.age == null ? null : props.age,
      birthYear: props.birthYear || null,
      deathYear: props.deathYear || null,
      deceased: !!props.deceased,
      client: !!props.client,
      order: props.order || null,
      owner: props.owner || null,
      note: props.note || '',
      source: props.source || '',
      implied: !!props.implied,
      dx: 0,
      edited: false
    };
    if (p.kind === 'pet' && !props.label) p.label = '반려동물';
    m.persons.push(p);
    return p;
  }

  function clientOf(m) {
    for (var i = 0; i < m.persons.length; i++) if (m.persons[i].client) return m.persons[i];
    return null;
  }

  function unionsOf(m, pid) {
    return m.unions.filter(function (u) { return u.a === pid || u.b === pid; });
  }
  function partnerIn(u, pid) { return u.a === pid ? u.b : u.a; }

  function parentUnionOf(m, pid) {
    for (var i = 0; i < m.links.length; i++) if (m.links[i].child === pid) return union(m, m.links[i].union);
    return null;
  }
  function linkOf(m, pid) {
    for (var i = 0; i < m.links.length; i++) if (m.links[i].child === pid) return m.links[i];
    return null;
  }
  function childrenOf(m, uid) {
    return m.links.filter(function (l) { return l.union === uid; }).map(function (l) { return person(m, l.child); }).filter(Boolean);
  }

  var seq = 0;
  function addUnion(m, a, b, status, extra) {
    extra = extra || {};
    var u = { id: nid(m, 'u'), a: a || null, b: b || null, status: status || 'married', start: extra.start || null, end: extra.end || null, seq: ++seq, edited: false };
    m.unions.push(u);
    return u;
  }

  function addLink(m, uid, child, type) {
    var old = linkOf(m, child);
    if (old) m.links.splice(m.links.indexOf(old), 1);
    var l = { id: nid(m, 'l'), union: uid, child: child, type: type || 'bio', twin: null, identical: false, edited: false };
    m.links.push(l);
    return l;
  }

  // 부모 묶음(결합)을 찾거나 만든다. 부모를 모르면 빈 결합.
  function ensureParentUnion(m, pid) {
    var u = parentUnionOf(m, pid);
    if (u) return u;
    u = addUnion(m, null, null, 'married');
    addLink(m, u.id, pid, 'bio');
    return u;
  }

  // 특정 성별의 부모를 찾거나 만든다
  function parentOf(m, pid, gender, props, create) {
    var u = parentUnionOf(m, pid);
    if (u) {
      var cands = [u.a, u.b].map(function (id) { return id && person(m, id); }).filter(Boolean);
      for (var i = 0; i < cands.length; i++) if (cands[i].gender === gender) return cands[i];
      if (!create) return null;
      if (u.a && u.b) {
        var unk = cands.filter(function (c) { return c.gender === 'U'; })[0];
        if (unk) { unk.gender = gender; return unk; }
        return null;
      }
    } else if (!create) return null;
    u = ensureParentUnion(m, pid);
    var p = addPerson(m, Object.assign({ gender: gender }, props || {}));
    if (!u.a) u.a = p.id; else u.b = p.id;
    return p;
  }

  function parentsOf(m, pid) {
    var u = parentUnionOf(m, pid);
    if (!u) return [];
    return [u.a, u.b].filter(Boolean).map(function (id) { return person(m, id); }).filter(Boolean);
  }

  // 지금(가장 최근, 헤어지지 않은) 결합
  function currentUnion(m, pid) {
    var us = unionsOf(m, pid).filter(function (u) { return u.a && u.b; });
    var live = us.filter(function (u) { return u.status === 'married' || u.status === 'cohabit'; });
    var list = live.length ? live : us;
    list.sort(function (a, b) { return b.seq - a.seq; });
    return list[0] || null;
  }

  // pid 가 다른 사람(not)이 아닌 상대와 맺은 결합. 없으면 만든다.
  function otherUnion(m, pid, notId, partnerProps, status) {
    var us = unionsOf(m, pid).filter(function (u) { return partnerIn(u, pid) !== notId && partnerIn(u, pid); });
    if (us.length) return us[0];
    var p = addPerson(m, partnerProps || {});
    return addUnion(m, pid, p.id, status || 'married');
  }

  // 자녀를 둘 결합: 상대가 정해졌으면 그 결합, 아니면 지금 결합, 없으면 한 부모 결합
  function childUnion(m, pid, partnerId) {
    var us = unionsOf(m, pid);
    if (partnerId) {
      var f = us.filter(function (u) { return partnerIn(u, pid) === partnerId; })[0];
      if (f) return f;
    }
    var cu = currentUnion(m, pid);
    if (cu) return cu;
    var single = us.filter(function (u) { return !partnerIn(u, pid); })[0];
    return single || addUnion(m, pid, null, 'married');
  }

  function siblingsOf(m, pid) {
    var u = parentUnionOf(m, pid);
    if (!u) return [];
    return childrenOf(m, u.id).filter(function (c) { return c.id !== pid; });
  }

  function addRelation(m, a, b, type, extra) {
    extra = extra || {};
    if (a === b) return null;
    for (var i = 0; i < m.relations.length; i++) {
      var r = m.relations[i];
      if (r.type === type && ((r.a === a && r.b === b) || (!REL[type].dir && r.a === b && r.b === a))) return null;
    }
    var rel = { id: nid(m, 'r'), a: a, b: b, type: type, sub: extra.sub || null, tentative: !!extra.tentative, note: extra.note || '', key: extra.key || null, edited: false };
    m.relations.push(rel);
    return rel;
  }

  function removePerson(m, pid) {
    m.persons = m.persons.filter(function (p) { return p.id !== pid && p.owner !== pid; });
    m.relations = m.relations.filter(function (r) { return r.a !== pid && r.b !== pid; });
    m.links = m.links.filter(function (l) { return l.child !== pid; });
    m.household = m.household.filter(function (id) { return id !== pid; });
    m.unions.forEach(function (u) {
      if (u.a === pid) u.a = null;
      if (u.b === pid) u.b = null;
    });
    cleanup(m);
  }

  // 아무도 없는 결합, 자녀 없는 한쪽 결합 정리
  function cleanup(m) {
    var ids = {};
    m.persons.forEach(function (p) { ids[p.id] = 1; });
    m.links = m.links.filter(function (l) { return ids[l.child]; });
    m.unions = m.unions.filter(function (u) {
      var partners = (u.a ? 1 : 0) + (u.b ? 1 : 0);
      var kids = m.links.some(function (l) { return l.union === u.id; });
      return partners === 2 || kids;
    });
    var uids = {};
    m.unions.forEach(function (u) { uids[u.id] = 1; });
    m.links = m.links.filter(function (l) { return uids[l.union]; });
  }

  function displayName(p) {
    if (!p) return '';
    return p.name || p.label || (p.client ? '내담자' : KIND[p.kind] || '이름 없음');
  }

  function clone(m) { return JSON.parse(JSON.stringify(m)); }

  global.FamilyModel = {
    REL: REL, ABUSE_SUB: ABUSE_SUB, UNION: UNION, LINK: LINK, KIND: KIND,
    create: create, addPerson: addPerson, addUnion: addUnion, addLink: addLink, addRelation: addRelation,
    person: person, union: union, clientOf: clientOf, unionsOf: unionsOf, partnerIn: partnerIn,
    parentUnionOf: parentUnionOf, linkOf: linkOf, childrenOf: childrenOf, ensureParentUnion: ensureParentUnion,
    parentOf: parentOf, parentsOf: parentsOf, currentUnion: currentUnion, otherUnion: otherUnion,
    childUnion: childUnion, siblingsOf: siblingsOf, removePerson: removePerson, cleanup: cleanup,
    displayName: displayName, clone: clone
  };
})(typeof window !== 'undefined' ? window : globalThis);
