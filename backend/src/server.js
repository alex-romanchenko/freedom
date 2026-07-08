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
  const {
    markIncomingMessagesAsDelivered,
    ensureMessageReactionsTable,
    setMessageReaction,
    findOrCreateConversation,
    createMessage,
    getMessageById,
  } = require('./models/message.model');
  const {
    getFcmTokensByUserId,
    deleteFcmToken,
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
  app.use('/api/posts', postCommentRoutes);
  app.use('/api/posts', postRoutes);
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
      callCreatedAtMs: getPendingCallCreatedAtMs(pendingCall),
      callSessionId: getPendingCallSessionId(
        pendingCall.caller_id,
        pendingCall.receiver_id
      ),
      iceCandidates: getPendingCallIceCandidates(
        pendingCall.caller_id,
        pendingCall.receiver_id
      ),
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
  const foregroundSockets = new Map();
  const CALL_TIMEOUT_MS = 30000;
  const ACTIVE_CALL_DISCONNECT_GRACE_MS = 12000;
  const pendingCallTimeouts = new Map();
  const pendingCallSessionIds = new Map();
  const activeCallsByUser = new Map();
  const activeCallDisconnectTimers = new Map();
  const recentCallLogEvents = new Map();
  // ICE candidates are normally delivered over Socket.IO. A device woken by FCM
  // Keep every early candidate until the receiver has answered. A socket can
  // already be connected while Flutter is still navigating to CallScreen.
  const pendingCallIceCandidates = new Map();

  function getPendingCallIceKey(callerId, receiverId) {
    return `${callerId}:${receiverId}`;
  }

  function clearPendingCallIceCandidates(callerId, receiverId) {
    pendingCallIceCandidates.delete(
      getPendingCallIceKey(callerId, receiverId)
    );
  }

  function setPendingCallSessionId(callerId, receiverId, callSessionId) {
    if (!callerId || !receiverId || !callSessionId) return;

    pendingCallSessionIds.set(
      getPendingCallTimeoutKey(callerId, receiverId),
      String(callSessionId)
    );
  }

  function getPendingCallSessionId(callerId, receiverId) {
    return pendingCallSessionIds.get(
      getPendingCallTimeoutKey(callerId, receiverId)
    );
  }

  function clearPendingCallSessionId(callerId, receiverId) {
    pendingCallSessionIds.delete(getPendingCallTimeoutKey(callerId, receiverId));
  }

  function storePendingCallIceCandidate(callerId, receiverId, candidate) {
    const key = getPendingCallIceKey(callerId, receiverId);
    const candidates = pendingCallIceCandidates.get(key) || [];
    const candidateValue = candidate?.candidate;

    if (
      candidateValue &&
      !candidates.some((item) => item?.candidate === candidateValue)
    ) {
      candidates.push(candidate);
      pendingCallIceCandidates.set(key, candidates);
      return true;
    }

    return false;
  }

  function getPendingCallIceCandidates(callerId, receiverId) {
    return [
      ...(pendingCallIceCandidates.get(
        getPendingCallIceKey(callerId, receiverId)
      ) || []),
    ];
  }

  function getOnlineUserIds() {
      return Array.from(onlineUsers.keys());
  }

  function hasOnlineSockets(userId) {
    const sockets = onlineUsers.get(String(userId));
    return Boolean(sockets && sockets.size > 0);
  }

  function normalizeCallUserId(userId) {
    return userId == null ? null : String(userId);
  }

  function getActiveCallKey(userA, userB) {
    const ids = [String(userA), String(userB)].sort();
    return `${ids[0]}:${ids[1]}`;
  }

  function setActiveCall(userA, userB, withVideo = false, callSessionId = null) {
    const firstUserId = normalizeCallUserId(userA);
    const secondUserId = normalizeCallUserId(userB);

    if (!firstUserId || !secondUserId) return null;

    const call = {
      key: getActiveCallKey(firstUserId, secondUserId),
      users: [firstUserId, secondUserId],
      withVideo: Boolean(withVideo),
      callSessionId: callSessionId ? String(callSessionId) : null,
      startedAt: Date.now(),
    };

    activeCallsByUser.set(firstUserId, call);
    activeCallsByUser.set(secondUserId, call);
    clearActiveCallDisconnectTimer(firstUserId);
    clearActiveCallDisconnectTimer(secondUserId);

    return call;
  }

  function getActiveCallForUser(userId) {
    return activeCallsByUser.get(String(userId));
  }

  function getOtherActiveCallUser(call, userId) {
    const id = String(userId);
    return call?.users?.find((item) => item !== id) || null;
  }

  function clearActiveCall(userA, userB) {
    const call =
      getActiveCallForUser(userA) ||
      getActiveCallForUser(userB);

    const users = call?.users || [userA, userB].filter((item) => item != null);

    users.forEach((userId) => {
      activeCallsByUser.delete(String(userId));
      clearActiveCallDisconnectTimer(userId);
    });
  }

  function clearActiveCallDisconnectTimer(userId) {
    const id = String(userId);
    const timer = activeCallDisconnectTimers.get(id);

    if (timer) {
      clearTimeout(timer);
      activeCallDisconnectTimers.delete(id);
    }
  }

  function scheduleActiveCallDisconnect(userId) {
    const id = String(userId);
    const call = getActiveCallForUser(id);
    const otherUserId = getOtherActiveCallUser(call, id);

    if (!call || !otherUserId || activeCallDisconnectTimers.has(id)) return;

    io.to(`user_${otherUserId}`).emit('callReconnecting', {
      from: id,
      to: otherUserId,
      timeoutMs: ACTIVE_CALL_DISCONNECT_GRACE_MS,
    });

    const timer = setTimeout(() => {
      activeCallDisconnectTimers.delete(id);

      if (hasOnlineSockets(id)) {
        io.to(`user_${otherUserId}`).emit('callReconnected', {
          from: id,
          to: otherUserId,
        });
        return;
      }

      const currentCall = getActiveCallForUser(id);
      const currentOtherUserId = getOtherActiveCallUser(currentCall, id);

      if (!currentCall || currentOtherUserId !== otherUserId) return;

      console.log('ACTIVE CALL DISCONNECT TIMEOUT:', {
        from: id,
        to: otherUserId,
      });

      io.to(`user_${otherUserId}`).emit('callEnded', {
        from: id,
        to: otherUserId,
        reason: 'disconnect',
      });

      clearActiveCall(id, otherUserId);
    }, ACTIVE_CALL_DISCONNECT_GRACE_MS);

    activeCallDisconnectTimers.set(id, timer);
  }

  function getForegroundSocketIds(userId) {
    return Array.from(foregroundSockets.get(String(userId)) || []);
  }

  function setSocketForeground(socket, isForeground) {
    const userId = socket.userId;
    if (!userId) return;

    const id = String(userId);

    if (isForeground) {
      if (!foregroundSockets.has(id)) {
        foregroundSockets.set(id, new Set());
      }

      foregroundSockets.get(id).add(socket.id);
      return;
    }

    if (!foregroundSockets.has(id)) return;

    foregroundSockets.get(id).delete(socket.id);

    if (foregroundSockets.get(id).size === 0) {
      foregroundSockets.delete(id);
    }
  }

async function sendFcmToTokens(tokens, buildMessage, label) {
  let sent = 0;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await messaging.send(buildMessage(token));
        sent += 1;
      } catch (error) {
        console.error(`${label} TOKEN ERROR:`, error.message);

        if (
          error.code === 'messaging/registration-token-not-registered' ||
          error.message === 'Requested entity was not found.'
        ) {
          try {
            await deleteFcmToken(token);
            console.log('DELETED INVALID FCM TOKEN');
          } catch (deleteError) {
            console.error('DELETE INVALID FCM TOKEN ERROR:', deleteError.message);
          }
        }
      }
    })
  );

  return sent;
}

