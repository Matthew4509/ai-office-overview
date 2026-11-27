// One-line cleaning for what people type (nicknames), the same as AI Head Office Overview's office/src/text.mjs:
// hidden and control characters, line breaks and runs of spaces become one space; a wrong type is empty text.
const HIDDEN = /[\u{0}-\u{1f}\u{7f}-\u{9f}\u{ad}\u{34f}\u{61c}\u{115f}\u{1160}\u{17b4}\u{17b5}\u{180b}-\u{180f}\u{200b}\u{200c}\u{200e}\u{200f}\u{2028}-\u{202e}\u{2060}-\u{206f}\u{3164}\u{fe00}-\u{fe0e}\u{feff}\u{ffa0}\u{fff9}-\u{fffb}\u{e0000}-\u{e007f}\u{e0100}-\u{e01ef}]/gu;
const LONE = /[\u{d800}-\u{dfff}]/gu;

export function oneLine(v, max = 200) {
  const s = (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
    .replace(LONE, '\u{fffd}').replace(HIDDEN, ' ').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : Array.from(s).slice(0, max).join('');
}
