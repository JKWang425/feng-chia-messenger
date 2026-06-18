const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all boards
router.get('/', (req, res) => {
    db.all('SELECT * FROM boards ORDER BY id ASC', [], (err, boards) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(boards);
    });
});

module.exports = router;
