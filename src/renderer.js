const audioList = document.querySelector('#audioList');
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
const fileInput = document.getElementById('fileInput');

let currentAudioIndex = 0;
let isPaused = false;
let isLyricShown = false;
let lyric = '';

const audioObj = {
  audioElements: [],
  audioFiles: [],
  volume: .5,
}

fileInput.addEventListener('change', function(event) {
  const files = event.target.files;
  const mp3Files = [];

  audioObj.audioElements = [];
  audioObj.audioFiles = [];
  audioObj.volume = volume.value;
  
  Array.from(playlist.children).forEach((li) => {
    li.remove();
  })

  audioList.innerHTML = '';
  progressBar.value = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type === "audio/mp3" || file.type === "audio/mpeg") {
      mp3Files.push(file);

      const audio = document.createElement('audio');
      audio.controls = true;

      const source = document.createElement('source');
      source.src = URL.createObjectURL(file);
      audio.appendChild(source);

      audioObj.audioElements.push(audio);

      const listItem = document.createElement('li');
      listItem.appendChild(audio);
      audioList.appendChild(listItem);

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
    }
  }

  audioObj.audioFiles.push(...mp3Files);
  
  playSongsBtn.style.display = "flex";
  togglePauseBtn.style.display = "none";

  lyric = document.createElement('li');
  lyric.classList = "lyric";
  playlist.append(lyric);

  document.querySelectorAll("button").forEach((button) => {
    button.disabled = false;
  })
});

volume.addEventListener("input", (e) => {
  const volume = e.target.value;
  const currentSong = audioObj.audioElements[currentAudioIndex];

  if(currentSong) currentSong.volume = volume;
  audioObj.volume = volume;
})

html.addEventListener("keydown", (e) => {
  if(e.key === "Alt") {
    e.preventDefault();
  }
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

function playPreviousSong() {
  pauseCurrentSong();
  currentAudioIndex--;

  if (currentAudioIndex < 0) {
    currentAudioIndex = audioObj.audioElements.length - 1;
  }

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"

  playCurrentSong();

  if(isLyricShown) fetchLyric(audioObj.audioFiles[currentAudioIndex].name);
}

function playIncomingSong() {
  pauseCurrentSong();
  currentAudioIndex++;
  if (currentAudioIndex >= audioObj.audioElements.length) {
    currentAudioIndex = 0;
  }

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  playCurrentSong();

  if(isLyricShown) fetchLyric(audioObj.audioFiles[currentAudioIndex].name);
}

function playCurrentSong() {
  const currentAudio = audioObj.audioElements[currentAudioIndex];

  if(currentAudio) {
    currentAudio.currentTime = 0;
    currentAudio.play();
    currentAudio.volume = audioObj.volume;

    if(isLyricShown) {
      currentSongPlaying.innerHTML = `Tocando agora: <span>${audioObj.audioFiles[currentAudioIndex].name.replace(".mp3", '')}</span>`;
    }

    progressBar.value = 0;

    document.querySelectorAll("li").forEach((song) => {
      song.classList.remove("songPlaying")
    })

    playlist.children[currentAudioIndex].classList.toggle("songPlaying");

    isPaused = false;
    
    playSongsBtn.style.display = "none";
    togglePauseBtn.style.display = "flex";

    // Remove previous timeupdate event listener
    currentAudio.removeEventListener('timeupdate', updateProgressBar);

    currentAudio.addEventListener('timeupdate', updateProgressBar);

    currentAudio.addEventListener('ended', () => {
      if(currentAudioIndex != audioObj.audioElements.length - 1) {        
        playIncomingSong();
      }
      else {
        currentAudioIndex = 0;
        playSongsBtn.style.display = "flex";
        togglePauseBtn.style.display = "none";
      }
    });
  }
}

function updateProgressBar() {
  const currentAudio = audioObj.audioElements[currentAudioIndex];
  const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
  if(progress) progressBar.value = progress;
}

function pauseCurrentSong() {
  const currentAudio = audioObj.audioElements[currentAudioIndex];
  if (currentAudio) {
    currentAudio.pause();
    isPaused = true;
  }

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
}

function togglePause() {
  const currentAudio = audioObj.audioElements[currentAudioIndex];
  if (currentAudio) {
    if (isPaused) {
      currentAudio.play();
      isPaused = false;

      playSongsBtn.style.display = "none";
      togglePauseBtn.style.display = "flex"
      togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
    } else {
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
  }
  else {
    currentSongPlaying.innerHTML = `Tocando agora: <span>${currentAudio}</span>`;
    isLyricShown = true;

    Array.from(playlist.children).forEach((song) => {
      song.style.display = "none";
    })

    lyric.style.display = "block";

    fetchLyric(currentAudio);
  }
}

function playSongAtIndex(index) {
  if (currentAudioIndex === index) return;

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  pauseCurrentSong();
  currentAudioIndex = index;
  playCurrentSong();

  if(isLyricShown) fetchLyric(audioObj.audioFiles[currentAudioIndex].name);
}

function restartCurrentSong() {
  const currentAudio = audioObj.audioElements[currentAudioIndex];

  if(currentAudio) {
    currentAudio.currentTime = 0;
    updateProgressBar();
  }
}

async function fetchLyric(songTitle) {
  const artist = songTitle.split(' - ')[0];
  const song = songTitle.split(' - ')[1].replace(".mp3", '');

  const response = await fetch(`https://api.lyrics.ovh/v1/${artist}/${song}`);
  const fetchedLyric = await response.json();

  const songLyric = fetchedLyric?.lyrics?.split("\r\n")[1];

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
}
