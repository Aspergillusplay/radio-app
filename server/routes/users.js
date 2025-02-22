// routes/users.js
import express from 'express';
import User from '../models/user.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { firebaseId } = req.body;
        if (!firebaseId) {
            return res.status(400).json({ error: 'firebaseId is required' });
        }
        // If the user already exists, it will be returned
        // If the user doesn't exist, it will be created
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
