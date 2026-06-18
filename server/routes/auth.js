const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid username or password' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        db.all('SELECT board_id FROM board_moderators WHERE user_id = ?', [user.id], (err, mods) => {
            const moderatedBoards = mods ? mods.map(m => m.board_id) : [];
            res.json({ message: 'Logged in successfully', user: { id: user.id, username: user.username, role: user.role, moderated_boards: moderatedBoards }, token });
        });
    });
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

router.get('/me', (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.all('SELECT board_id FROM board_moderators WHERE user_id = ?', [decoded.id], (err, mods) => {
            const moderatedBoards = mods ? mods.map(m => m.board_id) : [];
            res.json({ user: { ...decoded, moderated_boards: moderatedBoards } });
        });
    } catch (err) {
        res.json({ user: null });
    }
});

module.exports = router;
