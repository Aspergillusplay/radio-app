import express from 'express';
import setupWebSocket from './websocket.js';
import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';

const app = express();
const port = 3000;

async function generateTrackList(directory) {
    const tracks = [];

    const processDirectory = async (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory()) {
                await processDirectory(fullPath);
            } else if (file.name.toLowerCase().endsWith('.mp3')) {
                const metadata = await parseFile(fullPath);
                const duration = Math.floor(metadata.format.duration);

                tracks.push({
                    path: fullPath,
                    duration: duration,
                    name: file.name.replace('.mp3', '')
                });
            }
        }
    };

    await processDirectory(directory);
    return tracks;
}

(async () => {
    const tracksDirectory = path.resolve('src/assets/audio');
    const tracks = await generateTrackList(tracksDirectory);

    if (tracks.length === 0) {
        throw new Error('No audio files found in the specified directory.');
    }

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
})();