export function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, c => {
    const code = c.charCodeAt(0);
    const base = code <= 90 ? 65 : 97;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}


const runicMap: Record<string, string> = {
  A: '\u{16A8}',
  B: '\u{16D2}',
  C: '\u{16B2}',
  D: '\u{16DE}',
  E: '\u{16D6}',
  F: '\u{16A0}',
  G: '\u{16B7}',
  H: '\u{16BB}',
  I: '\u{16C1}',
  J: '\u{16C3}',
  K: '\u{16B2}',
  L: '\u{16DA}',
  M: '\u{16D7}',
  N: '\u{16BE}',
  O: '\u{16A9}',
  P: '\u{16C8}',
  Q: '\u{16B2}',
  R: '\u{16B1}',
  S: '\u{16CA}',
  T: '\u{16CF}',
  U: '\u{16A2}',
  V: '\u{16A1}',
  W: '\u{16B9}',
  X: '\u{16C9}',
  Y: '\u{16E3}',
  Z: '\u{16C9}',
  a: '\u{16A8}',
  b: '\u{16D2}',
  c: '\u{16B2}',
  d: '\u{16DE}',
  e: '\u{16D6}',
  f: '\u{16A0}',
  g: '\u{16B7}',
  h: '\u{16BB}',
  i: '\u{16C1}',
  j: '\u{16C3}',
  k: '\u{16B2}',
  l: '\u{16DA}',
  m: '\u{16D7}',
  n: '\u{16BE}',
  o: '\u{16A9}',
  p: '\u{16C8}',
  q: '\u{16B2}',
  r: '\u{16B1}',
  s: '\u{16CA}',
  t: '\u{16CF}',
  u: '\u{16A2}',
  v: '\u{16A1}',
  w: '\u{16B9}',
  x: '\u{16C9}',
  y: '\u{16E3}',
  z: '\u{16C9}',
};

export function toRunic(input: string): string {
  return input
    .split('')
    .map(ch => runicMap[ch] ?? ch)
    .join('');
}

export function tornVisibleText(input: string): string {
  const middle = Math.floor(input.length / 2);
  const before = input.lastIndexOf(' ', middle);
  const after = input.indexOf(' ', middle);
  const split =
    before !== -1 && middle - before < 20
      ? before
      : after !== -1 && after - middle < 20
        ? after
        : middle;
  const showFirst = Math.random() < 0.5;
  const marker = '\n--- torn ---\n';
  return showFirst
    ? `${input.slice(0, split)}${marker}`
    : `${marker}${input.slice(split)}`;
}

