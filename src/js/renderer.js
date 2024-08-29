// Global elements
const audioList                   = document.querySelector("#audioList");
const playSongsBtn                = document.querySelector("#playSongs");
const togglePauseBtn              = document.querySelector("#togglePauseBtn");
const prevSongBtn                 = document.querySelector("#prevSongBtn");
const nextSongBtn                 = document.querySelector("#nextSongBtn");
const backwardBtn                 = document.querySelector("#backwardBtn");
const currentSongPlaying          = document.querySelector("#currentSongPlaying");
const currentSongPlayingContainer = document.querySelector("#currentSongPlayingContainer");
const toggleLyricBtn              = document.querySelector("#toggleLyricBtn");
const playlist                    = document.querySelector("#playlist");
const volume                      = document.querySelector("#volume");
const progressBar                 = document.querySelector("#progressBar");
const html                        = document.querySelector("html");
const fileInput                   = document.querySelector("#fileInput");
const loader                      = document.querySelector(".loader");

// Global configuration
let currentAudioIndex = 0;
let isPaused = false;
let isLoop = true;
let lyric = '';

const audioObj = {
  audioElements: [],
  audioFiles: [],
  volume: .5,
}

const lyricObj = {
  isLyricShown: false,
  lyricScroll: null,
  lyricAutoScroll: false
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
  settings: {
    element: "div",
    classList: ["checkContainer"],
    children: [
      {element: "p", textContent: true},
      {element: "div", classList: ["check"], children: [
        {element: "input", attributes: [
          {name: "id", value: "FILL"},
          {name: "type", value: "checkbox"},
          {name: "name", value: "FILL"},          
          {name: "data-name", value: "DATA-NAME"}
        ]},
        {element: "label", attributes: [{name: "for", value: "FILL"}]},
      ]},
    ]
  },
  createElement: async () => {
    if (!configObj.settingsElement) {
      const settingsContainer = document.createElement("div");
      settingsContainer.classList.add("settingsContainer");

      const settingsHeader = document.createElement("div");
      settingsHeader.classList.add("settingsHeader");

      const title = document.createElement("h3");
      title.innerHTML = "Configurações";
      settingsHeader.appendChild(title);

      const settingsContent = document.createElement("div");
      settingsContent.classList.add("settingsContent");

      const userSettings = await configObj.getUserSettings();
      const settings = configObj.settings;

      userSettings.forEach((userSetting) => {
        const checkContainer = document.createElement(settings.element);
        settings.classList.forEach((item) => checkContainer.classList.add(item));

        settings.children.forEach((child) => {
          const element = document.createElement(child.element);

          if(child.textContent) element.textContent = userSetting.text;

          if(child.classList) {
            child.classList.forEach((item) => element.classList.add(item))
          }

          if(child.children) {
            child.children.forEach((item) => {
              const elementChild = document.createElement(item.element);

              item.attributes.forEach((attr) => {
                let attrVlue = attr.value;
                if (attrVlue === "FILL") attrVlue = userSetting.name;
                if (attrVlue === "DATA-NAME") attrVlue = userSetting.text;

                if(userSetting.value) {
                  elementChild.setAttribute("checked", true);
                }
                else {
                  elementChild.removeAttribute("checked");
                }

                elementChild.setAttribute(attr.name, attrVlue);
              })

              element.appendChild(elementChild);
            })
          }

          checkContainer.appendChild(element);
        })
        settingsContent.appendChild(checkContainer);
      })

      settingsContainer.appendChild(settingsHeader);
      settingsContainer.appendChild(settingsContent);

      configObj.settingsElement = settingsContainer;
    }

    return configObj.settingsElement;
  }
};

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

      case 76:
        toggleLyric();
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

      case 65:
        toggleLyricAutoScroll();
        break;

      case 75:
        toggleLoop();
        break;
    
      default:
        break;
    }
  }
});

