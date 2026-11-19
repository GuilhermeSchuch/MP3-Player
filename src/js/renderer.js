// Global elements
const audioList                   = document.querySelector("#audioList");
const playSongsBtn                = document.querySelector("#playSongs");
const togglePauseBtn              = document.querySelector("#togglePauseBtn");
const prevSongBtn                 = document.querySelector("#prevSongBtn");
const nextSongBtn                 = document.querySelector("#nextSongBtn");
const backwardBtn                 = document.querySelector("#backwardBtn");
const toggleSettingsbtn           = document.querySelector("#toggleSettingsbtn");
const playlist                    = document.querySelector("#playlist");
const playlistSelect              = document.querySelector("#playlistSelect");
const newPlaylistBtn              = document.querySelector("#newPlaylistBtn");
const renamePlaylistBtn           = document.querySelector("#renamePlaylistBtn");
const deletePlaylistBtn           = document.querySelector("#deletePlaylistBtn");
const volume                      = document.querySelector("#volume");
const songGain                    = document.querySelector("#songGain");
const songGainValue               = document.querySelector("#songGainValue");
const progressBar                 = document.querySelector("#progressBar");
const fileInput                   = document.querySelector("#fileInput");
const loader                      = document.querySelector(".loader");
const selectSongsBtn              = document.querySelector(".selectSongsBtn");
const dialogOverlay               = document.querySelector("#dialogOverlay");
const dialogBox                   = document.querySelector("#dialogBox");
const dialogTitle                 = document.querySelector("#dialogTitle");
const dialogMessage               = document.querySelector("#dialogMessage");
const dialogInput                 = document.querySelector("#dialogInput");
const dialogCancel                = document.querySelector("#dialogCancel");
const dialogConfirm               = document.querySelector("#dialogConfirm");
const APP_NAME                    = "EchoDeck";

// Global configuration
let currentAudioIndex = 0;
const playedSongIds = new Set();
const lyricsView = document.querySelector("#lyricsView");
const lyricsLines = document.querySelector("#lyricsLines");
const lyricsStatus = document.querySelector("#lyricsStatus");
const playlistViewBtn = document.querySelector("#playlistViewBtn");
const lyricsViewBtn = document.querySelector("#lyricsViewBtn");
let showingLyrics = false;
let lyricsRequest = 0;
let timedLines = [];
let highlightedLine = -1;
let isPaused = false;
let isShuffle = false;
let currentLanguage = "pt";
let playlistDocument = playlistModel.createEmptyDocument();
let activePlaylistSongs = [];
const importedFilesByPath = new Map();

const translations = {
  en: {
    playlistView: "Playlist",
    lyricsView: "Lyrics",
    lyricsIdle: "Play a song to see its lyrics.",
    lyricsLoading: "Looking up lyrics…",
    lyricsPlain: "Lyrics available without timing",
    lyricsMissing: "No matching lyrics found.",
    lyricsInstrumental: "Instrumental track",
    lyricsError: "Lyrics service unavailable. Select Lyrics to retry.",
    selectSongs: "Select Songs",
    noPlaylists: "No playlists",
    newPlaylist: "New",
    renamePlaylist: "Rename",
    deletePlaylist: "Delete",
    missing: "Missing",
    locate: "Locate",
    remove: "Remove",
    playlistNamePrompt: "Playlist name:",
    playlistNameRequired: "Please enter a playlist name.",
    confirmDeletePlaylist: "Delete this playlist?",
    confirmDeleteSong: "Remove this missing song?",
    invalidAudioFile: "Please choose an MP3 file.",
    by: "By",
    settings: "Settings",
    language: "Language",
    english: "English",
    portuguese: "Portuguese",
    shuffle: "Shuffle",
    songGain: "Song Gain",
    songGains: "Song gains",
    cancel: "Cancel",
    confirm: "OK",
  },
  pt: {
    playlistView: "Playlist",
    lyricsView: "Letra",
    lyricsIdle: "Toque uma música para ver a letra.",
    lyricsLoading: "Buscando letra…",
    lyricsPlain: "Letra disponível sem sincronização",
    lyricsMissing: "Nenhuma letra encontrada para esta música.",
    lyricsInstrumental: "Música instrumental",
    lyricsError: "Serviço de letras indisponível. Selecione Letra para tentar novamente.",
    selectSongs: "Selecionar Músicas",
    noPlaylists: "Nenhuma playlist",
    newPlaylist: "Nova",
    renamePlaylist: "Renomear",
    deletePlaylist: "Excluir",
    missing: "Ausente",
    locate: "Localizar",
    remove: "Remover",
    playlistNamePrompt: "Nome da playlist:",
    playlistNameRequired: "Digite um nome para a playlist.",
    confirmDeletePlaylist: "Excluir esta playlist?",
    confirmDeleteSong: "Remover esta música ausente?",
    invalidAudioFile: "Selecione um arquivo MP3.",
    by: "Por",
    settings: "Configurações",
    language: "Idioma",
    english: "Inglês",
    portuguese: "Português",
    shuffle: "Aleatório",
    songGain: "Ganho da música",
    songGains: "Ganhos por música",
    cancel: "Cancelar",
    confirm: "OK",
  },
};

