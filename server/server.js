// server/server.js
import express from 'express';
import cors from 'cors';
import setupWebSocket from './websocket.js';
import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import sequelize from './db.js';
import tracksRoutes from './routes/tracks.js';
import usersRoutes from './routes/users.js';
import artistsRoutes from './routes/artists.js';

const app = express();
const port = 3010;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

app.use('/api/tracks', tracksRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/artists', artistsRoutes);

const startDatabase = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Database connection established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startDatabase();

// Функция генерации списка треков (если используется локальное хранение файлов)
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

    setupWebSocket(
        server,
        tracks,
        () => {
            currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
            currentTrackStartTime = Date.now();
            return tracks[currentTrackIndex];
        },
        () => currentTrackStartTime,
        () => currentTrackIndex
    );

    // server/server.js (в конце файла)
    app.get('/current-time', (req, res) => {
        // Отдаем всегда актуальные данные: текущий индекс трека и elapsedTime
        const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
        res.json({ trackIndex: currentTrackIndex, elapsedTime });
    });

})();
