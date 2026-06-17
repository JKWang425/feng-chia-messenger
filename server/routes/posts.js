const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// Setup multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

const broadcast = (wss, message) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};

// Get all posts (with their replies)
router.get('/', (req, res) => {
    const postsQuery = 'SELECT * FROM posts ORDER BY created_at DESC';
    const repliesQuery = 'SELECT * FROM replies ORDER BY created_at ASC';

    db.all(postsQuery, [], (err, posts) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all(repliesQuery, [], (err, replies) => {
            if (err) return res.status(500).json({ error: err.message });

            const postsWithReplies = posts.map(post => {
                return {
                    ...post,
                    replies: replies.filter(reply => reply.post_id === post.id)
                };
            });

            res.json(postsWithReplies);
        });
    });
});

// Create a new post (requires auth, supports image upload)
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
    const { title, content } = req.body;
    const author = req.user.username; // Use username from JWT
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const query = 'INSERT INTO posts (title, content, author, image_url) VALUES (?, ?, ?, ?)';
    db.run(query, [title, content, author, imageUrl], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const newPost = { id: this.lastID, title, content, author, image_url: imageUrl, replies: [] };
        
        // Broadcast new post via WebSocket
        if (req.wss) {
            broadcast(req.wss, { type: 'NEW_POST', data: newPost });
        }

        res.status(201).json(newPost);
    });
});

// Reply to a post (requires auth)
router.post('/:id/replies', authMiddleware, (req, res) => {
    const postId = req.params.id;
    const { content } = req.body;
    const author = req.user.username; // Use username from JWT
    
    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const query = 'INSERT INTO replies (post_id, content, author) VALUES (?, ?, ?)';
    db.run(query, [postId, content, author], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const newReply = { id: this.lastID, post_id: Number(postId), content, author };
        
        // Broadcast new reply via WebSocket
        if (req.wss) {
            broadcast(req.wss, { type: 'NEW_REPLY', data: newReply });
        }

        res.status(201).json(newReply);
    });
});

module.exports = router;