fileInput.addEventListener('change', (e) => {
  const files = e.target.files;

  loadSongs(files);
  
  playSongsBtn.style.display = "flex";
  togglePauseBtn.style.display = "none";

  lyric = document.createElement('li');
  lyric.classList = "lyric";
  playlist.append(lyric);

  document.querySelectorAll("button").forEach((button) => {
    button.disabled = false;
  });
});

volume.addEventListener("input", (e) => {
  const volume = e.target.value;
  const currentAudio = getCurrentAudio();

  if(currentAudio) currentAudio.volume = volume;
  audioObj.volume = volume;
})

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

toggleLyricBtn.addEventListener("click", (e) => {
  toggleSettings();
  // toggleLyric();
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

function playCurrentSong() {
  const currentAudio = mountSongElement(audioObj.audioFiles[currentAudioIndex]);

  if(currentAudio) {
    currentAudio.currentTime = 0;
    currentAudio.volume = audioObj.volume;
    progressBar.value = 0;
    isPaused = false;

    currentAudio.play();

    if(lyricObj.isLyricShown) {
      playlist.scrollTo(0, 0);
      currentSongPlaying.innerHTML = `Tocando agora: <span>${audioObj.audioFiles[currentAudioIndex].name.replace(".mp3", '')}</span>`;      

      if(currentSongPlaying.textContent.length > 48) {
        currentSongPlaying.classList.add("scroll");
      }
      else {
        currentSongPlaying.classList.remove("scroll");
      }
    }

    document.querySelectorAll("li").forEach((song) => {
      song.classList.remove("songPlaying");
    })

    playlist.children[currentAudioIndex].classList.toggle("songPlaying");
    
    playSongsBtn.style.display = "none";
    togglePauseBtn.style.display = "flex";

    currentAudio.removeEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('ended', () => {
      if(currentAudioIndex === audioObj.audioFiles.length - 1) {
        if(!isLoop) {
          
        }
        else{
          playIncomingSong();
        }
      }
      else {
        playIncomingSong();
      }
    });
  }
}

function updateProgressBar() {
  const currentAudio = getCurrentAudio();
  const progress = (currentAudio?.currentTime / currentAudio?.duration) * 100;

  if(progress) progressBar.value = progress;
  
  if(lyricObj.lyricAutoScroll) {
    const lyricsContainer = document.querySelector('.lyric');
    const verses = lyricsContainer.children;

    if(verses.length > 0) {
      Array.from(verses).forEach((verse) => {
        verse.classList.remove("versePlayling");
      })

      if(progressBar.value < 100) {
        const scrollBarValue = parseInt((Math.floor(progressBar.value) / 100) * verses.length);

        if(scrollBarValue !== lyricObj.lyricScroll) {
          playlist.scrollBy(0, 21);

          lyricObj.lyricScroll = scrollBarValue;
        }

        verses[scrollBarValue].classList.add("versePlayling");
      }
    }
  }
}

function toggleLyricAutoScroll() {
  lyricObj.lyricAutoScroll = !lyricObj.lyricAutoScroll;

  if(!lyricObj.lyricAutoScroll) {
    const lyricsContainer = document.querySelector('.lyric');
    const verses = lyricsContainer.children;
    
    Array.from(verses).forEach((verse) => {
      verse.classList.remove("versePlayling");
    })

    playlist.scrollTo(0, 0);
  }
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

function toggleLyric() {
  const currentAudio = audioObj.audioFiles[currentAudioIndex].name.replace(".mp3", '');

  if(lyricObj.isLyricShown) {
    currentSongPlaying.innerHTML = ``;
    currentSongPlayingContainer.style.display = "none";
    lyricObj.isLyricShown = false;

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "block";
    })

    lyric.style.display = "none";

    Array.from(lyric.children).forEach((verse) => {
      verse.remove();
    })

    scrollToSong({ atIndex: true });
  }
  else {
    currentSongPlayingContainer.style.display = "block";
    lyricObj.isLyricShown = true;

    currentSongPlaying.innerHTML = `Tocando agora: <span>${audioObj.audioFiles[currentAudioIndex].name.replace(".mp3", '')}</span>`;      

    if(currentSongPlaying.textContent.length > 48) {
      currentSongPlaying.classList.add("scroll");
    }
    else {
      currentSongPlaying.classList.remove("scroll");
    }

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "none";
    })

    lyric.style.display = "block";

    fetchLyric(audioObj.audioFiles[currentAudioIndex].name);
    
  }
}

