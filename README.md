# EchoDeck

[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()


A simple local MP3 player with persistent playlists and Discord Rich Presence.


## Table of Contents

- [About](#about)

- [Demo](#demo)

- [Features](#features)

- [Install](#install)
- [Development](#development)
- [Build the Windows installer](#build-the-windows-installer)
- [Discord Rich Presence](#discord-rich-presence)
- [Shortcuts](#shortcuts)
- [AI agent handoff](#ai-agent-handoff)
  

## About

A software made with Electron which have one simple objective, play mp3 files ;)

## Demo

<img  src="/src/assets/demo.png"  width="300" />

<hr>
  

## Features

- Play mp3 files.
- Open **Lyrics** during playback to follow the highlighted line or read plain lyrics when timing is unavailable. EchoDeck looks up the title and artist on LRCLIB, using MP3 tags or the filename (ideally `Artist - Title.mp3`). It checks the track duration and caches successful matches for offline use.
- Create and persist multiple playlists.
- Restore missing songs with a file picker or remove them from a playlist.
- Adjust and persist per-song gain. The master volume is also remembered across restarts.
- Show the current song in Discord when Discord is running.
- Choose English or Portuguese in settings.
- Shuffle songs or play them in order, with automatic playlist looping.
- Keep the current song highlighted in teal and scroll it toward the top.
- Fade previously played songs to gray during the current run. Marks reset when ordered playback wraps or shuffle starts a new round.
- Remember the window's last position across launches, including a second monitor. Off-screen saved positions fall back to centered placement.
- Start a saved playlist directly with Play and control playback through global shortcuts.

## Install

Run an EchoDeck Windows x64 setup executable and follow the installation wizard. The wizard offers an installation-directory choice and creates desktop and Start menu shortcuts.

The current application version is **3.6.3**. The latest local build was generated from commit `e0a57a1` and is named `EchoDeck-Setup-3.2.0-e0a57a1.exe` under `out/installer/`. This build includes the focus-outline fix for playback buttons and sliders. Earlier `EchoDeck Setup-3.2.0.exe` builds have the same displayed version, so use the filename and source commit to identify this update.

Installer files are generated locally and ignored by Git. Use the build instructions below to produce one from a checkout.

Create a playlist with **New**, enter its name, and choose MP3 files. **Select Songs** adds songs to the active playlist. Playlists retain references to the files, so moved files appear as missing and offer **Locate** and **Remove** actions. Removing an entry only changes the playlist.

## Development

Use Node.js with npm and run the following from the repository root.

```text
npm ci
npm start
```

The app uses Electron 29 with vanilla HTML, CSS, and JavaScript. Node.js 22 was used for the latest verified builds.

```text
npm test          # Run the automated test suite
npm run electron  # Start Electron through nodemon
npm run package   # Package with Electron Forge
npm run forge-make # Run the older Forge makers
```

Settings, filename-keyed song gains, and playlists are saved in the app's user-data directory. Existing installations can continue using `%APPDATA%/MP3 Player` for config/playlists when legacy data exists. Window position is saved separately as `window-position.json` in EchoDeck's current user-data directory. Played-song marks last for the current session and reset on playlist reload.

## Build the Windows installer

On Windows, after installing dependencies, run the following command.

```text
npm run make
```

Electron Builder reads the NSIS configuration from `package.json` and creates `out/installer/EchoDeck Setup-<version>.exe` for Windows x64. The setup uses a multi-step wizard. The build can download Electron and packaging tools.

To distinguish builds that share a version, override the artifact filename with the source commit.

```text
npm run make -- --config.nsis.artifactName=EchoDeck-Setup-3.2.0-e0a57a1.exe
```

For app changes, keep the release version synchronized in `package.json`, both root version fields in `package-lock.json`, and the visible footer in `src/index.html`.

## Discord Rich Presence

Create an application named `EchoDeck` in the Discord Developer Portal and put its application ID in the root `.env` file:

```text
DISCORD_CLIENT_ID=your_discord_application_id
```

Use `.env.example` as a template. The ID is an application identifier. The local `.env` file is ignored by Git. Discord's desktop application must be running for the current song to appear in a profile.

`main.js` checks the process environment first and then `.env` beside the application's main script. Verify that this configuration is available in a packaged build when distributing an installer.

EchoDeck publishes a **Listening** activity with the current track in the compact status and a playback progress bar when the track duration is available. It refreshes the anchor on track changes, seeks, restarts, and resumes. Paused activity shows **Paused** with timestamps omitted. The activity image uses the uploaded asset key `logo_1_1_` in the EchoDeck Discord application's **Rich Presence → Art Assets**. If the asset key changes, update `large_image` in `src/js/discord-presence.js` to match.

  
## Shortcuts

|SHORTCUT                        |ACTION                         
|--------------------------------|-------------------------------
|CommandOrControl+num9           |`Play next song`
|CommandOrControl+num8           |`Toggle pause/play`
|CommandOrControl+num7           |`Play previous song`
|CommandOrControl+num6           |`Forward 1 sec`
|CommandOrControl+num5           |`Restart song`
|CommandOrControl+num4           |`Go back 1 sec`
|CommandOrControl+num3           |`Volume up`
|CommandOrControl+num2           |`Mute`
|CommandOrControl+num1           |`Volume down`
|CommandOrControl+num0           |`Switch between Playlist and Lyrics`

On Windows, `CommandOrControl` means Ctrl, and `num0` through `num9` refer to the numeric keypad.

## AI agent handoff

Start with [AI_CONTEXT.md](AI_CONTEXT.md) for architecture, persistence formats, preload IPC, playback/run tracking, release conventions, tests, and known limitations. It was reviewed against application commit `e0a57a1` on 2026-11-19.

The latest verification passed all 37 automated tests. They cover model/storage behavior and renderer/main-process logic with test doubles. Runtime checks cover actual audio, display placement, browser focus appearance, and Discord integration when work affects those areas.
