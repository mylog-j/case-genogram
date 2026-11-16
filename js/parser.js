/*
 * 한글 사례 문장 → 가족 모델
 * 모든 처리는 브라우저 안에서만 한다. 네트워크 요청 없음.
 *
 * parse(text, answers) — answers 는 '골라 주세요' 카드에서 고른 값 { 선택키: 값 }
 *
 * 가족 호칭은 "누구의 → 누구" 길(path)로 읽는다.
 *   F 아버지, M 어머니
 *   B 남자 형제, Z 여자 형제, X 형제자매  (+ 손위, - 손아래)
 *   H 남편, W 아내, SP 배우자, EXH/EXW/EX 전 배우자, CO 동거 상대
 *   H* 또는 W* 부모의 다른 배우자(새아버지·새어머니)
 *   S 아들, D 딸, K 자녀,  S* D* K* 배우자의 다른 결합에서 난 자녀(의붓자녀)
 * 예) 형부 = Z+>H (언니의 남편), 당숙 = F>F>B>S (아버지의 사촌 형제)
 * 뜻은 표준국어대사전으로 확인했다(당숙·종조부·대고모·이모할머니·진외가·생질·당질·재종 등).
 */
(function (global) {
  'use strict';

  var F = global.FamilyModel;

  // ── 호칭 사전 ───────────────────────────────────────────
  // [낱말, 길 또는 설정]. 같은 길이 여러 번 나오면 맨 앞 낱말이 그 자리의 기본 이름이 된다.
  var KIN = [
    // 부모
    ['아버지', 'F'], ['부', 'F'], ['父', 'F'], ['모', 'M'], ['母', 'M'], ['아빠', 'F'], ['부친', 'F'], ['친부', 'F'], ['생부', 'F'], ['친아버지', 'F'],
    ['어머니', 'M'], ['엄마', 'M'], ['모친', 'M'], ['친모', 'M'], ['생모', 'M'], ['친어머니', 'M'],
    ['양아버지', { p: 'F', adopt: true }], ['양부', { p: 'F', adopt: true }],
    ['양어머니', { p: 'M', adopt: true }], ['양모', { p: 'M', adopt: true }],
    ['친아빠', 'F'], ['친엄마', 'M'], ['생물학적 아버지', 'F'], ['생물학적 어머니', 'M'],
    ['양아빠', { p: 'F', adopt: true }], ['양엄마', { p: 'M', adopt: true }],
    ['새아버지', 'M>H*'], ['계부', 'M>H*'], ['의붓아버지', 'M>H*'], ['새아빠', 'M>H*'], ['의붓아빠', 'M>H*'],
    ['새 아버지', 'M>H*'], ['새 아빠', 'M>H*'],
    ['새어머니', 'F>W*'], ['계모', 'F>W*'], ['의붓어머니', 'F>W*'], ['새엄마', 'F>W*'], ['의붓엄마', 'F>W*'],
    ['새 어머니', 'F>W*'], ['새 엄마', 'F>W*'],

    // 조부모 이상 (친가)
    ['친할아버지', 'F>F'], ['조부', 'F>F'], ['친조부', 'F>F'],
    ['친할머니', 'F>M'], ['조모', 'F>M'], ['친조모', 'F>M'],
    ['증조할아버지', 'F>F>F'], ['증조부', 'F>F>F'], ['증조할머니', 'F>F>M'], ['증조모', 'F>F>M'],
    ['고조할아버지', 'F>F>F>F'], ['고조부', 'F>F>F>F'], ['고조할머니', 'F>F>F>M'], ['고조모', 'F>F>F>M'],
    // 외가
    ['외할아버지', 'M>F'], ['외조부', 'M>F'], ['외할머니', 'M>M'], ['외조모', 'M>M'],
    ['외증조할아버지', 'M>F>F'], ['외증조부', 'M>F>F'], ['외증조할머니', 'M>F>M'], ['외증조모', 'M>F>M'],
    ['외고조할아버지', 'M>F>F>F'], ['외고조할머니', 'M>F>F>M'],
    // 진외가 (아버지의 외가)
    ['진외할아버지', 'F>M>F'], ['진외할머니', 'F>M>M'],

    // 조부모의 형제
    ['큰할아버지', 'F>F>B+'], ['작은할아버지', 'F>F>B-'], ['종조부', 'F>F>B'], ['종조할아버지', 'F>F>B'],
    ['큰할머니', 'F>F>B+>W'], ['작은할머니', 'F>F>B->W'], ['종조모', 'F>F>B>W'], ['종조할머니', 'F>F>B>W'],
    ['고모할머니', 'F>F>Z'], ['대고모', 'F>F>Z'], ['왕고모', 'F>F>Z'], ['고모할아버지', 'F>F>Z>H'],
    ['큰외할아버지', 'M>F>B+'], ['작은외할아버지', 'M>F>B-'], ['외종조부', 'M>F>B'],
    ['큰외할머니', 'M>F>B+>W'], ['작은외할머니', 'M>F>B->W'],

    // 부모의 형제와 그 배우자
    ['큰아버지', 'F>B+'], ['백부', 'F>B+'], ['큰어머니', 'F>B+>W'], ['백모', 'F>B+>W'],
    ['작은아버지', 'F>B-'], ['숙부', 'F>B-'], ['작은어머니', 'F>B->W'], ['숙모', 'F>B->W'],
    ['고모', 'F>Z'], ['고모부', 'F>Z>H'],
    ['외삼촌', 'M>B'], ['외숙부', 'M>B'], ['외숙모', 'M>B>W'],
    ['이모', 'M>Z'], ['이모부', 'M>Z>H'],
    // 부모의 사촌
    ['당숙', 'F>F>B>S'], ['종숙', 'F>F>B>S'], ['당숙모', 'F>F>B>S>W'], ['당고모', 'F>F>B>D'],
    ['외당숙', 'M>F>B>S'], ['외당숙모', 'M>F>B>S>W'],

    // 사촌·육촌
    ['친사촌', 'F>B>K'], ['고종사촌', 'F>Z>K'], ['이종사촌', 'M>Z>K'], ['외사촌', 'M>B>K'],
    ['육촌', 'F>F>B>K>K'], ['재종', 'F>F>B>K>K'],

    // 형제와 그 배우자
    ['오빠', { p: 'B+', cg: 'F' }], ['언니', { p: 'Z+', cg: 'F' }], ['누나', { p: 'Z+', cg: 'M' }], ['형', { p: 'B+', cg: 'M' }],
    ['남동생', 'B-'], ['여동생', 'Z-'], ['동생', 'X-'],
    ['형부', { p: 'Z+>H', cg: 'F' }], ['매형', { p: 'Z+>H', cg: 'M' }], ['자형', { p: 'Z+>H', cg: 'M' }],
    ['제부', { p: 'Z->H', cg: 'F' }], ['매제', { p: 'Z->H', cg: 'M' }],
    ['올케', { p: 'B>W', cg: 'F' }], ['형수', { p: 'B+>W', cg: 'M' }], ['제수', { p: 'B->W', cg: 'M' }], ['계수', { p: 'B->W', cg: 'M' }],
    // 조카
    ['생질녀', 'Z>D'], ['생질', 'Z>S'], ['조카딸', 'X>D'], ['질녀', 'X>D'], ['조카며느리', 'X>S>W'], ['조카사위', 'X>D>H'], ['조카', 'X>K'],
    ['당질녀', 'F>B>K>D'], ['당질', 'F>B>K>S'], ['종질', 'F>B>K>S'],

    // 배우자
    ['남편', 'H'], ['아내', 'W'], ['부인', 'W'], ['와이프', 'W'], ['배우자', 'SP'],
    ['전남편', 'EXH'], ['전처', 'EXW'], ['전부인', 'EXW'], ['전아내', 'EXW'], ['전배우자', 'EX'], ['전 배우자', 'EX'],
    ['동거인', 'CO'], ['동거남', { p: 'CO', g: 'M' }], ['동거녀', { p: 'CO', g: 'F' }],
    // 시댁
    ['시아버지', 'H>F'], ['시어머니', 'H>M'], ['시할아버지', 'H>F>F'], ['시할머니', 'H>F>M'],
    ['시아주버니', 'H>B+'], ['아주버님', 'H>B+'], ['시숙', 'H>B+'],
    ['도련님', 'H>B-'], ['시동생', 'H>B-'],
    ['시누이', 'H>Z'], ['시누', 'H>Z'], ['아가씨', 'H>Z-'],
    // 처가
    ['장인', 'W>F'], ['장모', 'W>M'], ['처조부', 'W>F>F'], ['처조모', 'W>F>M'],
    ['처형', 'W>Z+'], ['처제', 'W>Z-'], ['처남댁', 'W>B>W'], ['처남', 'W>B'],

    // 자녀
    ['입양한 아들', { p: 'S', link: 'adopted' }], ['입양한 딸', { p: 'D', link: 'adopted' }],
    ['입양아', { p: 'K', link: 'adopted' }], ['양자', { p: 'S', link: 'adopted' }], ['양녀', { p: 'D', link: 'adopted' }],
    ['위탁아동', { p: 'K', link: 'foster' }],
    ['의붓아들', 'SP>S*'], ['의붓딸', 'SP>D*'], ['의붓자녀', 'SP>K*'],
    ['장남', { p: 'S', rank: 1 }], ['큰아들', { p: 'S', rank: 1 }], ['차남', { p: 'S', rank: 2 }], ['작은아들', { p: 'S', rank: 2 }],
    ['장녀', { p: 'D', rank: 1 }], ['큰딸', { p: 'D', rank: 1 }], ['차녀', { p: 'D', rank: 2 }], ['작은딸', { p: 'D', rank: 2 }],
    ['막내아들', { p: 'S', rank: 99 }], ['막내딸', { p: 'D', rank: 99 }],
    ['첫째 아들', { p: 'S', rank: 1 }], ['둘째 아들', { p: 'S', rank: 2 }], ['셋째 아들', { p: 'S', rank: 3 }],
    ['첫째 딸', { p: 'D', rank: 1 }], ['둘째 딸', { p: 'D', rank: 2 }], ['셋째 딸', { p: 'D', rank: 3 }],
    ['외아들', 'S'], ['외동딸', 'D'],
    ['아들', 'S'], ['딸', 'D'], ['자녀', 'K'],
    // 자녀의 배우자·손주
    ['며느리', 'S>W'], ['사위', 'D>H'],
    ['친손자', 'S>S'], ['친손녀', 'S>D'], ['외손자', 'D>S'], ['외손녀', 'D>D'],
    ['손자', 'K>S'], ['손녀', 'K>D'], ['손주', 'K>K'],
    ['증손자', 'K>K>S'], ['증손녀', 'K>K>D']
  ];

  // 뜻이 갈리는 호칭 → 고르기 (값은 길)
  var KIN_CHOICE = [
    ['할아버지', { q: '할아버지는 어느 쪽인가요?', opts: [['F>F', '친가'], ['M>F', '외가']], def: 'F>F', side: true }],
    ['할머니', { q: '할머니는 어느 쪽인가요?', opts: [['F>M', '친가'], ['M>M', '외가']], def: 'F>M', side: true }],
    ['이모할머니', { q: '이모할머니는 누구인가요?', opts: [['F>M>Z', '아버지의 이모(친할머니의 자매)'], ['M>M>Z', '어머니의 이모(외할머니의 자매)']], def: 'F>M>Z' }],
    ['이모할아버지', { q: '이모할아버지는 누구인가요?', opts: [['F>M>Z>H', '친할머니 자매의 남편'], ['M>M>Z>H', '외할머니 자매의 남편']], def: 'F>M>Z>H' }],
    ['삼촌', { q: '삼촌은 누구인가요?', opts: [['F>B', '아버지의 남자 형제'], ['M>B', '외삼촌(어머니의 남자 형제)']], def: 'F>B' }],
    ['사촌', { q: '사촌은 어느 쪽인가요?', opts: [['F>B>K', '친사촌(큰아버지·작은아버지의 자녀)'], ['F>Z>K', '고종사촌(고모의 자녀)'], ['M>Z>K', '이종사촌(이모의 자녀)'], ['M>B>K', '외사촌(외삼촌의 자녀)']], def: null }],
    ['형님', { q: '형님은 누구인가요?', opts: [['B+', '손위 형'], ['H>Z+', '남편의 누나'], ['H>B+>W', '남편 형의 아내(손위 동서)']], def: 'B+' }],
    ['동서', { q: '동서는 누구인가요?', opts: [['H>B>W', '남편 형제의 아내'], ['W>Z>H', '아내 자매의 남편']], def: null }],
    ['서방님', { q: '서방님은 누구인가요?', opts: [['H', '남편'], ['H>B-', '남편의 남동생(결혼한 시동생)'], ['H>Z->H', '손아래 시누이의 남편']], def: 'H' }],
    ['아버님', { q: '아버님은 누구인가요?', opts: [['F', '아버지'], ['H>F', '시아버지'], ['W>F', '장인']], def: null }],
    ['어머님', { q: '어머님은 누구인가요?', opts: [['M', '어머니'], ['H>M', '시어머니'], ['W>M', '장모']], def: null }],
    ['조부모', { q: '조부모는 어느 쪽인가요?', opts: [['F>F,F>M', '친가'], ['M>F,M>M', '외가']], def: 'F>F,F>M', side: true }]
  ];

  var GROUPS = [
    ['부모님', 'F,M'], ['부모', 'F,M'], ['양부모', 'F,M', true],
    ['친조부모', 'F>F,F>M'], ['외조부모', 'M>F,M>M'],
    ['시부모', 'H>F,H>M'], ['처부모', 'W>F,W>M']
  ];

  var OTHER = [
    ['내담자', { t: 'self' }], ['클라이언트', { t: 'self' }], ['본인', { t: 'self' }],
    ['CL', { t: 'self' }], ['Cl', { t: 'self' }], ['클라', { t: 'self' }], ['대상자', { t: 'self' }], ['이용자', { t: 'self' }],
    ['대상아동', { t: 'self' }], ['대상 아동', { t: 'self' }], ['내담아동', { t: 'self' }], ['아동', { t: 'self' }],
    ['반려견', { t: 'pet', species: '반려견' }], ['강아지', { t: 'pet', species: '반려견' }],
    ['반려묘', { t: 'pet', species: '반려묘' }], ['고양이', { t: 'pet', species: '반려묘' }],
    ['반려동물', { t: 'pet', species: '반려동물' }],
    ['부부', { t: 'couple' }]
  ];

  // 이복·이부·쌍둥이·사촌 형제 낱말 만들기
  var SIB_BASE = [['형', 'B+'], ['오빠', 'B+'], ['누나', 'Z+'], ['언니', 'Z+'], ['남동생', 'B-'], ['여동생', 'Z-'], ['동생', 'X-']];
  var HALF = [], TWIN = [];
  // 아버지만 같은(이복) · 어머니만 같은(이부) · 새부모가 데려온(의붓) 형제
  var HALF_P = ['이복', '이복 ', '배다른 ', '배다른', '어머니가 다른 ', '엄마가 다른 ', '어머니 다른 ', '엄마 다른 '];
  var HALF_M = ['이부', '이부 ', '씨다른 ', '씨다른', '아버지가 다른 ', '아빠가 다른 ', '아버지 다른 ', '아빠 다른 '];
  var STEP_SIB = ['의붓', '의붓 '];
  SIB_BASE.forEach(function (s) {
    var g = s[1][0] === 'B' ? 'M' : s[1][0] === 'Z' ? 'F' : 'U', ord = s[1].slice(-1) === '+' ? 'older' : 'younger';
    HALF_P.forEach(function (pre) { HALF.push([pre + s[0], { t: 'half', side: 'P', g: g, order: ord }]); });
    HALF_M.forEach(function (pre) { HALF.push([pre + s[0], { t: 'half', side: 'M', g: g, order: ord }]); });
    STEP_SIB.forEach(function (pre) { HALF.push([pre + s[0], { t: 'stepsib', g: g, order: ord }]); });
    TWIN.push(['쌍둥이 ' + s[0], { p: s[1], twin: true }], ['일란성 쌍둥이 ' + s[0], { p: s[1], twin: true, identical: true }]);
    ['친사촌', '고종사촌', '이종사촌', '외사촌'].forEach(function (c) {
      var base = KIN.filter(function (k) { return k[0] === c; })[0][1];
      var tail = base.slice(0, -1) + (g === 'M' ? 'S' : g === 'F' ? 'D' : 'K');
      KIN.push([c + ' ' + s[0], tail], [c + s[0], tail]);
    });
    KIN_CHOICE.push(['사촌 ' + s[0], { q: '사촌은 어느 쪽인가요?', g: g, opts: [['F>B>K', '친사촌'], ['F>Z>K', '고종사촌'], ['M>Z>K', '이종사촌'], ['M>B>K', '외사촌']], def: null }]);
  });
  [['형제', 'U'], ['남매', 'U'], ['자매', 'F'], ['형제자매', 'U']].forEach(function (w) {
    ['이복', '이복 ', '배다른 '].forEach(function (pre) { HALF.push([pre + w[0], { t: 'half', side: 'P', g: w[1], order: null }]); });
    ['이부', '이부 ', '씨다른 '].forEach(function (pre) { HALF.push([pre + w[0], { t: 'half', side: 'M', g: w[1], order: null }]); });
    STEP_SIB.forEach(function (pre) { HALF.push([pre + w[0], { t: 'stepsib', g: w[1], order: null }]); });
  });

  var LEX = [];
  KIN.concat(TWIN).forEach(function (w) {
    var s = typeof w[1] === 'string' ? { p: w[1] } : w[1];
    LEX.push({ word: w[0], spec: Object.assign({ t: 'path' }, s) });
  });
  KIN_CHOICE.forEach(function (w) { LEX.push({ word: w[0], spec: Object.assign({ t: 'choice' }, w[1]) }); });
  GROUPS.forEach(function (w) { LEX.push({ word: w[0], spec: { t: 'group', ps: w[1].split(','), adopt: !!w[2] } }); });
  OTHER.concat(HALF).forEach(function (w) { LEX.push({ word: w[0], spec: w[1] }); });
  LEX.sort(function (a, b) { return b.word.length - a.word.length; });

  // 길 → 기본 이름 (중간 사람 이름 붙이기)
  var PATH_LABEL = {};
  KIN.forEach(function (w) {
    var p = typeof w[1] === 'string' ? w[1] : w[1].p;
    if (!PATH_LABEL[p] && !/ /.test(w[0])) PATH_LABEL[p] = w[0];
  });
  var SEG_LABEL = { F: '아버지', M: '어머니', B: '남자 형제', Z: '여자 형제', X: '형제자매', H: '남편', W: '아내', SP: '배우자',
    EXH: '전남편', EXW: '전처', EX: '전 배우자', CO: '동거 상대', 'H*': '다른 배우자', 'W*': '다른 배우자', S: '아들', D: '딸', K: '자녀',
    'S*': '아들', 'D*': '딸', 'K*': '자녀' };

  // ── 관계 표현 ───────────────────────────────────────────
  var CLEAR_REL = [
    ['abuse', /학대|폭력|폭행|때리|때린|때렸|구타|성추행|성폭|추행|폭언|방임|방치|맞았|맞고 ?자|맞는다|맞아 ?왔/],
    ['cutoff', /단절|연락이 ?끊|연락을 ?끊|왕래가? ?없|왕래하지 ?않|연락 ?두절|의절|절연/],
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
  var AMBIG_REL = [
    [/사이가 ?(안 ?좋|나쁘|좋지 ?않)/, ['conflict', 'hostile', 'distant', 'cutoff'], '사이가 안 좋다'],
    [/연락이 ?뜸|연락을? ?(거의 )?(안 ?하|하지 ?않)|연락이 ?(거의 )?없/, ['distant', 'cutoff'], '연락'],
    [/멀어졌|멀어진|멀어지/, ['distant', 'cutoff'], '멀어짐'],
    [/어색/, ['distant'], '어색하다'],
    [/집착/, ['fused', 'control'], '집착'],
    [/없이는 ?(아무것도 )?못/, ['fused', 'care'], '의존'],
    [/무서워|두려워/, ['abuse', 'conflict'], '두려움'],
    [/훈육이 ?심|체벌/, ['abuse', 'conflict'], '훈육'],
    [/가깝|가까/, ['close', 'fused'], '가깝다']
  ];
  // '작고'는 "작고하다/작고했다/작고한"일 때만 사망 ("갈등 관계를 작고 있음" 같은 오타는 사망이 아님)
  var DEATH_RE = /사망|돌아가|별세|작고 ?(하|했|한|함|하였|하셨)|세상을 ?떠|숨졌|숨지/;
  // 당한 쪽에서 쓴 문장: "아버지에게 맞았다", "어머니로부터 방임되었다", "삼촌에 의해 학대받았다"
  var PASSIVE_RE = /당했|당함|당하|당해|받았|받음|받고|받는|맞았|맞고|맞는|맞아|로부터|에 ?의해|(방임|방치|학대|폭행)(되었|됐|되어|돼)/;
  var SOURCE_RE = /진술|라고 ?(했|말했|함|한다)|주장/;
  var TENTATIVE_RE = /의심|추정|것 ?같/;
  var HOUSE_RE = /(함께|같이) ?(살|산다|거주|생활)|한집에|(와|과|랑|이랑|하고)\s*(단둘이\s*|둘이\s*|셋이\s*|넷이\s*)?(살고|살며|살아|산다|삽니다|살고있|거주|생활하|생활 ?중|지내고|지낸다)/;
  // 자주 나오는 오타 바로잡기
  // "Cl.은"의 마침표가 문장 끝으로 읽히지 않게
  var TYPOS = [[/\b(CL|Cl|cl)\.(?=\s*[은는이가과와의도에])/g, 'CL'], [/제혼/g, '재혼'], [/이북(\s?)(형|오빠|누나|언니|남동생|여동생|동생|형제|남매|자매)/g, '이복$1$2'], [/이뷰(\s?)(형|오빠|누나|언니|남동생|여동생|동생|형제)/g, '이부$1$2'], [/어미니/g, '어머니'], [/아부지/g, '아버지'], [/할머님/g, '할머니'], [/할아버님/g, '할아버지']];
  // 주어 바로 뒤의 성별 낱말 ("클라이언트는 10세 여자아동으로")
  var GENDER_F = /(여자|여성|여아|여학생|소녀|여중생|여고생|여대생)/, GENDER_M = /(남자|남성|남아|남학생|소년|남중생|남고생|남대생)/;
  var HAVE_RE = /(이|가)\s*([가-힣]+\s*)?(한|두|세|네|\d+)?\s*(명)?\s*(씩\s*)?(있|없)/;

  var SURNAMES = '김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부';
  var DOUBLE_SURNAMES = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문'];
  var STOPWORDS = ['공무원', '회사원', '사업가', '사무직', '자영업', '주부', '전업주부', '교사', '강사', '노동자',
    '노숙인', '수급자', '장애인', '한부모', '정신과', '우울증', '조현병', '고혈압', '공황장애',
    '고등학생', '중학생', '초등학생', '대학생', '고등학교', '중학교', '재수생', '무직', '군인', '간호사', '의사',
    '사망', '이혼', '별거', '결혼', '재혼', '함께', '모두', '현재', '당시', '최근', '매우', '자주', '각각', '서로',
    '막내', '외동', '주양육자', '양육자', '보호자', '가장', '정도', '이후', '이전',
    '입양', '위탁', '쌍둥이', '일란성', '이란성', '동거', '임신', '유산', '사산'];

  var PREV_OK = /[\s,.()\[\]·"'“”‘’\-~:;!?]/;
  var NEXT_OK = /[\s,.()\[\]·"'“”‘’\-~:;!?은는이가과와도의을를랑에하께님로한]/;

  // ── 도우미 ──────────────────────────────────────────────
  function aliases(name) {
    var out = [name];
    if (/^[가-힣]{3,4}$/.test(name)) {
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
  // 학년 → 만 나이(그해 생일이 지난 나이): 초n = n+6, 중n = n+12, 고n = n+15
  var GRADE_RE = /(초등학교|초등학생|초등|중학교|중학생|고등학교|고등학생|고교)\s*(\d)\s*학년|(?:^|[^가-힣\d])(초|중|고)\s?(\d)(?![\d년세살명])/;
  function gradeOf(s) {
    var g = GRADE_RE.exec(s || '');
    if (!g) return null;
    var lv = (g[1] || g[3])[0], n = +(g[2] || g[4]);
    var max = lv === '초' ? 6 : 3;
    if (n < 1 || n > max) return null;
    return { grade: lv + n, age: n + (lv === '초' ? 6 : lv === '중' ? 12 : 15), index: g.index };
  }
  function applyGrade(p, s) {
    var gr = gradeOf(s);
    if (!gr) return false;
    var ch = false;
    if (!p.grade) { p.grade = gr.grade; ch = true; }
    if (p.age == null) { p.age = gr.age; ch = true; }
    return ch;
  }

  function parseParens(content) {
    var attrs = {};
    var gp = gradeOf(content);
    if (gp) { attrs.grade = gp.grade; attrs.gradeAge = gp.age; }
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

  function readNameAfter(text, j, m) {
    var rest = text.slice(j);
    var out = { end: j, name: '', attrs: {} };
    // 영문 머리글자 이름: "내담자 A는", "남편 B(50세)"
    var lm = /^(\s+)([A-Za-z]{1,3})(?![A-Za-z])(\s*씨)?(\s*\(([^)]*)\))?/.exec(rest);
    if (lm) {
      out.name = lm[2];
      out.end = j + lm[1].length + lm[2].length + (lm[3] ? lm[3].length : 0);
      if (lm[4]) { out.attrs = parseParens(lm[5]); out.end = j + lm[0].length; }
      return out;
    }
    var mm = /^(은|는|이|가|께서|의)?(\s*)([가-힣]{2,6})?(\s*\(([^)]*)\))?/.exec(rest);
    if (!mm) return out;
    var particle = mm[1] || '';
    if (particle === '의') return out;
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
    if (a.grade && !p.grade) { p.grade = a.grade; ch = true; }
    if (a.gradeAge != null && a.age == null && p.age == null) { p.age = a.gradeAge; ch = true; }
    if (a.birthYear && p.birthYear !== a.birthYear) { p.birthYear = a.birthYear; ch = true; }
    if (a.deceased && !p.deceased) { p.deceased = true; ch = true; }
    return ch;
  }

  function segInfo(seg) {
    var base = seg.replace(/[+\-]$/, ''), ord = seg.slice(-1) === '+' ? 'older' : seg.slice(-1) === '-' ? 'younger' : null;
    var g = { F: 'M', M: 'F', B: 'M', Z: 'F', X: 'U', H: 'M', W: 'F', SP: 'U', EXH: 'M', EXW: 'F', EX: 'U', CO: 'U',
      'H*': 'M', 'W*': 'F', S: 'M', D: 'F', K: 'U', 'S*': 'M', 'D*': 'F', 'K*': 'U' }[base];
    var kind = /^[FM]$/.test(base) ? 'parent' : /^[BZX]$/.test(base) ? 'sib' : /^(H|W|SP|EXH|EXW|EX|CO)$/.test(base) ? 'partner'
      : /\*$/.test(base) && /^[HW]/.test(base) ? 'step' : /\*$/.test(base) ? 'stepchild' : 'child';
    return { base: base, ord: ord, g: g, kind: kind };
  }

  // ── 해석기 ──────────────────────────────────────────────
  function Parser(answers) {
    this.m = F.create();
    this.answers = answers || {};
    this.clientGenderHint = null;
    this.sentence = { lastSubject: null, carry: null };
    this.warns = [];
  }

  Parser.prototype.client = function () {
    var c = F.clientOf(this.m);
    if (!c) { c = F.addPerson(this.m, { client: true, key: 'C', label: '내담자', implied: true }); this.effects++; }
    return c;
  };

  Parser.prototype.mk = function (props) { this.effects++; return F.addPerson(this.m, props); };

  Parser.prototype.choose = function (choice) {
    for (var i = 0; i < this.m.choices.length; i++) if (this.m.choices[i].key === choice.key) return this.m.choices[i].value;
    choice.value = Object.prototype.hasOwnProperty.call(this.answers, choice.key) ? this.answers[choice.key] : choice.def;
    this.m.choices.push(choice);
    return choice.value;
  };

  // 내담자 기준 길로 바꿔서 이름 찾기 (남편의 아버지 → 시아버지)
  function cpathOf(anchor, path) {
    if (anchor.client) return path;
    if (anchor.cpath) return anchor.cpath + '>' + path;
    return null;
  }
  function labelByCpath(cp) {
    if (!cp) return null;
    return PATH_LABEL[cp] || PATH_LABEL[cp.replace(/[+\-]/g, '')] || null;
  }

  Parser.prototype.labelOf = function (anchor, path) {
    var w = labelByCpath(cpathOf(anchor, path));
    if (w) return w;
    var segs = path.split('>'), last = segs[segs.length - 1];
    var prefix = segs.length > 1 ? this.labelOf(anchor, segs.slice(0, -1).join('>')) : (anchor.client ? '' : F.displayName(anchor));
    var tail = SEG_LABEL[last.replace(/[+\-]$/, '')] || '가족';
    if (/[+\-]$/.test(last) && /^[BZX]/.test(last)) tail = (last.slice(-1) === '+' ? '손위 ' : '손아래 ') + tail;
    return prefix ? prefix + '의 ' + tail : tail;
  };

  // 한 걸음: x 에서 seg 로 가는 사람을 찾거나 만든다
  Parser.prototype.step = function (nodes, seg, isFinal, key, label, name, word, clause) {
    var m = this.m, self = this, x = nodes[nodes.length - 1], info = segInfo(seg);
    function compat(c) {
      if (info.g !== 'U' && c.gender !== 'U' && c.gender !== info.g) return false;
      if (info.ord && c.order && c.order !== info.ord) return false;
      if (isFinal && name && c.name && c.name !== name) return false;
      return true;
    }
    function pick(cands) {
      var exact = cands.filter(function (c) { return c.key === key && !(isFinal && name && c.name && c.name !== name); });
      if (exact.length) return exact[0];
      if (isFinal && name) { var byN = cands.filter(function (c) { return c.name === name; })[0]; if (byN) return byN; }
      var ok = cands.filter(compat);
      var placeholders = ok.filter(function (c) { return c.implied; });
      if (placeholders.length) return placeholders[0];
      if (isFinal && ok.length) {
        // 같은 호칭을 다시 부른 경우("새아버지와 적대적이다")는 앞의 사람과 같은 사람
        if (!name) return ok.filter(function (c) { return c.label === label; })[0] || ok[0];
        var unnamed = ok.filter(function (c) { return !c.name; });
        return unnamed.filter(function (c) { return c.label === label; })[0] || unnamed[0] || null;
      }
      if (!isFinal && ok.length === 1) return ok[0];
      if (!isFinal && ok.length > 1) {
        var v = self.choose({
          key: 'via|' + word + '|' + (x.key || x.id) + '|' + seg, kind: 'via', text: clause,
          question: word + '는 누구 쪽인가요?', options: ok.map(function (c) { return [c.key || c.id, F.displayName(c)]; }), def: null
        });
        if (!v) return 'PENDING';
        return ok.filter(function (c) { return (c.key || c.id) === v; })[0] || ok[0];
      }
      return null;
    }
    function make(extra) {
      return self.mk(Object.assign({ key: key, gender: info.g, order: info.ord, label: label, implied: !isFinal }, extra || {}));
    }

    if (info.kind === 'parent') {
      var p = F.parentOf(m, x.id, info.g, null, false);
      if (p) { if (!p.key) p.key = key; return p; }
      p = F.parentOf(m, x.id, info.g, { key: key, label: label, implied: !isFinal }, true);
      if (p) this.effects++;
      return p;
    }
    if (info.kind === 'sib') {
      var sibs = F.siblingsOf(m, x.id);
      var s = pick(sibs);
      if (s === 'PENDING') return s;
      if (s) return s;
      // 앞에서 "이복 남동생"으로 소개한 사람을 뒤에서 "남동생"이라고만 불러도 같은 사람
      if (isFinal) {
        var halfs = [];
        F.parentsOf(m, x.id).forEach(function (pa) {
          F.unionsOf(m, pa.id).forEach(function (un) { halfs = halfs.concat(F.childrenOf(m, un.id)); });
        });
        var hs = halfs.filter(function (c) { return c.id !== x.id && c.kind === 'person' && sibs.indexOf(c) < 0 && compat(c) && c.label && c.label.slice(-label.length) === label; })[0];
        if (hs) return hs;
      }
      var u = F.ensureParentUnion(m, x.id);
      s = make();
      F.addLink(m, u.id, s.id, 'bio');
      return s;
    }
    if (info.kind === 'partner') {
      var wantEx = /^EX/.test(info.base), wantCo = info.base === 'CO';
      var partners = F.unionsOf(m, x.id).filter(function (un) {
        if (!F.partnerIn(un, x.id)) return false;
        var ex = un.status === 'divorced' || un.status === 'separated';
        return wantEx ? ex : wantCo ? un.status === 'cohabit' : !ex;
      }).map(function (un) { return F.person(m, F.partnerIn(un, x.id)); });
      var sp = pick(partners);
      if (sp === 'PENDING') return sp;
      if (sp) return sp;
      sp = make();
      F.addUnion(m, x.id, sp.id, wantEx ? 'divorced' : wantCo ? 'cohabit' : 'married');
      return sp;
    }
    if (info.kind === 'step') {
      var prev = nodes[nodes.length - 2];
      var pu = prev ? F.parentUnionOf(m, prev.id) : null;
      var excluded = pu ? F.partnerIn(pu, x.id) : null;
      var others = F.unionsOf(m, x.id).filter(function (un) { var q = F.partnerIn(un, x.id); return q && q !== excluded && un !== pu; })
        .sort(function (a, b) { return b.seq - a.seq; })
        .map(function (un) { return F.person(m, F.partnerIn(un, x.id)); });
      var st = pick(others) || others.filter(function (c) { return c.implied; })[0];
      if (st === 'PENDING') return st;
      if (st) {
        // 이복형제 때문에 미리 만든 '다른 배우자' 자리가 새부모로 확인되면 지금의 결혼으로
        var su = F.unionsOf(m, x.id).filter(function (un) { return F.partnerIn(un, x.id) === st.id; })[0];
        if (su && st.implied && su.status === 'divorced' && !su.end) su.status = 'married';
        return st;
      }
      st = make();
      F.addUnion(m, x.id, st.id, 'married');
      return st;
    }
    if (info.kind === 'stepchild') {
      var partner = nodes[nodes.length - 2];
      var un2 = F.unionsOf(m, x.id).filter(function (un) { var q = F.partnerIn(un, x.id); return q && (!partner || q !== partner.id); })[0];
      if (!un2) {
        var prevSp = this.mk({ key: key + '#P', gender: x.gender === 'M' ? 'F' : x.gender === 'F' ? 'M' : 'U', implied: true, label: F.displayName(x) + '의 이전 배우자' });
        un2 = F.addUnion(m, x.id, prevSp.id, 'divorced');
      }
      var sc = pick(F.childrenOf(m, un2.id));
      if (sc && sc !== 'PENDING') return sc;
      sc = make();
      F.addLink(m, un2.id, sc.id, 'bio');
      return sc;
    }
    // 자녀
    var kids = [];
    F.unionsOf(m, x.id).forEach(function (un) { kids = kids.concat(F.childrenOf(m, un.id)); });
    kids = kids.filter(function (k) { return k.kind === 'person'; });
    var k = pick(kids);
    if (k === 'PENDING') return k;
    if (k) return k;
    var cu = F.childUnion(m, x.id);
    k = make();
    F.addLink(m, cu.id, k.id, 'bio');
    return k;
  };

  Parser.prototype.walk = function (anchor, path, word, after, clause, extra) {
    extra = extra || {};
    var segs = path.split('>'), nodes = [anchor], key = anchor.key || anchor.id;
    for (var i = 0; i < segs.length; i++) {
      key += '>' + segs[i];
      var isFinal = i === segs.length - 1;
      var subPath = segs.slice(0, i + 1).join('>');
      var finalLabel = anchor.client ? word : (labelByCpath(cpathOf(anchor, subPath)) || F.displayName(anchor) + '의 ' + word);
      var label = isFinal ? finalLabel : this.labelOf(anchor, subPath);
      var p = this.step(nodes, segs[i], isFinal, key, label, isFinal ? after.name : '', word, clause);
      if (!p || p === 'PENDING') return p;
      if (!p.cpath && cpathOf(anchor, subPath)) p.cpath = cpathOf(anchor, subPath);
      nodes.push(p);
    }
    var fin = nodes[nodes.length - 1];
    if (fin.implied || !fin.label || fin.label === this.labelOf(anchor, path)) { fin.label = finalLabel; }
    if (fin.implied) { fin.implied = false; this.effects++; }
    if (!fin.key) fin.key = key;
    var info = segInfo(segs[segs.length - 1]);
    if (extra.g && fin.gender === 'U') fin.gender = extra.g;
    if (info.g !== 'U' && fin.gender === 'U') fin.gender = info.g;
    if (info.ord && !fin.order) fin.order = info.ord;
    if (extra.rank) fin.rank = extra.rank;
    if (extra.link && info.kind === 'child') { var l = F.linkOf(this.m, fin.id); if (l) l.type = extra.link; }
    if (extra.adopt) { var la = F.linkOf(this.m, anchor.id); if (la) la.type = 'adopted'; }
    return fin;
  };

  Parser.prototype.resolve = function (anchor, hit, after, clause) {
    var m = this.m, s = hit.spec, self = this, word = hit.word, out = [];
    function finish(p) {
      if (!p || p === 'PENDING') return;
      if (after.name && !p.name) { p.name = after.name; self.effects++; }
      if (applyAttrs(p, after.attrs)) self.effects++;
      out.push(p);
    }
    if (s.t === 'self') {
      var c = this.client();
      if (c.implied) { c.implied = false; this.effects++; }
      // 사례에 처음 쓴 말(클라이언트·내담자)을 그대로 이름으로
      if (!this.clientWord && word !== '본인') { this.clientWord = word; if (c.label !== word) { c.label = word; this.effects++; } }
      finish(c);
      return out;
    }
    if (s.t === 'pet') {
      var petKey = (anchor.key || anchor.id) + '>PET:' + s.species;
      var pet = m.persons.filter(function (q) { return q.key === petKey || (after.name && q.kind === 'pet' && q.name === after.name); })[0];
      if (!pet) pet = this.mk({ key: petKey, kind: 'pet', owner: anchor.id, label: s.species });
      if (after.name && !pet.name) { pet.name = after.name; this.effects++; }
      out.push(pet);
      return out;
    }
    if (s.t === 'group') {
      s.ps.forEach(function (p) { var q = self.walk(anchor, p, PATH_LABEL[p] || word, { name: '', attrs: {} }, clause, { adopt: s.adopt }); if (q && q !== 'PENDING') out.push(q); });
      return out;
    }
    if (s.t === 'choice') {
      var v = this.choose({
        key: 'kin|' + word.replace(/^사촌 .*/, '사촌') + '|' + (anchor.key || anchor.id), kind: s.side ? 'side' : 'kin', text: clause,
        question: (anchor.client ? '' : F.displayName(anchor) + '의 ') + s.q, options: s.opts, def: s.def
      });
      if (!v) { out.pending = true; return out; }
      if (s.side) v = v === 'P' ? s.opts[0][0] : v === 'M' ? s.opts[1][0] : v;
      var group = v.indexOf(',') >= 0;
      v.split(',').forEach(function (p) {
        // 고른 쪽이 분명한 이름을 가지면 그 이름으로(친할아버지·외할머니·외삼촌 등)
        var w = word;
        if (group || /^(할아버지|할머니|이모할머니|이모할아버지|아버님|어머님)$/.test(word)) w = PATH_LABEL[p] || word;
        if (word === '삼촌' && p === 'M>B') w = '외삼촌';
        var q = self.walk(anchor, p, w, group ? { name: '', attrs: {} } : after, clause, { g: s.g });
        if (q === 'PENDING') { out.pending = true; return; }
        if (group) { if (q) out.push(q); } else finish(q);
      });
      return out;
    }
    if (s.t === 'couple') {
      // "부부" → 바로 앞에 함께 나온 두 사람이 부부면 그 둘, 아니면 내담자의 지금 결혼, 그다음 내담자의 부모
      var cu = null, lp = this.sentence.lastPeople || [];
      if (lp.length === 2) cu = F.unionsOf(m, lp[0].id).filter(function (un) { return F.partnerIn(un, lp[0].id) === lp[1].id; })[0] || null;
      var cl = F.clientOf(m);
      if (!cu && cl) cu = F.currentUnion(m, cl.id) || null;
      if (cu && !F.partnerIn(cu, cu.a)) cu = null;
      if (!cu && cl) cu = F.parentUnionOf(m, cl.id) || null;
      if (!cu || !cu.a || !cu.b) return out;
      out.push(F.person(m, cu.a), F.person(m, cu.b));
      out.couple = cu;
      return out;
    }
    if (s.t === 'stepsib') {
      // 의붓형제: 새아버지·새어머니가 다른 결혼에서 낳은 자녀
      var ak = anchor.key || anchor.id;
      var hasSM = m.persons.some(function (q) { return q.key === ak + '>F>W*'; });
      var hasSF = m.persons.some(function (q) { return q.key === ak + '>M>H*'; });
      var sp = this.choose({
        key: 'stepsib|' + ak, kind: 'kin', text: clause,
        question: (anchor.client ? '' : F.displayName(anchor) + '의 ') + word + '은(는) 누구의 자녀인가요?',
        options: [['F>W*', '새어머니가 데려온 자녀'], ['M>H*', '새아버지가 데려온 자녀']],
        def: hasSM && !hasSF ? 'F>W*' : hasSF && !hasSM ? 'M>H*' : null
      });
      if (!sp) { out.pending = true; return out; }
      var stp = this.walk(anchor, sp, sp === 'F>W*' ? '새어머니' : '새아버지', { name: '', attrs: {} }, clause);
      if (!stp || stp === 'PENDING') { out.pending = true; return out; }
      var bioP = F.parentOf(m, anchor.id, sp === 'F>W*' ? 'M' : 'F', null, false);
      var su2 = F.unionsOf(m, stp.id).filter(function (x) { var pp = F.partnerIn(x, stp.id); return pp && (!bioP || pp !== bioP.id); })[0];
      if (!su2) {
        var prevP = this.mk({ key: ak + '>STEPP:' + sp, gender: stp.gender === 'M' ? 'F' : 'M', implied: true, label: F.displayName(stp) + '의 이전 배우자' });
        su2 = F.addUnion(m, stp.id, prevP.id, 'divorced');
      }
      var sskey = ak + '>SS:' + word;
      var ss = m.persons.filter(function (q) { return q.key === sskey && (!after.name || !q.name || q.name === after.name); })[0];
      if (!ss) {
        ss = this.mk({ key: sskey, gender: s.g, order: s.order, label: anchor.client ? word.replace(/^의붓 /, '의붓') : F.displayName(anchor) + '의 ' + word });
        F.addLink(m, su2.id, ss.id, 'bio');
      }
      finish(ss);
      return out;
    }
    if (s.t === 'half') {
      var shared = this.walk(anchor, s.side === 'P' ? 'F' : 'M', s.side === 'P' ? '아버지' : '어머니', { name: '', attrs: {} }, clause);
      var otherParent = F.parentOf(m, anchor.id, s.side === 'P' ? 'F' : 'M', null, false);
      var anchorPU = F.parentUnionOf(m, anchor.id);
      var pu = F.unionsOf(m, shared.id).filter(function (x) {
        var pp = F.partnerIn(x, shared.id);
        return pp && x !== anchorPU && (!otherParent || pp !== otherParent.id);
      }).sort(function (a1, b1) { return b1.seq - a1.seq; })[0];
      if (!pu) {
        var op = this.mk({ key: anchor.key + '>HALFP:' + s.side, gender: s.side === 'P' ? 'F' : 'M', implied: true,
          label: this.labelOf(anchor, s.side === 'P' ? 'F' : 'M') + '의 다른 배우자' });
        pu = F.addUnion(m, shared.id, op.id, 'divorced');
      }
      var skey = anchor.key + '>H' + s.side + ':' + word;
      var sib = m.persons.filter(function (q) { return q.key === skey && (!after.name || !q.name || q.name === after.name); })[0];
      if (!sib) {
        sib = this.mk({ key: skey, gender: s.g, order: s.order, label: anchor.client ? word : F.displayName(anchor) + '의 ' + word });
        F.addLink(m, pu.id, sib.id, 'bio');
      }
      finish(sib);
      return out;
    }
    // 길(path)
    var fin = this.walk(anchor, s.p, word.replace(/^(일란성 )?쌍둥이 /, '쌍둥이 '), after, clause, { rank: s.rank, link: s.link, adopt: s.adopt, g: s.g });
    if (fin === 'PENDING') { out.pending = true; return out; }
    if (!fin) return out;
    if (s.twin) {
      var la = F.linkOf(m, anchor.id), lb = F.linkOf(m, fin.id);
      if (la && lb) { var tg = la.twin || lb.twin || ('t' + la.id); la.twin = lb.twin = tg; if (s.identical) la.identical = lb.identical = true; }
    }
    if (s.cg && anchor.client) this.clientGenderHint = s.cg;
    finish(fin);
    return out;
  };

  Parser.prototype.scan = function (text) {
    var m = this.m, mentions = [], i = 0, holder = null;
    var haveClause = HAVE_RE.test(text);
    while (i < text.length) {
      // "6세이복 남동생"처럼 나이 뒤에 붙여 쓴 호칭도 읽는다
      if (i === 0 || PREV_OK.test(text[i - 1]) || /\d\s*(세|살)$/.test(text.slice(Math.max(0, i - 5), i))) {
        var hit = null;
        for (var k = 0; k < LEX.length; k++) {
          var w = LEX[k].word;
          if (text.substr(i, w.length) === w) {
            var j = i + w.length;
            if (j === text.length || NEXT_OK.test(text[j])) { hit = LEX[k]; break; }
          }
        }
        if (hit) {
          // "셋째 자녀를 임신" 같은 말은 사람을 만들지 않는다
          if (hit.spec.t === 'path' && /^[SDK]$/.test(hit.spec.p) && /^\s*(를|을)?\s*임신/.test(text.slice(i + hit.word.length))) { i += hit.word.length; continue; }
          // 한 글자 호칭(부·모)이 다른 낱말의 첫 글자일 때("부가적인 지원")는 사람이 아님
          if (/^[부모]$/.test(hit.word) && /^(가적|가 ?가치|가세|의 ?축적|로서의)/.test(text.slice(i + 1))) { i += 1; continue; }
          // "처남은 없다", "형제가 없다" → 사람을 만들지 않는다
          if (/^\s*(은|는|이|가|도)?\s*(없|안 계|없으며|없고)/.test(text.slice(i + hit.word.length)) && hit.spec.t !== 'self') { i += hit.word.length; continue; }
          // "1남 2녀 중 장녀"의 '장녀'는 자녀가 아니라 형제 순서
          if (/중\s*$/.test(text.slice(Math.max(0, i - 4), i)) && /^(장남|장녀|차남|차녀|막내)/.test(hit.word)) { i += hit.word.length; continue; }
          var anchor = null, prev = mentions[mentions.length - 1];
          if (prev && prev.persons.length === 1 && /^의\s*$/.test(text.slice(prev.end, i))) { anchor = prev.persons[0]; prev.possessive = true; }
          // "클라이언트 어머니"처럼 '의' 없이 붙여 쓴 경우
          if (!anchor && prev && prev.self && hit.spec.t !== 'self' && /^\s+$/.test(text.slice(prev.end, i))) { anchor = prev.persons[0]; prev.possessive = true; }
          // "부부 모두 아들과" → 그 부부의 아들
          if (!anchor && prev && prev.couple && hit.spec.t === 'path' && /^[SDK]$/.test(hit.spec.p)) {
            var cg = segInfo(hit.spec.p).g;
            var ck = F.childrenOf(m, prev.couple.id).filter(function (q) { return q.kind === 'person' && !q.client && (cg === 'U' || q.gender === cg || q.gender === 'U'); });
            var cp = ck[0];
            // 그 부부 사이 자녀가 없으면, 두 사람 중 한 사람의 자녀 가운데 맞는 사람이 하나뿐일 때 그 사람
            // ("아버지·새어머니 부부 모두 아들과 친밀" → 아버지의 아들인 남동생)
            if (!cp) {
              var pk = [];
              [prev.couple.a, prev.couple.b].forEach(function (pid) {
                F.unionsOf(m, pid).forEach(function (un) {
                  F.childrenOf(m, un.id).forEach(function (q) {
                    if (q.kind === 'person' && !q.client && pk.indexOf(q) < 0 && (cg === 'U' || q.gender === cg || q.gender === 'U')) pk.push(q);
                  });
                });
              });
              if (pk.length === 1) cp = pk[0];
            }
            if (!cp) {
              cp = this.mk({ key: (F.person(m, prev.couple.a).key || prev.couple.a) + '+' + (F.person(m, prev.couple.b).key || prev.couple.b) + '>' + hit.spec.p, gender: cg, label: hit.word });
              F.addLink(m, prev.couple.id, cp.id, 'bio');
            }
            mentions.push({ start: i, end: i + hit.word.length, persons: [cp], word: hit.word });
            i += hit.word.length;
            continue;
          }
          // "남동생은 부모와 친밀하다" → 남동생의 부모
          if (!anchor && hit.spec.t === 'group' && mentions.length && !holder) {
            var subj = mentions[0];
            if (subj.persons.length === 1 && subj.persons[0].kind === 'person' && !subj.persons[0].client && /^\s*(은|는|이|가)\s/.test(text.slice(subj.end, subj.end + 3))) anchor = subj.persons[0];
          }
          if (!anchor && hit.spec.t !== 'self') anchor = holder || (mentions.length === 0 ? this.sentence.carry : null);
          if (!anchor) anchor = this.client();
          var after = readNameAfter(text, i + hit.word.length, m);
          if (hit.spec.t === 'pet' && !after.name) {
            var pn = /^(\s+)([가-힣]{1,5})/.exec(text.slice(i + hit.word.length));
            if (pn) {
              var nm = pn[2].replace(/(가|는|은|를|을|와|과|도)$/, '');
              if (nm && !isRoleStart(nm) && !isStopword(nm) && !/^(있|없|한|두|세|네)/.test(nm)) {
                after = { name: nm, attrs: {}, end: i + hit.word.length + pn[1].length + nm.length };
              }
            }
          }
          // "12세 딸", "40세 남동생": 나이가 앞에 온다
          var ageBefore = /(?:^|[^\d])(\d{1,3})\s*(?:세|살)\s*(?:인\s*)?$/.exec(text.slice(Math.max(0, i - 12), i));
          var persons = this.resolve(anchor, hit, after, text);
          if (ageBefore && persons.length === 1 && persons[0].age == null) { persons[0].age = +ageBefore[1]; this.effects++; }
          // "초1 남동생", "중2인 딸": 학년이 앞에 온다
          var gradeBefore = /(?:^|[^가-힣\d])((?:초|중|고)\s?\d|(?:초등학교|초등|중학교|고등학교)\s*\d\s*학년)\s*(?:인\s*)?$/.exec(text.slice(Math.max(0, i - 14), i));
          if (gradeBefore && persons.length === 1 && persons[0].kind === 'person' && applyGrade(persons[0], gradeBefore[1])) this.effects++;
          var end = Math.max(after.end, i + hit.word.length);
          var mention = { start: i, end: end, persons: persons, word: hit.word, pending: !!persons.pending, anchorFrom: anchor,
            self: hit.spec.t === 'self', couple: persons.couple || null };
          mentions.push(mention);
          // "남편에게는 ~이 있다", "남편은 누나가 있다" → 뒤의 호칭은 남편 기준
          var suffix = text.slice(end, end + 6);
          if (persons.length === 1 && persons[0].kind === 'person') {
            if (/^\s*(에게는|에게도|에게|한테는|한테)/.test(suffix)) holder = persons[0];
            else if (haveClause && /^\s*(은|는)\s/.test(suffix) && mentions.length === 1) holder = persons[0];
          }
          i = end;
          continue;
        }
        var best = null, bestLen = 0;
        m.persons.forEach(function (p) {
          if (!p.name) return;
          aliases(p.name).forEach(function (a) {
            if (a.length > bestLen && text.substr(i, a.length) === a && !(/^[A-Za-z]/.test(a) && /[A-Za-z]/.test(text[i + a.length] || ''))) { best = p; bestLen = a.length; }
          });
        });
        if (best) {
          var e2 = i + bestLen;
          var pm = /^(\s*\(([^)]*)\))/.exec(text.slice(e2));
          if (pm) { if (applyAttrs(best, parseParens(pm[2]))) this.effects++; e2 += pm[1].length; }
          mentions.push({ start: i, end: e2, persons: [best] });
          var suf2 = text.slice(e2, e2 + 6);
          if (/^\s*(에게는|에게도|에게|한테는|한테)/.test(suf2)) holder = best;
          else if (haveClause && /^\s*(은|는)\s/.test(suf2) && mentions.length === 1) holder = best;
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

  // 연도 바로 뒤에 오는 결혼·이혼·재혼 낱말로 짝짓기
  function yearEvents(text) {
    var ev = {}, re = /(\d{4})\s*년(?!생)/g, mm;
    while ((mm = re.exec(text))) {
      var tail = text.slice(re.lastIndex, re.lastIndex + 12);
      var k = /^\s*(?:에|도|경|쯤|무렵)?\s*(?:에)?\s*(재혼|결혼|혼인|이혼|별거)/.exec(tail);
      if (!k) continue;
      var y = +mm[1];
      if (k[1] === '재혼') ev.re = ev.re || y;
      else if (k[1] === '이혼' || k[1] === '별거') ev.end = ev.end || y;
      else ev.start = ev.start || y;
    }
    return ev;
  }
  function years(text) {
    var out = [], re = /(\d{4})\s*년(?!생)/g, mm;
    while ((mm = re.exec(text))) out.push(+mm[1]);
    return out;
  }

  // "1남 2녀 중 장녀" → 형제 자리 만들기
  Parser.prototype.composition = function (text, subject) {
    var mm = /(\d)\s*남\s*(\d)\s*녀\s*중\s*(장남|장녀|차남|차녀|삼남|삼녀|막내|첫째|둘째|셋째|넷째)/.exec(text)
      || /(\d)\s*남\s*()중\s*(장남|차남|삼남|막내|첫째|둘째|셋째)/.exec(text)
      || /()(\d)\s*녀\s*중\s*(장녀|차녀|삼녀|막내|첫째|둘째|셋째)/.exec(text);
    if (!mm || !subject) return;
    var m = this.m, self = this;
    var sons = +(mm[1] || 0), daughters = +(mm[2] || 0), rankWord = mm[3];
    var total = sons + daughters;
    var g = /남$/.test(rankWord) ? 'M' : /녀$/.test(rankWord) ? 'F' : subject.gender;
    // 성별을 모르는데 "1남 1녀 중 막내"처럼 아들·딸이 섞여 있으면 → 고르기
    if (g === 'U' && sons && !daughters) g = 'M';
    else if (g === 'U' && daughters && !sons) g = 'F';
    else if (g === 'U') {
      var gv = this.choose({
        key: 'compg|' + (subject.key || subject.id), kind: 'kin', text: text,
        question: F.displayName(subject) + '은(는) ' + mm[0].replace(/\s*중.*$/, '') + ' 중 아들인가요, 딸인가요?',
        options: [['M', '아들'], ['F', '딸']], def: null
      });
      if (!gv) return 'PENDING';
      g = gv;
    }
    if (subject.gender === 'U' && g !== 'U') subject.gender = g;
    var rankMap = { 장남: 1, 장녀: 1, 차남: 2, 차녀: 2, 삼남: 3, 삼녀: 3, 첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4 };
    var sameRank = /[남녀]$/.test(rankWord) ? rankMap[rankWord] : null;   // 같은 성별 안에서의 순서
    var allRank = /^(첫째|둘째|셋째|넷째)$/.test(rankWord) ? rankMap[rankWord] : rankWord === '막내' ? total : null;
    subject.sibDeclared = { M: sons - (subject.gender === 'M' ? 1 : 0), F: daughters - (subject.gender === 'F' ? 1 : 0), text: text };
    var u = F.ensureParentUnion(m, subject.id);
    var existing = F.siblingsOf(m, subject.id);
    ['M', 'F'].forEach(function (gg) {
      var need = subject.sibDeclared[gg];
      var have = existing.filter(function (s) { return s.gender === gg; }).length;
      for (var n = have; n < need; n++) {
        var ord = null;
        if (gg === subject.gender && sameRank) ord = n < sameRank - 1 ? 'older' : 'younger';
        if (allRank === 1) ord = 'younger';
        if (rankWord === '막내') ord = 'older';
        var lab = gg === 'M' ? (ord === 'older' ? (subject.gender === 'F' ? '오빠' : '형') : ord === 'younger' ? '남동생' : '남자 형제')
          : (ord === 'older' ? (subject.gender === 'F' ? '언니' : '누나') : ord === 'younger' ? '여동생' : '여자 형제');
        var seg = (gg === 'M' ? 'B' : 'Z') + (ord === 'older' ? '+' : ord === 'younger' ? '-' : '');
        var cp = subject.client ? seg : subject.cpath ? subject.cpath + '>' + seg : null;
        var p = self.mk({ key: (subject.key || subject.id) + '>SIB' + gg + n, gender: gg, order: ord, implied: true, cpath: cp,
          label: subject.client ? lab : (labelByCpath(cp) || F.displayName(subject) + '의 ' + lab) });
        F.addLink(m, u.id, p.id, 'bio');
      }
    });
    if (sameRank) { subject.rank = sameRank; subject.compWord = rankWord; }
  };

  Parser.prototype.clause = function (text) {
    var m = this.m, self = this;
    this.effects = 0;
    var mentions = this.scan(text);
    var parts = [];
    mentions.forEach(function (mm) { if (!mm.possessive) parts = parts.concat(mm.persons); });
    parts = uniq(parts);
    var client = F.clientOf(m);
    var pendingChoice = mentions.some(function (mm) { return mm.pending; });

    // 어느 사람 뒤에든 은/는/이/가 가 붙으면 주어가 있는 마디 ("딸과 아들은 서로 친밀하다")
    var subjectExplicit = mentions.some(function (mm) { return !mm.possessive && /^\s*(이는|이가|은|는|이|가|께서)(\s|$|[,.])/.test(text.slice(mm.end)); });
    var people = parts.filter(function (p) { return p.kind === 'person'; });
    // 주어가 빠진 마디 → 같은 문장 앞 마디의 주어, 없으면 내담자
    var implicitSubject = !subjectExplicit ? (this.sentence.lastSubject || client) : null;
    if (implicitSubject && people.indexOf(implicitSubject) < 0 && /^\s*(와|과|랑|이랑|하고|에게|한테)/.test(mentions.length ? text.slice(mentions[0].end) : '')) {
      people = [implicitSubject].concat(people);
    }
    // "아버지와 어머니는 사이가 좋지만 / 자주 충돌한다" → 사람이 없는 뒷마디는 앞마디의 두 사람
    if (!people.length && this.sentence.lastPeople) people = this.sentence.lastPeople.slice();
    if (people.length >= 2) this.sentence.lastPeople = people.slice();
    // 소유격으로 시작한 마디("남편의 아버지는…")는 다음 마디에도 그 기준을 넘긴다
    var firstMention = mentions[0];
    if (firstMention && firstMention.possessive) this.sentence.carry = firstMention.persons[0];
    if (subjectExplicit && people.length) this.sentence.lastSubject = people[0];

    // ── 형제 구성
    if (/\d\s*[남녀]/.test(text) && /중\s*(장남|장녀|차남|차녀|삼남|삼녀|막내|첫째|둘째|셋째|넷째)/.test(text)) {
      if (this.composition(text, people[0] || client || this.client()) === 'PENDING') pendingChoice = true;
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
      if (relType && relType !== 'close') ambig = null;
      else if (ambig[2] === '가깝다' && relType === 'close') ambig = null;
    }
    if (ambig) relType = null;
    // "외조모가 주양육자 역할을 함" → 상대가 없으면 내담자를 돌보는 것으로
    if (relType === 'care' && people.length === 1 && !people[0].client && client) people = [people[0], client];

    if ((relType || ambig) && people.length >= 2) {
      var first = people[0], others = people.slice(1);
      var passive = PASSIVE_RE.test(text);
      var fearful = ambig && ambig[2] === '두려움';
      var note = SOURCE_RE.test(text) ? '진술' : '';
      var tentative = TENTATIVE_RE.test(text);
      // 폭력(빨강) · 신체·성적 학대(파랑) · 정서학대·방임(보라)
      var sub = null;
      if (/성추행|성폭|성적|추행|성 ?학대/.test(text)) sub = 'sexual';
      else if (/정서적|정서 ?학대|폭언|모욕|위협/.test(text)) sub = 'emotional';
      else if (/방임|방치|돌보지 ?않/.test(text)) sub = 'neglect';
      else if (/학대/.test(text)) sub = 'physical';
      else sub = 'violence';
      var mutual = /서로/.test(text);
      // "부부 모두 아들과", "부모는 남동생을" → 주어 묶음의 사람마다 상대와 잇기
      var pairs = others.map(function (o) { return [first, o]; });
      var lead = mentions.filter(function (mm) { return !mm.possessive; })[0];
      if (lead && lead.persons.length >= 2) {
        var objs = people.filter(function (p) { return lead.persons.indexOf(p) < 0; });
        if (objs.length) {
          pairs = [];
          lead.persons.forEach(function (sp) { objs.forEach(function (o) { pairs.push([sp, o]); }); });
        }
      }
      pairs.forEach(function (pr) {
        var first = pr[0], o = pr[1];
        var from = first, to = o;
        if (passive || fearful) { from = o; to = first; }
        var type = relType, key = null;
        if (ambig) {
          key = 'rel|' + ambig[2] + '|' + [first.key || first.id, o.key || o.id].join('~');
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
        var nr = F.addRelation(m, from.id, to.id, type, { sub: type === 'abuse' ? sub : null, note: note, tentative: tentative, key: key });
        if (nr && mutual && F.REL[type].dir) nr.mutual = true;
        self.effects++;   // 앞에서 이미 그은 관계를 다시 적은 것도 알아들은 것
      });
    }
    // 화살표가 있는 관계인데 한 사람만 나오면 "누가 했는지" 안내
    var missingActor = (relType && F.REL[relType] && F.REL[relType].dir) && people.length === 1;
    // "보통 관계", "무난한 관계"는 선을 긋지 않는 것이 맞으므로 알아들은 것으로
    if (!relType && !ambig && people.length >= 2 && /(보통|무난|평범|그럭저럭)/.test(text)) this.effects++;

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
            var np = this.mk({ key: (p0.key || p0.id) + '>RE', gender: p0.gender === 'M' ? 'F' : p0.gender === 'F' ? 'M' : 'U', implied: true,
              label: F.displayName(p0) + '의 재혼 배우자' });
            u = F.addUnion(m, p0.id, np.id, 'married');
          }
        } else if (us.length) {
          us.sort(function (a1, b1) { return b1.seq - a1.seq; });
          u = us[0];
        } else if (!p0.client && F.unionsOf(m, p0.id).some(function (uu) { return !F.partnerIn(uu, p0.id); })) {
          // "친모와는 이혼 후 왕래 없음" → 짝이 비어 있는 부모 자리에 상대를 채워 이혼으로
          u = F.unionsOf(m, p0.id).filter(function (uu) { return !F.partnerIn(uu, p0.id); })[0];
          var isPar = client && F.parentUnionOf(m, client.id) === u;
          var mate = this.mk({ key: (p0.key || p0.id) + '>MATE', gender: p0.gender === 'M' ? 'F' : p0.gender === 'F' ? 'M' : 'U', implied: true,
            label: isPar ? (p0.gender === 'F' ? '아버지' : '어머니') : F.displayName(p0) + '의 배우자' });
          if (u.a === p0.id) u.b = mate.id; else u.a = mate.id;
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
          var ys = years(text), ev = yearEvents(text);
          if (ev.start || ev.end || ev.re) {
            // 연도마다 바로 뒤의 말로 짝짓기: "2009년 결혼, 2012년 이혼, 2013년 재혼"
            if (ev.start) u.start = ev.start;
            if (ev.end && (status === 'divorced' || status === 'separated')) u.end = ev.end;
            if (ev.re) {
              var who = ppl.filter(function (q) { return q.id === u.a || q.id === u.b; })[0] || F.person(m, u.a);
              var ex2 = F.partnerIn(u, who.id);
              if (status === 'divorced' || status === 'separated') {
                var ru = F.unionsOf(m, who.id).filter(function (uu) { var pp = F.partnerIn(uu, who.id); return pp && pp !== ex2; })
                  .sort(function (a1, b1) { return b1.seq - a1.seq; })[0];
                if (!ru) {
                  var rp = this.mk({ key: (who.key || who.id) + '>RE', gender: who.gender === 'M' ? 'F' : who.gender === 'F' ? 'M' : 'U', implied: true,
                    label: F.displayName(who) + '의 재혼 배우자' });
                  ru = F.addUnion(m, who.id, rp.id, 'married');
                }
                ru.start = ev.re;
                if (ru.status === 'divorced' && !ru.end) ru.status = 'married';
              } else if (!ev.start) u.start = ev.re;
            }
          } else if (ys.length) {
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

    // ── 임신·유산·사산·임신중절 (주어가 없으면 내담자)
    var preg = null;
    if (/임신 ?중절|낙태/.test(text)) preg = 'abortion';
    else if (/사산/.test(text)) preg = 'stillbirth';
    else if (/자연 ?유산|유산(을)? ?(했|경험|되|됐|하였)/.test(text)) preg = 'miscarriage';
    else if (/임신 ?중|임신했|임신하였|임신 ?\d+ ?주/.test(text)) preg = 'pregnancy';
    if (preg) {
      var mother = (subjectExplicit && people[0]) || client || this.client();
      if (mother.gender === 'M') { var cuM = F.currentUnion(m, mother.id); if (cuM) mother = F.person(m, F.partnerIn(cuM, mother.id)); }
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
      var parent = people.filter(function (p) { return !/(아들|딸|자녀)$/.test(p.label); })[0] || client || this.client();
      var cu2 = F.childUnion(m, parent.id);
      var g = tw[2] === '아들' ? 'M' : tw[2] === '딸' ? 'F' : 'U';
      var twKey = (parent.key || parent.id) + '>TW:' + tw[2];
      var have = m.persons.filter(function (q) { return q.key && q.key.indexOf(twKey) === 0; });
      var single = people.filter(function (p) { return /(아들|딸|자녀)$/.test(p.label) && !p.name; })[0];
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

    // ── 주어 바로 뒤의 나이·성별 ("클라이언트는 10세 여자아동으로 아버지, …와 살고 있음")
    var lead2 = mentions.filter(function (mm) { return !mm.possessive; })[0];
    if (lead2 && lead2.persons.length === 1 && lead2.persons[0].kind === 'person' && (people.length > 1 || parts.length > 1)) {
      var nextM = mentions.filter(function (mm) { return mm.start >= lead2.end; })[0];
      var seg = text.slice(lead2.end, nextM ? nextM.start : text.length);
      var sm = /^\s*(은|는|이|가|께서)\s+/.exec(seg);
      if (sm) {
        var body = seg.slice(sm[0].length).split(/[,，]|(?:와|과|랑|이랑|하고|및)\s/)[0];
        var sp1 = lead2.persons[0];
        var am2 = /^(?:만\s*)?(\d{1,3})\s*(?:세|살)(?!에)/.exec(body);
        // 나이 바로 뒤가 다음 사람이면 그 사람의 나이 ("어머니는 40세 딸이…")
        var tailOnly = am2 && nextM && /^\s*$/.test(body.slice(am2[0].length)) && body === seg.slice(sm[0].length);
        if (am2 && !tailOnly && sp1.age == null) { sp1.age = +am2[1]; this.effects++; }
        var gb = gradeOf(body);
        // 학년 바로 뒤가 다음 사람이면 그 사람의 학년 ("어머니는 초3 딸이…")
        var gTail = gb && nextM && body === seg.slice(sm[0].length) && /^\s*$/.test(body.slice(gb.index).replace(/^[^가-힣\d]?(초등학교|초등학생|초등|중학교|중학생|고등학교|고등학생|고교|초|중|고)\s*\d\s*(학년)?/, ''));
        if (gb && gb.index <= 6 && !gTail && applyGrade(sp1, body)) this.effects++;
        var gw = /^(?:만\s*)?(?:\d{1,3}\s*(?:세|살)\s*,?\s*)?(?:(?:초|중|고)\s?\d\s*|(?:초등학교|초등|중학교|고등학교)\s*\d\s*학년\s*)?(?:의\s*)?([가-힣]+)/.exec(body);
        if (gw && !/(형제|자매|친구|동생|아이를|아들|딸)/.test(gw[1])) {
          if (GENDER_F.test(gw[1]) && gw[1].search(GENDER_F) === 0 && sp1.gender !== 'F') { sp1.gender = 'F'; this.effects++; }
          else if (GENDER_M.test(gw[1]) && gw[1].search(GENDER_M) === 0 && sp1.gender !== 'M') { sp1.gender = 'M'; this.effects++; }
        }
      }
    }

    // "만 10세 여아." 처럼 사람 없이 나이·성별만 쓴 마디는 내담자 정보
    if (!parts.length && (/\d{1,3}\s*(세|살)(?!에)/.test(text) || gradeOf(text) || GENDER_F.test(text) || GENDER_M.test(text)) && !/[남녀]\s*\d?\s*[녀]?\s*중/.test(text)) {
      var cc = this.client();
      parts = [cc]; people = [cc];
    }
    // ── 한 사람만 나오는 마디의 나이·성별·출생연도
    if (people.length === 1 && parts.length === 1) {
      var p1 = people[0];
      var am = /(?:^|[^\d])(\d{1,3})\s*(?:세|살)(?!에)/.exec(text);
      if (am && p1.age == null && !/\d\s*[남녀]\s*\d?\s*[녀]?\s*중/.test(text.slice(0, am.index))) { p1.age = parseInt(am[1], 10); this.effects++; }
      if (applyGrade(p1, text)) this.effects++;
      var by = /(\d{4})\s*년생/.exec(text);
      if (by && !p1.birthYear) { p1.birthYear = +by[1]; this.effects++; }
      if (/(^|\s)(남자|남성|남학생|남아|소년|남중생|남고생|남대생)/.test(text) && !/(남자|여자) ?(형제|친구)/.test(text) && p1.gender !== 'M') { p1.gender = 'M'; this.effects++; }
      if (/(^|\s)(여자|여성|여학생|여아|소녀|여중생|여고생|여대생)/.test(text) && !/(남자|여자) ?(형제|친구)/.test(text) && p1.gender !== 'F') { p1.gender = 'F'; this.effects++; }
    }

    var st, hint = '';
    if (missingActor) { st = 'partial'; hint = '누가 누구에게 했는지 알 수 없어 화살표를 긋지 않았어요. "아버지가 내담자를 ~", "내담자는 아버지에게 ~"처럼 두 사람을 함께 적어 주세요.'; }
    else if (pendingChoice) { st = 'choice'; hint = '해석이 갈리는 표현이 있어요. 아래에서 골라 주세요.'; }
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

  // 문장 → 마디. 한 문장 안의 마디들은 같은 문장 정보(앞 주어, 소유격 기준)를 나눈다.
  function splitSentences(text) {
    var out = [];
    text.split(/\n+/).forEach(function (line) {
      line = line.replace(/^\s*(?:\d{1,2}[.)]|[-•·*])\s+/, '');
      line.split(/(?<=[.!?。])\s+/).forEach(function (sent) {
        var clauses = [];
        sent.split(/(?<=(?:이고|이며|였고|었고|았고|했고|으며|있고|없고|지만|는데|으나|였으나|었으나)),?\s+/).forEach(function (c) {
          c = c.trim();
          if (c) clauses.push(c);
        });
        if (clauses.length) out.push(clauses);
      });
    });
    return out;
  }
  function splitClauses(text) {
    var out = [];
    splitSentences(text).forEach(function (s) { out = out.concat(s); });
    return out;
  }

  function parse(text, answers) {
    var P = new Parser(answers);
    text = text || '';
    TYPOS.forEach(function (t) { text = text.replace(t[0], t[1]); });
    splitSentences(text || '').forEach(function (clauses) {
      P.sentence = { lastSubject: null, carry: null };
      clauses.forEach(function (c) { P.clause(c); });
    });
    var m = P.m;
    var client = F.clientOf(m);
    if (!client && m.persons.length) client = F.addPerson(m, { client: true, key: 'C', label: '내담자', implied: true });
    if (client && client.gender === 'U' && P.clientGenderHint) client.gender = P.clientGenderHint;
    // 같은 두 사람에게 친밀(밀착)과 갈등이 함께 있으면 복합선 하나로
    [['close', 'closeConflict'], ['fused', 'fusedConflict']].forEach(function (pair) {
      m.relations.slice().forEach(function (r) {
        if (r.type !== pair[0]) return;
        var c = m.relations.filter(function (x) { return x.type === 'conflict' && ((x.a === r.a && x.b === r.b) || (x.a === r.b && x.b === r.a)); })[0];
        if (!c) return;
        r.type = pair[1];
        m.relations.splice(m.relations.indexOf(c), 1);
      });
    });
    // 형제 수 안내: "2남 1녀 중 차남"과 실제로 적은 형제 수가 다를 때
    m.persons.forEach(function (p) {
      if (!p.sibDeclared) return;
      var sibs = F.siblingsOf(m, p.id).filter(function (s) { return s.kind === 'person'; });
      ['M', 'F'].forEach(function (g) {
        var n = sibs.filter(function (s) { return s.gender === g; }).length;
        // 직접 적은 형제가 있으면, 형제 구성으로 미리 만든 빈자리부터 지운다
        // ("2남 1녀 중 차남" + "남동생이 있다" → 형 자리 대신 남동생)
        var extra = sibs.filter(function (s) { return s.gender === g && s.implied && s.key && s.key.indexOf('>SIB' + g) >= 0; });
        while (n > p.sibDeclared[g] && extra.length) {
          var gone = extra.pop();
          F.removePerson(m, gone.id);
          sibs.splice(sibs.indexOf(gone), 1);
          n--;
        }
        if (n > p.sibDeclared[g]) {
          m.lines.push({ text: p.sibDeclared.text, status: 'warn',
            hint: F.displayName(p) + '의 ' + (g === 'M' ? '남자' : '여자') + ' 형제가 형제 구성(' + p.sibDeclared.text.match(/\d\s*남\s*\d?\s*녀?|\d\s*녀/)[0] + ')보다 많이 적혀 있어요. 구체적으로 적은 형제를 따랐어요.' });
        }
      });
      delete p.sibDeclared;
    });
    // "장녀인데 형부(언니의 남편)가 있다"처럼 순서가 안 맞을 때
    m.persons.forEach(function (p) {
      if (!p.compWord || !p.rank) return;
      var older = F.siblingsOf(m, p.id).filter(function (s) { return s.gender === p.gender && s.order === 'older'; });
      if (older.length > p.rank - 1) {
        m.lines.push({ text: F.displayName(p) + ' — ' + p.compWord, status: 'warn',
          hint: F.displayName(p) + '은(는) ' + p.compWord + '인데 손위 ' + (p.gender === 'F' ? '여자' : '남자') + ' 형제(' + older.map(function (s) { return s.label; }).join(', ') + ')가 적혀 있어요. 적힌 대로 그렸으니 확인해 주세요.' });
      } else if (older.length < p.rank - 1 && p.rank < 99) {
        // "차남"인데 형이 없고 남동생만 적힌 경우
        var younger = F.siblingsOf(m, p.id).filter(function (s) { return s.gender === p.gender && s.order === 'younger'; });
        if (younger.length) {
          m.lines.push({ text: F.displayName(p) + ' — ' + p.compWord, status: 'warn',
            hint: F.displayName(p) + '은(는) ' + p.compWord + '인데 손위 ' + (p.gender === 'F' ? '여자' : '남자') + ' 형제는 없고 ' + younger.map(function (s) { return s.label; }).join(', ') + '이(가) 적혀 있어요. 적힌 대로 그렸으니 형제 순서를 확인해 주세요.' });
        }
      }
      delete p.compWord;
    });
    F.cleanup(m);
    return m;
  }

  global.GenogramParser = { parse: parse, splitClauses: splitClauses };
})(typeof window !== 'undefined' ? window : globalThis);
