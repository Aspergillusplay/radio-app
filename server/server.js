// server/server.js
import express from 'express';
import cors from 'cors';
import setupWebSocket from './websocket.js';
import sequelize from './db.js';
import tracksRoutes from './routes/tracks.js';
import usersRoutes from './routes/users.js';
import artistsRoutes from './routes/artists.js';
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

/**
 * Функция для вычисления длительности трека.
 * Получает поток файла из MinIO и с помощью music-metadata определяет duration.
 */
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

/**
 * Функция загрузки списка треков из базы данных.
 * Для каждого трека, у которого ещё не вычислена длительность, пытаемся её вычислить.
 */
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
    // Изначально загружаем список треков
    let tracks = await loadTracks();

    if (!tracks.length) {
        console.error('Треки не найдены в базе данных. Проверьте, что база данных заполнена и файлы загружены в MinIO.');
        return;
    }

    let currentTrackIndex = 0;
    let currentTrackStartTime = Date.now();
    let trackSwitchTimeout = null;
    let wssInstance = null;

    // Функция рассылки текущей информации (индекс трека и elapsedTime) через WebSocket
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

    // Функция старта воспроизведения трека по индексу.
    // Перед запуском каждого трека обновляем список треков, чтобы учесть новые добавленные.
    async function startTrack(index) {
        currentTrackIndex = index;
        currentTrackStartTime = Date.now();
        broadcastCurrentTrack();

        if (trackSwitchTimeout) clearTimeout(trackSwitchTimeout);

        // Обновляем список треков из базы данных
        tracks = await loadTracks();

        // Если текущий индекс оказался вне диапазона (например, новые треки добавились в начало),
        // то сбрасываем его на 0
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

    // Запуск HTTP-сервера
    const server = app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });

    // Инициализация WebSocket
    wssInstance = setupWebSocket(server, {
        getCurrentTrackIndex: () => currentTrackIndex,
        getCurrentTrackStartTime: () => currentTrackStartTime,
    });

    // (Опционально) Каждую секунду рассылаем обновлённую информацию клиентам
    setInterval(() => {
        broadcastCurrentTrack();
    }, 1000);

    // Начинаем воспроизведение с первого трека
    startTrack(0);

    // Эндпоинт для получения текущего состояния воспроизведения
    app.get('/current-time', (req, res) => {
        const elapsedTime = (Date.now() - currentTrackStartTime) / 1000;
        res.json({ trackIndex: currentTrackIndex, elapsedTime });
    });

})();