async function sendCallCancelPush(
  userId,
  callerId,
  { showMissedNotification = false, withVideo = false } = {}
) {
  try {
    const tokens = await getFcmTokensByUserId(userId);

    if (tokens.length === 0) return;

    const caller = showMissedNotification
      ? await getCallUserSummary(callerId)
      : null;
    const callerName =
      caller?.display_name || caller?.username || `User ${callerId}`;
    const title = 'Missed call';
    const body = withVideo
      ? `Missed video call from ${callerName}`
      : `Missed audio call from ${callerName}`;

    const sent = await sendFcmToTokens(
      tokens,
      (token) => ({
        token,
        ...(showMissedNotification
          ? {
              notification: {
                title,
                body,
              },
            }
          : {}),
        data: {
          type: 'call_cancel',
          callerId: callerId ? String(callerId) : '',
          ...(showMissedNotification
            ? {
                missedNotification: 'true',
                callerName,
                callerAvatar: caller?.avatar || '',
                withVideo: String(Boolean(withVideo)),
              }
            : {}),
        },
        android: {
          priority: 'high',
          ...(showMissedNotification
            ? {
                notification: {
                  channelId: 'missed_calls',
                  tag: `missed_call_${callerId || 'unknown'}`,
                },
              }
            : {}),
        },
      }),
      'FCM CALL CANCEL'
    );

    console.log('FCM CALL CANCEL SENT:', {
      to: userId,
      tokens: tokens.length,
      sent,
    });
  } catch (error) {
    console.error('FCM CALL CANCEL ERROR:', error.message);
  }
}

