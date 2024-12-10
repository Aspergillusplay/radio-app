import express from 'express';
import cors from 'cors';
import setupWebSocket from './websocket.js';
import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

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
    const tracksDirectory = path.resolve('public/assets/audio');
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

    app.get('/current-time', (req, res) => {
        const trackIndex = parseInt(req.query.trackIndex, 10);

        if (isNaN(trackIndex) || trackIndex < 0 || trackIndex >= tracks.length) {
            return res.status(400).json({ error: 'Invalid track index' });
        }

        if (trackIndex !== currentTrackIndex) {
            return res.status(400).json({ error: 'Track index mismatch' });
        }

        const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
        res.json({ elapsedTime });
    });

})();