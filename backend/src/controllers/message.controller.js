const {
  findOrCreateConversation,
  createMessage,
  getUserConversations,
  getMessagesByConversation,
  searchMessages,
  getMessageById,
  getForwardableMessageById,
  getGroupMemberIds,
  getGroupPushRecipientIds,
  markConversationAsRead,
  markMessagesAsRead,
  deleteConversationById,
  clearConversationById,
  updateMessageById,
  deleteMessageById,
  markMessageAsDelivered,
  getConversationById,
} = require('../models/message.model');
const { areUsersBlocked } = require('../models/safety.model');
const { getFcmTokensByUserId, getUserById } = require('../models/user.model');
const { messaging } = require('../utils/firebaseAdmin');
const pool = require('../db');
const crypto = require('crypto');
const fs = require('fs/promises');
const fsSync = require('fs');

function notificationText(message) {
  if (message.text) return message.text;
  if (message.image) return 'Photo';
  if (message.video) return 'Video';
  if (message.audio) return 'Audio';
  if (message.file) {
    return message.file_mime?.startsWith('audio/')
      ? 'Music'
      : message.file_name || 'File';
  }
  return 'New message';
}

function notificationMediaType(message) {
  if (message.image) return 'image';
  if (message.video) return 'video';
  if (message.audio) return 'voice';
  if (message.file) {
    return message.file_mime?.startsWith('audio/') ? 'music' : 'file';
  }
  return 'text';
}

function notificationMediaPath(message) {
  return message.image || message.video || message.audio || message.file || '';
}

function notificationPayloadForMessage(message, extra = {}) {
  return {
    messageId: message.id,
    senderId: message.sender_id,
    senderName: message.display_name || message.username || 'Freedom',
    senderAvatar: message.avatar || '',
    messageText: message.text || '',
    mediaType: notificationMediaType(message),
    mediaPath: notificationMediaPath(message),
    fileName: message.file_name || '',
    fileMime: message.file_mime || '',
    previewText: notificationText(message),
    ...extra,
  };
}

function messageUploadFromRequest(file) {
  const upload = {
    imagePath: null,
    videoPath: null,
    audioPath: null,
    filePath: null,
    fileName: null,
    fileMime: null,
    fileSize: 0,
  };

  if (!file) return upload;

  if (file.fieldname === 'file') {
    upload.filePath = `/uploads/message-files/${file.filename}`;
    upload.fileName = file.originalname;
    upload.fileMime = file.mimetype;
    upload.fileSize = file.size || 0;
    return upload;
  }

  if (file.mimetype.startsWith('audio/') && file.fieldname === 'audio') {
    upload.audioPath = `/uploads/message-audios/${file.filename}`;
    return upload;
  }

  if (file.mimetype.startsWith('image/')) {
    upload.imagePath = `/uploads/messages/${file.filename}`;
    return upload;
  }

  if (file.mimetype.startsWith('video/')) {
    upload.videoPath = `/uploads/message-videos/${file.filename}`;
    return upload;
  }

  return upload;
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function reuseExistingUploadedMedia(file, senderId) {
  const uploaded = messageUploadFromRequest(file);
  const mediaColumn = uploaded.videoPath
    ? 'video'
    : uploaded.imagePath
    ? 'image'
    : uploaded.audioPath
    ? 'audio'
    : uploaded.filePath
    ? 'file'
    : null;

  if (!mediaColumn || !file?.path) {
    return { ...uploaded, mediaSha256: null };
  }

  const mediaSha256 = await sha256File(file.path);
  const existing = await pool.query(
    `SELECT image, video, audio, file
     FROM messages
     WHERE sender_id = $1
       AND media_sha256 = $2
       AND ${mediaColumn} IS NOT NULL
     ORDER BY id ASC
     LIMIT 1`,
    [senderId, mediaSha256]
  );
  const existingPath = existing.rows[0]?.[mediaColumn];

  if (!existingPath) return { ...uploaded, mediaSha256 };

  // Multer has written the request body already; remove that duplicate and
  // attach the new message to the author's existing media asset instead.
  await fs.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });

  return {
    ...uploaded,
    imagePath: mediaColumn === 'image' ? existingPath : null,
    videoPath: mediaColumn === 'video' ? existingPath : null,
    audioPath: mediaColumn === 'audio' ? existingPath : null,
    filePath: mediaColumn === 'file' ? existingPath : null,
    mediaSha256,
  };
}

