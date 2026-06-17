const bcrypt = require('bcryptjs');
const db = require('./database');

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

setTimeout(async () => {
    try {
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        db.serialize(() => {
            // Clear existing data
            db.run('DELETE FROM replies');
            db.run('DELETE FROM posts');
            db.run('DELETE FROM users');
            db.run('DELETE FROM site_visits');

            console.log('Inserting seed data...');

            db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', adminPassword, 'admin']);

            const today = new Date().toISOString().split('T')[0];
            db.run('INSERT INTO site_visits (date, count) VALUES (?, ?)', [today, 42]);
            
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            db.run('INSERT INTO site_visits (date, count) VALUES (?, ?)', [yesterday, 30]);

            const insertPost = db.prepare('INSERT INTO posts (title, content, author) VALUES (?, ?, ?)');
            const insertReply = db.prepare('INSERT INTO replies (post_id, content, author) VALUES (?, ?, ?)');

            let completedPosts = 0;

            seedData.forEach((postData) => {
                insertPost.run([postData.title, postData.content, postData.author], function(err) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    
                    const postId = this.lastID;
                    
                    postData.replies.forEach(reply => {
                        insertReply.run([postId, reply.content, reply.author], (err) => {
                            if (err) console.error(err);
                        });
                    });

                    completedPosts++;
                    if (completedPosts === seedData.length) {
                        console.log('Seed data inserted successfully!');
                        insertPost.finalize();
                        insertReply.finalize();
                        
                        setTimeout(() => db.close(), 1000);
                    }
                });
            });
        });
    } catch (err) {
        console.error('Seed Error:', err);
    }
}, 1000);
