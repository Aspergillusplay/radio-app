import express from 'express';
import Wish from '../models/wish.js';
import User from '../models/user.js';

const router = express.Router();

// GET /api/wishes?firebaseId=<firebaseId>
// If the user is an admin, returns all wishes grouped by user's firebaseId.
router.get('/', async (req, res) => {
    const { firebaseId } = req.query;
    if (!firebaseId) {
        return res.status(400).json({ error: 'firebaseId is required' });
    }
    try {
        const user = await User.findOne({ where: { firebaseId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role === 'ADMIN') {
            const wishes = await Wish.findAll({
                include: [{ model: User, attributes: ['firebaseId', 'role'] }],
                order: [['createdAt', 'ASC']],
            });
            const grouped = wishes.reduce((acc, wish) => {
                const uid = wish.User?.firebaseId || "unknown";
                if (!acc[uid]) {
                    acc[uid] = [];
                }
                acc[uid].push(wish);
                return acc;
            }, {});
            res.json(grouped);
        } else {
            const wishes = await Wish.findAll({
                where: { UserId: user.id },
                order: [['createdAt', 'ASC']],
            });
            res.json({ [user.firebaseId]: wishes });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// POST /api/wishes
// Creates a new wish for the user with the specified firebaseId.
router.post('/', async (req, res) => {
    const { firebaseId, content } = req.body;
    if (!firebaseId || !content) {
        return res.status(400).json({ error: 'firebaseId and content are required' });
    }
    try {
        const user = await User.findOne({ where: { firebaseId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const wish = await Wish.create({ content, UserId: user.id });
        res.status(201).json(wish);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