async function sendMessagePush({ userId, title, body, data = {} }) {
  try {
    const tokens = await getFcmTokensByUserId(userId);

    if (!tokens.length) return;

    // Resolve the sender directly from users, just like missed-call pushes do.
    // This keeps the current avatar for every message type, including media.
    const sender = data.senderId ? await getUserById(data.senderId) : null;
    const resolvedData = {
      ...data,
      senderName:
        sender?.display_name || sender?.username || data.senderName || title,
      senderAvatar: sender?.avatar || data.senderAvatar || '',
    };

    await Promise.all(
      tokens.map((token) =>
        messaging.send({
          token,
          data: {
            type: 'message',
            title,
            body,
            ...Object.fromEntries(
              Object.entries(resolvedData).map(([key, value]) => [
                key,
                String(value),
              ])
            ),
          },
          android: {
            priority: 'high',
            ttl: 3600 * 1000,
          },
        })
      )
    );
  } catch (error) {
    console.error('FCM MESSAGE PUSH ERROR:', error.message);
  }
}

function isUserInConversation(io, userId, conversationId) {
  const userRoom = io.sockets.adapter.rooms.get(`user_${userId}`);
  const conversationRoom = io.sockets.adapter.rooms.get(
    `conversation_${conversationId}`
  );

  if (!userRoom || !conversationRoom) return false;

  return Array.from(userRoom).some((socketId) =>
    conversationRoom.has(socketId)
  );
}

// A user can have several logged-in devices. A message in an open chat is
// delivered through the conversation room, while the user's other devices are
// only in `user_<id>`. Delivering to the latter keeps chat lists in sync
// without duplicating the event on devices already in the conversation room.
function emitMessageToUserDevices(io, userId, conversationRoom, payload) {
  const userRoom = io.sockets.adapter.rooms.get(`user_${userId}`);
  if (!userRoom) return;

  userRoom.forEach((socketId) => {
    if (!conversationRoom || !conversationRoom.has(socketId)) {
      io.to(socketId).emit('newMessage', payload);
    }
  });
}

async function sendMessage(req, res) {
  try {
    const senderId = req.user.id;
    const { userId } = req.params;
    const { text, clientMessageId } = req.body;
    const {
      imagePath,
      videoPath,
      audioPath,
      filePath,
      fileName,
      fileMime,
      fileSize,
      mediaSha256,
    } = await reuseExistingUploadedMedia(req.file, senderId);
    const audioDuration = Number(req.body.audioDuration || 0);

    if (Number(senderId) === Number(userId)) {
      return res.status(400).json({
        message: 'You cannot send message to yourself',
      });
    }

    if (!text && !imagePath && !videoPath && !audioPath && !filePath) {
      return res.status(400).json({
        message: 'Message text, image, video, audio or file is required',
      });
    }

    if (await areUsersBlocked(senderId, userId)) {
      return res.status(403).json({ message: 'Messaging is unavailable' });
    }

    const conversation = await findOrCreateConversation(senderId, userId);

const message = await createMessage({
  conversationId: conversation.id,
  senderId,
  text,
  image: imagePath,
  video: videoPath,
  audio: audioPath,
  audioDuration,
  file: filePath,
  fileName,
  fileMime,
  fileSize,
  mediaSha256,
});

    const fullMessage = await getMessageById(message.id, senderId);
    let finalMessage = clientMessageId
      ? { ...fullMessage, client_message_id: clientMessageId }
      : fullMessage;

const io = req.app.get('io');

const conversationRoom = io.sockets.adapter.rooms.get(
  `conversation_${conversation.id}`
);

const userRoom = io.sockets.adapter.rooms.get(`user_${userId}`);

if (userRoom) {
  const deliveredMessage = await markMessageAsDelivered(message.id);

  if (deliveredMessage) {
    finalMessage = {
      ...finalMessage,
      status: 'delivered',
    };
  }
}

const payload = {
  conversationId: conversation.id,
  message: finalMessage,
};

io.to(`conversation_${conversation.id}`).emit('newMessage', payload);

emitMessageToUserDevices(io, senderId, conversationRoom, payload);

if (userRoom) {
  emitMessageToUserDevices(io, userId, conversationRoom, payload);
}

if (!isUserInConversation(io, userId, conversation.id)) {
  await sendMessagePush({
    userId,
    title: fullMessage.display_name || fullMessage.username || 'Freedom',
    body: notificationText(fullMessage),
    data: {
      conversationId: conversation.id,
      ...notificationPayloadForMessage(fullMessage),
    },
  });
}

    res.status(201).json({
      message: 'Message sent successfully',
      conversation,
      data: finalMessage,
    });
  } catch (error) {
    console.error('Error sending message:', error);

    res.status(500).json({
      message: 'Error sending message',
      error: error.message,
    });
  }
}