const defaultSettings = [
  { name: "shuffle", value: false },
  { name: "language", value: "pt" },
];

function translate(key) {
  return translations[currentLanguage][key] || translations.pt[key] || key;
}

function showLyricsStatus(key) {
  lyricsStatus.dataset.i18n = key;
  lyricsStatus.textContent = key ? translate(key) : "";
}

function syncLyrics() {
  if (!showingLyrics || !timedLines.length) return;
  const time = getCurrentAudio()?.currentTime;
  const next = timedLines.findLastIndex(line => line.time <= time);
  if (next === highlightedLine) return;
  lyricsLines.children[highlightedLine]?.classList.remove("activeLyric");
  highlightedLine = next;
  const row = lyricsLines.children[next];
  if (row) {
    row.classList.add("activeLyric");
    row.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  } else {
    lyricsLines.scrollTop = 0;
  }
}

async function refreshLyrics() {
  const request = ++lyricsRequest;
  if (!showingLyrics) return;
  timedLines = [];
  highlightedLine = -1;
  lyricsLines.replaceChildren();
  lyricsLines.scrollTop = 0;
  const audio = getCurrentAudio();
  const song = audio && audioObj.audioFiles[currentAudioIndex];
  document.querySelector("#lyricsTitle").textContent = song ? getSongDisplayName(song) : "";
  showLyricsStatus(song ? "lyricsLoading" : "lyricsIdle");
  if (!song || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    const result = await window.electronAPI.lookupLyrics(song.id, audio.duration);
    if (request !== lyricsRequest || audio !== getCurrentAudio()) return;
    if (result.kind === "synced") {
      showLyricsStatus("");
      timedLines = result.lines;
      for (const line of timedLines) {
        const row = document.createElement("p");
        row.textContent = line.text;
        lyricsLines.appendChild(row);
      }
      syncLyrics();
    } else if (result.kind === "plain") {
      showLyricsStatus("lyricsPlain");
      lyricsLines.textContent = result.text;
    } else {
      showLyricsStatus(result.kind === "instrumental" ? "lyricsInstrumental" : "lyricsMissing");
    }
  } catch {
    if (request === lyricsRequest) showLyricsStatus("lyricsError");
  }
}

function setLyricsView(visible) {
  showingLyrics = visible;
  lyricsView.hidden = !visible;
  playlist.hidden = visible;
  playlistViewBtn.setAttribute("aria-pressed", String(!visible));
  lyricsViewBtn.setAttribute("aria-pressed", String(visible));
  refreshLyrics();
}

playlistViewBtn.addEventListener("click", () => setLyricsView(false));
lyricsViewBtn.addEventListener("click", () => setLyricsView(true));

function showDialog({ title = APP_NAME, message = "", mode = "message", initialValue = "" }) {
  return new Promise((resolve) => {
    const hasInput = mode === "text";
    const hasCancel = mode === "text" || mode === "confirm";
    let settled = false;

    const close = (value) => {
      if (settled) return;
      settled = true;
      dialogOverlay.hidden = true;
      dialogBox.onsubmit = null;
      dialogCancel.onclick = null;
      resolve(value);
    };

    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogInput.hidden = !hasInput;
    dialogInput.value = initialValue;
    dialogCancel.hidden = !hasCancel;
    dialogCancel.textContent = translate("cancel");
    dialogConfirm.textContent = translate("confirm");
    dialogOverlay.hidden = false;

    dialogBox.onsubmit = (event) => {
      event.preventDefault();
      close(hasInput ? dialogInput.value : true);
    };
    dialogCancel.onclick = () => close(hasInput ? null : false);

    if (hasInput) {
      dialogInput.focus();
      dialogInput.select();
    }
    else {
      dialogConfirm.focus();
    }
  });
}

function requestTextDialog(title, message, initialValue = "") {
  return showDialog({ title, message, mode: "text", initialValue });
}

function showMessageDialog(message) {
  return showDialog({ message, mode: "message" });
}

function showConfirmDialog(message) {
  return showDialog({ message, mode: "confirm" });
}

function getSettingLabel(name) {
  return translate(name);
}

function getLanguage(settings) {
  const languageSetting = Array.isArray(settings)
    ? settings.find((setting) => setting.name === "language")
    : null;

  return languageSetting?.value === "en" ? "en" : "pt";
}

