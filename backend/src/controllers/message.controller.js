const {
  findOrCreateConversation,
  createMessage,
  getUserConversations,
  getMessagesByConversation,
  getMessageById,
  getGroupMemberIds,
  markConversationAsRead,
  markMessagesAsRead,
  deleteConversationById,
  updateMessageById,
  deleteMessageById,
  markMessageAsDelivered,
  getConversationById,
} = require('../models/message.model');
const { getFcmTokensByUserId } = require('../models/user.model');
const { messaging } = require('../utils/firebaseAdmin');

function notificationText(message) {
  if (message.text) return message.text;
  if (message.image) return 'Photo';
  if (message.video) return 'Video';
  if (message.audio) return 'Audio';
  return 'New message';
}

async function sendMessagePush({ userId, title, body, data = {} }) {
  try {
    const tokens = await getFcmTokensByUserId(userId);

    if (!tokens.length) return;

    await Promise.all(
      tokens.map((token) =>
        messaging.send({
          token,
          notification: {
            title,
            body,
          },
          data: {
            type: 'message',
            ...Object.fromEntries(
              Object.entries(data).map(([key, value]) => [key, String(value)])
            ),
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

async function sendMessage(req, res) {
  try {
    const senderId = req.user.id;
    const { userId } = req.params;
    const { text } = req.body;

let imagePath = null;
let videoPath = null;
let audioPath = null;
let audioDuration = Number(req.body.audioDuration || 0);

if (req.file) {
  if (req.file.mimetype.startsWith('audio/')) {
  audioPath = `/uploads/message-audios/${req.file.filename}`;
}
  if (req.file.mimetype.startsWith('image/')) {
    imagePath = `/uploads/messages/${req.file.filename}`;
  }

  if (req.file.mimetype.startsWith('video/')) {
    videoPath = `/uploads/message-videos/${req.file.filename}`;
  }
}

    if (Number(senderId) === Number(userId)) {
      return res.status(400).json({
        message: 'You cannot send message to yourself',
      });
    }

    if (!text && !imagePath && !videoPath && !audioPath) {
      return res.status(400).json({
        message: 'Message text, image, video or audio is required',
      });
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
});

    const fullMessage = await getMessageById(message.id, senderId);
let finalMessage = fullMessage;

const io = req.app.get('io');

const conversationRoom = io.sockets.adapter.rooms.get(
  `conversation_${conversation.id}`
);

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
  conversationId: conversation.id,
  message: finalMessage,
};

io.to(`conversation_${conversation.id}`).emit('newMessage', payload);

if (userRoom) {
  userRoom.forEach((socketId) => {
    if (!conversationRoom || !conversationRoom.has(socketId)) {
      io.to(socketId).emit('newMessage', payload);
    }
  });
}

if (!isUserInConversation(io, userId, conversation.id)) {
  await sendMessagePush({
    userId,
    title: fullMessage.display_name || fullMessage.username || 'Freedom',
    body: notificationText(fullMessage),
    data: {
      conversationId: conversation.id,
      senderId,
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
    const { text } = req.body;

    let imagePath = null;
    let videoPath = null;
    let audioPath = null;
    let audioDuration = Number(req.body.audioDuration || 0);

    if (req.file) {

      if (req.file.mimetype.startsWith('audio/')) {
  audioPath = `/uploads/message-audios/${req.file.filename}`;
}
      if (req.file.mimetype.startsWith('image/')) {
        imagePath = `/uploads/messages/${req.file.filename}`;
      }

      if (req.file.mimetype.startsWith('video/')) {
        videoPath = `/uploads/message-videos/${req.file.filename}`;
      }
    }

    if (!text && !imagePath && !videoPath && !audioPath) {
      return res.status(400).json({
        message: 'Message text, image, video or audio is required',
      });
    }

    const memberIds = await getGroupMemberIds(conversationId);

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
    });

    const fullMessage = await getMessageById(message.id, senderId);

    const io = req.app.get('io');

    const payload = {
      conversationId: Number(conversationId),

      group: {
        id: group.id,
        group_name: group.group_name,
        group_avatar: group.group_avatar,
      },

      message: fullMessage,
    };

    const conversationRoom = io.sockets.adapter.rooms.get(
      `conversation_${conversationId}`
    );

    io.to(`conversation_${conversationId}`).emit('newMessage', payload);

    memberIds.forEach((memberId) => {
      if (Number(memberId) === Number(senderId)) return;

      const userRoom = io.sockets.adapter.rooms.get(`user_${memberId}`);

      if (!userRoom) return;

      userRoom.forEach((socketId) => {
        if (!conversationRoom || !conversationRoom.has(socketId)) {
          io.to(socketId).emit('newMessage', payload);
        }
      });
    });

    await Promise.all(
      memberIds
        .filter((memberId) => Number(memberId) !== Number(senderId))
        .filter(
          (memberId) => !isUserInConversation(io, memberId, conversationId)
        )
        .map((memberId) =>
          sendMessagePush({
            userId: memberId,
            title: group.group_name || 'Group chat',
            body: `${fullMessage.display_name || fullMessage.username || 'User'}: ${notificationText(fullMessage)}`,
            data: {
              conversationId,
              senderId,
              groupId: group.id,
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
    const { before, limit } = req.query;

    const messages = await getMessagesByConversation(
      conversationId,
      before || null,
      Number(limit) || 30,
      req.user.id
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting messages',
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

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting conversation',
      error: error.message,
    });
  }
}


module.exports = {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  createConversation,
  deleteConversation,
  updateMessage,
  deleteMessage,
  markMessagesAsRead,
  sendGroupMessage,
};
