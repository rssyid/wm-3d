// Tes pembangun MathML (js/ui/equations/mathml.js): keluaran well-formed, escaping, jumlah anak tepat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc,
  mi,
  mn,
  mo,
  mtext,
  up,
  row,
  frac,
  sup,
  sub,
  msubsup,
  sqrt,
  eq,
  fn,
  bar,
  cases,
  when,
  math,
  imath,
  wrap,
  isSingleElement,
  space,
  sum,
  paren,
} from '../../js/ui/equations/mathml.js';
import { parseMarkup } from './equations.xml.js';

test('esc meng-escape karakter khusus HTML/XML', () => {
  assert.equal(esc(`a<b>&"c'`), 'a&lt;b&gt;&amp;&quot;c&#39;');
  assert.equal(esc(null), '');
  assert.equal(esc(3.5), '3.5');
});

test('elemen dasar dan escaping isi', () => {
  assert.equal(mi('x'), '<mi>x</mi>');
  assert.equal(mn('0,385'), '<mn>0,385</mn>');
  assert.equal(mo('<'), '<mo>&lt;</mo>');
  assert.equal(mtext('a & b'), '<mtext>a &amp; b</mtext>');
  assert.equal(mi('<script>'), '<mi>&lt;script&gt;</mi>');
  assert.equal(up('e'), '<mi mathvariant="normal">e</mi>');
  // angka JS → koma desimal dan minus tipografis
  assert.equal(mn(-1.5), '<mn>−1,5</mn>');
});

test('nilai atribut di-escape dan nama atribut divalidasi', () => {
  assert.equal(mi('x', { title: 'a"b<' }), '<mi title="a&quot;b&lt;">x</mi>');
  assert.throws(() => mi('x', { 'on click': 'x' }));
  assert.equal(mo('=', { stretchy: false, fence: true }), '<mo fence>=</mo>');
});

test('wrap dan isSingleElement', () => {
  assert.equal(isSingleElement('<mi>x</mi>'), true);
  assert.equal(isSingleElement('<mi>x</mi><mi>y</mi>'), false);
  assert.equal(isSingleElement('x'), false);
  assert.equal(isSingleElement('<mrow><mi>x</mi><mo>+</mo></mrow>'), true);
  assert.equal(isSingleElement('<mspace width="1em"></mspace>'), true);
  assert.equal(wrap('<mi>x</mi>'), '<mi>x</mi>');
  assert.equal(wrap('<mi>x</mi><mi>y</mi>'), '<mrow><mi>x</mi><mi>y</mi></mrow>');
  assert.equal(wrap(['<mi>x</mi>', '<mi>y</mi>']), '<mrow><mi>x</mi><mi>y</mi></mrow>');
});

test('frac, sup, sub, msubsup selalu punya jumlah anak tepat', () => {
  const f = frac(row(mi('a'), mo('+'), mi('b')), mi('c'));
  assert.equal(f, '<mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>c</mi></mfrac>');
  // isi berganda otomatis dibungkus mrow
  assert.equal(sup(mi('H') + mn('1'), mn('1,5')), '<msup><mrow><mi>H</mi><mn>1</mn></mrow><mn>1,5</mn></msup>');
  assert.equal(sub(mi('z'), mi('s')), '<msub><mi>z</mi><mi>s</mi></msub>');
  const ss = msubsup(mo('∫'), mi('a'), mi('b'));
  const tree = parseMarkup(ss);
  assert.equal(tree.children[0].tag, 'msubsup');
  assert.equal(tree.children[0].children.length, 3);
  for (const t of [frac(mi('a'), mi('b')), sup(mi('a'), mi('b')), sub(mi('a'), mi('b'))]) {
    assert.equal(parseMarkup(t).children[0].children.length, 2, t);
  }
  assert.equal(sqrt(mn('2')), '<msqrt><mn>2</mn></msqrt>');
});

test('eq, fn, paren, sum, cases, bar menghasilkan markup well-formed', () => {
  const samples = [
    eq(mi('Q'), row(mi('C'), mi('L')), mn('0,030')),
    fn('max', [mi('r'), mn('0')], ';'),
    paren(mi('x'), '[', ']'),
    sum(mi('i'), mi('N'), mi('x')),
    sum(mi('j'), null, mi('x')),
    cases([
      [mn('0'), when(mi('H'), mo('≤'), mn('0'))],
      [mi('x'), null],
    ]),
    bar('T'),
    bar(row(mi('d'), mi('x'))),
    space('1em'),
  ];
  for (const s of samples) {
    const tree = parseMarkup(s);
    assert.equal(tree.children.length, 1, `satu elemen tingkat atas: ${s}`);
  }
  assert.match(fn('max', [mi('r'), mn('0')], ';'), /<mo>;<\/mo>/);
  assert.match(bar('T'), /class="eq-ol"/);
  const c = cases([
    [mn('1'), null],
    [mn('2'), null],
    [mn('3'), null],
  ]);
  assert.match(c, /--rows:3/);
  assert.equal((c.match(/<mtr>/g) || []).length, 3);
});

test('math & imath: elemen akar, display, dan aria-label', () => {
  const m = math(eq(mi('a'), mn('1')), { label: 'a sama dengan "1"' });
  assert.match(m, /^<math display="block" aria-label="a sama dengan &quot;1&quot;">/);
  const tree = parseMarkup(m);
  assert.equal(tree.children[0].tag, 'math');
  const im = imath(mi('x'), mo('='), mn('2'));
  assert.equal(im, '<math><mi>x</mi><mo>=</mo><mn>2</mn></math>');
});

test('parser uji menolak markup tidak seimbang', () => {
  assert.throws(() => parseMarkup('<mrow><mi>x</mrow>'));
  assert.throws(() => parseMarkup('<mi>x'));
});

test('splitParts memecah "A, B" tingkat atas dan membiarkan koma bersarang', async () => {
  const { splitParts, topChildren } = await import('../../js/ui/equations/mathml.js');
  const A = eq(mi('a'), mn('1'));
  const B = eq(mi('b'), fn('max', [mi('x'), mn('0')], ','));
  const both = row(A, mo(','), space('1em'), B);
  assert.deepEqual(splitParts(both), [A, B]);
  assert.equal(topChildren(both).length, 4);
  // tanpa spasi → tidak dipecah; koma di dalam fn tidak memecah
  assert.deepEqual(splitParts(row(A, mo(','), B)), [row(A, mo(','), B)]);
  assert.deepEqual(splitParts(B), [B]);
  const three = row(A, mo(','), space('1em'), B, mo(','), space('1em'), mi('c'));
  assert.equal(splitParts(three).length, 3);
  for (const p of splitParts(three)) assert.equal(parseMarkup(p).children.length, 1);
});
