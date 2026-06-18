const express = require('express');
const router = express.Router();
const db = require('../database');
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
router.get('/users', (req, res) => {
    db.all('SELECT id, username, role, created_at FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Delete a user (and their posts/replies)
router.delete('/users/:id', (req, res) => {
    const userId = req.params.id;

    // First get the user's username to delete their posts
    db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const username = user.username;

        db.serialize(() => {
            // Delete replies by this author
            db.run('DELETE FROM replies WHERE author = ?', [username]);

            // Delete replies on posts by this author
            db.run(`DELETE FROM replies WHERE post_id IN (SELECT id FROM posts WHERE author = ?)`, [username]);

            // Delete posts by this author
            db.run('DELETE FROM posts WHERE author = ?', [username]);

            // Delete user
            db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'User and all associated data deleted successfully' });
                broadcast(req.wss, { type: 'POST_DELETED', data: null }); // trigger refetch
            });
        });
    });
});

// Delete a post
router.delete('/posts/:id', (req, res) => {
    const postId = req.params.id;
    db.serialize(() => {
        db.run('DELETE FROM replies WHERE post_id = ?', [postId]);
        db.run('DELETE FROM posts WHERE id = ?', [postId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Post and its replies deleted successfully' });
            broadcast(req.wss, { type: 'POST_DELETED', data: { id: Number(postId) } });
        });
    });
});

// Get daily visits
router.get('/visits', (req, res) => {
    db.all('SELECT * FROM site_visits ORDER BY date ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;
