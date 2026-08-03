const {
  createGroupConversation,
  getGroupInfo,
  updateGroupName,
  updateGroupAvatar,
  addGroupMembers,
  setGroupNotificationsMuted,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  
} = require('../models/groupChat.model');
const Notification = require('../models/notification.model');
const {
  createMessage,
  getMessageById,
  getConversationById,
  getGroupMemberIds,
} = require('../models/message.model');

function groupMemberAddedText(member) {
  return [
    'GROUP_MEMBER_ADDED',
    member.id,
    encodeURIComponent(member.username || ''),
    encodeURIComponent(member.display_name || ''),
  ].join('|');
}

async function createGroupChat(req, res) {
  try {
    const adminId = req.user.id;

    let { name, memberIds } = req.body;

    memberIds = memberIds || req.body['memberIds[]'];

    if (!Array.isArray(memberIds)) {
      memberIds = memberIds ? [memberIds] : [];
    }

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (memberIds.length === 0) {
      return res.status(400).json({ message: 'Members are required' });
    }

    const avatarPath = req.file
      ? `/uploads/group-avatars/${req.file.filename}`
      : null;

    const group = await createGroupConversation({
      name: name.trim(),
      avatar: avatarPath,
      adminId,
      memberIds,
    });

    await Promise.all(
  memberIds.map((memberId) =>
    Notification.createNotification({
      userId: memberId,
      senderId: adminId,
      type: 'group_added',
      entityId: group.id,
      entityType: 'conversation',
      text: 'added you to a group chat',
    })
  )
);

  const io = req.app.get('io');

  memberIds.forEach((memberId) => {
    io.to(`user_${memberId}`).emit('groupAdded', {
      conversationId: group.id,
      group,
    });
  });

    res.status(201).json({
      message: 'Group chat created',
      group,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating group chat',
      error: error.message,
    });
  }
}

async function getGroupChatInfo(req, res) {
  try {
    const currentUserId = req.user.id;
    const { conversationId } = req.params;

    const group = await getGroupInfo(conversationId, currentUserId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    res.status(500).json({
      message: 'Error getting group info',
      error: error.message,
    });
  }
}

async function updateGroupNotifications(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { muted } = req.body;

    if (typeof muted !== 'boolean') {
      return res.status(400).json({ message: 'Muted must be a boolean' });
    }

    const membership = await setGroupNotificationsMuted(
      conversationId,
      userId,
      muted
    );

    if (!membership) {
      return res.status(404).json({ message: 'Group membership not found' });
    }

    res.json({ notifications_muted: membership.notifications_muted });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating group notifications',
      error: error.message,
    });
  }
}

async function renameGroupChat(req, res) {
  try {
    const adminId = req.user.id;
    const { conversationId } = req.params;
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await updateGroupName(conversationId, adminId, name.trim());

    if (!group) {
      return res.status(403).json({
        message: 'Only group admin can rename this group',
      });
    }

    res.json({ message: 'Group renamed', group });
  } catch (error) {
    res.status(500).json({
      message: 'Error renaming group',
      error: error.message,
    });
  }
}

async function changeGroupAvatar(req, res) {
  try {
    const adminId = req.user.id;
    const { conversationId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'Avatar image is required' });
    }

    const avatarPath = `/uploads/group-avatars/${req.file.filename}`;

    const group = await updateGroupAvatar(conversationId, adminId, avatarPath);

    if (!group) {
      return res.status(403).json({
        message: 'Only group admin can change avatar',
      });
    }

    res.json({ message: 'Group avatar updated', group });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating group avatar',
      error: error.message,
    });
  }
}

async function addMembersToGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { conversationId } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: 'Members are required' });
    }

    const result = await addGroupMembers(conversationId, adminId, memberIds);

    if (!result) {
      return res.status(403).json({
        message: 'Only group admin can add members',
      });
    }
    await Promise.all(
      result.map((member) =>
        Notification.createNotification({
          userId: member.id,
          senderId: adminId,
          type: 'group_added',
          entityId: conversationId,
          entityType: 'conversation',
          text: 'added you to a group chat',
        })
      )
    );

    const io = req.app.get('io');

    result.forEach((member) => {
      io.to(`user_${member.id}`).emit('groupAdded', { conversationId });
    });

    const group = await getConversationById(conversationId);
    const currentMemberIds = await getGroupMemberIds(conversationId);

    for (const member of result) {
      const message = await createMessage({
        conversationId,
        senderId: adminId,
        text: groupMemberAddedText(member),
        image: null,
        video: null,
        audio: null,
        audioDuration: 0,
        file: null,
        fileName: null,
        fileMime: null,
        fileSize: 0,
      });
      const fullMessage = await getMessageById(message.id, adminId);
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
      currentMemberIds.forEach((memberId) => {
        const userRoom = io.sockets.adapter.rooms.get(`user_${memberId}`);
        if (!userRoom) return;
        userRoom.forEach((socketId) => {
          if (!conversationRoom || !conversationRoom.has(socketId)) {
            io.to(socketId).emit('newMessage', payload);
          }
        });
      });
    }

    res.json({ message: 'Members added', members: result });
  } catch (error) {
    res.status(500).json({
      message: 'Error adding members',
      error: error.message,
    });
  }
}

async function removeMemberFromGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { conversationId, memberId } = req.params;

    const result = await removeGroupMember(conversationId, adminId, memberId);

    if (result === null) {
      return res.status(403).json({
        message: 'Only group admin can remove members',
      });
    }

    if (result === false) {
      return res.status(400).json({
        message: 'Admin cannot remove himself',
      });
    }

    await Notification.createNotification({
  userId: memberId,
  senderId: adminId,
  type: 'group_removed',
  entityId: conversationId,
  entityType: 'conversation',
  text: 'removed you from a group chat',
});

const io = req.app.get('io');

io.to(`user_${memberId}`).emit('groupRemoved', {
  conversationId,
});

    res.json({ message: 'Member removed', member: result });
  } catch (error) {
    res.status(500).json({
      message: 'Error removing member',
      error: error.message,
    });
  }
}

async function leaveGroupChat(req, res) {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const result = await leaveGroup(conversationId, userId);

    if (!result) {
      return res.status(400).json({
        message: 'Admin cannot leave group. Delete group instead.',
      });
    }

    res.json({ message: 'Left group' });
  } catch (error) {
    res.status(500).json({
      message: 'Error leaving group',
      error: error.message,
    });
  }
}

async function deleteGroupChat(req, res) {
  try {
    const adminId = req.user.id;
    const { conversationId } = req.params;

    const result = await deleteGroup(conversationId, adminId);

    if (!result) {
      return res.status(403).json({
        message: 'Only group admin can delete group',
      });
    }

    res.json({ message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({
      message: 'Error deleting group',
      error: error.message,
    });
  }
}

module.exports = {
  createGroupChat,
  getGroupChatInfo,
  renameGroupChat,
  changeGroupAvatar,
  addMembersToGroup,
  updateGroupNotifications,
  removeMemberFromGroup,
  leaveGroupChat,
  deleteGroupChat,
};
