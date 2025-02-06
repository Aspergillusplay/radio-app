// server/routes/tracks.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import Track from '../models/track.js';
import Artist from "../models/artist.js";
import TrackLike from "../models/likes.js";

const router = express.Router();

// Получаем путь к текущей директории (для ESModules)
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Папка для хранения загруженных аудиофайлов
const audioDir = path.join(__dirname, 'public', 'assets', 'audio');

// Убедимся, что папка существует, если нет — создадим её
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Настройка хранилища Multer для сохранения файлов в public/assets/audio
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Указываем папку для загрузки файлов
        cb(null, audioDir);
    },
    filename: function (req, file, cb) {
        // Указываем, как будут называться файлы
        cb(null, Date.now() + path.extname(file.originalname)); // уникальное имя файла
    }
});

// Настроить multer с этим хранилищем
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Неверный формат файла'), false);
        }
    }
});

// Маршрут для загрузки аудиофайла
router.post('/', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Аудиофайл не был предоставлен.' });
        }

        console.log('Загруженный файл:', req.file);
        console.log('Данные формы:', req.body);

        // Формируем путь для доступа к файлу относительно папки public
        const filePath = `assets/audio/${req.file.filename}`;

        // Если order не передан, вычисляем его как maxOrder+1
        let order;
        if (req.body.order) {
            order = parseInt(req.body.order, 10);
        } else {
            const maxOrder = await Track.max('order') || 0;
            order = maxOrder + 1;
        }

        // Формируем данные для создания записи трека в БД
        const trackData = {
            name: req.body.name || req.file.originalname, // название трека (из формы или по умолчанию имя файла)
            path: filePath,
            order: order,
            likes: 0,
            artistId: req.body.artistId || null, // ID группы (артиста)
        };

        // Создаем новый трек в базе данных
        const newTrack = await Track.create(trackData);

        res.status(201).json({
            message: 'Аудиофайл успешно загружен!',
            track: newTrack,
        });
    } catch (error) {
        console.error('Ошибка загрузки аудиофайла:', error);
        res.status(500).json({ error: 'Ошибка сервера при загрузке аудио' });
    }
});

// Пример GET-маршрута для получения списка треков с артистами
router.get('/', async (req, res) => {
    try {
        const tracks = await Track.findAll({
            order: [['order', 'ASC']], // сортировка по порядку
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


router.post('/like', async (req, res) => {
    const { TrackId, UserId } = req.body;

    if (!UserId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        console.log('Received like request:', { TrackId, UserId });

        // Проверяем, не поставил ли пользователь уже лайк
        const existingLike = await TrackLike.findOne({
            where: {
                TrackId,
                UserId,
            }
        });

        if (existingLike) {
            console.log('User already liked this track:', { TrackId, UserId });
            return res.status(400).json({ error: 'You already liked this track' });
        }

        // Создаем новый лайк
        await TrackLike.create({
            TrackId,
            UserId,
        });
        console.log('Like created:', { TrackId, UserId });

        // Обновляем количество лайков у трека
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

// Удалить лайк с трека
router.delete('/like', async (req, res) => {
    const { TrackId, UserId } = req.query; // Используем query-параметры

    try {
        const like = await TrackLike.findOne({
            where: {
                TrackId,
                UserId,
            }
        });

        if (!like) {
            return res.status(400).json({ error: "You haven't liked this track yet" });
        }

        // Удаляем лайк
        await like.destroy();

        // Обновляем количество лайков у трека
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
            where: {
                TrackId,
                UserId,
            }
        });

        res.status(200).json({ isLiked: !!existingLike });
    } catch (error) {
        console.error('Error fetching like status:', error);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

export default router;