async function sendGroupMessage(req, res) {
  try {
    const senderId = req.user.id;
    const { conversationId } = req.params;
    const { text, clientMessageId } = req.body;
    const {
      imagePath,
      videoPath,
      audioPath,
      filePath,
      fileName,
      fileMime,
      fileSize,
      mediaSha256,
    } = await reuseExistingUploadedMedia(req.file, senderId);
    const audioDuration = Number(req.body.audioDuration || 0);

    if (!text && !imagePath && !videoPath && !audioPath && !filePath) {
      return res.status(400).json({
        message: 'Message text, image, video, audio or file is required',
      });
    }

    const memberIds = await getGroupMemberIds(conversationId);
    const pushRecipientIds = await getGroupPushRecipientIds(conversationId);

    if (!memberIds.map(Number).includes(Number(senderId))) {
      return res.status(403).json({
        message: 'You are not a member of this group',
      });
    }

    const group = await getConversationById(conversationId);

    if (!group || !group.is_group) {
      return res.status(404).json({
        message: 'Group conversation not found',
      });
    }

    const message = await createMessage({
      conversationId,
      senderId,
      text,
      image: imagePath,
      video: videoPath,
      audio: audioPath,
      audioDuration,
      file: filePath,
      fileName,
      fileMime,
      fileSize,
      mediaSha256,
    });

    const fullMessage = await getMessageById(message.id, senderId);
    const finalMessage = clientMessageId
      ? { ...fullMessage, client_message_id: clientMessageId }
      : fullMessage;

    const io = req.app.get('io');

    const payload = {
      conversationId: Number(conversationId),

      group: {
        id: group.id,
        group_name: group.group_name,
        group_avatar: group.group_avatar,
      },

      message: finalMessage,
    };

    const conversationRoom = io.sockets.adapter.rooms.get(
      `conversation_${conversationId}`
    );

    io.to(`conversation_${conversationId}`).emit('newMessage', payload);

    memberIds.forEach((memberId) => {
      emitMessageToUserDevices(io, memberId, conversationRoom, payload);
    });

    await Promise.all(
      pushRecipientIds
        .filter((memberId) => Number(memberId) !== Number(senderId))
        .filter(
          (memberId) => !isUserInConversation(io, memberId, conversationId)
        )
        .map((memberId) =>
          sendMessagePush({
            userId: memberId,
            title: group.group_name || 'Group chat',
            body: notificationText(fullMessage),
            data: {
              conversationId,
              groupId: group.id,
              groupName: group.group_name || '',
              ...notificationPayloadForMessage(fullMessage),
            },
          })
        )
    );

    res.status(201).json({
      message: 'Group message sent successfully',
      data: fullMessage,
    });
  } catch (error) {
    console.error('Error sending group message:', error);

    res.status(500).json({
      message: 'Error sending group message',
      error: error.message,
    });
  }
}

