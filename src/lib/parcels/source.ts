import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import yauzl from "yauzl";

/** Open the first .csv/.txt entry of a zip as a stream (no extraction to disk). */
export function csvStreamFromZip(zipPath: string): Promise<Readable> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error("cannot open zip"));
      zip.on("error", reject);
      zip.on("end", () => reject(new Error(`No CSV found inside ${zipPath}`)));
      zip.readEntry();
      zip.on("entry", (entry: yauzl.Entry) => {
        if (/\.(csv|txt)$/i.test(entry.fileName) && !/\/$/.test(entry.fileName)) {
          zip.openReadStream(entry, (e, stream) => {
            if (e || !stream) return reject(e ?? new Error("cannot read zip entry"));
            resolve(stream);
          });
        } else zip.readEntry();
      });
    });
  });
}

/** A .csv or .zip file path -> a byte stream of the CSV. */
export async function openRollFile(file: string): Promise<Readable> {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  if (/\.zip$/i.test(file)) return csvStreamFromZip(file);
  return fs.createReadStream(file);
}

/** Download a URL to dest (skips when it already exists unless refresh). Returns the path. */
export async function downloadFile(url: string, dest: string, opts: { refresh?: boolean; log?: (m: string) => void } = {}): Promise<string> {
  const log = opts.log ?? (() => {});
  if (fs.existsSync(dest) && !opts.refresh && fs.statSync(dest).size > 1000) {
    log(`Using cached ${dest}`);
    return dest;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": "contract-sender/1.0 (public records research)" } });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status} ${res.statusText}) for ${url}`);
  const total = Number(res.headers.get("content-length") || 0);
  let got = 0;
  let lastLog = Date.now();
  const tmp = dest + ".part";
  const body = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  body.on("data", (c: Buffer) => {
    got += c.length;
    if (Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      log(`  ${(got / 1e6).toFixed(0)} MB${total ? ` / ${(total / 1e6).toFixed(0)} MB` : ""}`);
    }
  });
  await pipeline(body, fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
  log(`Saved ${dest} (${(got / 1e6).toFixed(1)} MB)`);
  return dest;
}
