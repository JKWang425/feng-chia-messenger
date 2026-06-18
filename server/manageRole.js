const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const action = process.argv[2];
const username = process.argv[3];
const param = process.argv[4];

if (!action || !username) {
    console.log("使用方式:");
    console.log("  1. 設定管理員: node manageRole.js admin <使用者名稱>");
    console.log("  2. 設定版主:   node manageRole.js mod <使用者名稱> <看板ID>");
    console.log("  3. 移除版主:   node manageRole.js unmod <使用者名稱> <看板ID>");
    process.exit(1);
}

db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return console.error("資料庫錯誤:", err.message);
    if (!user) return console.error(`找不到使用者: ${username}，請先在網站上註冊該帳號。`);

    if (action === 'admin') {
        db.run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id], function (err) {
            if (err) return console.error(err.message);
            console.log(`✅ 成功！已將 ${username} 升級為管理員 (Admin)`);
            console.log(`請請該使用者登出後重新登入，即可看到管理員後台。`);
        });
    } else if (action === 'mod') {
        if (!param) return console.error("請提供看板ID！例如: node manageRole.js mod Jack 1");
        db.run("INSERT OR IGNORE INTO board_moderators (board_id, user_id) VALUES (?, ?)", [param, user.id], function (err) {
            if (err) return console.error(err.message);
            console.log(`✅ 成功！已將 ${username} 設為 看板 ID ${param} 的版主`);
            console.log(`請請該使用者登出後重新登入，即可看到該看板的刪文按鈕。`);
        });
    } else if (action === 'unmod') {
        if (!param) return console.error("請提供看板ID！例如: node manageRole.js unmod Jack 1");
        db.run("DELETE FROM board_moderators WHERE board_id = ? AND user_id = ?", [param, user.id], function (err) {
            if (err) return console.error(err.message);
            console.log(`✅ 成功！已移除 ${username} 在 看板 ID ${param} 的版主權限`);
        });
    } else {
        console.log("未知的指令。");
    }
});
