const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const postsRouter = require('./routes/posts');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const visitsRouter = require('./routes/visits');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 3000;

// Update CORS to allow cookies
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Pass wss to routes
app.use((req, res, next) => {
    req.wss = wss;
    next();
});

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/visits', visitsRouter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    ws.on('close', () => console.log('Client disconnected'));
});

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
