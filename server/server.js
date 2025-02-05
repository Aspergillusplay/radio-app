// server/server.js
import express from 'express';
import cors from 'cors';
import setupWebSocket from './websocket.js';
import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import { fileURLToPath } from 'url';
import sequelize from './db.js';
import tracksRoutes from './routes/tracks.js';
import usersRoutes from './routes/users.js';

// Создаём экземпляр приложения Express сразу
const app = express();

const port = 3000;

// Настраиваем middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Подключаем маршруты (эти вызовы идут после инициализации app)
app.use('/api/tracks', tracksRoutes);
app.use('/api/users', usersRoutes);

// Далее, подключаем статические файлы
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Функция для подключения к базе данных
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

// Функция генерации списка треков из файлов (если требуется, либо замените на логику работы с БД)
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