function normalizeSettings(settings) {
  const sourceSettings = Array.isArray(settings) ? settings : [];

  return defaultSettings.map((defaultSetting) => {
    const savedSetting = sourceSettings.find((setting) => setting.name === defaultSetting.name);
    const value = savedSetting?.value === undefined
      ? defaultSetting.value
      : savedSetting.value;

    return {
      name: defaultSetting.name,
      text: getSettingLabel(defaultSetting.name),
      value: defaultSetting.name === "language"
        ? (value === "en" ? "en" : "pt")
        : Boolean(value),
    };
  });
}

function getSongGains(settings) {
  const songGainsSetting = Array.isArray(settings)
    ? settings.find((setting) => setting.name === "songGains")
    : null;

  if (!songGainsSetting?.value || typeof songGainsSetting.value !== "object") {
    return {};
  }

  return { ...songGainsSetting.value };
}

function buildPersistedSettings(settings, songGains) {
  return [
    ...settings,
    { name: "songGains", text: translate("songGains"), value: { ...songGains } },
  ];
}

function getSongGain(songName) {
  const gain = Number(audioObj.songGains[songName]);
  return Number.isFinite(gain) ? Math.max(-12, Math.min(12, gain)) : 0;
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function formatSongGain(db) {
  const numericGain = Number(db);
  return `${numericGain > 0 ? "+" : ""}${numericGain} dB`;
}

function getSongDisplayName(song) {
  return String(song?.name || APP_NAME).replace(/\.mp3$/i, "") || APP_NAME;
}

function setMediaSessionIdentity(song) {
  if ("mediaSession" in navigator && "MediaMetadata" in window) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: getSongDisplayName(song),
      artist: APP_NAME,
      album: getActivePlaylistRecord()?.name || APP_NAME,
    });
  }
}

function buildDiscordActivity(song, currentAudio, paused = false) {
  const activity = {
    title: getSongDisplayName(song).slice(0, 128),
    paused,
  };

  if (Number.isFinite(currentAudio?.currentTime)) {
    activity.positionSeconds = currentAudio.currentTime;
  }

  return activity;
}

function updateDiscordPresence(song, paused = false, currentAudio = getCurrentAudio()) {
  if (!song) {
    return window.electronAPI.clearDiscordPresence().catch(() => {});
  }

  return window.electronAPI
    .updateDiscordPresence(buildDiscordActivity(song, currentAudio, paused))
    .catch(() => {});
}

function syncSongGainControl() {
  const currentSong = audioObj.audioFiles[currentAudioIndex];
  const hasSong = Boolean(currentSong);
  const gain = hasSong ? getSongGain(currentSong.name) : 0;

  songGain.disabled = !hasSong;
  songGain.value = gain;
  songGainValue.textContent = formatSongGain(gain);

  if (audioObj.gainNode) {
    audioObj.gainNode.gain.value = dbToLinear(gain);
  }
}

async function refreshSongGains() {
  const settings = await configObj.getUserSettings();
  audioObj.songGains = getSongGains(settings);
  syncSongGainControl();
}

async function saveSongGain(songName, gain) {
  const savedSettings = await configObj.getUserSettings();
  const songGains = getSongGains(savedSettings);
  songGains[songName] = gain;
  audioObj.songGains = songGains;

  const settings = normalizeSettings(savedSettings);
  settings.forEach((setting) => {
    setting.text = getSettingLabel(setting.name);
  });

  await configObj.saveUserSettings(buildPersistedSettings(settings, songGains));
}

function applyLanguage(language) {
  currentLanguage = language === "en" ? "en" : "pt";
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n);
  });

  renderPlaylistSelector();
  if (!configObj.isSettingsShown) renderPlaylistRows(activePlaylistSongs);
}

const audioObj = {
  audioElements: [],
  audioFiles: [],
  indexBySongId: {},
  volume: .5,
  audioContext: null,
  mediaSource: null,
  gainNode: null,
  songGains: {},
}

const configObj = {
  isSettingsShown: false,
  settingsElement: null,
  getUserSettings: async () => {
    const config = await window.electronAPI.loadConfig();
    return config;
  },
  saveUserSettings: async (newConfig) => {
    await window.electronAPI.saveConfig(newConfig);
  },
  createElement: async () => {
    if (!configObj.settingsElement) {
      const userSettings = await configObj.getUserSettings();
      configObj.settingsElement = buildSettingsElement(userSettings);
    }

    return configObj.settingsElement;
  }
};

function createRecordId(prefix) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getActivePlaylistRecord() {
  return playlistModel.getActivePlaylist(playlistDocument);
}

