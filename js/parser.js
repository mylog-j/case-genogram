/*
 * 한글 사례 문장 → 가족 모델
 * 모든 처리는 브라우저 안에서만 한다. 네트워크 요청 없음.
 *
 * parse(text, answers) — answers 는 '골라 주세요' 카드에서 고른 값 { 선택키: 값 }
 */
(function (global) {
  'use strict';

  var F = global.FamilyModel;

  // ── 낱말 사전 ───────────────────────────────────────────
  // t: self · parent · parents · gp · gps · step · sib · half · partner · child · aunt · inlaw · inlaws · pet
  var WORDS = [
    ['내담자', { t: 'self' }], ['클라이언트', { t: 'self' }], ['본인', { t: 'self' }],

    ['아버지', { t: 'parent', g: 'M' }], ['아빠', { t: 'parent', g: 'M' }], ['부친', { t: 'parent', g: 'M' }],
    ['친부', { t: 'parent', g: 'M' }], ['생부', { t: 'parent', g: 'M' }],
    ['어머니', { t: 'parent', g: 'F' }], ['엄마', { t: 'parent', g: 'F' }], ['모친', { t: 'parent', g: 'F' }],
    ['친모', { t: 'parent', g: 'F' }], ['생모', { t: 'parent', g: 'F' }],
    ['부모님', { t: 'parents' }], ['부모', { t: 'parents' }],

    ['친할아버지', { t: 'gp', side: 'P', g: 'M' }], ['친할머니', { t: 'gp', side: 'P', g: 'F' }],
    ['외할아버지', { t: 'gp', side: 'M', g: 'M' }], ['외할머니', { t: 'gp', side: 'M', g: 'F' }],
    ['할아버지', { t: 'gp', side: null, g: 'M' }], ['할머니', { t: 'gp', side: null, g: 'F' }],
    ['친조부모', { t: 'gps', side: 'P' }], ['외조부모', { t: 'gps', side: 'M' }], ['조부모', { t: 'gps', side: null }],

    ['새아버지', { t: 'step', g: 'M' }], ['계부', { t: 'step', g: 'M' }],
    ['새어머니', { t: 'step', g: 'F' }], ['계모', { t: 'step', g: 'F' }],

    ['오빠', { t: 'sib', g: 'M', order: 'older', cg: 'F' }], ['언니', { t: 'sib', g: 'F', order: 'older', cg: 'F' }],
    ['누나', { t: 'sib', g: 'F', order: 'older', cg: 'M' }], ['형', { t: 'sib', g: 'M', order: 'older', cg: 'M' }],
    ['남동생', { t: 'sib', g: 'M', order: 'younger' }], ['여동생', { t: 'sib', g: 'F', order: 'younger' }],
    ['동생', { t: 'sib', g: 'U', order: 'younger' }],

    ['남편', { t: 'partner', g: 'M' }], ['아내', { t: 'partner', g: 'F' }], ['부인', { t: 'partner', g: 'F' }],
    ['배우자', { t: 'partner', g: 'U' }],
    ['전남편', { t: 'partner', g: 'M', ex: true }], ['전처', { t: 'partner', g: 'F', ex: true }],
    ['전부인', { t: 'partner', g: 'F', ex: true }], ['전배우자', { t: 'partner', g: 'U', ex: true }],
    ['전 배우자', { t: 'partner', g: 'U', ex: true }],
    ['동거인', { t: 'partner', g: 'U', cohabit: true }], ['동거남', { t: 'partner', g: 'M', cohabit: true }],
    ['동거녀', { t: 'partner', g: 'F', cohabit: true }],

    ['입양한 아들', { t: 'child', g: 'M', ctype: 'adopted' }], ['입양한 딸', { t: 'child', g: 'F', ctype: 'adopted' }],
    ['입양아', { t: 'child', g: 'U', ctype: 'adopted' }], ['양자', { t: 'child', g: 'M', ctype: 'adopted' }],
    ['양녀', { t: 'child', g: 'F', ctype: 'adopted' }], ['위탁아동', { t: 'child', g: 'U', ctype: 'foster' }],
    ['아들', { t: 'child', g: 'M' }], ['딸', { t: 'child', g: 'F' }], ['자녀', { t: 'child', g: 'U' }],

    ['고모', { t: 'aunt', side: 'P', g: 'F' }], ['큰아버지', { t: 'aunt', side: 'P', g: 'M', order: 'older' }],
    ['백부', { t: 'aunt', side: 'P', g: 'M', order: 'older' }], ['작은아버지', { t: 'aunt', side: 'P', g: 'M', order: 'younger' }],
    ['숙부', { t: 'aunt', side: 'P', g: 'M', order: 'younger' }], ['삼촌', { t: 'aunt', side: 'P', g: 'M' }],
    ['이모', { t: 'aunt', side: 'M', g: 'F' }], ['외삼촌', { t: 'aunt', side: 'M', g: 'M' }],

    ['시아버지', { t: 'inlaw', g: 'M', sg: 'M' }], ['시어머니', { t: 'inlaw', g: 'F', sg: 'M' }],
    ['장인', { t: 'inlaw', g: 'M', sg: 'F' }], ['장모', { t: 'inlaw', g: 'F', sg: 'F' }],
    ['시부모', { t: 'inlaws', sg: 'M' }],

    ['반려견', { t: 'pet', species: '반려견' }], ['강아지', { t: 'pet', species: '반려견' }],
    ['반려묘', { t: 'pet', species: '반려묘' }], ['고양이', { t: 'pet', species: '반려묘' }],
    ['반려동물', { t: 'pet', species: '반려동물' }]
  ];

  // 이복·이부·쌍둥이 형제 낱말 만들기
  var SIB_BASE = [['형', 'M', 'older'], ['오빠', 'M', 'older'], ['누나', 'F', 'older'], ['언니', 'F', 'older'],
    ['남동생', 'M', 'younger'], ['여동생', 'F', 'younger'], ['동생', 'U', 'younger']];
  SIB_BASE.forEach(function (s) {
    WORDS.push(['이복' + s[0], { t: 'half', side: 'P', g: s[1], order: s[2] }]);
    WORDS.push(['배다른 ' + s[0], { t: 'half', side: 'P', g: s[1], order: s[2] }]);
    WORDS.push(['이부' + s[0], { t: 'half', side: 'M', g: s[1], order: s[2] }]);
    WORDS.push(['씨다른 ' + s[0], { t: 'half', side: 'M', g: s[1], order: s[2] }]);
    WORDS.push(['쌍둥이 ' + s[0], { t: 'sib', g: s[1], order: s[2], twin: true }]);
    WORDS.push(['일란성 쌍둥이 ' + s[0], { t: 'sib', g: s[1], order: s[2], twin: true, identical: true }]);
  });
  WORDS.push(['이복형제', { t: 'half', side: 'P', g: 'U', order: null }]);
  WORDS.push(['이부형제', { t: 'half', side: 'M', g: 'U', order: null }]);

  var LEX = WORDS.map(function (w) { return { word: w[0], spec: w[1] }; })
    .sort(function (a, b) { return b.word.length - a.word.length; });

  // ── 관계 표현 ───────────────────────────────────────────
  var CLEAR_REL = [
    ['abuse', /학대|폭력|폭행|때리|때렸|구타|성추행|성폭|추행|폭언|방임/],
    ['cutoff', /단절|연락이 ?끊|연락을 ?끊|왕래가 ?없|왕래하지 ?않|의절|절연/],
    ['hostile', /적대|증오|적개심/],
    ['control', /통제|간섭|대신 ?결정|결정을 ?대신/],
    ['focus', /희생양|탓을 ?돌|책임을 ?돌|탓한다|탓을 ?한/],
    ['care', /돌본다|돌보고|돌봄|간병|부양|주 ?보호자|주 ?양육자/],
    ['oneSided', /짝사랑|일방적/],
    ['fused', /밀착|융합|과잉보호|지나치게 ?가깝|지나치게 ?가까|지나치게 ?의존|서로에게 ?의존/],
    ['conflict', /갈등|다툼|다투|싸우|싸움|불화|충돌/],
    ['distant', /소원|거리감|거리가 ?있|서먹|무관심|냉담/],
    ['close', /친밀|사이가 ?좋|지지적|의지하|의지한|애착/]
  ];
  // 해석이 갈리는 표현 → 고르기
  var AMBIG_REL = [
    [/사이가 ?(안 ?좋|나쁘|좋지 ?않)/, ['conflict', 'hostile', 'distant', 'cutoff'], '사이가 안 좋다'],
    [/연락이 ?뜸|연락을? ?(거의 )?(안 ?하|하지 ?않)|연락이 ?(거의 )?없/, ['distant', 'cutoff'], '연락'],
    [/멀어졌|멀어진|멀어지/, ['distant', 'cutoff'], '멀어짐'],
    [/집착/, ['fused', 'control'], '집착'],
    [/없이는 ?(아무것도 )?못/, ['fused', 'care'], '의존'],
    [/무서워|두려워/, ['abuse', 'conflict'], '두려움'],
    [/훈육이 ?심|체벌/, ['abuse', 'conflict'], '훈육'],
    [/가깝|가까/, ['close', 'fused'], '가깝다']
  ];
  var DEATH_RE = /사망|돌아가|별세|작고|세상을 ?떠|숨졌|숨지/;
  var PASSIVE_RE = /당했|당함|당하|받았|받음|받고|받는/;
  var SOURCE_RE = /진술|라고 ?(했|말했|함|한다)|주장/;
  var TENTATIVE_RE = /의심|추정|것 ?같/;
  var HOUSE_RE = /(함께|같이) ?(살|산다|거주|생활)|한집에/;

  var SURNAMES = '김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부';
  var DOUBLE_SURNAMES = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문'];
  var STOPWORDS = ['공무원', '회사원', '사업가', '사무직', '자영업', '주부', '전업주부', '교사', '강사', '노동자',
    '노숙인', '수급자', '장애인', '한부모', '전남편', '전처', '정신과', '우울증', '조현병', '고혈압', '공황장애',
    '고등학생', '중학생', '초등학생', '대학생', '고등학교', '중학교', '재수생', '무직', '군인', '간호사', '의사',
    '사망', '이혼', '별거', '결혼', '재혼', '함께', '모두', '현재', '당시', '최근', '매우', '자주', '각각', '서로',
    '장남', '장녀', '차남', '차녀', '막내', '외동', '주양육자', '양육자', '보호자', '가장', '정도', '이후', '이전',
    '입양', '위탁', '쌍둥이', '일란성', '이란성', '동거', '임신', '유산', '사산'];

  var PREV_OK = /[\s,.()\[\]·"'“”‘’\-~:;!?]/;
  var NEXT_OK = /[\s,.()\[\]·"'“”‘’\-~:;!?은는이가과와도의을를랑에하께님]/;

  // ── 도우미 ──────────────────────────────────────────────
  function aliases(name) {
    var out = [name];
    if (name.length >= 3) {
      var given = name.slice(DOUBLE_SURNAMES.indexOf(name.slice(0, 2)) >= 0 ? 2 : 1);
      if (given.length >= 2) out.push(given);
    }
    return out;
  }
  function isRoleStart(s) {
    for (var i = 0; i < LEX.length; i++) if (s.indexOf(LEX[i].word) === 0) return true;
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
      else if (/논바이너리|트랜스|젠더|성별다양/.test(t)) attrs.genderLabel = t;
      else {
        var y = /^(\d{4})년생$/.exec(t);
        if (y) { attrs.birthYear = +y[1]; return; }
        var m = /^(\d{1,3})(세|살)?$/.exec(t);
        if (m) attrs.age = parseInt(m[1], 10);
      }
    });
    return attrs;
  }
  function knownName(m, s) {
    for (var i = 0; i < m.persons.length; i++) {
      var p = m.persons[i];
      if (!p.name) continue;
      var al = aliases(p.name);
      for (var k = 0; k < al.length; k++) if (s.indexOf(al[k]) === 0) return p;
    }
    return null;
  }
  function byName(m, name) {
    for (var i = 0; i < m.persons.length; i++) if (m.persons[i].name === name) return m.persons[i];
    return null;
  }

  function readNameAfter(text, j, m) {
    var rest = text.slice(j);
    var mm = /^(은|는|이|가|께서|의)?(\s*)([가-힣]{2,6})?(\s*\(([^)]*)\))?/.exec(rest);
    var out = { end: j, name: '', attrs: {} };
    if (!mm) return out;
    var particle = mm[1] || '';
    if (particle === '의') return out; // 소유격은 다음 낱말의 기준
    var run = mm[3] || '';
    var hasParens = !!mm[4];
    var name = '';
    if (run && !isRoleStart(run) && !knownName(m, run)) {
      if (hasParens && run.length <= 5 && !isStopword(run)) name = run;
      else if (!hasParens) {
        var copula = /(이다|이고|이며|입니다|이에요|예요|이야|씨)$/.exec(run);
        var core = copula ? run.slice(0, run.length - copula[0].length) : run;
        if (!copula && core.length >= 3 && /[이가은는와과도의을를]$/.test(core)) core = core.slice(0, -1);
        var apposition = particle === '' && mm[2].length > 0;
        if ((copula || apposition) && looksLikeFullName(core) && !isStopword(core)) name = core;
      }
    }
    if (name) {
      out.name = name;
      out.end = j + particle.length + mm[2].length + run.length;
      if (hasParens) { out.attrs = parseParens(mm[5]); out.end = j + mm[0].length; }
    } else if (!run && hasParens) {
      out.attrs = parseParens(mm[5]);
      out.end = j + mm[0].length;
    }
    return out;
  }

  function applyAttrs(p, a) {
    var ch = false;
    if (a.gender && p.gender !== a.gender) { p.gender = a.gender; ch = true; }
    if (a.genderLabel && p.genderLabel !== a.genderLabel) { p.genderLabel = a.genderLabel; ch = true; }
    if (a.age != null && p.age !== a.age) { p.age = a.age; ch = true; }
    if (a.birthYear && p.birthYear !== a.birthYear) { p.birthYear = a.birthYear; ch = true; }
    if (a.deceased && !p.deceased) { p.deceased = true; ch = true; }
    return ch;
  }

  // ── 해석기 ──────────────────────────────────────────────
  function Parser(answers) {
    this.m = F.create();
    this.answers = answers || {};
    this.clientGenderHint = null;
  }

  Parser.prototype.client = function () {
    var c = F.clientOf(this.m);
    if (!c) { c = F.addPerson(this.m, { client: true, key: 'C', label: '내담자', implied: true }); this.effects++; }
    return c;
  };

  Parser.prototype.mk = function (props) { this.effects++; return F.addPerson(this.m, props); };

  Parser.prototype.labelFor = function (anchor, word) {
    return anchor.client ? word : F.displayName(anchor) + '의 ' + word;
  };

  Parser.prototype.choose = function (choice) {
    // 이미 같은 선택이 있으면 다시 넣지 않는다
    for (var i = 0; i < this.m.choices.length; i++) if (this.m.choices[i].key === choice.key) return this.m.choices[i].value;
    choice.value = this.answers.hasOwnProperty(choice.key) ? this.answers[choice.key] : choice.def;
    this.m.choices.push(choice);
    return choice.value;
  };

  // 같은 이름 또는 같은 자리(key)의 사람을 찾는다
  Parser.prototype.findSame = function (key, name, label) {
    var m = this.m;
    if (name) { var n = byName(m, name); if (n) return n; }
    for (var i = 0; i < m.persons.length; i++) {
      var p = m.persons[i];
      if (p.key === key && (!name || !p.name)) return p;
    }
    return null;
  };

  Parser.prototype.parent = function (anchor, g, word) {
    var m = this.m;
    var p = F.parentOf(m, anchor.id, g, null, false);
    if (p) return p;
    p = F.parentOf(m, anchor.id, g, { key: anchor.key + '>P:' + g, label: this.labelFor(anchor, word || (g === 'M' ? '아버지' : '어머니')) }, true);
    if (p) this.effects++;
    return p;
  };

  Parser.prototype.resolve = function (anchor, hit, after, clause) {
    var m = this.m, s = hit.spec, self = this, word = hit.word;
    var out = [];
    function finish(p) {
      if (!p) return;
      if (after.name && !p.name) { p.name = after.name; self.effects++; }
      if (s.g && s.g !== 'U' && p.gender === 'U') p.gender = s.g;
      if (applyAttrs(p, after.attrs)) self.effects++;
      out.push(p);
    }
    if (s.t === 'self') {
      var c = this.client();
      if (c.implied) { c.implied = false; this.effects++; }
      finish(c);
      return out;
    }
    if (s.t === 'parent') { finish(this.parent(anchor, s.g, word)); return out; }
    if (s.t === 'parents') { out.push(this.parent(anchor, 'M'), this.parent(anchor, 'F')); return out; }

    if (s.t === 'gp' || s.t === 'gps') {
      var side = s.side;
      if (!side) {
        side = this.choose({
          key: 'side|' + word.replace('조부모', '할') + '|' + anchor.key, kind: 'side', text: clause,
          question: (anchor.client ? '' : F.displayName(anchor) + '의 ') + word + '는 어느 쪽인가요?',
          options: [['P', '친가'], ['M', '외가']], def: 'P'
        });
      }
      var mid = this.parent(anchor, side === 'P' ? 'M' : 'F');
      var pre = side === 'P' ? '친' : '외';
      var self2 = this;
      var gpOf = function (g) {
        var w = pre + (g === 'M' ? '할아버지' : '할머니');
        var q = self2.parent(mid, g, w);
        if (!q.name && !q.edited) q.label = self2.labelFor(anchor, w);
        return q;
      };
      if (s.t === 'gps') { out.push(gpOf('M'), gpOf('F')); return out; }
      finish(gpOf(s.g));
      return out;
    }

    if (s.t === 'step') {
      var bio = this.parent(anchor, s.g === 'M' ? 'F' : 'M');
      var other = F.parentOf(m, anchor.id, s.g, null, false);
      var key = anchor.key + '>STEP:' + s.g;
      var found = this.findSame(key, after.name);
      if (found) { finish(found); return out; }
      var u = F.unionsOf(m, bio.id).filter(function (x) { var pp = F.partnerIn(x, bio.id); return pp && (!other || pp !== other.id) && F.person(m, pp).gender !== (s.g === 'M' ? 'F' : 'M'); })[0];
      var sp;
      if (u) sp = F.person(m, F.partnerIn(u, bio.id));
      else {
        sp = this.mk({ key: key, gender: s.g, label: this.labelFor(anchor, word) });
        F.addUnion(m, bio.id, sp.id, 'married');
      }
      if (!sp.key) sp.key = key;
      if (sp.implied) { sp.implied = false; sp.label = this.labelFor(anchor, word); }
      finish(sp);
      return out;
    }

    if (s.t === 'sib' || s.t === 'half') {
      var pu;
      if (s.t === 'sib') pu = F.ensureParentUnion(m, anchor.id);
      else {
        var shared = this.parent(anchor, s.side === 'P' ? 'M' : 'F');
        var otherParent = F.parentOf(m, anchor.id, s.side === 'P' ? 'F' : 'M', null, false);
        var anchorPU = F.parentUnionOf(m, anchor.id);
        var existing = F.unionsOf(m, shared.id).filter(function (x) {
          var pp = F.partnerIn(x, shared.id);
          return pp && x !== anchorPU && (!otherParent || pp !== otherParent.id);
        }).sort(function (a1, b1) { return b1.seq - a1.seq; })[0];
        if (existing) pu = existing;
        else {
          var op = this.mk({ key: anchor.key + '>HALFP:' + s.side, gender: s.side === 'P' ? 'F' : 'M', implied: true,
            label: this.labelFor(anchor, word.replace(/^(이복|이부|배다른 |씨다른 )/, '') + '의 ' + (s.side === 'P' ? '어머니' : '아버지')) });
          pu = F.addUnion(m, shared.id, op.id, 'divorced');
        }
      }
      var skey = anchor.key + '>' + (s.t === 'half' ? 'H' + s.side : 'S') + ':' + word;
      var sib = this.findSame(skey, after.name);
      if (sib && after.name && sib.name === after.name) { /* 이름으로 찾음 */ }
      else if (!sib || (after.name && sib.name)) {
        sib = this.mk({ key: skey, gender: s.g, order: s.order, label: this.labelFor(anchor, word.replace(/^(일란성 )?쌍둥이 /, '쌍둥이 ')) });
        F.addLink(m, pu.id, sib.id, 'bio');
      }
      if (s.twin) {
        var la = F.linkOf(m, anchor.id), lb = F.linkOf(m, sib.id);
        if (la && lb) { var tg = la.twin || lb.twin || ('t' + la.id); la.twin = lb.twin = tg; if (s.identical) la.identical = lb.identical = true; }
      }
      if (s.cg && anchor.client) this.clientGenderHint = s.cg;
      finish(sib);
      return out;
    }

    if (s.t === 'partner') {
      var pkey = anchor.key + '>' + (s.ex ? 'EX' : s.cohabit ? 'CO' : 'SP');
      var found2 = this.findSame(pkey, after.name);
      if (!found2) {
        var cands = F.unionsOf(m, anchor.id).filter(function (x) {
          var pp = F.partnerIn(x, anchor.id);
          if (!pp) return false;
          var ex = x.status === 'divorced' || x.status === 'separated';
          return s.ex ? ex : !ex;
        });
        if (cands.length && !after.name) found2 = F.person(m, F.partnerIn(cands[cands.length - 1], anchor.id));
      }
      if (!found2) {
        found2 = this.mk({ key: pkey, gender: s.g, label: this.labelFor(anchor, word) });
        F.addUnion(m, anchor.id, found2.id, s.ex ? 'divorced' : s.cohabit ? 'cohabit' : 'married');
      }
      finish(found2);
      return out;
    }

    if (s.t === 'child') {
      var cu = F.childUnion(m, anchor.id);
      var ckey = anchor.key + '>K:' + word;
      var ch = this.findSame(ckey, after.name);
      if (!ch || (after.name && ch.name && ch.name !== after.name)) {
        ch = this.mk({ key: ckey, gender: s.g, label: this.labelFor(anchor, word.replace('입양한 ', '')) });
        F.addLink(m, cu.id, ch.id, s.ctype || 'bio');
      }
      finish(ch);
      return out;
    }

    if (s.t === 'aunt') {
      var par = this.parent(anchor, s.side === 'P' ? 'M' : 'F');
      var apu = F.ensureParentUnion(m, par.id);
      var akey = anchor.key + '>A:' + word;
      var au = this.findSame(akey, after.name);
      if (!au || (after.name && au.name && au.name !== after.name)) {
        au = this.mk({ key: akey, gender: s.g, order: s.order, label: this.labelFor(anchor, word) });
        F.addLink(m, apu.id, au.id, 'bio');
      }
      finish(au);
      return out;
    }

    if (s.t === 'inlaw' || s.t === 'inlaws') {
      var spu = F.currentUnion(m, anchor.id);
      var spouse = spu ? F.person(m, F.partnerIn(spu, anchor.id)) : null;
      if (!spouse) {
        spouse = this.mk({ key: anchor.key + '>SP', gender: s.sg, label: this.labelFor(anchor, s.sg === 'M' ? '남편' : '아내'), implied: true });
        F.addUnion(m, anchor.id, spouse.id, 'married');
      }
      if (s.t === 'inlaws') { out.push(this.parent(spouse, 'M', '시아버지'), this.parent(spouse, 'F', '시어머니')); return out; }
      var il = this.parent(spouse, s.g, word);
      il.label = this.labelFor(anchor, word);
      finish(il);
      return out;
    }

    if (s.t === 'pet') {
      var petKey = anchor.key + '>PET:' + s.species;
      var pet = this.findSame(petKey, after.name);
      if (!pet) pet = this.mk({ key: petKey, kind: 'pet', owner: anchor.id, label: s.species });
      if (after.name && !pet.name) { pet.name = after.name; this.effects++; }
      out.push(pet);
      return out;
    }
    return out;
  };

  Parser.prototype.scan = function (text) {
    var m = this.m, mentions = [], i = 0;
    while (i < text.length) {
      if (i === 0 || PREV_OK.test(text[i - 1])) {
        var hit = null;
        for (var k = 0; k < LEX.length; k++) {
          var w = LEX[k].word;
          if (text.substr(i, w.length) === w) {
            var j = i + w.length;
            if (j === text.length || NEXT_OK.test(text[j])) { hit = LEX[k]; break; }
          }
        }
        if (hit) {
          // 바로 앞이 "A의 " 이면 A 가 기준
          var anchor = null, prev = mentions[mentions.length - 1];
          if (prev && prev.persons.length === 1 && /^의\s*$/.test(text.slice(prev.end, i))) { anchor = prev.persons[0]; prev.possessive = true; }
          if (!anchor) anchor = this.client();
          var after = readNameAfter(text, i + hit.word.length, m);
          if (hit.spec.t === 'pet' && !after.name) {
            // 반려동물 이름은 두 글자도 흔하다: "반려견 콩이가"
            var pn = /^(\s+)([가-힣]{1,5})/.exec(text.slice(i + hit.word.length));
            if (pn) {
              var nm = pn[2].replace(/(가|는|은|를|을|와|과|도)$/, '');
              if (nm && !isRoleStart(nm) && !isStopword(nm) && !/^(있|없|한|두|세|네)/.test(nm)) {
                after = { name: nm, attrs: {}, end: i + hit.word.length + pn[1].length + nm.length };
              }
            }
          }
          var persons = this.resolve(anchor, hit, after, text);
          var end = Math.max(after.end, i + hit.word.length);
          mentions.push({ start: i, end: end, persons: persons, word: hit.word });
          i = end;
          continue;
        }
        var best = null, bestLen = 0;
        m.persons.forEach(function (p) {
          if (!p.name) return;
          aliases(p.name).forEach(function (a) {
            if (a.length > bestLen && text.substr(i, a.length) === a) { best = p; bestLen = a.length; }
          });
        });
        if (best) {
          var e2 = i + bestLen;
          var pm = /^(\s*\(([^)]*)\))/.exec(text.slice(e2));
          if (pm) { if (applyAttrs(best, parseParens(pm[2]))) this.effects++; e2 += pm[1].length; }
          mentions.push({ start: i, end: e2, persons: [best] });
          i = e2;
          continue;
        }
      }
      i++;
    }
    return mentions;
  };

  function uniq(list) {
    var seen = {}, out = [];
    list.forEach(function (p) { if (p && !seen[p.id]) { seen[p.id] = 1; out.push(p); } });
    return out;
  }

  function subjectGroup(text, mentions, kwIndex) {
    var before = mentions.filter(function (mm) { return mm.end <= kwIndex && !mm.possessive; });
    if (!before.length) return [];
    var group = [before[before.length - 1]];
    for (var k = before.length - 2; k >= 0; k--) {
      var gap = text.slice(before[k].end, group[0].start);
      if (/^(\s|와|과|랑|이랑|하고|,|및)*$/.test(gap) && /(와|과|랑|하고|,|및)/.test(gap)) group.unshift(before[k]);
      else break;
    }
    var out = [];
    group.forEach(function (mm) { out = out.concat(mm.persons); });
    return uniq(out);
  }

  function years(text) {
    var out = [], re = /(\d{4})\s*년(?!생)/g, mm;
    while ((mm = re.exec(text))) out.push(+mm[1]);
    return out;
  }

  Parser.prototype.clause = function (text) {
    var m = this.m, self = this;
    this.effects = 0;
    var mentions = this.scan(text);
    var parts = [];
    mentions.forEach(function (mm) { if (!mm.possessive) parts = parts.concat(mm.persons); });
    parts = uniq(parts);
    var client = F.clientOf(m);
    var pendingChoice = false;

    // 주어가 빠진 "어머니와 갈등이 있다" → 내담자가 주어
    var subjectExplicit = mentions.length && /^\s*(은|는|이|가|께서)/.test(text.slice(mentions[0].end));
    var withFirst = mentions.length && /^\s*(와|과|랑|이랑|하고)/.test(text.slice(mentions[0].end));
    var people = parts.filter(function (p) { return p.kind === 'person'; });
    if (people.length === 1 && client && people[0] !== client && withFirst && !subjectExplicit) {
      people = [client, people[0]];
    }

    // ── 정서적 관계
    var relType = null, ambig = null;
    for (var a = 0; a < AMBIG_REL.length; a++) if (AMBIG_REL[a][0].test(text)) { ambig = AMBIG_REL[a]; break; }
    for (var r = 0; r < CLEAR_REL.length; r++) if (CLEAR_REL[r][1].test(text)) { relType = CLEAR_REL[r][0]; break; }
    if (relType === 'close' && /갈등|다투|충돌|싸우/.test(text)) relType = 'closeConflict';
    if (relType === 'fused' && /갈등|다투|충돌|싸우/.test(text)) relType = 'fusedConflict';
    if (relType === 'conflict' && /사이가 ?좋|친밀|가깝|가까/.test(text)) relType = 'closeConflict';
    if (relType === 'conflict' && /밀착|융합|의존/.test(text)) relType = 'fusedConflict';
    if (ambig) {
      if (relType && relType !== 'close') ambig = null;                       // 분명한 말이 있으면 그것을 따른다
      else if (ambig[2] === '가깝다' && relType === 'close') ambig = null;      // "친밀하고 가깝다"
    }
    if (ambig) relType = null;

    if ((relType || ambig) && people.length >= 2) {
      var first = people[0], others = people.slice(1);
      var passive = PASSIVE_RE.test(text);
      var fearful = ambig && ambig[2] === '두려움';
      var note = SOURCE_RE.test(text) ? '진술' : '';
      var tentative = TENTATIVE_RE.test(text);
      var sub = null;
      if (/성추행|성폭|성적|추행/.test(text)) sub = 'sexual';
      else if (/정서적|폭언|모욕|위협/.test(text)) sub = 'emotional';
      else if (/방임|돌보지 ?않/.test(text)) sub = 'neglect';
      else if (/폭행|폭력|때리|때렸|구타|신체/.test(text)) sub = 'physical';
      others.forEach(function (o) {
        var from = first, to = o;
        if (passive || fearful) { from = o; to = first; }
        var type = relType;
        if (ambig) {
          var key = 'rel|' + ambig[2] + '|' + [first.key || first.id, o.key || o.id].join('~');
          var value = self.choose({
            key: key, kind: 'relation', text: text,
            question: F.displayName(first) + ' ↔ ' + F.displayName(o) + '의 관계를 골라 주세요',
            options: ambig[1].map(function (t) { return [t, F.REL[t].label]; }).concat([['none', '선 긋지 않음']]),
            def: null
          });
          if (!value) { pendingChoice = true; return; }
          if (value === 'none') { self.effects++; return; }
          type = value;
        }
        if (F.addRelation(m, from.id, to.id, type, { sub: type === 'abuse' ? (sub || 'physical') : null, note: note, tentative: tentative })) self.effects++;
      });
    }

    // ── 부부 관계
    var status = null;
    if (/이혼/.test(text)) status = 'divorced';
    else if (/별거/.test(text)) status = 'separated';
    else if (/동거|사실혼/.test(text) && !HOUSE_RE.test(text)) status = 'cohabit';
    else if (/결혼|혼인|재혼/.test(text)) status = 'married';
    var splitUp = /헤어졌|헤어진|헤어지/.test(text);
    if ((status || splitUp) && parts.length) {
      var u = null;
      var ppl = parts.filter(function (p) { return p.kind === 'person'; });
      for (var x = 0; x < ppl.length && !u; x++) for (var y = x + 1; y < ppl.length && !u; y++) {
        var shared = F.unionsOf(m, ppl[x].id).filter(function (uu) { return F.partnerIn(uu, ppl[x].id) === ppl[y].id; })[0];
        if (shared) u = shared;
      }
      if (!u && ppl.length === 1) {
        var p0 = ppl[0];
        var us = F.unionsOf(m, p0.id).filter(function (uu) { return F.partnerIn(uu, p0.id); });
        if (/재혼/.test(text)) {
          var prevPartner = us.length ? F.partnerIn(us[0], p0.id) : null;
          var parentsOfClient = client ? F.parentsOf(m, client.id) : [];
          var otherBio = parentsOfClient.filter(function (q) { return q.id !== p0.id; })[0];
          u = F.unionsOf(m, p0.id).filter(function (uu) { var pp = F.partnerIn(uu, p0.id); return pp && pp !== (otherBio && otherBio.id) && pp !== prevPartner; })[0];
          if (!u) {
            var np = this.mk({ key: p0.key + '>RE', gender: p0.gender === 'M' ? 'F' : p0.gender === 'F' ? 'M' : 'U', implied: true,
              label: F.displayName(p0) + '의 재혼 배우자' });
            u = F.addUnion(m, p0.id, np.id, 'married');
          }
        } else if (us.length) {
          us.sort(function (a1, b1) { return b1.seq - a1.seq; });
          u = us[0];
        } else if (p0.client) {
          var ex = this.mk({ key: 'C>SP', gender: p0.gender === 'M' ? 'F' : p0.gender === 'F' ? 'M' : 'U', implied: true, label: '배우자' });
          u = F.addUnion(m, p0.id, ex.id, 'married');
        }
      }
      if (u) {
        if (splitUp && !status) {
          var v = this.choose({
            key: 'union|' + [u.a, u.b].map(function (id) { var q = F.person(m, id); return q && (q.key || q.id); }).join('~'),
            kind: 'union', text: text,
            question: F.displayName(F.person(m, u.a)) + ' · ' + F.displayName(F.person(m, u.b)) + '는 어떻게 헤어졌나요?',
            options: [['separated', '별거'], ['divorced', '이혼'], ['none', '그대로 두기']], def: null
          });
          if (!v) pendingChoice = true;
          else if (v !== 'none') status = v;
        }
        if (status && /재혼/.test(text) && !/이혼|별거/.test(text)) status = 'married';
        if (status) {
          u.status = status;
          var ys = years(text);
          if (ys.length) {
            if (ys.length >= 2) { u.start = ys[0]; u.end = ys[ys.length - 1]; }
            else if (status === 'divorced' || status === 'separated') u.end = ys[0];
            else u.start = ys[0];
          }
          this.effects++;
        }
      }
    }

    // ── 사망
    var dm = DEATH_RE.exec(text);
    if (dm && parts.length) {
      var dead = subjectGroup(text, mentions, dm.index);
      if (!dead.length) dead = parts.slice(0, 1);
      var dy = years(text);
      var da = /(\d{1,3})\s*(세|살)에/.exec(text);
      dead.forEach(function (p) {
        if (!p.deceased) { p.deceased = true; self.effects++; }
        if (dy.length && dead.length === 1) { p.deathYear = dy[dy.length - 1]; self.effects++; }
        if (da && dead.length === 1 && p.age == null) { p.age = +da[1]; self.effects++; }
      });
    }

    // ── 임신·유산·사산·임신중절
    var preg = null;
    if (/임신 ?중절|낙태/.test(text)) preg = 'abortion';
    else if (/사산/.test(text)) preg = 'stillbirth';
    else if (/자연 ?유산|유산(을)? ?(했|경험|되|됐|하였)/.test(text)) preg = 'miscarriage';
    else if (/임신 ?중|임신했|임신하였|임신 ?\d+ ?주/.test(text)) preg = 'pregnancy';
    if (preg && people.length) {
      var mother = people[0];
      var pu = F.childUnion(m, mother.id);
      var py = years(text);
      var pkey = (mother.key || mother.id) + '>' + preg + (py[0] || '');
      if (!m.persons.some(function (q) { return q.key === pkey; })) {
        var pp = this.mk({ key: pkey, kind: preg, label: F.KIND[preg], birthYear: py[0] || null });
        F.addLink(m, pu.id, pp.id, 'bio');
      }
    }

    // ── 쌍둥이 자녀 ("쌍둥이 아들이 있다")
    var tw = /(일란성 |이란성 )?쌍둥이 ?(아들|딸|자녀)/.exec(text);
    if (tw && !mentions.some(function (mm) { return /쌍둥이/.test(mm.word || ''); })) {
      var parent = people.filter(function (p) { return !/^(아들|딸|자녀)$/.test(p.label); })[0] || client || this.client();
      var cu2 = F.childUnion(m, parent.id);
      var g = tw[2] === '아들' ? 'M' : tw[2] === '딸' ? 'F' : 'U';
      var twKey = (parent.key || parent.id) + '>TW:' + tw[2];
      var have = m.persons.filter(function (q) { return q.key && q.key.indexOf(twKey) === 0; });
      // 앞서 '아들'로 만든 한 명이 있으면 그 사람을 쌍둥이 첫째로 쓴다
      var single = people.filter(function (p) { return p.label === tw[2] || p.label === F.displayName(parent) + '의 ' + tw[2]; })[0];
      if (have.length < 2) {
        var t1 = single || this.mk({ key: twKey + '1', gender: g, label: '쌍둥이 ' + tw[2] });
        if (single) { single.key = twKey + '1'; single.label = '쌍둥이 ' + tw[2]; }
        var t2 = this.mk({ key: twKey + '2', gender: g, label: '쌍둥이 ' + tw[2] });
        if (!F.linkOf(m, t1.id)) F.addLink(m, cu2.id, t1.id, 'bio');
        F.addLink(m, cu2.id, t2.id, 'bio');
        var l1 = F.linkOf(m, t1.id), l2 = F.linkOf(m, t2.id);
        l1.twin = l2.twin = 't' + l1.id;
        if (tw[1] === '일란성 ') l1.identical = l2.identical = true;
      }
    }

    // ── 함께 사는 가족
    if (HOUSE_RE.test(text) && parts.length) {
      var members = parts.filter(function (p) { return p.kind === 'person' || p.kind === 'pet'; });
      if (client && members.indexOf(client) < 0 && !subjectExplicit) members.unshift(client);
      members.forEach(function (p) { if (m.household.indexOf(p.id) < 0) { m.household.push(p.id); self.effects++; } });
    }

    // ── 한 사람만 나오는 문장의 나이·성별·출생연도
    if (people.length === 1 && parts.length === 1) {
      var p1 = people[0];
      var am = /(?:^|[^\d])(\d{1,3})\s*(?:세|살)(?!에)/.exec(text);
      if (am && p1.age == null) { p1.age = parseInt(am[1], 10); this.effects++; }
      var by = /(\d{4})\s*년생/.exec(text);
      if (by && !p1.birthYear) { p1.birthYear = +by[1]; this.effects++; }
      if (/(^|\s)(남자|남성|남학생|남아)/.test(text) && p1.gender !== 'M') { p1.gender = 'M'; this.effects++; }
      if (/(^|\s)(여자|여성|여학생|여아)/.test(text) && p1.gender !== 'F') { p1.gender = 'F'; this.effects++; }
    }

    var st, hint = '';
    if (pendingChoice) { st = 'choice'; hint = '해석이 갈리는 표현이 있어요. 아래에서 골라 주세요.'; }
    else if (this.effects > 0) st = 'ok';
    else if (parts.length) {
      st = 'partial';
      var who = parts.map(F.displayName).join(', ');
      hint = people.length >= 2
        ? who + ' 사이의 관계를 나타내는 말(갈등, 친밀, 밀착, 소원, 단절, 폭력, 이혼 등)을 찾지 못했어요.'
        : who + '은(는) 찾았지만, 가계도에 더할 내용(이름, 나이, 성별, 사망, 관계)은 찾지 못했어요.';
    } else {
      st = 'none';
      hint = '사람을 찾지 못했어요. 내담자, 아버지, 누나처럼 관계를 나타내는 말이나 앞에서 소개한 이름을 넣어 주세요.';
    }
    m.lines.push({ text: text, status: st, hint: hint });
  };

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

  function parse(text, answers) {
    var P = new Parser(answers);
    splitClauses(text || '').forEach(function (c) { P.clause(c); });
    var m = P.m;
    var client = F.clientOf(m);
    if (!client && m.persons.length) client = F.addPerson(m, { client: true, key: 'C', label: '내담자', implied: true });
    if (client && client.gender === 'U' && P.clientGenderHint) client.gender = P.clientGenderHint;
    // 성별 모르는 배우자는 내담자와 다른 성별로 두지 않는다(추정 금지). 그대로 둔다.
    F.cleanup(m);
    return m;
  }

  global.GenogramParser = { parse: parse, splitClauses: splitClauses };
})(typeof window !== 'undefined' ? window : globalThis);
