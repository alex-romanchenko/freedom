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
  const groupChatRoutes = require('./routes/groupChat.routes');
  const { markIncomingMessagesAsDelivered } = require('./models/message.model');
  const {
    getFcmTokensByUserId,
    savePendingCall,
    getPendingCall,
    deletePendingCall,
  } = require('./models/user.model');

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
  app.use('/api/group-chats', groupChatRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/posts', postCommentRoutes);
  app.get('/', (req, res) => {
    res.send('Freedom API is running 🚀');
  });

  const { messaging } = require('./utils/firebaseAdmin');

    app.post('/api/test-push', async (req, res) => {
      try {
        const { token } = req.body;

        if (!token) {
          return res.status(400).json({
            message: 'Token is required',
          });
        }

        const result = await messaging.send({
          token,
          notification: {
            title: 'Freedom',
            body: 'Test push notification',
          },
          data: {
            type: 'test',
          },
        });

        res.json({
          message: 'Push sent',
          result,
        });
      } catch (error) {
        console.error('Test push error:', error);
        res.status(500).json({
          message: 'Push error',
          error: error.message,
        });
      }
    });

    app.get('/api/pending-call/:callerId', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const receiverId = decoded.id;
    const callerId = req.params.callerId;

    const pendingCall = await getPendingCall(receiverId, callerId);

    if (!pendingCall) {
      return res.status(404).json({
        message: 'Pending call not found',
      });
    }

    res.json({
      callerId: pendingCall.caller_id,
      receiverId: pendingCall.receiver_id,
      offer: pendingCall.offer,
      withVideo: pendingCall.with_video,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error getting pending call',
      error: error.message,
    });
  }
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

socket.on('callUser', async ({ to, offer, from, withVideo }) => {
  console.log('CALL USER:', { from, to, withVideo });

  let caller = null;

  try {
    const result = await pool.query(
      'SELECT id, username, avatar, display_name FROM users WHERE id = $1',
      [from]
    );

    caller = result.rows[0];
  } catch (error) {
    console.error('Get caller error:', error.message);
  }

  const incomingPayload = {
    from,
    offer,
    withVideo,
    caller: caller || {
      id: from,
      username: `User ${from}`,
    },
  };

    await savePendingCall({
    callerId: from,
    receiverId: to,
    offer,
    withVideo,
  });

  io.to(`user_${to}`).emit('incomingCall', incomingPayload);

  const targetRoom = io.sockets.adapter.rooms.get(`user_${to}`);
  const targetOnline = Boolean(targetRoom && targetRoom.size > 0);

  if (targetOnline) {
    console.log('SKIP FCM CALL PUSH, USER ONLINE:', {
      to,
      sockets: Array.from(targetRoom),
    });
    return;
  }

  try {
    const tokens = await getFcmTokensByUserId(to);

    if (tokens.length > 0) {
      await Promise.all(
        tokens.map((token) =>
          messaging.send({
            token,
            data: {
              type: 'incoming_call',
              callerId: String(from),
              withVideo: String(withVideo),
              callerName:
                caller?.display_name ||
                caller?.username ||
                `User ${from}`,
              callerAvatar: caller?.avatar || '',
            },
            android: {
              priority: 'high',
            },
          })
        )
      );

      console.log('FCM CALL PUSH SENT:', {
        to,
        tokens: tokens.length,
      });
    } else {
      console.log('NO FCM TOKENS FOR USER:', to);
    }
  } catch (error) {
    console.error('FCM CALL PUSH ERROR:', error.message);
  }
});

socket.on('answerCall', ({ to, answer }) => {
  io.to(`user_${to}`).emit('callAnswered', {
    answer,
  });
});

socket.on('rejectCall', async ({ to, from }) => {
  io.to(`user_${to}`).emit('callRejected');

  if (from) {
    socket.to(`user_${from}`).emit('callHandledOnOtherDevice');
  }

  if (from && to) {
    try {
      await deletePendingCall(from, to);
    } catch (error) {
      console.error('Delete pending rejected call error:', error.message);
    }
  }
});

socket.on('acceptCallOnDevice', ({ from }) => {
  if (from) {
    socket.to(`user_${from}`).emit('callHandledOnOtherDevice');
  }
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