async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    await markConversationAsRead(conversationId, userId);

    const updatedMessages = await markMessagesAsRead(conversationId, userId);

    const io = req.app.get('io');

    io.to(`conversation_${conversationId}`).emit('messagesRead', {
      conversationId: Number(conversationId),
      messageIds: updatedMessages.map((m) => m.id),
    });

    res.json({
      message: 'Marked as read',
      updatedMessages,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error marking as read',
      error: error.message,
    });
  }
}

async function getConversations(req, res) {
  try {
    const userId = req.user.id;

    const conversations = await getUserConversations(userId);

    res.json(conversations);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting conversations',
      error: error.message,
    });
  }
}

async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { before, after, limit } = req.query;

    const messages = await getMessagesByConversation(
      conversationId,
      before || null,
      Number(limit) || 30,
      req.user.id,
      after || null
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting messages',
      error: error.message,
    });
  }
}

function forwardedTextFromMessage(message) {
  const senderName = (
    message.display_name ||
    message.username ||
    'User'
  ).replace(/\|/g, ' ');

  return `FORWARDED|${senderName}|${message.text || ''}`;
}

async function forwardMessage(req, res) {
  try {
    const senderId = req.user.id;
    const { messageId, userId, conversationId, isGroup } = req.body;

    if (!messageId) {
      return res.status(400).json({ message: 'Message id is required' });
    }

    const originalMessage = await getForwardableMessageById(
      messageId,
      senderId
    );

    if (!originalMessage) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const targetIsGroup = isGroup === true || isGroup === 'true';
    const text = forwardedTextFromMessage(originalMessage);
    let targetConversation = null;
    let memberIds = [];
    let pushRecipientIds = [];

    if (targetIsGroup) {
      if (!conversationId) {
        return res
          .status(400)
          .json({ message: 'Conversation id is required' });
      }

      memberIds = await getGroupMemberIds(conversationId);
      pushRecipientIds = await getGroupPushRecipientIds(conversationId);

      if (!memberIds.map(Number).includes(Number(senderId))) {
        return res.status(403).json({
          message: 'You are not a member of this group',
        });
      }

      targetConversation = await getConversationById(conversationId);

      if (!targetConversation || !targetConversation.is_group) {
        return res.status(404).json({
          message: 'Group conversation not found',
        });
      }
    } else {
      if (!userId) {
        return res.status(400).json({ message: 'User id is required' });
      }

      if (Number(senderId) === Number(userId)) {
        return res.status(400).json({
          message: 'You cannot send message to yourself',
        });
      }

      if (await areUsersBlocked(senderId, userId)) {
        return res.status(403).json({ message: 'Messaging is unavailable' });
      }

      targetConversation = await findOrCreateConversation(senderId, userId);
    }

    const message = await createMessage({
      conversationId: targetConversation.id,
      senderId,
      text,
      image: originalMessage.image,
      video: originalMessage.video,
      audio: originalMessage.audio,
      audioDuration: originalMessage.audio_duration,
      file: originalMessage.file,
      fileName: originalMessage.file_name,
      fileMime: originalMessage.file_mime,
      fileSize: originalMessage.file_size,
    });

    const fullMessage = await getMessageById(message.id, senderId);
    const io = req.app.get('io');
    const conversationRoom = io.sockets.adapter.rooms.get(
      `conversation_${targetConversation.id}`
    );

    if (targetIsGroup) {
      const payload = {
        conversationId: Number(targetConversation.id),
        group: {
          id: targetConversation.id,
          group_name: targetConversation.group_name,
          group_avatar: targetConversation.group_avatar,
        },
        message: fullMessage,
      };

      io.to(`conversation_${targetConversation.id}`).emit('newMessage', payload);

      memberIds.forEach((memberId) => {
        emitMessageToUserDevices(io, memberId, conversationRoom, payload);
      });

      await Promise.all(
        pushRecipientIds
          .filter((memberId) => Number(memberId) !== Number(senderId))
          .filter(
            (memberId) =>
              !isUserInConversation(io, memberId, targetConversation.id)
          )
          .map((memberId) =>
            sendMessagePush({
              userId: memberId,
              title: targetConversation.group_name || 'Group chat',
              body: notificationText(fullMessage),
              data: {
                conversationId: targetConversation.id,
                groupId: targetConversation.id,
                groupName: targetConversation.group_name || '',
                ...notificationPayloadForMessage(fullMessage),
              },
            })
          )
      );
    } else {
      let finalMessage = fullMessage;
      const userRoom = io.sockets.adapter.rooms.get(`user_${userId}`);

      if (userRoom) {
        const deliveredMessage = await markMessageAsDelivered(message.id);

        if (deliveredMessage) {
          finalMessage = {
            ...fullMessage,
            status: 'delivered',
          };
        }
      }

      const payload = {
        conversationId: targetConversation.id,
        message: finalMessage,
      };

      io.to(`conversation_${targetConversation.id}`).emit('newMessage', payload);

      emitMessageToUserDevices(io, senderId, conversationRoom, payload);

      if (userRoom) {
        emitMessageToUserDevices(io, userId, conversationRoom, payload);
      }

      if (!isUserInConversation(io, userId, targetConversation.id)) {
        await sendMessagePush({
          userId,
          title: fullMessage.display_name || fullMessage.username || 'Freedom',
          body: notificationText(fullMessage),
          data: {
            conversationId: targetConversation.id,
            ...notificationPayloadForMessage(fullMessage),
          },
        });
      }
    }

    res.status(201).json({
      message: 'Message forwarded successfully',
      data: fullMessage,
    });
  } catch (error) {
    console.error('Error forwarding message:', error);
    res.status(500).json({
      message: 'Error forwarding message',
      error: error.message,
    });
  }
}

