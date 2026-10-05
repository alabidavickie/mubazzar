/**
 * RFC 4180 CSV reader: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF or LF, and the
 * UTF-8 BOM Excel adds. Fully empty lines are dropped. Throws on an unterminated quote.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };
  while (i < src.length) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        field += c;
      }
      i++;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      endRow();
      if (c === "\r" && src[i + 1] === "\n") i++;
    } else field += c;
    i++;
  }
  if (quoted) throw new Error("UNTERMINATED_QUOTE");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}
