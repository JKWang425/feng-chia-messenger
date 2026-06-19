const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../database');
const { JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const pool = await poolPromise;
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .query('INSERT INTO users (username, password) OUTPUT INSERTED.id VALUES (@username, @password)');
        
        res.status(201).json({ message: 'User registered successfully', userId: result.recordset[0].id });
    } catch (err) {
        if (err.number === 2627) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const pool = await poolPromise;
        const userResult = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM users WHERE username = @username');
            
        const user = userResult.recordset[0];
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

        const modsResult = await pool.request()
            .input('user_id', sql.Int, user.id)
            .query('SELECT board_id FROM board_moderators WHERE user_id = @user_id');
            
        const moderatedBoards = modsResult.recordset ? modsResult.recordset.map(m => m.board_id) : [];
        res.json({ message: 'Logged in successfully', user: { id: user.id, username: user.username, role: user.role, moderated_boards: moderatedBoards }, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const pool = await poolPromise;
        const modsResult = await pool.request()
            .input('user_id', sql.Int, decoded.id)
            .query('SELECT board_id FROM board_moderators WHERE user_id = @user_id');
            
        const moderatedBoards = modsResult.recordset ? modsResult.recordset.map(m => m.board_id) : [];
        res.json({ user: { ...decoded, moderated_boards: moderatedBoards } });
    } catch (err) {
        res.json({ user: null });
    }
});

module.exports = router;
