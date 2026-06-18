const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create tables
        db.serialize(() => {
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS site_visits (
                date DATE PRIMARY KEY,
                count INTEGER DEFAULT 0
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                author TEXT NOT NULL,
                image_url TEXT,
                board_id INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET DEFAULT
            )`);

            // Try to add board_id column to existing posts table
            db.run("ALTER TABLE posts ADD COLUMN board_id INTEGER DEFAULT 1 REFERENCES boards(id)", (err) => {
                // Ignore error if column already exists
            });

            db.run(`CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            )`, () => {
                // Seed default boards
                const defaultBoards = [
                    { id: 1, name: '🎓 校園閒聊', description: '綜合討論' },
                    { id: 2, name: '🍔 逢甲美食', description: '便當街、周邊美食' },
                    { id: 3, name: '📚 課程討論', description: '選課、教授評價' },
                    { id: 4, name: '🏠 租屋資訊', description: '逢甲周邊租屋' },
                    { id: 5, name: '🤝 二手交易', description: '課本、機車、生活用品' },
                    { id: 6, name: '🎸 社團活動', description: '各系學會、社團宣傳' }
                ];

                const insertBoard = db.prepare('INSERT OR IGNORE INTO boards (id, name, description) VALUES (?, ?, ?)');
                defaultBoards.forEach(board => {
                    insertBoard.run(board.id, board.name, board.description);
                });
                insertBoard.finalize();
            });

            db.run(`CREATE TABLE IF NOT EXISTS board_moderators (
                board_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                UNIQUE(board_id, user_id),
                FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                author TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS post_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                UNIQUE(post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS post_saves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                UNIQUE(post_id, user_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);
        });
    }
});

module.exports = db;
