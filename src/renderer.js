const audioList = document.querySelector('#audioList');
const playSongsBtn = document.querySelector("#playSongs");
const togglePauseBtn = document.querySelector("#togglePauseBtn");
const prevSongBtn = document.querySelector("#prevSongBtn");
const nextSongBtn = document.querySelector("#nextSongBtn");
const currentSong = document.querySelector("#currentSong");
const playlist = document.querySelector("#playlist");
const volume = document.querySelector("#volume");
const progressBar = document.querySelector("#progressBar");
const html = document.querySelector("html");
const fileInput = document.getElementById('fileInput');

let currentAudioIndex = 0;
let isPaused = false;

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
}

function playCurrentSong() {
  const currentAudio = audioObj.audioElements[currentAudioIndex];
  if (currentAudio) {
    currentAudio.currentTime = 0;
    currentAudio.play();
    currentAudio.volume = audioObj.volume;

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

function playSongAtIndex(index) {
  if (currentAudioIndex === index) return;

  playSongsBtn.style.display = "none";
  togglePauseBtn.style.display = "flex";
  togglePauseBtn.innerHTML = "<img src='./assets/pause.ico' alt='PAUSE' width='20'>"
  
  pauseCurrentSong();
  currentAudioIndex = index;
  playCurrentSong();
}
