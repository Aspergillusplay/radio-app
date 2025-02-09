// server/routes/artists.js
import express from 'express';
import Artist from '../models/artist.js';
import multer from "multer";
import minioClient from "../clients/minioClient.js";

const router = express.Router();

const bucketName = 'images';


router.get('/', async (req, res) => {
    try {
        const artists = await Artist.findAll();
        res.json(artists);
    } catch (error) {
        console.error('Error retrieving artists:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Настроим multer для загрузки изображений
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

// POST: создание новой группы
router.post('/upload', upload.single('image'), async (req, res) => {
    const { name } = req.body;
    const fileName = req.file.originalname;

    await minioClient.putObject(bucketName, fileName, req.file.buffer, async (err, etag) => {
        if (err) {
            console.error('Error uploading image:', err);
            return res.status(500).json({error: 'Error uploading image'});
        }

        const artist = await Artist.create({
            name: name,
            image: fileName,
        });

        res.status(201).json(artist);
    });
});

export default router;
