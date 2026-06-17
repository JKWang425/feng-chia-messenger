const express = require('express');
const router = express.Router();
const db = require('../database');

router.post('/', (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    db.get('SELECT count FROM site_visits WHERE date = ?', [today], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            db.run('UPDATE site_visits SET count = count + 1 WHERE date = ?', [today], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, count: row.count + 1 });
            });
        } else {
            db.run('INSERT INTO site_visits (date, count) VALUES (?, 1)', [today], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, count: 1 });
            });
        }
    });
});

module.exports = router;
