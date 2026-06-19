require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to Azure SQL Database');

        const initScript = `
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'boards')
            BEGIN
                CREATE TABLE boards (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(255) UNIQUE NOT NULL,
                    description NVARCHAR(MAX)
                );
                
                INSERT INTO boards (name, description) VALUES 
                    (N'🎓 校園閒聊', N'綜合討論'),
                    (N'🍔 逢甲美食', N'便當街、周邊美食'),
                    (N'📚 課程討論', N'選課、教授評價'),
                    (N'🏠 租屋資訊', N'逢甲周邊租屋'),
                    (N'🤝 二手交易', N'課本、機車、生活用品'),
                    (N'🎸 社團活動', N'各系學會、社團宣傳');
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
            BEGIN
                CREATE TABLE users (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    username NVARCHAR(255) UNIQUE NOT NULL,
                    password NVARCHAR(255) NOT NULL,
                    role NVARCHAR(50) DEFAULT 'user',
                    created_at DATETIME DEFAULT GETDATE()
                )
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'site_visits')
            BEGIN
                CREATE TABLE site_visits (
                    date DATE PRIMARY KEY,
                    count INT DEFAULT 0
                )
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'posts')
            BEGIN
                CREATE TABLE posts (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    title NVARCHAR(255) NOT NULL,
                    content NVARCHAR(MAX) NOT NULL,
                    author NVARCHAR(255) NOT NULL,
                    image_url NVARCHAR(MAX),
                    board_id INT DEFAULT 1,
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET DEFAULT
                )
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'board_moderators')
            BEGIN
                CREATE TABLE board_moderators (
                    board_id INT NOT NULL,
                    user_id INT NOT NULL,
                    UNIQUE(board_id, user_id),
                    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION
                )
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'replies')
            BEGIN
                CREATE TABLE replies (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    post_id INT NOT NULL,
                    content NVARCHAR(MAX) NOT NULL,
                    author NVARCHAR(255) NOT NULL,
                    created_at DATETIME DEFAULT GETDATE(),
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                )
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'post_likes')
            BEGIN
                CREATE TABLE post_likes (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    post_id INT NOT NULL,
                    user_id INT NOT NULL,
                    UNIQUE(post_id, user_id),
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION
                )
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'post_saves')
            BEGIN
                CREATE TABLE post_saves (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    post_id INT NOT NULL,
                    user_id INT NOT NULL,
                    UNIQUE(post_id, user_id),
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION
                )
            END
        `;

        return pool.request().query(initScript).then(() => pool);
    })
    .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
    });

module.exports = {
    sql,
    poolPromise
};
