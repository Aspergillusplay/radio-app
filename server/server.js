// server/server.js
import express from 'express';
import cors from 'cors';
import setupWebSocket from './websocket.js';
import sequelize from './db.js';
import tracksRoutes from './routes/tracks.js';
import usersRoutes from './routes/users.js';
import artistsRoutes from './routes/artists.js';
import wishesRoutes from './routes/wishes.js';
import Track from './models/track.js'; // Модель трека из БД
import minioClient from './clients/minioClient.js';
import { parseStream } from 'music-metadata'; // Для получения метаданных аудиофайла

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
app.use('/api/wishes', wishesRoutes);

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

// Function to compute track duration
async function computeTrackDuration(track) {
    return new Promise((resolve) => {
        const bucket = 'audio'; // Название вашего бакета в MinIO
        minioClient.getObject(bucket, track.path, async (err, stream) => {
            if (err) {
                console.error(`Ошибка получения файла ${track.path} из MinIO:`, err);
                resolve(null);
                return;
            }
            try {
                const metadata = await parseStream(stream, null, { duration: true });
                resolve(metadata.format.duration);
            } catch (parseErr) {
                console.error(`Ошибка получения метаданных для трека ${track.name}:`, parseErr);
                resolve(null);
            }
        });
    });
}

// Function to load tracks from the database and compute their duration
async function loadTracks() {
    const tracksFromDB = await Track.findAll({ order: [['order', 'ASC']] });
    const newTracks = tracksFromDB.map(track => track.get({ plain: true }));
    for (const track of newTracks) {
        if (!track.duration) {
            const duration = await computeTrackDuration(track);
            track.duration = (duration && duration > 0) ? Math.floor(duration) : 200;
            console.log(`Трек "${track.name}" длится ${track.duration} сек.`);
        } else {
            console.log(`Трек "${track.name}" длится ${track.duration} сек.`);
        }
    }
    return newTracks;
}

(async () => {
    // Track duration computation
    let tracks = await loadTracks();

    if (!tracks.length) {
        console.error('Треки не найдены в базе данных. Проверьте, что база данных заполнена и файлы загружены в MinIO.');
        return;
    }

    let currentTrackIndex = 0;
    let currentTrackStartTime = Date.now();
    let trackSwitchTimeout = null;
    let wssInstance = null;

    // Function to broadcast current track information to all clients
    function broadcastCurrentTrack() {
        const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
        if (wssInstance) {
            wssInstance.clients.forEach((client) => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({
                        type: 'currentTrack',
                        trackIndex: currentTrackIndex,
                        elapsedTime: elapsedTime
                    }));
                }
            });
        }
    }

    // Function to start playing a track by its index
    async function startTrack(index) {
        currentTrackIndex = index;
        currentTrackStartTime = Date.now();
        broadcastCurrentTrack();

        if (trackSwitchTimeout) clearTimeout(trackSwitchTimeout);
        tracks = await loadTracks();

        // Looping through the tracks
        if (currentTrackIndex >= tracks.length) {
            currentTrackIndex = 0;
        }

        const currentTrack = tracks[currentTrackIndex];
        if (!currentTrack) {
            console.error(`Трек не найден для индекса ${currentTrackIndex}`);
            return;
        }

        const delay = currentTrack.duration * 1000;
        console.log(
            `Запущен трек "${currentTrack.name}" (order: ${currentTrack.order}) с длительностью ${currentTrack.duration} сек. Следующий трек через ${delay} мс.`
        );

        trackSwitchTimeout = setTimeout(() => {
            let nextIndex = currentTrackIndex + 1;
            if (nextIndex >= tracks.length) {
                nextIndex = 0;
            }
            startTrack(nextIndex);
        }, delay);
    }

    const server = app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

    wssInstance = setupWebSocket(server, {
        getCurrentTrackIndex: () => currentTrackIndex,
        getCurrentTrackStartTime: () => currentTrackStartTime,
    });

    startTrack(0);

    app.get('/current-time', (req, res) => {
        const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
        res.json({ trackIndex: currentTrackIndex, elapsedTime });
    });

})();