async function savePlaylistDocument() {
  playlistDocument = playlistModel.normalizeDocument(playlistDocument);
  await window.electronAPI.savePlaylists(playlistDocument);
}

function isMp3File(file) {
  return file && (file.type === "audio/mp3" || file.type === "audio/mpeg" || /\.mp3$/i.test(file.name));
}

function renderPlaylistSelector() {
  playlistSelect.replaceChildren();

  if (playlistDocument.playlists.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.textContent = translate("noPlaylists");
    playlistSelect.appendChild(emptyOption);
  }
  else {
    playlistDocument.playlists.forEach((playlistRecord) => {
      const option = document.createElement("option");
      option.value = playlistRecord.id;
      option.textContent = playlistRecord.name;
      playlistSelect.appendChild(option);
    });
    playlistSelect.value = playlistDocument.activePlaylistId;
  }

  const hasActivePlaylist = Boolean(getActivePlaylistRecord());
  playlistSelect.disabled = !hasActivePlaylist;
  renamePlaylistBtn.disabled = !hasActivePlaylist;
  deletePlaylistBtn.disabled = !hasActivePlaylist;
}

function createMissingSongRow(song) {
  const row = document.createElement("li");
  row.classList.add("missingSong");
  row.dataset.songId = song.id;

  const name = document.createElement("span");
  name.classList.add("missingSongName");
  name.textContent = song.name.replace(".mp3", "");

  const status = document.createElement("span");
  status.classList.add("missingSongStatus");
  status.textContent = translate("missing");

  const locateButton = document.createElement("button");
  locateButton.type = "button";
  locateButton.dataset.action = "locate";
  locateButton.dataset.songId = song.id;
  locateButton.textContent = translate("locate");

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.dataset.action = "remove";
  removeButton.dataset.songId = song.id;
  removeButton.textContent = translate("remove");

  row.append(name, status, locateButton, removeButton);
  return row;
}

function renderPlaylistRows(songRecords) {
  playlist.replaceChildren();

  songRecords.forEach((song) => {
    if (!song.exists) {
      playlist.appendChild(createMissingSongRow(song));
      return;
    }

    const row = document.createElement("li");
    row.classList.add("song");
    row.dataset.songId = song.id;
    row.dataset.playable = "true";
    row.textContent = song.name.replace(".mp3", "");
    playlist.appendChild(row);
  });
  syncSongRowStates();
}

function syncSongRowStates() {
  const currentSongId = getCurrentAudio() ? audioObj.audioFiles[currentAudioIndex]?.id : null;
  for (const row of playlist.children) {
    if (row.dataset.playable !== "true") continue;
    const { songId } = row.dataset;
    const isCurrent = songId === currentSongId;
    row.classList.toggle("songPlaying", isCurrent);
    row.classList.toggle("songPlayed", !isCurrent && playedSongIds.has(songId));
  }
}

function setPlaybackControlsEnabled(enabled) {
  [playSongsBtn, togglePauseBtn, prevSongBtn, nextSongBtn, backwardBtn]
    .forEach((button) => { button.disabled = !enabled; });
}

function getSongRow(songId) {
  return Array.from(playlist.children).find((row) => row.dataset.songId === songId) || null;
}

function scrollToCurrentSong() {
  const currentSong = audioObj.audioFiles[currentAudioIndex];
  const row = currentSong ? getSongRow(currentSong.id) : null;
  row?.scrollIntoView({ block: "start", behavior: "smooth" });
}

async function loadActivePlaylist() {
  pauseCurrentSong({ updatePresence: false });
  window.electronAPI.clearDiscordPresence().catch(() => {});
  dismountSongsElement();
  isPaused = false;
  playSongsBtn.style.display = "flex";
  togglePauseBtn.style.display = "none";
  setPlaybackControlsEnabled(false);
  audioObj.audioFiles = [];
  audioObj.indexBySongId = {};
  currentAudioIndex = 0;
  refreshLyrics();
  playedSongIds.clear();
  progressBar.value = 0;

  const activePlaylist = getActivePlaylistRecord();
  if (!activePlaylist) {
    activePlaylistSongs = [];
    renderPlaylistRows(activePlaylistSongs);
    syncSongGainControl();
    return;
  }

  const inspectedSongs = await window.electronAPI.inspectPlaylistSongs(activePlaylist.songs);
  activePlaylistSongs = inspectedSongs.map((song) => ({
    ...song,
    file: importedFilesByPath.get(playlistModel.normalizePath(song.path)) || null,
  }));
  const playbackQueue = playlistModel.buildPlaybackQueue(activePlaylistSongs);
  audioObj.audioFiles = playbackQueue.songs;
  audioObj.indexBySongId = playbackQueue.indexBySongId;
  renderPlaylistRows(activePlaylistSongs);
  setPlaybackControlsEnabled(audioObj.audioFiles.length > 0);
  syncSongGainControl();
}