async function getCallUserSummary(userId) {
  try {
    const result = await pool.query(
      'SELECT id, username, avatar, display_name FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('GET CALL USER SUMMARY ERROR:', error.message);
    return null;
  }
}

async function sendMissedCallPush(userId, callerId, withVideo = false) {
  try {
    const tokens = await getFcmTokensByUserId(userId);

    if (tokens.length === 0) return;

    const caller = await getCallUserSummary(callerId);
    const callerName =
      caller?.display_name || caller?.username || `User ${callerId}`;
    const title = 'Missed call';
    const body = withVideo
      ? `Missed video call from ${callerName}`
      : `Missed audio call from ${callerName}`;

    const sent = await sendFcmToTokens(
      tokens,
      (token) => ({
        token,
        notification: {
          title,
          body,
        },
        data: {
          type: 'missed_call',
          callerId: callerId ? String(callerId) : '',
          callerName,
          callerAvatar: caller?.avatar || '',
          withVideo: String(Boolean(withVideo)),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'missed_calls',
            tag: `missed_call_${callerId || 'unknown'}`,
          },
        },
      }),
      'FCM MISSED CALL'
    );

    console.log('FCM MISSED CALL SENT:', {
      to: userId,
      tokens: tokens.length,
      sent,
    });
  } catch (error) {
    console.error('FCM MISSED CALL ERROR:', error.message);
  }
}

function getPendingCallTimeoutKey(callerId, receiverId) {
  return `${callerId}:${receiverId}`;
}

function getPendingCallCreatedAtMs(pendingCall) {
  if (!pendingCall?.created_at) return null;

  const createdAt = pendingCall.created_at;

  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }

  return new Date(createdAt).getTime();
}

function clearPendingCallTimeout(callerId, receiverId) {
  const key = getPendingCallTimeoutKey(callerId, receiverId);
  const timeout = pendingCallTimeouts.get(key);

  if (timeout) {
    clearTimeout(timeout);
    pendingCallTimeouts.delete(key);
  }
}

