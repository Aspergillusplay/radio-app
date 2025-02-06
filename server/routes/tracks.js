// server/routes/tracks.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Track from '../models/track.js';
import Artist from "../models/artist.js";

const router = express.Router();

// Определяем __dirname для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка хранилища Multer для сохранения файлов в public/assets/audio
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/assets/audio');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// Маршрут для загрузки аудиофайла
router.post('/', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Аудиофайл не был предоставлен.' });
        }

        // Формируем путь для доступа к файлу относительно папки public
        const filePath = `/assets/audio/${req.file.filename}`;

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

export default router;
