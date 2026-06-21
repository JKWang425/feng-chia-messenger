const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
const { sql, poolPromise } = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { postLimiter } = require('../middleware/rateLimiter');
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

// Get posts with pagination, replies, likes, and saves
router.get('/', async (req, res) => {
    const currentUserId = getOptionalUserId(req);
    const boardId = req.query.board_id;
    const sort = req.query.sort || 'latest'; // 'latest' or 'popular'
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const offset = (page - 1) * limit;
    const search = req.query.search;

    try {
        const pool = await poolPromise;

        let conditions = [];
        if (boardId) conditions.push('board_id = @boardId');
        if (search) conditions.push('(title LIKE @search OR content LIKE @search)');
        let whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

        // --- Count total posts ---
        let countQuery = 'SELECT COUNT(*) AS total FROM posts' + whereClause;
        const countRequest = pool.request();
        if (boardId) countRequest.input('boardId', sql.Int, boardId);
        if (search) countRequest.input('search', sql.NVarChar, `%${search}%`);

        const countResult = await countRequest.query(countQuery);
        const totalPosts = countResult.recordset[0].total;

        // --- Fetch paginated posts ---
        let query = 'SELECT * FROM posts' + whereClause;
        let request = pool.request();

        if (boardId) request.input('boardId', sql.Int, boardId);
        if (search) request.input('search', sql.NVarChar, `%${search}%`);

        query += ' ORDER BY created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limit);

        const postsResult = await request.query(query);
        const posts = postsResult.recordset;

        if (posts.length === 0) {
            return res.json({ posts: [], totalPosts, page, limit, hasMore: false });
        }

        // --- Fetch related data only for current page's posts ---
        const postIds = posts.map(p => p.id);
        const idList = postIds.join(',');

        const [repliesResult, likesResult, savesResult] = await Promise.all([
            pool.request().query(`SELECT * FROM replies WHERE post_id IN (${idList}) ORDER BY created_at ASC`),
            pool.request().query(`SELECT * FROM post_likes WHERE post_id IN (${idList})`),
            pool.request().query(`SELECT * FROM post_saves WHERE post_id IN (${idList})`)
        ]);

        const replies = repliesResult.recordset;
        const likes = likesResult.recordset;
        const saves = savesResult.recordset;

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
                popularityScore: postLikes.length * 2 + postReplies.length
            };
        });

        // In-memory sorting for popular (within this page)
        if (sort === 'popular') {
            postsWithDetails.sort((a, b) => b.popularityScore - a.popularityScore);
        }

        const hasMore = page * limit < totalPosts;
        res.json({ posts: postsWithDetails, totalPosts, page, limit, hasMore });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new post (requires auth, supports image upload)
