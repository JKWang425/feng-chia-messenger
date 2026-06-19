const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('../database');

router.post('/', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('today', sql.Date, today)
            .query('SELECT count FROM site_visits WHERE date = @today');
            
        if (result.recordset.length > 0) {
            await pool.request()
                .input('today', sql.Date, today)
                .query('UPDATE site_visits SET count = count + 1 WHERE date = @today');
            res.json({ success: true, count: result.recordset[0].count + 1 });
        } else {
            await pool.request()
                .input('today', sql.Date, today)
                .query('INSERT INTO site_visits (date, count) VALUES (@today, 1)');
            res.json({ success: true, count: 1 });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
