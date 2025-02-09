// routes/tracks.js
import express from 'express';
import multer from 'multer';
import Track from '../models/track.js';
import Artist from "../models/artist.js";
import TrackLike from "../models/likes.js";
import minioClient from "../clients/minioClient.js";

const router = express.Router();

// Настройка хранилища Multer для загрузки файлов (если требуется)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/flac'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Неверный формат файла'), false);
        }
    }
});

// Маршрут для загрузки аудиофайла (без изменений)
router.post('/upload', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Аудиофайл не был предоставлен.' });
        }
        const bucketName = 'audio';
        const fileName = req.file.originalname;

        console.log('Загруженный файл:', req.file);
        console.log('Данные формы:', req.body);

        await minioClient.putObject(bucketName, fileName, req.file.buffer, async (err, etag) => {
            if (err) {
                console.error('Ошибка загрузки аудиофайла:', err);
                return res.status(500).json({ error: 'Ошибка сервера при загрузке аудио' });
            }
            console.log('Файл успешно загружен в Minio:', etag);
            res.status(201).json({ message: 'Файл успешно загружен' });

            let order;
            if (req.body.order) {
                order = parseInt(req.body.order, 10);
            } else {
                const maxOrder = await Track.max('order') || 0;
                order = maxOrder + 1;
            }

            const trackData = {
                name: req.body.name || req.file.originalname,
                path: fileName, // сохраняем только имя файла
                order: order,
                likes: 0,
                artistId: req.body.artistId || null,
            };

            await Track.create(trackData);
        });

    } catch (error) {
        console.error('Ошибка загрузки аудиофайла:', error);
        res.status(500).json({ error: 'Ошибка сервера при загрузке аудио' });
    }
});

// GET-маршрут для получения списка треков с артистами (без изменений)
router.get('/', async (req, res) => {
    try {
        const tracks = await Track.findAll({
            order: [['order', 'ASC']],
            include: {
                model: Artist,
                attributes: ['id', 'name', 'image'],
            }
        });
        res.json(tracks);
    } catch (error) {
        console.error('Error retrieving tracks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// **Изменённый маршрут для стриминга аудио с поддержкой Range-запросов**
router.get('/stream/:filename', (req, res) => {
    const bucket = 'audio';
    const filename = req.params.filename;

    // Сначала получаем метаданные объекта для определения размера файла
    minioClient.statObject(bucket, filename, (err, stat) => {
        if (err) {
            console.error(`Ошибка при получении метаданных файла ${filename}:`, err);
            return res.status(404).json({ error: 'Файл не найден' });
        }

        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            // Пример заголовка Range: "bytes=0-"
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'audio/mpeg'
            });
            // Получаем часть файла из Minio
            minioClient.getPartialObject(bucket, filename, start, chunkSize, (err, dataStream) => {
                if (err) {
                    console.error(`Ошибка при получении частичного объекта ${filename}:`, err);
                    return res.status(500).send(err.message);
                }
                dataStream.pipe(res);
            });
        } else {
            // Если Range-заголовок не передан — отдаем весь файл
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mpeg'
            });
            minioClient.getObject(bucket, filename, (err, dataStream) => {
                if (err) {
                    console.error(`Ошибка при получении файла ${filename}:`, err);
                    return res.status(500).send(err.message);
                }
                dataStream.pipe(res);
            });
        }
    });
});

// Маршруты для работы с лайками (без изменений)
router.post('/like', async (req, res) => {
    const { TrackId, UserId } = req.body;

    if (!UserId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        console.log('Received like request:', { TrackId, UserId });

        const existingLike = await TrackLike.findOne({
            where: { TrackId, UserId }
        });

        if (existingLike) {
            console.log('User already liked this track:', { TrackId, UserId });
            return res.status(400).json({ error: 'You already liked this track' });
        }

        await TrackLike.create({ TrackId, UserId });
        console.log('Like created:', { TrackId, UserId });

        const track = await Track.findByPk(TrackId);
        if (!track) {
            console.log('Track not found:', { TrackId });
            return res.status(404).json({ error: 'Track not found' });
        }

        track.likes += 1;
        await track.save();
        console.log('Track likes updated:', { TrackId, likes: track.likes });

        res.status(200).json({ message: 'Track liked successfully' });
    } catch (error) {
        console.error('Error processing like request:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

router.delete('/like', async (req, res) => {
    const { TrackId, UserId } = req.query;

    try {
        const like = await TrackLike.findOne({
            where: { TrackId, UserId }
        });

        if (!like) {
            return res.status(400).json({ error: "You haven't liked this track yet" });
        }

        await like.destroy();

        const track = await Track.findByPk(TrackId);
        if (track) {
            track.likes = Math.max(0, track.likes - 1);
            await track.save();
        }

        res.status(200).json({ message: 'Track unliked successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

router.post('/like/status', async (req, res) => {
    const { TrackId, UserId } = req.body;

    try {
        const existingLike = await TrackLike.findOne({
            where: { TrackId, UserId }
        });
        res.status(200).json({ isLiked: !!existingLike });
    } catch (error) {
        console.error('Error fetching like status:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

export default router;
