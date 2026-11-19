const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const id3 = require("node-id3");

async function readTags(filePath) {
  const file = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(10);
    await file.read(header, 0, 10, 0);
    if (header.toString("ascii", 0, 3) !== "ID3") return {};
    const size = header.subarray(6).reduce((n, byte) => n * 128 + (byte & 127), 0);
    if (size > 16 * 1024 * 1024) return {};
    const buffer = Buffer.alloc(size + 10);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return id3.read(buffer.subarray(0, bytesRead), { include: ["TIT2", "TPE1", "TALB"], noRaw: true });
  } finally {
    await file.close();
  }
}

function parseLyrics(source) {
  const lines = [];
  const offsetMs = Number(source.match(/\[offset:\s*([+-]?\d+)\]/i)?.[1] || 0);
  for (const line of source.split(/\r?\n/)) {
    const stamps = /^\s*((?:\[\d+:\d{2}(?:\.\d+)?\]\s*)+)/.exec(line);
    if (!stamps) continue;
    const text = line.slice(stamps[0].length).trim();
    for (const stamp of stamps[1].matchAll(/\[(\d+):(\d{2}(?:\.\d+)?)\]/g)) {
      const startMs = Number(stamp[1]) * 60000 + Math.round(Number(stamp[2]) * 1000);
      lines.push({ time: (startMs - offsetMs) / 1000, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function lyricsFrom(record) {
  const lines = parseLyrics(record.syncedLyrics || "");
  if (lines.some(line => line.text)) return { kind: "synced", lines };
  if (record.plainLyrics?.trim()) return { kind: "plain", text: record.plainLyrics };
  if (record.instrumental) return { kind: "instrumental" };
  return { kind: "missing" };
}

const normalize = value => (value || "").normalize("NFKC").trim().toLowerCase();

async function lookupLyrics(filePath, duration, cacheDir, fetchLyrics = fetch) {
  const tags = await readTags(filePath).catch(() => ({}));
  const filename = path.parse(filePath).name;
  const separator = filename.indexOf(" - ");
  const title = tags.title || (separator < 0 ? filename : filename.slice(separator + 3));
  const artist = tags.artist || (separator < 0 ? "" : filename.slice(0, separator));
  const album = tags.album || "";
  const key = createHash("sha256").update(JSON.stringify([title, artist, album, Math.round(duration)])).digest("hex");
  const cacheFile = path.join(cacheDir, key + ".json");
  try {
    const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
    if (cached.kind === "plain" && typeof cached.text === "string" ||
        cached.kind === "synced" && Array.isArray(cached.lines) ||
        cached.kind === "instrumental") return cached;
  } catch { /* Missing or unreadable cache entries are fetched again. */ }

  const url = new URL("https://lrclib.net/api/search");
  url.searchParams.set("track_name", title);
  if (artist) url.searchParams.set("artist_name", artist);
  const response = await fetchLyrics(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "EchoDeck (desktop lyrics player)" } });
  if (!response.ok) throw new Error("Lyrics provider unavailable");
  const records = await response.json();
  const candidates = records.filter(record => normalize(record.trackName) === normalize(title) &&
    (!artist || normalize(record.artistName) === normalize(artist)) &&
    Number.isFinite(record.duration) && Math.abs(record.duration - duration) <= 3);
  if (!artist && new Set(candidates.map(record => normalize(record.artistName))).size > 1) return { kind: "missing" };
  const matches = candidates.map(record => ({ record, lyrics: lyricsFrom(record) }))
    .filter(match => match.lyrics.kind !== "missing");
  const albumMatches = match => Boolean(album) && normalize(match.record.albumName) === normalize(album);
  matches.sort((a, b) => Number(albumMatches(b)) - Number(albumMatches(a)) ||
    Number(b.lyrics.kind === "synced") - Number(a.lyrics.kind === "synced") ||
    Math.abs(a.record.duration - duration) - Math.abs(b.record.duration - duration));
  const result = matches[0]?.lyrics || { kind: "missing" };
  if (result.kind !== "missing") {
    const temp = cacheFile + "." + randomUUID();
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(temp, JSON.stringify(result));
      await fs.rename(temp, cacheFile);
    } catch { await fs.unlink(temp).catch(() => {}); }
  }
  return result;
}

module.exports = { lookupLyrics, parseLyrics };
