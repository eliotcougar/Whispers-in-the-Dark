export function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, c => {
    const code = c.charCodeAt(0);
    const base = code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

const gothicMap: Record<string, string> = {
  A: '\u{1D504}',
  B: '\u{1D505}',
  C: '\u{212D}',
  D: '\u{1D507}',
  E: '\u{1D508}',
  F: '\u{1D509}',
  G: '\u{1D50A}',
  H: '\u{210C}',
  I: '\u{2111}',
  J: '\u{1D50D}',
  K: '\u{1D50E}',
  L: '\u{1D50F}',
  M: '\u{1D510}',
  N: '\u{1D511}',
  O: '\u{1D512}',
  P: '\u{1D513}',
  Q: '\u{1D514}',
  R: '\u{211C}',
  S: '\u{1D516}',
  T: '\u{1D517}',
  U: '\u{1D518}',
  V: '\u{1D519}',
  W: '\u{1D51A}',
  X: '\u{1D51B}',
  Y: '\u{1D51C}',
  Z: '\u{2128}',
  a: '\u{1D51E}',
  b: '\u{1D51F}',
  c: '\u{1D520}',
  d: '\u{1D521}',
  e: '\u{1D522}',
  f: '\u{1D523}',
  g: '\u{1D524}',
  h: '\u{1D525}',
  i: '\u{1D526}',
  j: '\u{1D527}',
  k: '\u{1D528}',
  l: '\u{1D529}',
  m: '\u{1D52A}',
  n: '\u{1D52B}',
  o: '\u{1D52C}',
  p: '\u{1D52D}',
  q: '\u{1D52E}',
  r: '\u{1D52F}',
  s: '\u{1D530}',
  t: '\u{1D531}',
  u: '\u{1D532}',
  v: '\u{1D533}',
  w: '\u{1D534}',
  x: '\u{1D535}',
  y: '\u{1D536}',
  z: '\u{1D537}',
  0: '\u{1D7D8}',
  1: '\u{1D7D9}',
  2: '\u{1D7DA}',
  3: '\u{1D7DB}',
  4: '\u{1D7DC}',
  5: '\u{1D7DD}',
  6: '\u{1D7DE}',
  7: '\u{1D7DF}',
  8: '\u{1D7E0}',
  9: '\u{1D7E1}',
};

export function toGothic(input: string): string {
  return input
    .split('')
    .map(ch => gothicMap[ch] ?? ch)
    .join('');
}
