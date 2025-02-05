// server/routes/tracks.js
import express from 'express';
import Track from '../models/track.js';
import Artist from '../models/artist.js'; // убедитесь, что этот путь правильный

const router = express.Router();

// Получаем все треки вместе с информацией об исполнителе (artist)
router.get('/', async (req, res) => {
    try {
        const tracks = await Track.findAll({
            include: {
                model: Artist,
                attributes: ['id', 'name', 'image'], // выбираем только нужные поля
            },
        });
        res.json(tracks);
    } catch (error) {
        console.error('Error retrieving tracks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
