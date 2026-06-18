const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
const db = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

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

// Helper for JWT decoding without rejecting
const getOptionalUserId = (req) => {
    const token = req.cookies.token;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.id;
    } catch {
        return null;
    }
};

// Get all posts with their replies, likes, and saves
router.get('/', (req, res) => {
    const currentUserId = getOptionalUserId(req);
    const boardId = req.query.board_id;
    const sort = req.query.sort || 'latest'; // 'latest' or 'popular'

    let query = 'SELECT * FROM posts';
    const params = [];

    if (boardId) {
        query += ' WHERE board_id = ?';
        params.push(boardId);
    }

    // Sort by created_at first. For 'popular', we will sort in memory after attaching likes/replies.
    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, posts) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all('SELECT * FROM replies ORDER BY created_at ASC', [], (err, replies) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all('SELECT * FROM post_likes', [], (err, likes) => {
                if (err) return res.status(500).json({ error: err.message });

                db.all('SELECT * FROM post_saves', [], (err, saves) => {
                    if (err) return res.status(500).json({ error: err.message });

                    let postsWithDetails = posts.map(post => {
                        const postLikes = likes.filter(l => l.post_id === post.id);
                        const postSaves = saves.filter(s => s.post_id === post.id);
                        const postReplies = replies.filter(reply => reply.post_id === post.id);

                        return {
                            ...post,
                            replies: postReplies,
                            likesCount: postLikes.length,
                            savesCount: postSaves.length,
                            isLiked: currentUserId ? postLikes.some(l => l.user_id === currentUserId) : false,
                            isSaved: currentUserId ? postSaves.some(s => s.user_id === currentUserId) : false,
                            popularityScore: postLikes.length * 2 + postReplies.length // Simple metric for popular sorting
                        };
                    });

                    // In-memory sorting for popular
                    if (sort === 'popular') {
                        postsWithDetails.sort((a, b) => b.popularityScore - a.popularityScore);
                    }

                    res.json(postsWithDetails);
                });
            });
        });
    });
});

// Create a new post (requires auth, supports image upload)
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
    const { title, content, board_id } = req.body;
    const author = req.user.username; // Use username from JWT
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const boardId = board_id || 1; // Default to board 1 if missing

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    const query = 'INSERT INTO posts (title, content, author, image_url, board_id) VALUES (?, ?, ?, ?, ?)';
    db.run(query, [title, content, author, imageUrl, boardId], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const newPost = { id: this.lastID, title, content, author, image_url: imageUrl, board_id: boardId, replies: [] };

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
    db.run(query, [postId, content, author], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const newReply = { id: this.lastID, post_id: Number(postId), content, author };

        // Broadcast new reply via WebSocket
        if (req.wss) {
            broadcast(req.wss, { type: 'NEW_REPLY', data: newReply });
        }

        res.status(201).json(newReply);
    });
});

// Toggle Like
router.post('/:id/like', authMiddleware, (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;

    db.get('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Like removed', isLiked: false });
            });
        } else {
            db.run('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Like added', isLiked: true });
            });
        }
    });
});

// Toggle Save
router.post('/:id/save', authMiddleware, (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;

    db.get('SELECT * FROM post_saves WHERE post_id = ? AND user_id = ?', [postId, userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run('DELETE FROM post_saves WHERE post_id = ? AND user_id = ?', [postId, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Save removed', isSaved: false });
            });
        } else {
            db.run('INSERT INTO post_saves (post_id, user_id) VALUES (?, ?)', [postId, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Save added', isSaved: true });
            });
        }
    });
});

// Delete a post (requires auth, must be author, moderator of the board, or admin)
router.delete('/:id', authMiddleware, (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const username = req.user.username;

    // First check if post exists and get its board_id and author
    db.get('SELECT author, board_id FROM posts WHERE id = ?', [postId], (err, post) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Check if user is author or admin
        let hasPermission = (post.author === username || userRole === 'admin');

        // If not author or admin, check if user is a moderator for this board
        if (!hasPermission) {
            db.get('SELECT * FROM board_moderators WHERE board_id = ? AND user_id = ?', [post.board_id, userId], (err, mod) => {
                if (err) return res.status(500).json({ error: err.message });
                if (mod) {
                    deletePost(postId, req, res);
                } else {
                    return res.status(403).json({ error: 'Permission denied to delete this post' });
                }
            });
        } else {
            deletePost(postId, req, res);
        }
    });
});

function deletePost(postId, req, res) {
    db.serialize(() => {
        db.run('DELETE FROM replies WHERE post_id = ?', [postId]);
        db.run('DELETE FROM post_likes WHERE post_id = ?', [postId]);
        db.run('DELETE FROM post_saves WHERE post_id = ?', [postId]);
        db.run('DELETE FROM posts WHERE id = ?', [postId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (req.wss) {
                broadcast(req.wss, { type: 'POST_DELETED', data: { id: Number(postId) } });
            }
            res.json({ message: 'Post deleted successfully' });
        });
    });
}

module.exports = router;