async function searchUserMessages(req, res) {
  try {
    const userId = req.user.id;
    const query = `${req.query.q || ''}`.trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    if (query.length < 2) {
      return res.json([]);
    }

    const results = await searchMessages(userId, query, limit, offset);
    res.json(results);
  } catch (error) {
    res.status(500).json({
      message: 'Error searching messages',
      error: error.message,
    });
  }
}

async function createConversation(req, res) {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    const conversation = await findOrCreateConversation(currentUserId, userId);

    res.status(201).json({
      message: 'Conversation created',
      conversation,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating conversation',
      error: error.message,
    });
  }
}
async function updateMessage(req, res) {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await updateMessageById(messageId, userId, text);

    res.json(message);
  } catch (error) {
    res.status(500).json({
      message: 'Error updating message',
      error: error.message,
    });
  }
}

async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;

    const deletedMessage = await deleteMessageById(messageId);

    if (deletedMessage) {
      const io = req.app.get('io');
      io.to(`conversation_${deletedMessage.conversation_id}`).emit(
        'messageDeleted',
        {
          conversationId: deletedMessage.conversation_id,
          messageId: deletedMessage.id,
        }
      );
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting message',
      error: error.message,
    });
  }
}
async function deleteConversation(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    await deleteConversationById(conversationId, userId);

    const io = req.app.get('io');
    io.to(`conversation_${conversationId}`).emit('conversationDeleted', {
      conversationId: Number(conversationId),
      userId,
    });
    io.to(`user_${userId}`).emit('conversationDeleted', {
      conversationId: Number(conversationId),
      userId,
    });

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting conversation',
      error: error.message,
    });
  }
}

async function clearConversation(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const clearedMessages = await clearConversationById(conversationId, userId);

    const io = req.app.get('io');
    io.to(`conversation_${conversationId}`).emit('conversationCleared', {
      conversationId: Number(conversationId),
      userId,
    });
    io.to(`user_${userId}`).emit('conversationCleared', {
      conversationId: Number(conversationId),
      userId,
    });

    res.json({
      message: 'Conversation cleared',
      deletedCount: clearedMessages.length,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error clearing conversation',
      error: error.message,
    });
  }
}


module.exports = {
  sendMessage,
  getConversations,
  getMessages,
  searchUserMessages,
  markAsRead,
  createConversation,
  deleteConversation,
  clearConversation,
  updateMessage,
  deleteMessage,
  markMessagesAsRead,
  sendGroupMessage,
  forwardMessage,
};
