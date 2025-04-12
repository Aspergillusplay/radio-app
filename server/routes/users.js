// server/routes/users.js
import express from 'express';
import multer from 'multer';
import minioClient from '../clients/minioClient.js';
import User from '../models/user.js';

const router = express.Router();

// Настройка multer для загрузки изображений
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const bucketName = 'images';

// POST: загрузка и обновление картинки профиля
router.post('/upload-profile-image', upload.single('image'), async (req, res) => {
    const { firebaseId } = req.query;
    if (!firebaseId) {
        return res.status(400).json({ error: 'firebaseId is required' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
    }

    // Формируем уникальное имя файла для картинки профиля
    const fileName = `profile-${firebaseId}-${req.file.originalname}`;

    try {
        // Загружаем файл в хранилище (minio)
        await minioClient.putObject(bucketName, fileName, req.file.buffer);

        // Генерируем URL для доступа к картинке
        // (Настройте URL согласно вашей конфигурации MinIO или другого хранилища)
        const imageUrl = `${import.meta.env.VITE_MINIO_URL}/${bucketName}/${fileName}`;

        // Находим пользователя по firebaseId и обновляем информацию о картинке
        const user = await User.findOne({ where: { firebaseId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.profileImage = fileName;
        await user.save();

        res.status(200).json({ imageUrl });
    } catch (error) {
        console.error('Error uploading profile image:', error);
        res.status(500).json({ error: 'Error uploading profile image' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { firebaseId, email, displayName } = req.body;
        if (!firebaseId) {
            return res.status(400).json({ error: 'firebaseId is required' });
        }

        let login = displayName || email;
        if (!displayName && email) {
            login = email.split('@')[0];
        }

        const [user, created] = await User.findOrCreate({
            where: { firebaseId },
            defaults: { role: 'USER', login },
        });
        if (!created && !user.login) {
            user.login = login;
            await user.save();
        }

        res.json({ user, created });
    } catch (error) {
        console.error('Error in /api/users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:firebaseId', async (req, res) => {
    try {
        const { firebaseId } = req.params;
        const user = await User.findOne({ where: { firebaseId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error in GET /api/users/:firebaseId:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT route to handle updating the user
router.put('/:firebaseId', async (req, res) => {
    try {
        const { firebaseId } = req.params;
        const { login } = req.body;
        const user = await User.findOne({ where: { firebaseId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.login = login;
        await user.save();
        res.json(user);
    } catch (error) {
        console.error('Error in PUT /api/users/:firebaseId:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;