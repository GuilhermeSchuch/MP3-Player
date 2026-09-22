(function exposePlaylistModel(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  }
  else {
    root.playlistModel = factory();
  }
})(typeof globalThis === "object" ? globalThis : this, () => {
  const VERSION = 1;

  function createEmptyDocument() {
    return {
      version: VERSION,
      activePlaylistId: null,
      playlists: [],
    };
  }

  function createId(prefix) {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizePath(path) {
    return String(path || "")
      .replaceAll("\\", "/")
      .replace(/\/+/g, "/")
      .toLowerCase();
  }

  function normalizeSong(song) {
    if (!song || typeof song !== "object") return null;

    const id = typeof song.id === "string" ? song.id.trim() : "";
    const name = typeof song.name === "string" ? song.name.trim() : "";
    const path = typeof song.path === "string" ? song.path.trim() : "";

    if (!id || !name || !path) return null;
    return { id, name, path };
  }

  function normalizePlaylist(playlist) {
    if (!playlist || typeof playlist !== "object") return null;

    const id = typeof playlist.id === "string" ? playlist.id.trim() : "";
    const name = typeof playlist.name === "string" ? playlist.name.trim() : "";
    if (!id || !name || !Array.isArray(playlist.songs)) return null;

    const songs = [];
    const seenIds = new Set();
    const seenPaths = new Set();

    playlist.songs.forEach((rawSong) => {
      const song = normalizeSong(rawSong);
      if (!song || seenIds.has(song.id) || seenPaths.has(normalizePath(song.path))) return;

      seenIds.add(song.id);
      seenPaths.add(normalizePath(song.path));
      songs.push(song);
    });

    return { id, name, songs };
  }

  function normalizeDocument(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.playlists)) {
      return createEmptyDocument();
    }

    const playlists = [];
    const seenIds = new Set();

    value.playlists.forEach((rawPlaylist) => {
      const playlist = normalizePlaylist(rawPlaylist);
      if (!playlist || seenIds.has(playlist.id)) return;

      seenIds.add(playlist.id);
      playlists.push(playlist);
    });

    const requestedActiveId = typeof value.activePlaylistId === "string"
      ? value.activePlaylistId
      : null;

    return {
      version: VERSION,
      activePlaylistId: seenIds.has(requestedActiveId)
        ? requestedActiveId
        : (playlists[0]?.id || null),
      playlists,
    };
  }

  function replacePlaylist(document, playlistId, replacement) {
    return {
      ...document,
      playlists: document.playlists.map((playlist) => (
        playlist.id === playlistId ? replacement : playlist
      )),
    };
  }

  function createPlaylist(document, name, id = createId("playlist")) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) throw new Error("Playlist name cannot be blank");

    const playlist = { id, name: trimmedName, songs: [] };
    return {
      ...document,
      activePlaylistId: id,
      playlists: [...document.playlists, playlist],
    };
  }

  function renamePlaylist(document, playlistId, name) {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) throw new Error("Playlist name cannot be blank");
    return replacePlaylist(document, playlistId, {
      ...document.playlists.find((playlist) => playlist.id === playlistId),
      name: trimmedName,
    });
  }

  function removePlaylist(document, playlistId) {
    const playlists = document.playlists.filter((playlist) => playlist.id !== playlistId);
    const activePlaylistId = document.activePlaylistId === playlistId
      ? (playlists[0]?.id || null)
      : document.activePlaylistId;

    return { ...document, activePlaylistId, playlists };
  }

  function addSongs(document, playlistId, songs) {
    const playlist = document.playlists.find((item) => item.id === playlistId);
    if (!playlist) return document;

    const knownPaths = new Set(playlist.songs.map((song) => normalizePath(song.path)));
    const additions = [];

    songs.forEach((rawSong) => {
      const song = normalizeSong(rawSong);
      if (!song || knownPaths.has(normalizePath(song.path))) return;

      knownPaths.add(normalizePath(song.path));
      additions.push(song);
    });

    return replacePlaylist(document, playlistId, {
      ...playlist,
      songs: [...playlist.songs, ...additions],
    });
  }

  function replaceSongPath(document, playlistId, songId, replacement) {
    const song = normalizeSong(replacement);
    const playlist = document.playlists.find((item) => item.id === playlistId);
    if (!song || !playlist) return document;

    const duplicatePath = playlist.songs.some((item) => (
      item.id !== songId && normalizePath(item.path) === normalizePath(song.path)
    ));
    if (duplicatePath) return document;

    return replacePlaylist(document, playlistId, {
      ...playlist,
      songs: playlist.songs.map((item) => item.id === songId ? song : item),
    });
  }

  function removeSong(document, playlistId, songId) {
    const playlist = document.playlists.find((item) => item.id === playlistId);
    if (!playlist) return document;

    return replacePlaylist(document, playlistId, {
      ...playlist,
      songs: playlist.songs.filter((song) => song.id !== songId),
    });
  }

  function getActivePlaylist(document) {
    return document.playlists.find((playlist) => playlist.id === document.activePlaylistId) || null;
  }

  function getPlayableSongs(songs) {
    return Array.isArray(songs)
      ? songs.filter((song) => song.exists === true)
      : [];
  }

  function buildPlaybackQueue(songs) {
    const playableSongs = getPlayableSongs(songs);
    return {
      songs: playableSongs,
      indexBySongId: Object.fromEntries(
        playableSongs.map((song, index) => [song.id, index]),
      ),
    };
  }

  return {
    addSongs,
    createEmptyDocument,
    createPlaylist,
    buildPlaybackQueue,
    getActivePlaylist,
    getPlayableSongs,
    normalizeDocument,
    normalizePath,
    removePlaylist,
    removeSong,
    renamePlaylist,
    replaceSongPath,
  };
});
