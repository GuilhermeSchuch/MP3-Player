const audioList = document.querySelector("#audioList");
const playSongsBtn = document.querySelector("#playSongs");
const togglePauseBtn = document.querySelector("#togglePauseBtn");
const prevSongBtn = document.querySelector("#prevSongBtn");
const nextSongBtn = document.querySelector("#nextSongBtn");
const backwardBtn = document.querySelector("#backwardBtn");
const currentSongPlaying = document.querySelector("#currentSongPlaying");
const toggleLyricBtn = document.querySelector("#toggleLyricBtn");
const playlist = document.querySelector("#playlist");
const volume = document.querySelector("#volume");
const progressBar = document.querySelector("#progressBar");
const html = document.querySelector("html");
const fileInput = document.querySelector("#fileInput");
const loader = document.querySelector(".loader");

// Feat - Performance changes

let currentAudioIndex = 0;
let isPaused = false;
let isLyricShown = false;
let lyric = '';
let lyricScroll = null;

const audioObj = {
  audioElements: [],
  audioFiles: [],
  volume: .5,
}

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
  toggleLyric();
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

    if(isLyricShown) {
      currentSongPlaying.innerHTML = `Tocando agora: <span>${audioObj.audioFiles[currentAudioIndex].name.replace(".mp3", '')}</span>`;
    }

    document.querySelectorAll("li").forEach((song) => {
      song.classList.remove("songPlaying")
    })

    playlist.children[currentAudioIndex].classList.toggle("songPlaying");
    
    playSongsBtn.style.display = "none";
    togglePauseBtn.style.display = "flex";

    currentAudio.removeEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('timeupdate', updateProgressBar);
    currentAudio.addEventListener('ended', () => {
      if(currentAudioIndex != audioObj.audioFiles.length - 1) {        
        playIncomingSong();
      }
      else {
        currentAudioIndex = 0;
        playSongsBtn.style.display = "flex";
        togglePauseBtn.style.display = "none";
        playIncomingSong();
      }
    });
  }
}

function updateProgressBar() {
  const currentAudio = getCurrentAudio();
  const progress = (currentAudio?.currentTime / currentAudio?.duration) * 100;

  if(progress) progressBar.value = progress;

  // if(isLyricShown) {
  //   const lyricsContainer = document.querySelector('.lyric');
  //   const verses = lyricsContainer.children;

  //   if(verses.length > 0) {
  //     Array.from(verses).forEach((verse) => {
  //       verse.classList.remove("versePlayling");
  //     })

  //     if(progressBar.value < 100) {
  //       const scrollBarValue = parseInt((Math.floor(progressBar.value) / 100) * verses.length);

  //       if(scrollBarValue !== lyricScroll) {
  //         playlist.scrollBy(0, 21);

  //         lyricScroll = scrollBarValue;
  //       }

  //       verses[scrollBarValue].classList.add("versePlayling");
  //     }
  //   }
  // }
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

  if(isLyricShown) {
    currentSongPlaying.innerHTML = ``;
    isLyricShown = false;

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
    currentSongPlaying.innerHTML = `Tocando agora: <span>${currentAudio}</span>`;
    isLyricShown = true;

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "none";
    })

    lyric.style.display = "block";

    fetchLyric(audioObj.audioFiles[currentAudioIndex].name);
    
    playlist.scrollBy(0, 0);
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

    // https://api.vagalume.com.br/docs/letras/#apidoc_ex1
    // https://gist.github.com/lenivene/afb11929910b2dc8cb02

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
  if(!isLyricShown) {
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