// Έλεγχος αναλλοίωτων της λογικής (node test.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const m = html.match(/<script id="logic">([\s\S]*?)<\/script>/);
if (!m) throw new Error('logic block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const L = mod.exports;
let n = 0, fails = 0;
function ok(c, msg) { n++; if (!c) { fails++; console.error('FAIL: ' + msg); } }

// --- Βάση ---
ok(L.VERBS.length >= 30, 'at least 30 verbs');
const lemmas = new Set();
for (const v of L.VERBS) {
  ok(!lemmas.has(v.lemma), 'duplicate lemma ' + v.lemma); lemmas.add(v.lemma);
  ok(v.raw.length === 5 && v.raw.slice(0, 4).every(a => a.length === 6) && v.raw[4].length === 1, v.lemma + ': raw shape');
  const seen = new Map();
  for (const t of L.TENSES) {
    const f = v.forms[t.id];
    ok(Array.isArray(f) && f.length === 6, v.lemma + ' ' + t.id + ' has 6 persons');
    f.forEach((s, p) => {
      ok(typeof s === 'string' && s.trim() !== '' && !/undefined|NaN|\s{2}/.test(s) && s === s.trim(), v.lemma + ' ' + t.id + ' ' + p + ' non-empty');
      ok(!seen.has(s), v.lemma + ': form «' + s + '» appears twice (' + t.id + p + ' vs ' + seen.get(s) + ')');
      seen.set(s, t.id + p);
    });
  }
  // σύνθετοι χρόνοι
  v.forms.fcont.forEach((s, p) => ok(s === 'θα ' + v.forms.pres[p], v.lemma + ' fcont'));
  v.forms.fsimp.forEach((s, p) => ok(s === 'θα ' + v.raw[3][p], v.lemma + ' fsimp'));
  v.forms.perf.forEach((s, p) => ok(s === L.HAVE[p] + ' ' + v.raw[4][0], v.lemma + ' perf'));
  v.forms.plup.forEach((s, p) => ok(s === L.HAD[p] + ' ' + v.raw[4][0], v.lemma + ' plup'));
  // αύξηση
  const sg = [0, 1, 2, 5], pl = [3, 4];
  if (v.aug.includes('i')) { sg.forEach(p => ok(v.forms.impf[p].startsWith('έ'), v.lemma + ' impf augment p' + p)); pl.forEach(p => ok(!v.forms.impf[p].startsWith('έ'), v.lemma + ' impf pl no augment')); }
  if (v.aug.includes('a')) { sg.forEach(p => ok(v.forms.aor[p].startsWith('έ'), v.lemma + ' aor augment p' + p)); pl.forEach(p => ok(!v.forms.aor[p].startsWith('έ'), v.lemma + ' aor pl no augment')); }
  // παθητική: κανονικές καταλήξεις
  if (v.voice === 'pass' && v.lemma !== 'έρχομαι') {
    ok(v.forms.pres[0].endsWith('μαι'), v.lemma + ' pres ends -μαι');
    ok(v.forms.aor[0].endsWith('θηκα'), v.lemma + ' aor ends -θηκα');
  }
  if (v.voice === 'act' && v.pair) {
    ok(L.BY_LEMMA[v.pair] && L.BY_LEMMA[v.pair].voice === 'pass', v.lemma + ' has passive pair');
  }
  ok(v.voice === 'act' ? v.lemma.endsWith('ω') || v.lemma.endsWith('ώ') : v.lemma.endsWith('μαι'), v.lemma + ' lemma shape');
}
ok(L.VERBS.filter(v => v.voice === 'pass').length >= 3, 'passive verbs present');
// οι ρηματικοί τύποι ενός ρήματος δεν ταυτίζονται με τους τύπους άλλου της ίδιας φωνής (ώστε το «ποιου ρήματος» να μην μπερδεύει) — μόνο ενημερωτικά:
// ευρετικός έλεγχος γνωστών τύπων
const g = (l, t, p) => L.BY_LEMMA[l].forms[t][p];
ok(g('γράφω', 'aor', 0) === 'έγραψα', 'γράφω aor');
ok(g('γράφω', 'fsimp', 3) === 'θα γράψουμε', 'γράφω fsimp');
ok(g('γράφω', 'plup', 5) === 'είχαν γράψει', 'γράφω plup');
ok(g('λέω', 'fsimp', 0) === 'θα πω' && g('λέω', 'perf', 0) === 'έχω πει', 'λέω');
ok(g('τρώω', 'aor', 0) === 'έφαγα' && g('τρώω', 'fsimp', 2) === 'θα φάει', 'τρώω');
ok(g('λύνομαι', 'aor', 0) === 'λύθηκα' && g('λύνομαι', 'fsimp', 0) === 'θα λυθώ', 'λύνομαι');
ok(g('έρχομαι', 'aor', 0) === 'ήρθα' && g('έρχομαι', 'perf', 0) === 'έχω έρθει', 'έρχομαι');
ok(g('πηγαίνω', 'fsimp', 0) === 'θα πάω', 'πηγαίνω');

// --- Ερωτήσεις ---
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const kinds = {};
for (const tier of [1, 2, 3, 4]) {
  const rng = seeded(1234 + tier);
  const T = L.TIERS[tier];
  const recent = [];
  const allowedVerbs = new Set(L.poolFor(tier).map(v => v.lemma));
  for (let i = 0; i < 500; i++) {
    const q = L.genQuestion(tier, rng, recent);
    recent.push(q.key); if (recent.length > 12) recent.shift();
    kinds[tier + q.kind] = (kinds[tier + q.kind] || 0) + 1;
    const tag = 'tier' + tier + ' #' + i + ' ' + q.prompt;
    ok(q.options.length === 4, tag + ': 4 options');
    ok(new Set(q.options).size === 4, tag + ': unique options');
    ok(q.options.every(o => typeof o === 'string' && o && !/undefined|NaN/.test(o)), tag + ': clean options');
    ok(q.answer >= 0 && q.options.filter(o => o === q.correct).length === 1 && q.options[q.answer] === q.correct, tag + ': exactly one correct');
    ok(T.tenses.includes(q.tense), tag + ': tense in tier');
    ok(!/undefined|NaN/.test(q.prompt + q.sub + q.explain), tag + ': clean text');
    ok(q.optMeta.length === 4, tag + ': meta');
    if (q.kind === 'form') {
      ok(q.correct === L.BY_LEMMA[q.verb].forms[q.tense][q.person], tag + ': correct matches DB');
      ok(allowedVerbs.has(q.verb), tag + ': verb allowed in tier');
      q.options.forEach((o, k) => { const mt = q.optMeta[k]; ok(L.BY_LEMMA[q.verb].forms[mt.tense][mt.person] === o && T.tenses.includes(mt.tense), tag + ': option meta'); });
      ok(q.prompt.includes(L.TENSE[q.tense].name.toLowerCase()) && q.prompt.includes(L.PERSONS[q.person].name), tag + ': prompt mentions tense & person');
    } else if (q.kind === 'recog') {
      ok(tier >= 3, tag + ': recog only tier>=3');
      const hits = L.tensesOfForm(q.verb, q.shown);
      ok(hits.length === 1 && hits[0].tense === q.tense && hits[0].person === q.person, tag + ': shown form unambiguous & tense matches');
      ok(q.correct === L.TENSE[hits[0].tense].name, tag + ': answer is the form\'s tense');
      ok(q.prompt.includes('«' + q.shown + '»'), tag + ': prompt shows form');
    } else if (q.kind === 'voice') {
      ok(tier === 4, tag + ': voice only tier 4');
      const act = L.BY_LEMMA[q.verb], pas = L.BY_LEMMA[q.target];
      ok(act.voice === 'act' && pas.voice === 'pass' && act.pair === pas.lemma, tag + ': pair');
      ok(q.shown === act.forms[q.tense][q.person] && q.correct === pas.forms[q.tense][q.person], tag + ': voice matches DB');
      q.options.forEach(o => ok(tensesOfFormSafe(pas, o), tag + ': voice options all passive forms'));
    }
    if (tier < 4) ok(L.BY_LEMMA[q.verb].voice === 'act', tag + ': no passive before tier 4');
    if (tier < 3) ok(!q.tense.match(/perf|plup/) && L.BY_LEMMA[q.verb].level === 1, tag + ': tier<3 restrictions');
    if (tier === 1) ok(['pres', 'impf', 'aor'].includes(q.tense), tag + ': tier1 tenses');
  }
}
function tensesOfFormSafe(v, text) { return Object.values(v.forms).some(a => a.includes(text)); }
ok(kinds['3recog'] > 50 && kinds['4voice'] > 50 && kinds['4recog'] > 30, 'recog/voice questions occur: ' + JSON.stringify(kinds));
ok(Object.keys(kinds).some(k => k.startsWith('4form')) && !kinds['1recog'] && !kinds['2recog'] && !kinds['3voice'], 'kinds per tier');

console.log(n + ' checks, ' + fails + ' failed. kinds=' + JSON.stringify(kinds));
process.exit(fails ? 1 : 0);
