const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../database');
const { adminMiddleware } = require('../middleware/auth');
const WebSocket = require('ws');

const broadcast = (wss, message) => {
    if (!wss) return;
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};

// Protect all admin routes
router.use(adminMiddleware);

// Get all users
router.get('/users', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT id, username, role, created_at FROM users');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a user (and their posts/replies/likes/saves)
router.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const pool = await poolPromise;
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT username FROM users WHERE id = @userId');
            
        const user = userResult.recordset[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const username = user.username;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            request.input('username', sql.NVarChar, username);
            request.input('userId', sql.Int, userId);

            // Delete junction records associated with user
            await request.query('DELETE FROM board_moderators WHERE user_id = @userId');
            await request.query('DELETE FROM post_likes WHERE user_id = @userId');
            await request.query('DELETE FROM post_saves WHERE user_id = @userId');

            // Delete replies by this author
            await request.query('DELETE FROM replies WHERE author = @username');

            // Delete replies on posts by this author
            await request.query('DELETE FROM replies WHERE post_id IN (SELECT id FROM posts WHERE author = @username)');

            // Delete posts by this author
            await request.query('DELETE FROM posts WHERE author = @username');

            // Delete user
            await request.query('DELETE FROM users WHERE id = @userId');

            await transaction.commit();
            res.json({ message: 'User and all associated data deleted successfully' });
            broadcast(req.wss, { type: 'POST_DELETED', data: null }); // trigger refetch
        } catch (err) {
            await transaction.rollback();
            res.status(500).json({ error: err.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a post
router.delete('/posts/:id', async (req, res) => {
    const postId = req.params.id;
    try {
        const pool = await poolPromise;
        // Due to ON DELETE CASCADE for post_id, deleting post will delete related replies, likes, saves
        await pool.request()
            .input('postId', sql.Int, postId)
            .query('DELETE FROM posts WHERE id = @postId');
            
        res.json({ message: 'Post and its relations deleted successfully' });
        broadcast(req.wss, { type: 'POST_DELETED', data: { id: Number(postId) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get daily visits
router.get('/visits', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM site_visits ORDER BY date ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
