// routes/users.js
import express from 'express';
import User from '../models/user.js';

const router = express.Router();

// Эндпоинт для создания (или получения) пользователя
router.post('/', async (req, res) => {
    try {
        const { firebaseId } = req.body;
        if (!firebaseId) {
            return res.status(400).json({ error: 'firebaseId is required' });
        }
        // Если пользователь с таким firebaseId уже существует, он будет найден,
        // иначе будет создан новый с ролью по умолчанию ("USER")
        const [user, created] = await User.findOrCreate({
            where: { firebaseId },
            defaults: { role: 'USER' },
        });
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

export default router;
