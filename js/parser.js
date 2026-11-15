/*
 * 한글 문장 → 가계도 모델
 * 모든 처리는 브라우저 안에서만 한다. 네트워크 요청 없음.
 */
(function (global) {
  'use strict';

  // ── 사전 ────────────────────────────────────────────────
  // role: client · father · mother · sibling · spouse · child · pgf · pgm · mgf · mgm
  var ROLE_WORDS = [
    ['내담자', { role: 'client' }],
    ['클라이언트', { role: 'client' }],
    ['본인', { role: 'client' }],
    ['친할아버지', { role: 'pgf', gender: 'M' }],
    ['친할머니', { role: 'pgm', gender: 'F' }],
    ['외할아버지', { role: 'mgf', gender: 'M' }],
    ['외할머니', { role: 'mgm', gender: 'F' }],
    ['할아버지', { role: 'pgf', gender: 'M' }],
    ['할머니', { role: 'pgm', gender: 'F' }],
    ['아버지', { role: 'father', gender: 'M' }],
    ['아빠', { role: 'father', gender: 'M' }],
    ['부친', { role: 'father', gender: 'M' }],
    ['어머니', { role: 'mother', gender: 'F' }],
    ['엄마', { role: 'mother', gender: 'F' }],
    ['모친', { role: 'mother', gender: 'F' }],
    ['오빠', { role: 'sibling', gender: 'M', order: 'older', clientGender: 'F' }],
    ['언니', { role: 'sibling', gender: 'F', order: 'older', clientGender: 'F' }],
    ['누나', { role: 'sibling', gender: 'F', order: 'older', clientGender: 'M' }],
    ['형', { role: 'sibling', gender: 'M', order: 'older', clientGender: 'M' }],
    ['남동생', { role: 'sibling', gender: 'M', order: 'younger' }],
    ['여동생', { role: 'sibling', gender: 'F', order: 'younger' }],
    ['동생', { role: 'sibling', gender: 'U', order: 'younger' }],
    ['남편', { role: 'spouse', gender: 'M' }],
    ['아내', { role: 'spouse', gender: 'F' }],
    ['부인', { role: 'spouse', gender: 'F' }],
    ['배우자', { role: 'spouse', gender: 'U' }],
    ['아들', { role: 'child', gender: 'M' }],
    ['딸', { role: 'child', gender: 'F' }],
    ['자녀', { role: 'child', gender: 'U' }]
  ];

  var GROUP_WORDS = [
    ['친조부모', ['pgf', 'pgm']],
    ['외조부모', ['mgf', 'mgm']],
    ['조부모', ['pgf', 'pgm']],
    ['부모님', ['father', 'mother']],
    ['부모', ['father', 'mother']]
  ];

  var ROLE_LABEL = {
    client: '내담자', father: '아버지', mother: '어머니', sibling: '형제자매',
    spouse: '배우자', child: '자녀', pgf: '친할아버지', pgm: '친할머니',
    mgf: '외할아버지', mgm: '외할머니'
  };
  var UNIQUE = { client: 1, father: 1, mother: 1, spouse: 1, pgf: 1, pgm: 1, mgf: 1, mgm: 1 };

  var REL_TYPES = [
    // 우선순위 순서. 앞에서 걸리면 뒤는 보지 않는다.
    ['abuse', /학대|폭력|폭행|때리|때렸|구타/],
    ['cutoff', /단절|연락이 ?끊|연락을 ?끊|연락하지 ?않|왕래가 ?없|왕래하지 ?않|의절|절연/],
    ['fused', /밀착|융합|과잉보호|지나치게 ?가깝|지나치게 ?가까|집착/],
    ['conflict', /갈등|다툼|다투|싸우|싸움|불화|적대|충돌|사이가 ?나쁘|사이가 ?안 ?좋/],
    ['distant', /소원|거리감|거리가 ?있|서먹|무관심|냉담/],
    ['close', /친밀|가깝|가까|사이가 ?좋|지지적|의지하|의지한/]
  ];
  var REL_LABEL = {
    close: '친밀', fused: '밀착', conflict: '갈등', distant: '소원', cutoff: '단절', abuse: '폭력·학대'
  };

  var UNION_TYPES = [
    ['divorced', /이혼/],
    ['separated', /별거/],
    ['cohabit', /동거|사실혼/],
    ['married', /결혼|혼인|재혼/]
  ];
  var UNION_LABEL = { married: '결혼', divorced: '이혼', separated: '별거', cohabit: '동거' };

  var DEATH_RE = /사망|돌아가|별세|작고|세상을 ?떠|숨졌|숨지/;
  var PASSIVE_RE = /당했|당함|당하|받았|받음|받고/;

  var SURNAMES = '김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부';
  var DOUBLE_SURNAMES = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문'];
  var STOPWORDS = ['공무원', '회사원', '사업가', '사무직', '자영업', '주부', '전업주부', '교사', '강사', '노동자',
    '노숙인', '수급자', '장애인', '한부모', '전남편', '전처', '정신과', '우울증', '조현병', '고혈압', '공황장애',
    '고등학생', '중학생', '초등학생', '대학생', '고등학교', '중학교', '재수생', '무직', '군인', '간호사', '의사',
    '사망', '이혼', '별거', '결혼', '재혼', '함께', '모두', '현재', '당시', '최근', '매우', '자주', '각각', '서로',
    '장남', '장녀', '차남', '차녀', '막내', '외동', '주양육자', '양육자', '보호자', '가장', '정도', '이후', '이전'];

  var PREV_OK = /[\s,.()\[\]·"'“”‘’\-~:;!?]/;
  var NEXT_OK = /[\s,.()\[\]·"'“”‘’\-~:;!?은는이가과와도의을를랑에하께님]/;

  var LEXICON = ROLE_WORDS.map(function (w) { return { word: w[0], info: w[1] }; })
    .concat(GROUP_WORDS.map(function (w) { return { word: w[0], group: w[1] }; }))
    .sort(function (a, b) { return b.word.length - a.word.length; });

  // ── 도우미 ──────────────────────────────────────────────
  function newModel() {
    return {
      persons: [],
      unions: { parents: 'married', client: 'married', paternal: 'married', maternal: 'married' },
      relations: [],
      lines: [],
      nextId: 1
    };
  }

  function addPerson(model, role, opts) {
    opts = opts || {};
    var p = {
      id: 'p' + model.nextId++,
      role: role,
      label: opts.label || ROLE_LABEL[role],
      name: opts.name || '',
      gender: opts.gender || 'U',
      age: opts.age == null ? null : opts.age,
      deceased: !!opts.deceased,
      order: opts.order || null,
      implied: !!opts.implied
    };
    model.persons.push(p);
    return p;
  }

  function findRole(model, role) {
    for (var i = 0; i < model.persons.length; i++) if (model.persons[i].role === role) return model.persons[i];
    return null;
  }

  function aliases(name) {
    var out = [name];
    if (name.length >= 3) {
      var given = name.slice(DOUBLE_SURNAMES.indexOf(name.slice(0, 2)) >= 0 ? 2 : 1);
      if (given.length >= 2) out.push(given);
    }
    return out;
  }

  function isRoleStart(s) {
    for (var i = 0; i < LEXICON.length; i++) if (s.indexOf(LEXICON[i].word) === 0) return true;
    return false;
  }

  function looksLikeFullName(s) {
    if (s.length === 3 && SURNAMES.indexOf(s[0]) >= 0) return true;
    if (s.length === 4 && DOUBLE_SURNAMES.indexOf(s.slice(0, 2)) >= 0) return true;
    return false;
  }

  function isStopword(s) {
    for (var i = 0; i < STOPWORDS.length; i++) if (s.indexOf(STOPWORDS[i]) === 0) return true;
    return /(있|없|했|한다|하다|이다|된다|되었|였다|었다)/.test(s);
  }

  function parseParens(content) {
    var attrs = {};
    content.split(/[,\s/·]+/).forEach(function (t) {
      if (!t) return;
      if (/^(남|남성|남자|M|m)$/.test(t)) attrs.gender = 'M';
      else if (/^(여|여성|여자|F|f)$/.test(t)) attrs.gender = 'F';
      else if (/^(사망|故|고인|작고|별세)$/.test(t)) attrs.deceased = true;
      else {
        var m = /^(\d{1,3})(세|살)?$/.exec(t);
        if (m) attrs.age = parseInt(m[1], 10);
      }
    });
    return attrs;
  }

  // 역할 낱말 바로 뒤의 이름·괄호를 읽는다. 읽은 길이만큼 end 를 돌려준다.
  function readNameAfter(text, j, model) {
    var rest = text.slice(j);
    var m = /^(은|는|이|가|께서|의)?(\s*)([가-힣]{2,6})?(\s*\(([^)]*)\))?/.exec(rest);
    var out = { end: j, name: '', attrs: {} };
    if (!m) return out;
    var particle = m[1] || '';
    var run = m[3] || '';
    var hasParens = !!m[4];
    var name = '';

    if (run && !isRoleStart(run) && !knownName(model, run)) {
      if (hasParens && run.length <= 5 && !isStopword(run)) {
        name = run;
      } else if (!hasParens) {
        var copula = /(이다|이고|이며|입니다|이에요|예요|이야|씨)$/.exec(run);
        var core = copula ? run.slice(0, run.length - copula[0].length) : run;
        if (!copula && core.length >= 3 && /[이가은는와과도의을를]$/.test(core)) core = core.slice(0, -1);
        var apposition = particle === '' && m[2].length > 0;
        if ((copula || apposition) && looksLikeFullName(core) && !isStopword(core)) name = core;
      }
    }

    if (name) {
      out.name = name;
      out.end = j + particle.length + m[2].length + run.length;
      if (hasParens) {
        out.attrs = parseParens(m[5]);
        out.end = j + m[0].length;
      }
    } else if (!run && hasParens) {
      out.attrs = parseParens(m[5]);
      out.end = j + m[0].length;
    } else if (run && hasParens && !name) {
      // 이름이 아닌 낱말 뒤 괄호는 무시
    }
    return out;
  }

  function knownName(model, s) {
    for (var i = 0; i < model.persons.length; i++) {
      var p = model.persons[i];
      if (!p.name) continue;
      var al = aliases(p.name);
      for (var k = 0; k < al.length; k++) if (s.indexOf(al[k]) === 0) return p;
    }
    return null;
  }

  function applyAttrs(p, attrs) {
    var changed = false;
    if (attrs.gender && p.gender !== attrs.gender) { p.gender = attrs.gender; changed = true; }
    if (attrs.age != null && p.age !== attrs.age) { p.age = attrs.age; changed = true; }
    if (attrs.deceased && !p.deceased) { p.deceased = true; changed = true; }
    return changed;
  }

  // ── 한 마디(절) 읽기 ────────────────────────────────────
  function scanMentions(text, model, ctx) {
    var mentions = [];
    var i = 0;
    while (i < text.length) {
      var hit = null;
      if (i === 0 || PREV_OK.test(text[i - 1])) {
        for (var k = 0; k < LEXICON.length; k++) {
          var w = LEXICON[k].word;
          if (text.substr(i, w.length) === w) {
            var j = i + w.length;
            if (j === text.length || NEXT_OK.test(text[j])) { hit = LEXICON[k]; break; }
          }
        }
        if (hit) {
          var after = readNameAfter(text, i + hit.word.length, model);
          var persons = resolveLexicon(model, hit, after, ctx);
          mentions.push({ start: i, end: Math.max(after.end, i + hit.word.length), persons: persons });
          i = Math.max(after.end, i + hit.word.length);
          continue;
        }
        // 앞에서 소개한 이름
        var best = null, bestLen = 0;
        model.persons.forEach(function (p) {
          if (!p.name) return;
          aliases(p.name).forEach(function (a) {
            if (a.length > bestLen && text.substr(i, a.length) === a) { best = p; bestLen = a.length; }
          });
        });
        if (best) {
          var end = i + bestLen;
          var pm = /^(\s*\(([^)]*)\))/.exec(text.slice(end));
          if (pm) {
            if (applyAttrs(best, parseParens(pm[2]))) ctx.effects++;
            end += pm[1].length;
          }
          mentions.push({ start: i, end: end, persons: [best] });
          i = end;
          continue;
        }
      }
      i++;
    }
    return mentions;
  }

  function resolveLexicon(model, hit, after, ctx) {
    if (hit.group) {
      return hit.group.map(function (role) {
        var p = findRole(model, role);
        if (!p) { p = addPerson(model, role, { gender: role === 'father' || /gf$/.test(role) ? 'M' : 'F' }); ctx.effects++; }
        return p;
      });
    }
    var info = hit.info;
    var role = info.role;
    var p = null;
    if (UNIQUE[role]) {
      p = findRole(model, role);
    } else if (after.name) {
      p = model.persons.filter(function (q) { return q.role === role && q.name === after.name; })[0] ||
          model.persons.filter(function (q) { return q.role === role && !q.name && q.label === hit.word; })[0] || null;
    } else {
      p = model.persons.filter(function (q) { return q.role === role && q.label === hit.word; })[0] || null;
    }
    if (!p) {
      p = addPerson(model, role, {
        label: role === 'sibling' || role === 'child' || role === 'spouse' ? hit.word : ROLE_LABEL[role],
        gender: info.gender || 'U',
        order: info.order || null
      });
      ctx.effects++;
    }
    if (after.name && !p.name) { p.name = after.name; ctx.effects++; }
    if (info.gender && info.gender !== 'U' && p.gender === 'U') p.gender = info.gender;
    if (applyAttrs(p, after.attrs)) ctx.effects++;
    if (info.clientGender) ctx.clientGenderHint = info.clientGender;
    return [p];
  }

  function displayName(p) {
    return p.name || p.label || ROLE_LABEL[p.role];
  }

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (p) { if (!seen[p.id]) { seen[p.id] = 1; out.push(p); } });
    return out;
  }

  // 키워드 바로 앞에서 '와/과/,'로 이어진 사람 묶음 (주어 묶음)
  function subjectGroup(text, mentions, kwIndex) {
    var before = mentions.filter(function (m) { return m.end <= kwIndex; });
    if (!before.length) return [];
    var group = [before[before.length - 1]];
    for (var k = before.length - 2; k >= 0; k--) {
      var gap = text.slice(before[k].end, group[0].start);
      if (/^(\s|와|과|랑|이랑|하고|,|및)*$/.test(gap) && /(와|과|랑|하고|,|및)/.test(gap)) group.unshift(before[k]);
      else break;
    }
    var out = [];
    group.forEach(function (m) { out = out.concat(m.persons); });
    return uniq(out);
  }

  function unionKeyFor(persons) {
    var roles = {};
    persons.forEach(function (p) { roles[p.role] = 1; });
    if (roles.father || roles.mother) return 'parents';
    if (roles.spouse) return 'client';
    if (roles.pgf || roles.pgm) return 'paternal';
    if (roles.mgf || roles.mgm) return 'maternal';
    if (roles.client) return 'client';
    return null;
  }

  function addRelation(model, a, b, type) {
    if (a.id === b.id) return false;
    for (var i = 0; i < model.relations.length; i++) {
      var r = model.relations[i];
      if (r.type === type && ((r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) return false;
    }
    model.relations.push({ a: a.id, b: b.id, type: type });
    return true;
  }

  function parseClause(text, model, ctx) {
    ctx.effects = 0;
    var mentions = scanMentions(text, model, ctx);
    var persons = [];
    mentions.forEach(function (m) { persons = persons.concat(m.persons); });
    persons = uniq(persons);

    // 정서적 관계
    var relType = null;
    for (var r = 0; r < REL_TYPES.length; r++) if (REL_TYPES[r][1].test(text)) { relType = REL_TYPES[r][0]; break; }
    if (relType && persons.length >= 2) {
      var first = persons[0], others = persons.slice(1);
      if (relType === 'abuse' && PASSIVE_RE.test(text)) {
        // "A는 B에게 폭행을 당했다" → B가 A에게
        others.forEach(function (o) { if (addRelation(model, o, first, relType)) ctx.effects++; });
      } else {
        others.forEach(function (o) { if (addRelation(model, first, o, relType)) ctx.effects++; });
      }
    }

    // 부부 관계
    var unionType = null;
    for (var u = 0; u < UNION_TYPES.length; u++) if (UNION_TYPES[u][1].test(text)) { unionType = UNION_TYPES[u][0]; break; }
    if (unionType && persons.length) {
      var key = unionKeyFor(persons);
      if (key) {
        model.unions[key] = unionType;
        ctx.effects++;
        if (key === 'client' && !findRole(model, 'spouse')) addPerson(model, 'spouse', { implied: true });
      }
    }

    // 사망
    var dm = DEATH_RE.exec(text);
    if (dm && persons.length) {
      var dead = subjectGroup(text, mentions, dm.index);
      if (!dead.length) dead = persons.slice(0, 1);
      dead.forEach(function (p) { if (!p.deceased) { p.deceased = true; ctx.effects++; } });
    }

    // 한 사람만 나오는 문장의 나이·성별
    if (persons.length === 1) {
      var p = persons[0];
      var am = /(?:^|[^\d])(\d{1,3})\s*(?:세|살)/.exec(text);
      if (am && p.age == null) { p.age = parseInt(am[1], 10); ctx.effects++; }
      if (/(^|\s)(남자|남성|남학생|남아)/.test(text) && p.gender !== 'M') { p.gender = 'M'; ctx.effects++; }
      if (/(^|\s)(여자|여성|여학생|여아)/.test(text) && p.gender !== 'F') { p.gender = 'F'; ctx.effects++; }
    }

    var status, hint = '';
    if (ctx.effects > 0) status = 'ok';
    else if (persons.length) {
      status = 'partial';
      var who = persons.map(displayName).join(', ');
      hint = persons.length >= 2
        ? who + ' 사이의 관계를 나타내는 말(갈등, 친밀, 밀착, 소원, 단절, 폭력, 이혼 등)을 찾지 못했어요.'
        : who + '은(는) 찾았지만, 가계도에 더할 내용(이름, 나이, 성별, 사망, 관계)은 찾지 못했어요.';
    } else {
      status = 'none';
      hint = '사람을 찾지 못했어요. 내담자, 아버지, 누나처럼 관계를 나타내는 말이나 앞에서 소개한 이름을 넣어 주세요.';
    }
    return { text: text, status: status, hint: hint };
  }

  function splitClauses(text) {
    var out = [];
    text.split(/\n+/).forEach(function (line) {
      line.split(/(?<=[.!?。])\s+/).forEach(function (sent) {
        sent.split(/(?<=(?:이고|이며|였고|었고|았고|했고|으며|있고|없고)),?\s+/).forEach(function (c) {
          c = c.replace(/^[\s\-•·*\d.)]+(?=[가-힣A-Za-z])/, '').trim();
          if (c) out.push(c);
        });
      });
    });
    return out;
  }

  function finalize(model, ctx) {
    var client = findRole(model, 'client');
    if (!client && model.persons.length) client = addPerson(model, 'client', { implied: true });
    if (client && client.gender === 'U' && ctx.clientGenderHint) client.gender = ctx.clientGenderHint;
    var spouse = findRole(model, 'spouse');
    if (client && spouse && spouse.gender === 'U' && client.gender !== 'U') spouse.gender = client.gender === 'M' ? 'F' : 'M';
    if ((findRole(model, 'pgf') || findRole(model, 'pgm')) && !findRole(model, 'father')) addPerson(model, 'father', { gender: 'M', implied: true });
    if ((findRole(model, 'mgf') || findRole(model, 'mgm')) && !findRole(model, 'mother')) addPerson(model, 'mother', { gender: 'F', implied: true });
  }

  function parse(text) {
    var model = newModel();
    var ctx = { effects: 0, clientGenderHint: null };
    splitClauses(text || '').forEach(function (c) {
      model.lines.push(parseClause(c, model, ctx));
    });
    finalize(model, ctx);
    return model;
  }

  global.GenogramParser = {
    parse: parse,
    newModel: newModel,
    addPerson: addPerson,
    findRole: findRole,
    displayName: displayName,
    ROLE_LABEL: ROLE_LABEL,
    REL_LABEL: REL_LABEL,
    UNION_LABEL: UNION_LABEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
