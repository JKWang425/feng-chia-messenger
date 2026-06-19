const express = require('express');
const router = express.Router();
const { poolPromise } = require('../database');

// Get all boards
router.get('/', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM boards ORDER BY id ASC');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
