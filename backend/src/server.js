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
  const { markIncomingMessagesAsDelivered } = require('./models/message.model');

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
  const onlineUsers = new Map();
  function getOnlineUserIds() {
      return Array.from(onlineUsers.keys());
  }
  io.on('connection', (socket) => {

    socket.on('getOnlineUsers', () => {
  socket.emit('onlineUsers', {
    users: getOnlineUserIds(),
  });
});

  socket.on('logoutUser', async (userId) => {
  const id = String(userId);

  onlineUsers.delete(id);

  try {
    await pool.query(
      'UPDATE users SET last_seen = NOW() WHERE id = $1',
      [id]
    );
  } catch (error) {
    console.error('Update last_seen on logout error:', error.message);
  }

  io.emit('userOffline', {
    userId: id,
    lastSeen: new Date().toISOString(),
  });

  io.emit('onlineUsers', {
    users: getOnlineUserIds(),
  });
});

    console.log('Socket connected:', socket.id);

  socket.on('joinUser', async (userId) => {
  const id = String(userId);

  socket.join(`user_${id}`);

  if (!onlineUsers.has(id)) {
    onlineUsers.set(id, new Set());
  }

  onlineUsers.get(id).add(socket.id);
  socket.userId = id;

  socket.emit('onlineUsers', {
  users: getOnlineUserIds(),
});

  io.emit('onlineUsers', {
    users: getOnlineUserIds(),
  });

  io.emit('userOnline', {
    userId: id,
  });

  try {
    const deliveredMessages = await markIncomingMessagesAsDelivered(id);

    deliveredMessages.forEach((message) => {
      io.to(`conversation_${message.conversation_id}`).emit('messagesDelivered', {
        conversationId: message.conversation_id,
        messageIds: [message.id],
      });
    });
  } catch (error) {
    console.error('Mark incoming delivered error:', error.message);
  }

  console.log(`Socket ${socket.id} joined user_${id}`);
});

    socket.on('joinConversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation_${conversationId}`);
    });

    socket.on('typing', ({ conversationId, userId }) => {
    socket.to(`conversation_${conversationId}`).emit('typing', {
      conversationId,
      userId,
    });
  });

  socket.on('stopTyping', ({ conversationId, userId }) => {
    socket.to(`conversation_${conversationId}`).emit('stopTyping', {
      conversationId,
      userId,
    });
  });

socket.on('callUser', ({ to, offer, from, withVideo }) => {
  console.log('CALL USER:', { from, to, withVideo });

  io.to(`user_${to}`).emit('incomingCall', {
    from,
    offer,
    withVideo,
  });
});

socket.on('answerCall', ({ to, answer }) => {
  io.to(`user_${to}`).emit('callAnswered', {
    answer,
  });
});

socket.on('iceCandidate', ({ to, candidate }) => {
  io.to(`user_${to}`).emit('iceCandidate', {
    candidate,
  });
});

socket.on('endCall', ({ to }) => {
  io.to(`user_${to}`).emit('callEnded');
});

socket.on('disconnect', async () => {
  const userId = socket.userId;

  if (userId && onlineUsers.has(userId)) {
    onlineUsers.get(userId).delete(socket.id);

    if (onlineUsers.get(userId).size === 0) {
      setTimeout(async () => {
        if (onlineUsers.has(userId) && onlineUsers.get(userId).size > 0) {
          return;
        }

        onlineUsers.delete(userId);

        const lastSeen = new Date().toISOString();

        try {
          await pool.query(
            'UPDATE users SET last_seen = NOW() WHERE id = $1',
            [userId]
          );
        } catch (error) {
          console.error('Update last_seen error:', error.message);
        }

        io.emit('userOffline', {
          userId,
          lastSeen,
        });

        io.emit('onlineUsers', {
          users: getOnlineUserIds(),
        });
      }, 2000);
    } else {
      io.emit('onlineUsers', {
        users: getOnlineUserIds(),
      });
    }
  }

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