import type { Readable } from "stream";
import { StringDecoder } from "string_decoder";

/**
 * Streaming CSV reader for very large files (the Miami-Dade NAL is ~470 MB).
 * Handles quoted fields, "" escapes and embedded newlines. Yields string[]
 * records; the first record is the header.
 */
export async function* csvRecords(input: Readable, encoding: BufferEncoding = "latin1"): AsyncGenerator<string[]> {
  const decoder = new StringDecoder(encoding);
  let carry = "";
  let first = true;

  const parseLine = (line: string): string[] => {
    if (line.indexOf('"') === -1) return line.split(",");
    const out: string[] = [];
    let field = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else q = false;
        } else field += c;
      } else if (c === '"' && field === "") q = true;
      else if (c === ",") {
        out.push(field);
        field = "";
      } else field += c;
    }
    out.push(field);
    return out;
  };

  const quoteCount = (s: string) => {
    let n = 0;
    for (let i = s.indexOf('"'); i !== -1; i = s.indexOf('"', i + 1)) n++;
    return n;
  };

  function* drain(text: string, final: boolean): Generator<string[]> {
    let start = 0;
    const buf = text;
    for (;;) {
      const nl = buf.indexOf("\n", start);
      if (nl === -1) break;
      let end = nl;
      // quoted newline? keep consuming lines until quotes balance
      let line = buf.slice(start, end);
      let next = nl;
      while (quoteCount(line) % 2 === 1) {
        const nn = buf.indexOf("\n", next + 1);
        if (nn === -1) {
          // incomplete quoted record: keep the remainder for the next chunk
          carry = buf.slice(start);
          return;
        }
        next = nn;
        line = buf.slice(start, next);
      }
      end = next;
      start = end + 1;
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (first) {
        line = line.replace(/^\uFEFF/, "");
        first = false;
      }
      if (line.length === 0) continue;
      yield parseLine(line);
    }
    carry = buf.slice(start);
    if (final && carry.length) {
      const line = carry.endsWith("\r") ? carry.slice(0, -1) : carry;
      carry = "";
      if (line.length) yield parseLine(line);
    }
  }

  for await (const chunk of input) {
    const text = carry + (typeof chunk === "string" ? chunk : decoder.write(chunk as Buffer));
    carry = "";
    yield* drain(text, false);
  }
  const tail = carry + decoder.end();
  carry = "";
  yield* drain(tail, true);
}
