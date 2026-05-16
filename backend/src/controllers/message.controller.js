const {
  findOrCreateConversation,
  createMessage,
  getUserConversations,
  getMessagesByConversation,
  getMessageById,
  markConversationAsRead,
  deleteConversationById,
  updateMessageById,
  deleteMessageById,
} = require('../models/message.model');

async function sendMessage(req, res) {
  try {
    const senderId = req.user.id;
    const { userId } = req.params;
    const { text } = req.body;

    let imagePath = null;

    if (req.file) {
      imagePath = `/uploads/messages/${req.file.filename}`;
    }

    if (Number(senderId) === Number(userId)) {
      return res.status(400).json({
        message: 'You cannot send message to yourself',
      });
    }

    if (!text && !imagePath) {
      return res.status(400).json({
        message: 'Message text or image is required',
      });
    }

    const conversation = await findOrCreateConversation(senderId, userId);

    const message = await createMessage({
      conversationId: conversation.id,
      senderId,
      text,
      image: imagePath,
    });

    const fullMessage = await getMessageById(message.id);

    const io = req.app.get('io');

const payload = {
  conversationId: conversation.id,
  message: fullMessage,
};

io.to(`conversation_${conversation.id}`).emit('newMessage', payload);

io.to(`user_${userId}`).emit('newMessage', payload);

    res.status(201).json({
      message: 'Message sent successfully',
      conversation,
      data: fullMessage,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error sending message',
      error: error.message,
    });
  }
}

async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    await markConversationAsRead(conversationId, userId);

    res.json({ message: 'Marked as read' });
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
      Number(limit) || 30
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

    await deleteMessageById(messageId);

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
};