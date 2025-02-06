// server/routes/artists.js
import express from 'express';
import Artist from '../models/artist.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const artists = await Artist.findAll();
        res.json(artists);
    } catch (error) {
        console.error('Error retrieving artists:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
