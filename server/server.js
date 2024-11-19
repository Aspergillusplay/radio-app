import express from 'express';
import setupWebSocket from './websocket.js';

const app = express();
const port = 3000;


const tracks = [
    { path: "src/assets/audio/linkinpark/linkin-park-burn-it-down.mp3", duration: 231 },
    { path: "src/assets/audio/linkinpark/linkin-park-numb.mp3", duration: 185 },
    { path: "src/assets/audio/linkinpark/linkin-park-in-the-end.mp3", duration: 216 },
    { path: "src/assets/audio/nightwish/Nightwish-Over-The-Hils-And-Far-Away.mp3", duration: 260 },
    { path: "src/assets/audio/powerwolf/Powerwolf-Army Of The Night.mp3", duration: 190 },
    { path: "src/assets/audio/powerwolf/Powerwolf-Demon`s Are A Girl`s Best Friends.mp3", duration: 210 },
    { path: "src/assets/audio/powerwolf/Powerwolf-We Drink Your Blood.mp3", duration: 220 },
    { path: "src/assets/audio/skillet/skillet_-_hero.mp3", duration: 180 },
    { path: "src/assets/audio/skillet/skillet_-_legendary.mp3", duration: 200 },
    { path: "src/assets/audio/skillet/skillet-feel-invincible.mp3", duration: 210 }
];

let currentTrackIndex = 0;
let currentTrackStartTime = Date.now();

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

setupWebSocket(server, tracks, () => {
    currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
    currentTrackStartTime = Date.now();
    return tracks[currentTrackIndex];
}, () => currentTrackStartTime, () => currentTrackIndex);