router.post('/', authMiddleware, postLimiter, upload.single('image'), async (req, res) => {
    const { title, content, board_id } = req.body;
    const author = req.user.username; // Use username from JWT
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const boardId = board_id || 1; // Default to board 1 if missing

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('title', sql.NVarChar, title)
            .input('content', sql.NVarChar, content)
            .input('author', sql.NVarChar, author)
            .input('imageUrl', sql.NVarChar, imageUrl)
            .input('boardId', sql.Int, boardId)
            .query('INSERT INTO posts (title, content, author, image_url, board_id) OUTPUT INSERTED.id VALUES (@title, @content, @author, @imageUrl, @boardId)');
            
        const newPost = { id: result.recordset[0].id, title, content, author, image_url: imageUrl, board_id: boardId, replies: [] };

        // Broadcast new post via WebSocket
        if (req.wss) {
            broadcast(req.wss, { type: 'NEW_POST', data: newPost });
        }

        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reply to a post (requires auth)
router.post('/:id/replies', authMiddleware, postLimiter, async (req, res) => {
    const postId = req.params.id;
    const { content } = req.body;
    const author = req.user.username; // Use username from JWT

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('postId', sql.Int, postId)
            .input('content', sql.NVarChar, content)
            .input('author', sql.NVarChar, author)
            .query('INSERT INTO replies (post_id, content, author) OUTPUT INSERTED.id VALUES (@postId, @content, @author)');
            
        const newReply = { id: result.recordset[0].id, post_id: Number(postId), content, author };

        // Broadcast new reply via WebSocket
        if (req.wss) {
            broadcast(req.wss, { type: 'NEW_REPLY', data: newReply });
        }

        res.status(201).json(newReply);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Like
router.post('/:id/like', authMiddleware, postLimiter, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;

    try {
        const pool = await poolPromise;
        const check = await pool.request()
            .input('postId', sql.Int, postId)
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM post_likes WHERE post_id = @postId AND user_id = @userId');

        if (check.recordset.length > 0) {
            await pool.request()
                .input('postId', sql.Int, postId)
                .input('userId', sql.Int, userId)
                .query('DELETE FROM post_likes WHERE post_id = @postId AND user_id = @userId');
            // Get updated count
            const countResult = await pool.request()
                .input('postId2', sql.Int, postId)
                .query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = @postId2');
            const newCount = countResult.recordset[0].cnt;
            if (req.wss) broadcast(req.wss, { type: 'LIKE_UPDATED', data: { post_id: Number(postId), likesCount: newCount } });
            res.json({ message: 'Like removed', isLiked: false, likesCount: newCount });
        } else {
            await pool.request()
                .input('postId', sql.Int, postId)
                .input('userId', sql.Int, userId)
                .query('INSERT INTO post_likes (post_id, user_id) VALUES (@postId, @userId)');
            const countResult = await pool.request()
                .input('postId2', sql.Int, postId)
                .query('SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = @postId2');
            const newCount = countResult.recordset[0].cnt;
            if (req.wss) broadcast(req.wss, { type: 'LIKE_UPDATED', data: { post_id: Number(postId), likesCount: newCount } });
            res.json({ message: 'Like added', isLiked: true, likesCount: newCount });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle Save
router.post('/:id/save', authMiddleware, postLimiter, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;

    try {
        const pool = await poolPromise;
        const check = await pool.request()
            .input('postId', sql.Int, postId)
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM post_saves WHERE post_id = @postId AND user_id = @userId');

        if (check.recordset.length > 0) {
            await pool.request()
                .input('postId', sql.Int, postId)
                .input('userId', sql.Int, userId)
                .query('DELETE FROM post_saves WHERE post_id = @postId AND user_id = @userId');
            const countResult = await pool.request()
                .input('postId2', sql.Int, postId)
                .query('SELECT COUNT(*) AS cnt FROM post_saves WHERE post_id = @postId2');
            const newCount = countResult.recordset[0].cnt;
            if (req.wss) broadcast(req.wss, { type: 'SAVE_UPDATED', data: { post_id: Number(postId), savesCount: newCount } });
            res.json({ message: 'Save removed', isSaved: false, savesCount: newCount });
        } else {
            await pool.request()
                .input('postId', sql.Int, postId)
                .input('userId', sql.Int, userId)
                .query('INSERT INTO post_saves (post_id, user_id) VALUES (@postId, @userId)');
            const countResult = await pool.request()
                .input('postId2', sql.Int, postId)
                .query('SELECT COUNT(*) AS cnt FROM post_saves WHERE post_id = @postId2');
            const newCount = countResult.recordset[0].cnt;
            if (req.wss) broadcast(req.wss, { type: 'SAVE_UPDATED', data: { post_id: Number(postId), savesCount: newCount } });
            res.json({ message: 'Save added', isSaved: true, savesCount: newCount });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a post (requires auth, must be author, moderator of the board, or admin)
router.delete('/:id', authMiddleware, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const username = req.user.username;

    try {
        const pool = await poolPromise;
        
        // First check if post exists and get its board_id and author
        const postResult = await pool.request()
            .input('postId', sql.Int, postId)
            .query('SELECT author, board_id FROM posts WHERE id = @postId');
            
        const post = postResult.recordset[0];
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Check if user is author or admin
        let hasPermission = (post.author === username || userRole === 'admin');

        // If not author or admin, check if user is a moderator for this board
        if (!hasPermission) {
            const modCheck = await pool.request()
                .input('boardId', sql.Int, post.board_id)
                .input('userId', sql.Int, userId)
                .query('SELECT * FROM board_moderators WHERE board_id = @boardId AND user_id = @userId');
                
            if (modCheck.recordset.length > 0) {
                await deletePost(postId, pool, req, res);
            } else {
                return res.status(403).json({ error: 'Permission denied to delete this post' });
            }
        } else {
            await deletePost(postId, pool, req, res);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function deletePost(postId, pool, req, res) {
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const request = new sql.Request(transaction);
        request.input('postId', sql.Int, postId);
        
        await request.query('DELETE FROM replies WHERE post_id = @postId');
        await request.query('DELETE FROM post_likes WHERE post_id = @postId');
        await request.query('DELETE FROM post_saves WHERE post_id = @postId');
        await request.query('DELETE FROM posts WHERE id = @postId');
        
        await transaction.commit();
        
        if (req.wss) {
            broadcast(req.wss, { type: 'POST_DELETED', data: { id: Number(postId) } });
        }
        res.json({ message: 'Post deleted successfully' });
    } catch (err) {
        await transaction.rollback();
        res.status(500).json({ error: err.message });
    }
}

module.exports = router;
