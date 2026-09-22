const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { normalizeDocument } = require("./playlist-model");

function loadPlaylists(filePath, logger = () => {}) {
  if (!fs.existsSync(filePath)) return normalizeDocument(null);

  try {
    return normalizeDocument(JSON.parse(fs.readFileSync(filePath, "utf8")));
  }
  catch (error) {
    logger(`Unable to load playlists: ${error.message}`);
    return normalizeDocument(null);
  }
}

function savePlaylists(filePath, document) {
  const normalizedDocument = normalizeDocument(document);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(normalizedDocument, null, 2));
}

function inspectPlaylistSongs(songs) {
  return songs.map((song) => {
    const exists = fs.existsSync(song.path);
    return {
      ...song,
      exists,
      url: exists ? pathToFileURL(song.path).href : null,
    };
  });
}

module.exports = {
  inspectPlaylistSongs,
  loadPlaylists,
  savePlaylists,
};