async function loadPlaylistDocument() {
  playlistDocument = playlistModel.normalizeDocument(await window.electronAPI.loadPlaylists());
  renderPlaylistSelector();
  await loadActivePlaylist();
}

async function handlePlaylistImport(files) {
  const selectedFiles = Array.from(files || []).filter(isMp3File);
  if (selectedFiles.length === 0) {
    if (files?.length > 0) await showMessageDialog(translate("invalidAudioFile"));
    return;
  }

  if (!getActivePlaylistRecord()) {
    const name = await requestTextDialog(translate("newPlaylist"), translate("playlistNamePrompt"));
    if (!name?.trim()) {
      await showMessageDialog(translate("playlistNameRequired"));
      return;
    }
    playlistDocument = playlistModel.createPlaylist(
      playlistDocument,
      name,
      createRecordId("playlist"),
    );
  }

  const songs = selectedFiles.map((file) => {
    const path = window.electronAPI.getFilePath(file);
    importedFilesByPath.set(playlistModel.normalizePath(path), file);
    return { id: createRecordId("song"), name: file.name, path };
  });

  playlistDocument = playlistModel.addSongs(
    playlistDocument,
    playlistDocument.activePlaylistId,
    songs,
  );
  await savePlaylistDocument();
  renderPlaylistSelector();
  await loadActivePlaylist();
}

async function createPlaylist() {
  const name = await requestTextDialog(translate("newPlaylist"), translate("playlistNamePrompt"));
  if (!name?.trim()) {
    await showMessageDialog(translate("playlistNameRequired"));
    return;
  }

  playlistDocument = playlistModel.createPlaylist(
    playlistDocument,
    name,
    createRecordId("playlist"),
  );
  await savePlaylistDocument();
  renderPlaylistSelector();
  await loadActivePlaylist();
  fileInput.click();
}

async function renameActivePlaylist() {
  const activePlaylist = getActivePlaylistRecord();
  if (!activePlaylist) return;

  const name = await requestTextDialog(
    translate("renamePlaylist"),
    translate("playlistNamePrompt"),
    activePlaylist.name,
  );
  if (!name?.trim()) {
    await showMessageDialog(translate("playlistNameRequired"));
    return;
  }

  playlistDocument = playlistModel.renamePlaylist(playlistDocument, activePlaylist.id, name);
  await savePlaylistDocument();
  renderPlaylistSelector();
}

async function deleteActivePlaylist() {
  const activePlaylist = getActivePlaylistRecord();
  if (!activePlaylist || !await showConfirmDialog(translate("confirmDeletePlaylist"))) return;

  playlistDocument = playlistModel.removePlaylist(playlistDocument, activePlaylist.id);
  await savePlaylistDocument();
  renderPlaylistSelector();
  await loadActivePlaylist();
}

async function locateSong(songId) {
  const activePlaylist = getActivePlaylistRecord();
  const song = activePlaylist?.songs.find((item) => item.id === songId);
  if (!activePlaylist || !song) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".mp3,audio/mpeg,audio/mp3";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!isMp3File(file)) {
      await showMessageDialog(translate("invalidAudioFile"));
      return;
    }

    const path = window.electronAPI.getFilePath(file);
    importedFilesByPath.set(playlistModel.normalizePath(path), file);
    playlistDocument = playlistModel.replaceSongPath(
      playlistDocument,
      activePlaylist.id,
      songId,
      { id: songId, name: file.name, path },
    );
    await savePlaylistDocument();
    await loadActivePlaylist();
  }, { once: true });
  input.click();
}

async function deleteSong(songId) {
  const activePlaylist = getActivePlaylistRecord();
  if (!activePlaylist || !await showConfirmDialog(translate("confirmDeleteSong"))) return;

  playlistDocument = playlistModel.removeSong(playlistDocument, activePlaylist.id, songId);
  await savePlaylistDocument();
  await loadActivePlaylist();
}

