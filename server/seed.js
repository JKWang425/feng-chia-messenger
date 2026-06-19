const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('./database');

const seedData = [
    {
        title: '【問題】資工系大一必修選課請益',
        content: '想請問各位學長姐，大一的計算機概論推薦選哪位老師的課呢？看網路上評價很兩極，想聽聽大家的意見。',
        author: '迷茫的新生',
        replies: [
            { content: '大推張教授，上課幽默但作業有點多', author: '資工大二老油條' },
            { content: '看你想學東西還是想輕鬆過，想學東西就選張教授', author: '過來人' }
        ]
    },
    {
        title: '【情報】圖書館地下室自習室開放時間延長！',
        content: '剛剛看到圖書館公告，期末考週（下週開始）地下室的自習室會24小時開放，大家加油！',
        author: '逢甲百曉生',
        replies: [
            { content: '太棒了吧！終於不用去外面咖啡廳熬夜了', author: '期末火燒屁股' },
            { content: '感謝情報，希望搶得到位置', author: '只會睡覺' }
        ]
    },
    {
        title: '【尋物】誰在語文大樓掉了一把黑色雨傘？',
        content: '今天早上在語文大樓2樓女廁外面看到一把黑色的折疊傘，有需要的人可以去教官室認領喔。',
        author: '好心人A',
        replies: []
    },
    {
        title: '【閒聊】逢甲夜市有什麼新開推薦的嗎？',
        content: '最近吃膩了那幾家老店，想請問大家有沒有推薦逢甲夜市最近新開的美食？',
        author: '吃貨擔當',
        replies: [
            { content: '文華路那邊新開了一家韓式炸雞，還不錯吃', author: '美食雷達' },
            { content: '推明倫蛋餅旁邊巷子的地瓜球', author: 'QQ蛋愛好者' },
            { content: '那家地瓜球每次都排超長...放棄', author: '懶得排隊' }
        ]
    }
];

async function runSeed() {
    try {
        const adminPassword = await bcrypt.hash('admin123', 10);
        const pool = await poolPromise;
        console.log('Inserting seed data...');

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);

            // Clear existing data (order matters due to FK constraints)
            await request.query('DELETE FROM replies');
            await request.query('DELETE FROM post_likes');
            await request.query('DELETE FROM post_saves');
            await request.query('DELETE FROM posts');
            await request.query('DELETE FROM board_moderators');
            await request.query('DELETE FROM users');
            await request.query('DELETE FROM site_visits');

            // Insert admin
            request.input('adminUser', sql.NVarChar, 'admin');
            request.input('adminPass', sql.NVarChar, adminPassword);
            request.input('adminRole', sql.NVarChar, 'admin');
            await request.query('INSERT INTO users (username, password, role) VALUES (@adminUser, @adminPass, @adminRole)');

            // Insert site visits
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            
            request.input('today', sql.Date, today);
            await request.query('INSERT INTO site_visits (date, count) VALUES (@today, 42)');
            
            request.input('yesterday', sql.Date, yesterday);
            await request.query('INSERT INTO site_visits (date, count) VALUES (@yesterday, 30)');

            // Insert posts and replies
            for (const postData of seedData) {
                const postReq = new sql.Request(transaction);
                postReq.input('title', sql.NVarChar, postData.title);
                postReq.input('content', sql.NVarChar, postData.content);
                postReq.input('author', sql.NVarChar, postData.author);
                const postRes = await postReq.query('INSERT INTO posts (title, content, author) OUTPUT INSERTED.id VALUES (@title, @content, @author)');
                const postId = postRes.recordset[0].id;

                for (const reply of postData.replies) {
                    const replyReq = new sql.Request(transaction);
                    replyReq.input('postId', sql.Int, postId);
                    replyReq.input('content', sql.NVarChar, reply.content);
                    replyReq.input('author', sql.NVarChar, reply.author);
                    await replyReq.query('INSERT INTO replies (post_id, content, author) VALUES (@postId, @content, @author)');
                }
            }

            await transaction.commit();
            console.log('Seed data inserted successfully!');
            process.exit(0);
        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
}

// Wait for database table initialization in database.js to complete
setTimeout(runSeed, 3000);