async function toggleSettings() {
  const settings = await configObj.createElement();

  if(configObj.isSettingsShown) {
    configObj.isSettingsShown = false;

    currentSongPlaying.innerHTML = ``;
    currentSongPlayingContainer.style.display = "none";
    
    settings.remove();

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "block";
    })

    scrollToSong({ atIndex: true });
  }
  else {
    configObj.isSettingsShown = true;

    if(currentSongPlaying.innerHTML.length > 0) {
      currentSongPlayingContainer.style.display = "block";
      currentSongPlaying.innerHTML = `Tocando agora: <span>${audioObj.audioFiles[currentAudioIndex].name.replace(".mp3", '')}</span>`;

      if(currentSongPlaying.textContent.length > 48) {
        currentSongPlaying.classList.add("scroll");
      }
      else {
        currentSongPlaying.classList.remove("scroll");
      }
    }

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "none";
    })

    playlist.appendChild(settings);

    const settingsCheckboxs = document.querySelectorAll("input[type='checkbox']");
    
    settingsCheckboxs.forEach((checkbox) => {
      checkbox.addEventListener("change", async () => {
        const newConfig = [];

        settingsCheckboxs.forEach((settingCheckbox) => {
          const { name, checked: value } = settingCheckbox;
          const text = checkbox.getAttribute("data-name");

          newConfig.push({name, text, value});
        })

        await configObj.saveUserSettings(newConfig);
      })
    })
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

async function fetchLyric(songTitle) {
  const artist = songTitle.split(' - ')[0];
  const song = songTitle.split(' - ')[1].replace(".mp3", '');

  const API_KEY = document.querySelector("#API_KEY").textContent;
  const URL = "https://api.vagalume.com.br/search.php";

  try {
    const response = await fetch(`${URL}?art=${artist}&mus=${song}&apikey=${API_KEY}`);
    const fetchedLyric = await response.json();

    const songLyric = fetchedLyric?.mus[0]?.text;    

    Array.from(lyric.children).forEach((verse) => {
      verse.remove();
    })
  
    if(songLyric) {
      let songVerses = songLyric.split("\n");
      lyric.innerHTML = '';
  
      songVerses.forEach((verse) => {
        const span = document.createElement("span");
        span.style.display = "block";
        span.innerHTML = verse;
  
        lyric.appendChild(span);
      })
    }
    else {
      lyric.innerHTML = "Letras não encontradas";
    }

    Array.from(lyric.children).forEach((verse) => {
      if(verse.textContent === '') verse.remove();
    })
    
  } catch (error) {
    lyric.innerHTML = "Letras não encontradas";
  }
}

function scrollToSong({ type = null, atIndex = false }) {
  if(!lyricObj.isLyricShown) {
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
  }
  else {
    fetchLyric(audioObj.audioFiles[currentAudioIndex].name);
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

    audioObj.audioElements.push(audio);

    const listItem = document.createElement('li');
    listItem.appendChild(audio);
    audioList.appendChild(listItem);

    return audio;    
  }
}

function dismountSongsElement() {
  audioObj.audioElements = [];

  Array.from(audioList.children).forEach((li) => {
    li.remove();
  })
}

function getCurrentAudio() {
  const audio = document.querySelector(`[data-id="${currentAudioIndex}"]`);
  return audio;
}

function toggleLoop() {
  isLoop = !isLoop;
}