function buildSettingsElement(userSettings) {
  const settingsContainer = document.createElement("div");
  settingsContainer.classList.add("settingsContainer");

  const settingsHeader = document.createElement("div");
  settingsHeader.classList.add("settingsHeader");

  const title = document.createElement("h3");
  title.textContent = translate("settings");
  settingsHeader.appendChild(title);

  const settingsContent = document.createElement("div");
  settingsContent.classList.add("settingsContent");

  normalizeSettings(userSettings).forEach((userSetting) => {
    const settingContainer = document.createElement("div");
    settingContainer.classList.add("checkContainer");

    const labelText = document.createElement("p");
    labelText.textContent = getSettingLabel(userSetting.name);
    settingContainer.appendChild(labelText);

    if (userSetting.name === "language") {
      const selectContainer = document.createElement("div");
      selectContainer.classList.add("languageSelect");

      const languageSelect = document.createElement("select");
      languageSelect.id = "languageSelect";
      languageSelect.name = "language";
      languageSelect.dataset.settingName = "language";

      [
        { value: "en", label: translate("english") },
        { value: "pt", label: translate("portuguese") },
      ].forEach((optionData) => {
        const option = document.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label;
        languageSelect.appendChild(option);
      });

      languageSelect.value = userSetting.value;
      selectContainer.appendChild(languageSelect);
      settingContainer.appendChild(selectContainer);
    }
    else {
      const check = document.createElement("div");
      check.classList.add("check");

      const checkbox = document.createElement("input");
      checkbox.id = userSetting.name;
      checkbox.type = "checkbox";
      checkbox.name = userSetting.name;
      checkbox.dataset.settingName = userSetting.name;
      checkbox.checked = userSetting.value;

      const label = document.createElement("label");
      label.htmlFor = userSetting.name;

      check.appendChild(checkbox);
      check.appendChild(label);
      settingContainer.appendChild(check);
    }

    settingsContent.appendChild(settingContainer);
  });

  settingsContainer.appendChild(settingsHeader);
  settingsContainer.appendChild(settingsContent);
  settingsContainer.addEventListener("change", handleSettingChange);

  return settingsContainer;
}

async function handleSettingChange(event) {
  const settingElement = event.target.closest("[data-setting-name]");
  if (!settingElement) return;

  const settings = normalizeSettings(await configObj.getUserSettings());

  if (settingElement.dataset.settingName === "language") {
    const language = settingElement.value === "en" ? "en" : "pt";
    const languageSetting = settings.find((setting) => setting.name === "language");
    languageSetting.value = language;
    currentLanguage = language;
  }
  else {
    const setting = settings.find((item) => item.name === settingElement.name);
    if (setting) setting.value = settingElement.checked;
  }

  settings.forEach((setting) => {
    setting.text = getSettingLabel(setting.name);
  });

  await configObj.saveUserSettings(
    buildPersistedSettings(settings, getSongGains(await configObj.getUserSettings()))
  );
  await parseConfigs();
  applyLanguage(currentLanguage);

  if (configObj.settingsElement) {
    const oldSettingsElement = configObj.settingsElement;
    const newSettingsElement = buildSettingsElement(settings);
    oldSettingsElement.replaceWith(newSettingsElement);
    configObj.settingsElement = newSettingsElement;
  }
}

// Listeners
document.addEventListener("keydown", (e) => {
  if(audioObj.audioFiles.length > 0) {
    switch (e.keyCode) {
      case 80:
        playPreviousSong();
        break;
  
      case 84:
        if(currentAudioIndex === 0 && progressBar.value === 0) {
          playCurrentSong();
        }
        else {
          togglePause();
        }
        break;
  
      case 78:
        playIncomingSong();
        break;

      case 82:
        restartCurrentSong();
        break;

      case 77:
        handleVolume(77);
        break;

      case 85:
        handleVolume(85);
        break;

      case 68:
        handleVolume(68);
        break;

      case 70:
        forwardOrBackSong(1);
        break;

      case 66:
        forwardOrBackSong(-1);
        break;
    
      default:
        break;
    }
  }
});

selectSongsBtn.addEventListener("click", async (event) => {
  if (playlistModel.getImportFlow(playlistDocument) !== "create-playlist-first") return;

  event.preventDefault();
  await createPlaylist();
});

fileInput.addEventListener('change', async (e) => {
  await handlePlaylistImport(e.target.files);
  fileInput.value = "";
});

playlistSelect.addEventListener("change", async (e) => {
  playlistDocument = {
    ...playlistDocument,
    activePlaylistId: e.target.value,
  };
  await savePlaylistDocument();
  await loadActivePlaylist();
});

newPlaylistBtn.addEventListener("click", createPlaylist);
renamePlaylistBtn.addEventListener("click", renameActivePlaylist);
deletePlaylistBtn.addEventListener("click", deleteActivePlaylist);

playlist.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    const songId = actionButton.dataset.songId;
    if (action === "locate") locateSong(songId);
    if (action === "remove") deleteSong(songId);
    return;
  }

  const songRow = event.target.closest("li[data-song-id][data-playable='true']");
  if (!songRow) return;
  const queueIndex = audioObj.indexBySongId[songRow.dataset.songId];
  if (Number.isInteger(queueIndex)) playSongAtIndex(queueIndex);
});

volume.addEventListener("input", () => updateVolume(Number(volume.value)))