async function getPendingCallForUser(userId) {
  const result = await pool.query(
    `
    SELECT *
    FROM pending_calls
    WHERE caller_id = $1 OR receiver_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
}

function callLogKey(userA, userB) {
  const first = Math.min(Number(userA), Number(userB));
  const second = Math.max(Number(userA), Number(userB));
  return `${first}:${second}`;
}

async function emitCallLogMessage({
  callerId,
  receiverId,
  actorId,
  status,
  durationSeconds = 0,
  withVideo = false,
}) {
  if (!callerId || !receiverId || !actorId || !status) return;

  const key = callLogKey(callerId, receiverId);
  const now = Date.now();
  const lastAt = recentCallLogEvents.get(key) || 0;

  if (now - lastAt < 2500) return;
  recentCallLogEvents.set(key, now);

  setTimeout(() => {
    if (recentCallLogEvents.get(key) === now) {
      recentCallLogEvents.delete(key);
    }
  }, 3000);

  try {
    const conversation = await findOrCreateConversation(callerId, receiverId);
    const text = [
      'CALL_EVENT',
      status,
      callerId,
      receiverId,
      Math.max(0, Number(durationSeconds) || 0),
      withVideo ? 'video' : 'audio',
    ].join('|');

    const message = await createMessage({
      conversationId: conversation.id,
      senderId: actorId,
      text,
    });

    const fullMessage = await getMessageById(message.id, actorId);
    const payload = {
      conversationId: conversation.id,
      message: fullMessage,
    };

    const conversationRoom = io.sockets.adapter.rooms.get(
      `conversation_${conversation.id}`
    );

    io.to(`conversation_${conversation.id}`).emit('newMessage', payload);

    [callerId, receiverId].forEach((userId) => {
      const userRoom = io.sockets.adapter.rooms.get(`user_${userId}`);
      if (!userRoom) return;

      userRoom.forEach((socketId) => {
        if (conversationRoom && conversationRoom.has(socketId)) return;
        io.to(socketId).emit('newMessage', payload);
      });
    });
  } catch (error) {
    console.error('CALL LOG MESSAGE ERROR:', error.message);
  }
}

function schedulePendingCallTimeout({ callerId, receiverId, createdAtMs }) {
  clearPendingCallTimeout(callerId, receiverId);

  const key = getPendingCallTimeoutKey(callerId, receiverId);
  const timeout = setTimeout(async () => {
    try {
      pendingCallTimeouts.delete(key);

      const pendingCall = await getPendingCall(receiverId, callerId);

      if (!pendingCall) return;

      const pendingCreatedAtMs = getPendingCallCreatedAtMs(pendingCall);

      if (pendingCreatedAtMs !== createdAtMs) {
        console.log('CALL AUTO TIMEOUT SKIPPED STALE TIMER:', {
          from: callerId,
          to: receiverId,
        });
        return;
      }

      await deletePendingCall(receiverId, callerId);
      clearPendingCallIceCandidates(callerId, receiverId);
      clearPendingCallSessionId(callerId, receiverId);
      await emitCallLogMessage({
        callerId,
        receiverId,
        actorId: callerId,
        status: 'missed',
      });

      io.to(`user_${callerId}`).emit('callEnded');
      await sendMissedCallPush(receiverId, callerId, pendingCall.with_video);

      console.log('CALL AUTO TIMEOUT:', {
        from: callerId,
        to: receiverId,
      });
    } catch (error) {
      console.error('CALL AUTO TIMEOUT ERROR:', error.message);
    }
  }, CALL_TIMEOUT_MS);

  pendingCallTimeouts.set(key, timeout);
}

app.post('/api/calls/reject', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const receiverId = decoded.id;
    const { callerId, callSessionId } = req.body;

    console.log('HTTP CALL REJECT:', {
      callerId,
      receiverId,
      callSessionId,
    });

    if (!callerId) {
      return res.status(400).json({ message: 'Caller id is required' });
    }

    const pendingSessionId = getPendingCallSessionId(callerId, receiverId);
    if (
      callSessionId &&
      pendingSessionId &&
      String(callSessionId) !== String(pendingSessionId)
    ) {
      console.log('HTTP CALL REJECT IGNORED STALE SESSION:', {
        callerId,
        receiverId,
        callSessionId,
        pendingSessionId,
      });
      return res.json({ message: 'Stale call ignored' });
    }

    io.to(`user_${callerId}`).emit('callRejected');

    try {
      await deletePendingCall(receiverId, callerId);
      clearPendingCallTimeout(callerId, receiverId);
      clearPendingCallIceCandidates(callerId, receiverId);
      clearPendingCallSessionId(callerId, receiverId);
      await emitCallLogMessage({
        callerId,
        receiverId,
        actorId: receiverId,
        status: 'rejected',
      });
    } catch (error) {
      console.error('Delete pending HTTP rejected call error:', error.message);
    }

    await sendCallCancelPush(callerId, receiverId);

    res.json({ message: 'Call rejected' });
  } catch (error) {
    res.status(500).json({
      message: 'Error rejecting call',
      error: error.message,
    });
  }
});

  io.on('connection', (socket) => {

    socket.on('getOnlineUsers', () => {
  socket.emit('onlineUsers', {
    users: getOnlineUserIds(),
  });
});

  socket.on('logoutUser', async (userId) => {
  const id = String(userId);

  onlineUsers.delete(id);
  foregroundSockets.delete(id);

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
  const roomName = `user_${id}`;

  if (socket.rooms.has(roomName)) {
    return;
  }

  socket.join(roomName);

  if (!onlineUsers.has(id)) {
    onlineUsers.set(id, new Set());
  }

  onlineUsers.get(id).add(socket.id);
  socket.userId = id;
  clearActiveCallDisconnectTimer(id);

  const activeCall = getActiveCallForUser(id);
  const otherActiveCallUserId = getOtherActiveCallUser(activeCall, id);

  if (otherActiveCallUserId) {
    io.to(`user_${otherActiveCallUserId}`).emit('callReconnected', {
      from: id,
      to: otherActiveCallUserId,
    });
  }

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

  socket.on('appState', ({ foreground } = {}) => {
    setSocketForeground(socket, foreground === true);
    console.log('APP STATE:', {
      userId: socket.userId,
      socketId: socket.id,
      foreground: foreground === true,
    });
  });

    socket.on('joinConversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation_${conversationId}`);
    });

    socket.on('leaveConversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} left conversation_${conversationId}`);
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

  socket.on('messageReaction', async ({ conversationId, messageId, reaction }) => {
    const userId = socket.userId;

    if (!userId || !conversationId || !messageId) {
      return;
    }

    const normalizedReaction =
      typeof reaction === 'string' && reaction.trim() ? reaction.trim() : null;

    try {
      const reactions = await setMessageReaction({
        messageId: Number(messageId),
        userId: Number(userId),
        reaction: normalizedReaction,
      });

      io.to(`conversation_${conversationId}`).emit('messageReactionUpdated', {
        conversationId: Number(conversationId),
        messageId: Number(messageId),
        userId: Number(userId),
        reaction: normalizedReaction,
        reactions,
      });
    } catch (error) {
      console.error('MESSAGE REACTION ERROR:', error.message);
    }
  });

socket.on('callUser', async ({ to, offer, from, withVideo, callSessionId }) => {
  console.log('CALL USER:', { from, to, withVideo });
  clearPendingCallIceCandidates(from, to);

  try {
    const [callerPendingCall, receiverPendingCall] = await Promise.all([
      getPendingCallForUser(from),
      getPendingCallForUser(to),
    ]);
    const blockingPendingCall = callerPendingCall || receiverPendingCall;
    const blockingActiveCall =
      getActiveCallForUser(from) || getActiveCallForUser(to);

    if (blockingPendingCall || blockingActiveCall) {
      console.log('CALL USER REJECTED, CALL ALREADY EXISTS:', {
        from,
        to,
        pendingCaller: blockingPendingCall?.caller_id,
        pendingReceiver: blockingPendingCall?.receiver_id,
        activeUsers: blockingActiveCall?.users,
      });

      io.to(`user_${from}`).emit('callRejected', {
        from: to,
        to: from,
        reason: 'busy',
      });

      return;
    }
  } catch (error) {
    console.error('Check pending call conflict error:', error.message);
  }

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

  const pendingCall = await savePendingCall({
    callerId: from,
    receiverId: to,
    offer,
    withVideo,
  });
  const callCreatedAtMs = getPendingCallCreatedAtMs(pendingCall) || Date.now();
  const normalizedCallSessionId =
    callSessionId || `${from}:${to}:${callCreatedAtMs}`;

  setPendingCallSessionId(from, to, normalizedCallSessionId);
  incomingPayload.callCreatedAtMs = callCreatedAtMs;
  incomingPayload.callSessionId = normalizedCallSessionId;

  schedulePendingCallTimeout({
    callerId: from,
    receiverId: to,
    createdAtMs: callCreatedAtMs,
  });

  io.to(`user_${to}`).emit('incomingCall', incomingPayload);
  io.to(socket.id).emit('callRegistered', {
    to,
    from,
    callCreatedAtMs,
    callSessionId: normalizedCallSessionId,
  });

  const targetRoom = io.sockets.adapter.rooms.get(`user_${to}`);
  const targetOnline = Boolean(targetRoom && targetRoom.size > 0);
  const targetForegroundSockets = getForegroundSocketIds(to);
  const targetForeground = targetForegroundSockets.length > 0;

  if (targetForeground) {
    console.log('SEND FCM CALL PUSH FALLBACK, USER FOREGROUND:', {
      to,
      sockets: targetForegroundSockets,
    });
  } else if (targetOnline) {
    console.log('SEND FCM CALL PUSH, USER ONLINE BUT BACKGROUND:', {
      to,
      sockets: Array.from(targetRoom),
    });
  }

  try {
    const tokens = await getFcmTokensByUserId(to);

    if (tokens.length > 0) {
      const sent = await sendFcmToTokens(
        tokens,
        (token) => ({
            token,
            data: {
              type: 'incoming_call',
              callerId: String(from),
              withVideo: String(withVideo),
              callCreatedAtMs: String(callCreatedAtMs),
              callTimeoutMs: String(CALL_TIMEOUT_MS),
              callSessionId: String(normalizedCallSessionId),
              callerName:
                caller?.display_name ||
                caller?.username ||
                `User ${from}`,
              callerAvatar: caller?.avatar || '',
            },
            android: {
              priority: 'high',
            },
          }),
        'FCM CALL PUSH'
      );

      console.log('FCM CALL PUSH SENT:', {
        to,
        tokens: tokens.length,
        sent,
      });
    } else {
      console.log('NO FCM TOKENS FOR USER:', to);
    }
  } catch (error) {
    console.error('FCM CALL PUSH ERROR:', error.message);
  }
});

socket.on('answerCall', async ({ to, from, answer, callSessionId }) => {
  const actorId = from || socket.userId;

  console.log('ANSWER CALL:', { from: actorId, to });

  if (actorId && to) {
    try {
      const pendingCall =
        (await getPendingCall(actorId, to)) ||
        (await getPendingCall(to, actorId));
      const pendingSessionId =
        getPendingCallSessionId(to, actorId) ||
        getPendingCallSessionId(actorId, to);

      if (
        callSessionId &&
        pendingSessionId &&
        String(callSessionId) !== String(pendingSessionId)
      ) {
        console.log('ANSWER CALL IGNORED STALE SESSION:', {
          from: actorId,
          to,
          callSessionId,
          pendingSessionId,
        });
        return;
      }

      setActiveCall(
        actorId,
        to,
        pendingCall?.with_video,
        pendingSessionId || callSessionId
      );
      await deletePendingCall(actorId, to);
      await deletePendingCall(to, actorId);
      clearPendingCallTimeout(to, actorId);
      clearPendingCallTimeout(actorId, to);
      clearPendingCallIceCandidates(to, actorId);
      clearPendingCallIceCandidates(actorId, to);
      clearPendingCallSessionId(to, actorId);
      clearPendingCallSessionId(actorId, to);
    } catch (error) {
      console.error('Delete pending answered call error:', error.message);
    }
  }

  io.to(`user_${to}`).emit('callAnswered', {
    answer,
    from: actorId,
    to,
    callSessionId,
  });
});

socket.on('rejectCall', async ({ to, from, callSessionId }) => {
  console.log('REJECT CALL:', { from, to });

  if (from && to && callSessionId) {
    const pendingSessionId =
      getPendingCallSessionId(to, from) || getPendingCallSessionId(from, to);

    if (pendingSessionId && String(callSessionId) !== String(pendingSessionId)) {
      console.log('REJECT CALL IGNORED STALE SESSION:', {
        from,
        to,
        callSessionId,
        pendingSessionId,
      });
      return;
    }
  }

  io.to(`user_${to}`).emit('callRejected');

  if (from) {
    socket.to(`user_${from}`).emit('callHandledOnOtherDevice');
  }

  if (from && to) {
    try {
      await deletePendingCall(from, to);
      clearPendingCallTimeout(to, from);
      clearPendingCallIceCandidates(to, from);
      clearPendingCallSessionId(to, from);
      await emitCallLogMessage({
        callerId: to,
        receiverId: from,
        actorId: from,
        status: 'rejected',
      });
    } catch (error) {
      console.error('Delete pending rejected call error:', error.message);
    }
  }

  if (to && from) {
    await sendCallCancelPush(to, from);
  }
});

socket.on('acceptCallOnDevice', ({ from }) => {
  if (from) {
    socket.to(`user_${from}`).emit('callHandledOnOtherDevice');
  }
});

socket.on('iceCandidate', ({ to, candidate }) => {
  const from = socket.userId;

  if (from && to && candidate) {
    const stored = storePendingCallIceCandidate(from, to, candidate);
    if (stored) {
      console.log('STORED PENDING ICE CANDIDATE:', { from, to });
    }
  }

  io.to(`user_${to}`).emit('iceCandidate', {
    candidate,
  });
});

socket.on('endCall', async ({
  to,
  from,
  durationSeconds,
  withVideo,
  callSessionId,
}) => {
  const actorId = from || socket.userId;

  console.log('END CALL:', { from: actorId, to, callSessionId });

  if (actorId && to) {
    let pendingOutgoingCall = null;
    let pendingCall = null;
    let callWithVideo = Boolean(withVideo);

    try {
      pendingOutgoingCall = await getPendingCall(to, actorId);
      const pendingIncomingCall = await getPendingCall(actorId, to);
      pendingCall = pendingOutgoingCall || pendingIncomingCall;
      const activeCall = getActiveCallForUser(actorId);
      const pendingSessionId = pendingOutgoingCall
        ? getPendingCallSessionId(actorId, to)
        : pendingIncomingCall
        ? getPendingCallSessionId(to, actorId)
        : null;
      const activeOtherUserId = getOtherActiveCallUser(activeCall, actorId);
      const activeSessionId =
        activeCall && String(activeOtherUserId) === String(to)
          ? activeCall.callSessionId
          : null;
      const expectedSessionId = activeSessionId || pendingSessionId;

      if (
        callSessionId &&
        expectedSessionId &&
        String(callSessionId) !== String(expectedSessionId)
      ) {
        console.log('END CALL IGNORED STALE SESSION:', {
          from: actorId,
          to,
          callSessionId,
          expectedSessionId,
        });
        return;
      }

      if (
        callSessionId &&
        !expectedSessionId &&
        !pendingCall &&
        !activeSessionId
      ) {
        console.log('END CALL IGNORED, NO MATCHING CALL:', {
          from: actorId,
          to,
          callSessionId,
        });
        return;
      }

      io.to(`user_${to}`).emit('callEnded', {
        from: actorId,
        to,
        callSessionId,
      });

      const callerId = pendingOutgoingCall
        ? actorId
        : pendingIncomingCall
        ? to
        : actorId;
      const receiverId = pendingOutgoingCall
        ? to
        : pendingIncomingCall
        ? actorId
        : to;
      const callWasAnswered = !pendingCall;

      await deletePendingCall(to, actorId);
      await deletePendingCall(actorId, to);
      clearPendingCallTimeout(actorId, to);
      clearPendingCallTimeout(to, actorId);
      clearPendingCallIceCandidates(actorId, to);
      clearPendingCallIceCandidates(to, actorId);
      clearPendingCallSessionId(actorId, to);
      clearPendingCallSessionId(to, actorId);
      clearActiveCall(actorId, to);

      callWithVideo =
        typeof withVideo === 'boolean'
          ? withVideo
          : Boolean(pendingCall?.with_video);

      await emitCallLogMessage({
        callerId,
        receiverId,
        actorId,
        status: callWasAnswered ? 'ended' : 'canceled',
        durationSeconds,
        withVideo: callWithVideo,
      });
    } catch (error) {
      console.error('Delete pending ended call error:', error.message);
    }

    await sendCallCancelPush(to, actorId, {
      showMissedNotification: Boolean(pendingOutgoingCall),
      withVideo: callWithVideo,
    });
  }
});

socket.on('disconnect', async () => {
  const userId = socket.userId;

  if (userId && onlineUsers.has(userId)) {
    onlineUsers.get(userId).delete(socket.id);
    setSocketForeground(socket, false);

    if (onlineUsers.get(userId).size === 0) {
      setTimeout(async () => {
        if (onlineUsers.has(userId) && onlineUsers.get(userId).size > 0) {
          return;
        }

        onlineUsers.delete(userId);
        scheduleActiveCallDisconnect(userId);

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

  ensureMessageReactionsTable()
    .catch((error) => {
      console.error('Ensure message reactions table error:', error.message);
    })
    .finally(() => {
      server.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);
      });
    });
