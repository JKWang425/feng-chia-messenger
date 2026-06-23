const rateLimit = require('express-rate-limit');

// 全域防護：15 分鐘內最多 200 次請求
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, 
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 登入/註冊防護：1 小時內最多 10 次錯誤/嘗試
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    keyGenerator: (req) => {
        // 如果請求中有 username（例如登入/註冊），則以 IP + username 作為限制基準
        // 這樣可以避免同一個 IP 下的其他使用者被無辜封鎖
        return req.body.username ? `${req.ip}_${req.body.username}` : req.ip;
    },
    message: { error: 'Too many login attempts, please try again after an hour.' }
});

// 發文防護：1 分鐘內最多發佈 5 次
const postLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { error: 'You are posting too fast, please try again in a minute.' }
});

module.exports = { globalLimiter, authLimiter, postLimiter };
