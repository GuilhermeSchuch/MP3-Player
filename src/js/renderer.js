// Global elements
const audioList                   = document.querySelector("#audioList");
const playSongsBtn                = document.querySelector("#playSongs");
const togglePauseBtn              = document.querySelector("#togglePauseBtn");
const prevSongBtn                 = document.querySelector("#prevSongBtn");
const nextSongBtn                 = document.querySelector("#nextSongBtn");
const backwardBtn                 = document.querySelector("#backwardBtn");
const toggleSettingsbtn           = document.querySelector("#toggleSettingsbtn");
const playlist                    = document.querySelector("#playlist");
const volume                      = document.querySelector("#volume");
const songGain                    = document.querySelector("#songGain");
const songGainValue               = document.querySelector("#songGainValue");
const progressBar                 = document.querySelector("#progressBar");
const fileInput                   = document.querySelector("#fileInput");
const loader                      = document.querySelector(".loader");

// Global configuration
let currentAudioIndex = 0;
let randomicSongsPlayed = [];
let isPaused = false;
let isShuffle = false;
let currentLanguage = "pt";

const translations = {
  en: {
    selectSongs: "Select Songs",
    by: "By",
    settings: "Settings",
    language: "Language",
    english: "English",
    portuguese: "Portuguese",
    shuffle: "Shuffle",
    songGain: "Song Gain",
    songGains: "Song gains",
  },
  pt: {
    selectSongs: "Selecionar Músicas",
    by: "Por",
    settings: "Configurações",
    language: "Idioma",
    english: "Inglês",
    portuguese: "Português",
    shuffle: "Aleatório",
    songGain: "Ganho da música",
    songGains: "Ganhos por música",
  },
};

const defaultSettings = [
  { name: "shuffle", value: false },
  { name: "language", value: "pt" },
];

function translate(key) {
  return translations[currentLanguage][key] || translations.pt[key] || key;
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

}

const audioObj = {
  audioElements: [],
  audioFiles: [],
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

fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  loadSongs(files);
  
  playSongsBtn.style.display = "flex";
  togglePauseBtn.style.display = "none";

  document.querySelectorAll("button").forEach((button) => {
    button.disabled = false;
  });

  if(configObj.isSettingsShown) configObj.isSettingsShown = false;
  await parseConfigs();
});

volume.addEventListener("input", (e) => {
  const volume = e.target.value;
  const currentAudio = getCurrentAudio();

  if(currentAudio) currentAudio.volume = volume;
  audioObj.volume = volume;
})

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
  }
});

function playPreviousSong() {
  pauseCurrentSong();

  currentAudioIndex--; 
  
  if(currentAudioIndex < 0) {
    currentAudioIndex = audioObj.audioFiles.length - 1;
  } 

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"

  scrollToSong({ type: "previous" });
  playCurrentSong();
}

function playIncomingSong() {
  pauseCurrentSong();
  
  if(currentAudioIndex === audioObj.audioFiles.length - 1) {
    currentAudioIndex = 0;
  }
  else {
    currentAudioIndex++;
  }

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  scrollToSong({ type: "incoming" });
  playCurrentSong();
}

async function playCurrentSong() {
  await refreshSongGains();

  if(isShuffle) {
    currentAudioIndex = getRandomNumber(audioObj.audioFiles.length - 1);
    scrollToSong({ atIndex: true });
  }
  
  const currentAudio = mountSongElement(audioObj.audioFiles[currentAudioIndex]);

  if(currentAudio) {
    currentAudio.currentTime = 0;
    currentAudio.volume = audioObj.volume;
    audioObj.audioContext?.resume();
    syncSongGainControl();
    progressBar.value = 0;
    isPaused = false;

    currentAudio.play();

    document.querySelectorAll("li").forEach((song) => {
      song.classList.remove("songPlaying");
    })

    playlist.children[currentAudioIndex].classList.toggle("songPlaying");
    
    playSongsBtn.style.display = "none";
    togglePauseBtn.style.display = "flex";

    currentAudio.removeEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('ended', () => {
      playIncomingSong();
    });
  }
}

function updateProgressBar() {
  const currentAudio = getCurrentAudio();
  const progress = (currentAudio?.currentTime / currentAudio?.duration) * 100;

  if(progress) progressBar.value = progress;
}

function pauseCurrentSong() {
  const currentAudio = getCurrentAudio()

  if(currentAudio) {
    currentAudio.pause();
    isPaused = true;
  }

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
}

function togglePause() {
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    if(isPaused) {
      currentAudio.play();
      isPaused = false;

      playSongsBtn.style.display = "none";
      togglePauseBtn.style.display = "flex"
      togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
    }
    else {
      currentAudio.pause();
      isPaused = true;

      togglePauseBtn.innerHTML = "<img src='./assets/play.ico' alt='PLAY' width='20'>"
    }
  }
}