songGain.addEventListener("input", (e) => {
  const gain = Number(e.target.value);
  songGainValue.textContent = formatSongGain(gain);

  if (audioObj.gainNode) {
    audioObj.gainNode.gain.value = dbToLinear(gain);
  }
});

songGain.addEventListener("change", async (e) => {
  const currentSong = audioObj.audioFiles[currentAudioIndex];
  if (!currentSong) return;

  await saveSongGain(currentSong.name, Number(e.target.value));
});

playSongsBtn.addEventListener("click", (e) => {
  playCurrentSong();
});

togglePauseBtn.addEventListener("click", (e) => {
  togglePause();
});

prevSongBtn.addEventListener("click", (e) => {
  playPreviousSong();
});

nextSongBtn.addEventListener("click", (e) => {
  playIncomingSong();
});

backwardBtn.addEventListener("click", (e) => {
  restartCurrentSong();
});

toggleSettingsbtn.addEventListener("click", (e) => {
  toggleSettings();
});

progressBar.addEventListener('click', (e) => {
  const clickedX = e.clientX - progressBar.getBoundingClientRect().left;
  const progressBarWidth = progressBar.offsetWidth;
  const clickedPercentage = (clickedX / progressBarWidth) * 100;
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    const newTime = (clickedPercentage / 100) * currentAudio.duration;
    currentAudio.currentTime = newTime;
    updateProgressBar();
    updateDiscordPresence(audioObj.audioFiles[currentAudioIndex], isPaused, currentAudio);
  }
});

function playPreviousSong() {
  if (audioObj.audioFiles.length === 0) return;
  pauseCurrentSong();

  currentAudioIndex--; 
  
  if(currentAudioIndex < 0) {
    currentAudioIndex = audioObj.audioFiles.length - 1;
  } 

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"

  scrollToCurrentSong();
  playCurrentSong({ chooseShuffle: false });
}

function playIncomingSong() {
  if (audioObj.audioFiles.length === 0) return;
  pauseCurrentSong();
  
  const startsNewRun = !isShuffle && currentAudioIndex === audioObj.audioFiles.length - 1;
  if(currentAudioIndex === audioObj.audioFiles.length - 1) {
    currentAudioIndex = 0;
  }
  else {
    currentAudioIndex++;
  }

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  scrollToCurrentSong();
  playCurrentSong({ chooseShuffle: isShuffle, startsNewRun });
}

async function playCurrentSong({ chooseShuffle = isShuffle, startsNewRun = false } = {}) {
  await refreshSongGains();
  if (audioObj.audioFiles.length === 0) return;

  if (startsNewRun) playedSongIds.clear();
  if(chooseShuffle && isShuffle) {
    currentAudioIndex = chooseShuffledSongIndex();
    scrollToCurrentSong();
  }
  
  const currentSong = audioObj.audioFiles[currentAudioIndex];
  const currentAudio = mountSongElement(currentSong);

  if(currentAudio) {
    currentAudio.currentTime = 0;
    currentAudio.volume = audioObj.volume;
    audioObj.audioContext?.resume();
    setMediaSessionIdentity(currentSong);
    syncSongGainControl();
    progressBar.value = 0;
    isPaused = false;

    currentAudio.play();
    refreshLyrics();
    currentAudio.addEventListener("loadedmetadata", () => {
      if (currentAudio === getCurrentAudio()) refreshLyrics();
    });
    currentAudio.addEventListener("seeked", syncLyrics);
    updateDiscordPresence(currentSong, false, currentAudio);

    playedSongIds.add(currentSong.id);
    syncSongRowStates();
    
    playSongsBtn.style.display = "none";
    togglePauseBtn.style.display = "flex";
    togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>";

    currentAudio.removeEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('ended', () => {
      playIncomingSong();
    });
  }
}

function updateProgressBar() {
  syncLyrics();
  const currentAudio = getCurrentAudio();
  const progress = (currentAudio?.currentTime / currentAudio?.duration) * 100;

  if(progress) progressBar.value = progress;
}

function pauseCurrentSong({ updatePresence = true } = {}) {
  const currentAudio = getCurrentAudio()

  if(currentAudio) {
    currentAudio.pause();
    isPaused = true;
    if (updatePresence) {
      updateDiscordPresence(audioObj.audioFiles[currentAudioIndex], true);
    }
  }
}

function togglePause() {
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    if(isPaused) {
      currentAudio.play();
      isPaused = false;
      updateDiscordPresence(audioObj.audioFiles[currentAudioIndex]);

      playSongsBtn.style.display = "none";
      togglePauseBtn.style.display = "flex"
      togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
    }
    else {
      currentAudio.pause();
      isPaused = true;
      updateDiscordPresence(audioObj.audioFiles[currentAudioIndex], true);

      togglePauseBtn.innerHTML = "<img src='./assets/play.ico' alt='PLAY' width='20'>"
    }
  }
}

