const { sql, poolPromise } = require('./database');
const bcrypt = require('bcryptjs');

const action = process.argv[2];
const username = process.argv[3];
const param = process.argv[4];

if (!action || !username) {
    console.log("使用方式:");
    console.log("  1. 設定管理員: node manageRole.js admin <使用者名稱>");
    console.log("  2. 移除管理員: node manageRole.js unadmin <使用者名稱>");
    console.log("  3. 設定版主:   node manageRole.js mod <使用者名稱> <看板ID>");
    console.log("  4. 移除版主:   node manageRole.js unmod <使用者名稱> <看板ID>");
    console.log("  5. 重設密碼:   node manageRole.js resetpw <使用者名稱> <新密碼>");
    process.exit(1);
}

async function run() {
    try {
        const pool = await poolPromise;
        const userResult = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT id FROM users WHERE username = @username');

        const user = userResult.recordset[0];
        if (!user) {
            console.error(`找不到使用者: ${username}，請先在網站上註冊該帳號。`);
            process.exit(1);
        }

        if (action === 'admin') {
            await pool.request()
                .input('userId', sql.Int, user.id)
                .query("UPDATE users SET role = 'admin' WHERE id = @userId");
            console.log(`✅ 成功！已將 ${username} 升級為管理員 (Admin)`);
            console.log(`請該使用者登出後重新登入，即可看到管理員後台。`);
        } else if (action === 'unadmin') {
            await pool.request()
                .input('userId', sql.Int, user.id)
                .query("UPDATE users SET role = 'user' WHERE id = @userId");
            console.log(`✅ 成功！已將 ${username} 降級為一般使用者 (User)`);
        } else if (action === 'mod') {
            if (!param) {
                console.error("請提供看板ID！例如: node manageRole.js mod Jack 1");
                process.exit(1);
            }
            // IF NOT EXISTS INSERT (to simulate INSERT OR IGNORE)
            await pool.request()
                .input('boardId', sql.Int, param)
                .input('userId', sql.Int, user.id)
                .query(`
                    IF NOT EXISTS (SELECT * FROM board_moderators WHERE board_id = @boardId AND user_id = @userId)
                    BEGIN
                        INSERT INTO board_moderators (board_id, user_id) VALUES (@boardId, @userId)
                    END
                `);
            console.log(`✅ 成功！已將 ${username} 設為 看板 ID ${param} 的版主`);
            console.log(`請該使用者登出後重新登入，即可看到該看板的刪文按鈕。`);
        } else if (action === 'unmod') {
            if (!param) {
                console.error("請提供看板ID！例如: node manageRole.js unmod Jack 1");
                process.exit(1);
            }
            await pool.request()
                .input('boardId', sql.Int, param)
                .input('userId', sql.Int, user.id)
                .query("DELETE FROM board_moderators WHERE board_id = @boardId AND user_id = @userId");
            console.log(`✅ 成功！已移除 ${username} 在 看板 ID ${param} 的版主權限`);
        } else if (action === 'resetpw') {
            if (!param) {
                console.error("請提供新密碼！例如: node manageRole.js resetpw Jack 123456");
                process.exit(1);
            }
            const hashedPassword = await bcrypt.hash(param, 10);
            await pool.request()
                .input('userId', sql.Int, user.id)
                .input('password', sql.NVarChar, hashedPassword)
                .query("UPDATE users SET password = @password WHERE id = @userId");
            console.log(`✅ 成功！已將 ${username} 的密碼強制重設為: ${param}`);
        } else {
            console.log("未知的指令。");
        }
    } catch (err) {
        console.error("資料庫錯誤:", err.message);
    } finally {
        process.exit(0);
    }
}

run();
