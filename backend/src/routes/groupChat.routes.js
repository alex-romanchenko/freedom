const uploadGroupAvatar = require('../middleware/uploadGroupAvatar');
const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const {
  createGroupChat,
  getGroupChatInfo,
  renameGroupChat,
  changeGroupAvatar,
  addMembersToGroup,
  removeMemberFromGroup,
  leaveGroupChat,
  deleteGroupChat
} = require('../controllers/groupChat.controller');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  uploadGroupAvatar.single('avatar'),
  createGroupChat
);
router.get('/:conversationId', authMiddleware, getGroupChatInfo);
router.patch('/:conversationId/name', authMiddleware, renameGroupChat);
router.delete('/:conversationId/leave', authMiddleware, leaveGroupChat);
router.delete('/:conversationId', authMiddleware, deleteGroupChat);
router.patch(
  '/:conversationId/avatar',
  authMiddleware,
  uploadGroupAvatar.single('avatar'),
  changeGroupAvatar
);

router.post(
  '/:conversationId/members',
  authMiddleware,
  addMembersToGroup
);

router.delete(
  '/:conversationId/members/:memberId',
  authMiddleware,
  removeMemberFromGroup
);



module.exports = router;