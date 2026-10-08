// Our OCR module's lines (modules/scanner-ocr) -> the scanner list as text, row by row. Vision's own order prints the
// right column (slot times, PRIO, "by 18:00", a business's hours) after all the rows, so the parser could only guess
// whose each was (columnTags). With each line's position, a right-column item goes right after the left-column line it
// sits level with: name, street, postcode, route code of a row, its own times and tags among them.

/** One recognised line; x, y, w, h are fractions of the upright photo, from its top-left corner. */
export interface OcrLine { text: string; x: number; y: number; w: number; h: number }

/** First line of a text built this way: the parser then reads a tag in a row's lines as that row's own. */
export const ROWS = '[rows]';

export function rowOrder(lines: OcrLine[]): string {
  const mid = (l: OcrLine) => l.y + l.h / 2;
  const right = (l: OcrLine) => l.x >= 0.5; // ponytail: the scanner's two columns split at half width
  const left = lines.filter(l => !right(l)).sort((a, b) => a.y - b.y);
  if (!left.length) return lines.map(l => l.text).join('\n');
  const level = new Map(left.map(l => [l, [] as OcrLine[]]));
  for (const r of lines.filter(right).sort((a, b) => a.y - b.y)) {
    const near = left.reduce((a, b) => (Math.abs(mid(b) - mid(r)) < Math.abs(mid(a) - mid(r)) ? b : a));
    level.get(near)!.push(r);
  }
  return [ROWS, ...left.flatMap(l => [l.text, ...level.get(l)!.map(r => r.text)])].join('\n');
}
