const pool = require('./db');
const express = require('express');
const authRoutes = require('./routes/auth.routes');
const cors = require('cors');
const postRoutes = require('./routes/post.routes');
const userRoutes = require('./routes/user.routes');
const followRoutes = require('./routes/follow.routes');
const path = require('path');
const messageRoutes = require('./routes/message.routes');
const http = require('http');
const { Server } = require('socket.io');
const photoRoutes = require('./routes/photo.routes');
const photoLikeRoutes = require('./routes/photoLike.routes');
const photoCommentRoutes = require('./routes/photoComment.routes');
const postCommentRoutes = require('./routes/postComment.routes');
const notificationRoutes = require('./routes/notification.routes');

require('dotenv').config();


const app = express();

app.use('/api/follow', followRoutes);
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
app.use('/api/users', userRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/photos', photoLikeRoutes);
app.use('/api/photos', photoCommentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/posts', postCommentRoutes);
app.get('/', (req, res) => {
  res.send('Freedom API is running 🚀');
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinUser', (userId) => {
  socket.join(`user_${userId}`);
  console.log(`Socket ${socket.id} joined user_${userId}`);
});

  socket.on('joinConversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`Socket ${socket.id} joined conversation_${conversationId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      message: 'Database connected',
      time: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      message: 'Database connection error',
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});