async function toggleSettings() {
  if (showingLyrics) setLyricsView(false);
  const settings = await configObj.createElement();

  if(configObj.isSettingsShown) {
    configObj.isSettingsShown = false;
    lyricsViewBtn.disabled = false;
    
    settings.remove();
    configObj.settingsElement = null;

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "block";
    })

    scrollToSong({ atIndex: true });

    await parseConfigs();
  }
  else {
    configObj.isSettingsShown = true;
    lyricsViewBtn.disabled = true;

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "none";
    })

    playlist.appendChild(settings);

  }
}

function playSongAtIndex(index) {
  if (!audioObj.audioFiles[index]) return;
  if (currentAudioIndex === index && getCurrentAudio()) return;

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  pauseCurrentSong();
  currentAudioIndex = index;
  scrollToCurrentSong();
  playCurrentSong({ chooseShuffle: false });
}

function restartCurrentSong() {
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    currentAudio.currentTime = 0;
    updateProgressBar();
    updateDiscordPresence(audioObj.audioFiles[currentAudioIndex], isPaused, currentAudio);
  }
}

function scrollToSong({ type = null, atIndex = false }) {
  scrollToCurrentSong();
};

function applyVolume(value) {
  audioObj.volume = value;
  volume.value = value;
  const audio = getCurrentAudio();
  if (audio) audio.volume = value;
}

function updateVolume(value) {
  if (value === audioObj.volume) return;
  applyVolume(value);
  window.electronAPI.saveVolume(value).catch(error => console.error("Unable to save volume", error));
}

function handleVolume(code) {
  const step = code === 85 ? 0.1 : -0.1;
  const value = code === 77 ? 0 : Math.round((audioObj.volume + step) * 10) / 10;
  updateVolume(Math.min(1, Math.max(0, value)));
}

function mountSongElement(song) {
  if(audioObj.audioElements.length > 0) {
    dismountSongsElement();
  }

  if(song?.file || song?.url) {
    const audio = document.createElement('audio');
    audio.setAttribute("data-id", currentAudioIndex)
    audio.controls = true;

    const source = document.createElement('source');
    source.src = song.file ? URL.createObjectURL(song.file) : song.url;
    audio.appendChild(source);

    if (!audioObj.audioContext) {
      audioObj.audioContext = new AudioContext();
    }

    audioObj.mediaSource = audioObj.audioContext.createMediaElementSource(audio);
    audioObj.gainNode = audioObj.audioContext.createGain();
    audioObj.gainNode.gain.value = dbToLinear(getSongGain(song.name));
    audioObj.mediaSource.connect(audioObj.gainNode);
    audioObj.gainNode.connect(audioObj.audioContext.destination);

    audioObj.audioElements.push(audio);

    const listItem = document.createElement('li');
    listItem.appendChild(audio);
    audioList.appendChild(listItem);

    return audio;    
  }
}

function dismountSongsElement() {
  audioObj.mediaSource?.disconnect();
  audioObj.gainNode?.disconnect();
  audioObj.audioElements = [];
  audioObj.mediaSource = null;
  audioObj.gainNode = null;

  Array.from(audioList.children).forEach((li) => {
    li.remove();
  })
}

function getCurrentAudio() {
  const audio = document.querySelector(`[data-id="${currentAudioIndex}"]`);
  return audio;
}

async function parseConfigs() {
  const settings = normalizeSettings(await configObj.getUserSettings());

  const shuffleConfig = settings.find((setting) => setting.name === "shuffle");

  isShuffle = shuffleConfig.value;

  return [shuffleConfig]
}

function chooseShuffledSongIndex() {
  const availableIndexes = [];
  audioObj.audioFiles.forEach((song, index) => {
    if (!playedSongIds.has(song.id)) {
      availableIndexes.push(index);
    }
  });

  if (availableIndexes.length > 0) {
    return availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
  }
  playedSongIds.clear();
  return Math.floor(Math.random() * audioObj.audioFiles.length);
}

function forwardOrBackSong(newTime) {
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    currentAudio.currentTime += newTime;
    updateProgressBar();
    updateDiscordPresence(audioObj.audioFiles[currentAudioIndex], isPaused, currentAudio);
  }
}

async function initializeApp() {
  const settings = await configObj.getUserSettings();
  const savedVolume = Array.isArray(settings) && settings.find(entry => entry.name === "volume")?.value;
  applyVolume(Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1 ? savedVolume : 0.5);
  applyLanguage(getLanguage(settings));

  await parseConfigs();
  await loadPlaylistDocument();
}

initializeApp();