async function toggleSettings() {
  const settings = await configObj.createElement();

  if(configObj.isSettingsShown) {
    configObj.isSettingsShown = false;
    
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

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "none";
    })

    playlist.appendChild(settings);

  }
}

function playSongAtIndex(index) {
  if (currentAudioIndex === index) return;

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  pauseCurrentSong();
  currentAudioIndex = index;

  scrollToSong({ atIndex: true });
  playCurrentSong();
}

function restartCurrentSong() {
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    currentAudio.currentTime = 0;
    updateProgressBar();
  }
}

function scrollToSong({ type = null, atIndex = false }) {
  if(atIndex) {
    playlist.scrollTo(0, 0);
    playlist.scrollBy(0, currentAudioIndex * 21);
  }
  else {
    if(type === "previous") {
      if(audioObj.audioFiles.length === currentAudioIndex + 1) {
        playlist.scrollBy(0, currentAudioIndex * 21);
      }
      else {
        playlist.scrollBy(0, -21);
      }
    }

    if(type === "incoming") {
      if(currentAudioIndex === 0) {
        playlist.scrollTo(0, 0);
      }
      else {
        playlist.scrollBy(0, 21);
      }
    }
  }
};

function handleVolume(code) {
  let newVolume = audioObj.volume;

  switch (code) {
    case 77:
      newVolume = 0;

      audioObj.volume = newVolume;
      volume.value = newVolume;
      break;

    case 85:
      if(volume.value != 1) {
        newVolume = Math.round((parseFloat(audioObj.volume) + 0.1) * 10) / 10;

        audioObj.volume = newVolume;
        volume.value = newVolume;
      }
      break;

    case 68:
      if(volume.value != 0) {
        newVolume = Math.round((parseFloat(audioObj.volume) - 0.1) * 10) / 10;

        audioObj.volume = newVolume;
        volume.value = newVolume;
      }
      break;
  
    default:
      break;
  }

  getCurrentAudio().volume = newVolume;
}

function loadSongs (files) {
  audioObj.audioElements = [];
  audioObj.audioFiles = [];
  audioObj.volume = volume.value;
  currentAudioIndex = 0;
  randomicSongsPlayed = [];

  Array.from(playlist.children).forEach((li) => {
    if(!Array.from(li.classList).includes("loader")) {
      li.remove();
    }
  })

  audioList.innerHTML = '';
  progressBar.value = 0;

  Array.from(files).forEach((file) => {
    audioObj.audioFiles.push(file);

    const songItem = document.createElement("li");
    songItem.textContent = file.name.replace(".mp3", '');
    songItem.classList.add("song");
    playlist.appendChild(songItem);

    songItem.addEventListener("click", () => {
      document.querySelectorAll("li").forEach((song) => {
        song.classList.remove("songPlaying")
      })
      playSongAtIndex(Array.from(playlist.children).indexOf(songItem));
    });
  })

  refreshSongGains();

}

function mountSongElement(file) {
  if(audioObj.audioElements.length > 0) {
    dismountSongsElement();
  }

  if(file.type === "audio/mp3" || file.type === "audio/mpeg") {
    const audio = document.createElement('audio');
    audio.setAttribute("data-id", currentAudioIndex)
    audio.controls = true;

    const source = document.createElement('source');
    source.src = URL.createObjectURL(file);
    audio.appendChild(source);

    if (!audioObj.audioContext) {
      audioObj.audioContext = new AudioContext();
    }

    audioObj.mediaSource = audioObj.audioContext.createMediaElementSource(audio);
    audioObj.gainNode = audioObj.audioContext.createGain();
    audioObj.gainNode.gain.value = dbToLinear(getSongGain(file.name));
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

function getRandomNumber(max) {
  let availableIndexes = [];

  for(let index = 0; index <= max; index++) {
    if(!randomicSongsPlayed.includes(index)) {
      availableIndexes.push(index);
    }
  }

  if(availableIndexes.length === 0) {
    randomicSongsPlayed = [];
    availableIndexes = Array.from({ length: max + 1 }, (_, index) => index);
  }

  const newIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
  randomicSongsPlayed.push(newIndex);  
  return newIndex;
}

function forwardOrBackSong(newTime) {
  const currentAudio = getCurrentAudio();

  if(currentAudio) {
    currentAudio.currentTime += newTime;
    updateProgressBar();
  }
}

async function initializeApp() {
  const settings = await configObj.getUserSettings();
  applyLanguage(getLanguage(settings));

  if (Array.isArray(settings) && settings.some((setting) => ["lyricsAutoScroll", "loop"].includes(setting.name))) {
    const cleanedSettings = normalizeSettings(settings);
    cleanedSettings.forEach((setting) => {
      setting.text = getSettingLabel(setting.name);
    });
    await configObj.saveUserSettings(
      buildPersistedSettings(cleanedSettings, getSongGains(settings))
    );
  }

  await parseConfigs();
}

initializeApp();
