import { useEffect, useState } from 'react';
import api from '../../api/api';
import {
  IoClose,
  IoCameraOutline,
  IoNotificationsOutline,
  IoNotificationsOffOutline,
} from 'react-icons/io5';
import { getFileUrl } from '../../api/fileUrl';
import AddGroupMembersPanel from './AddGroupMembersPanel';
import { getIdentityColors } from '../../utils/identityColors';
import { t } from '../../utils/i18n';

function GroupInfoPanel({
  groupInfo,
  currentUser,
  onlineUsers,
  onClose,
  onOpenUser,
  onGroupDeletedOrLeft,
  language,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [localMembers, setLocalMembers] = useState(groupInfo?.members || []);
  const [editName, setEditName] = useState(groupInfo?.group_name || '');
  const [localGroupName, setLocalGroupName] = useState(
    groupInfo?.group_name || ''
  );
  const [localGroupAvatar, setLocalGroupAvatar] = useState(
    groupInfo?.group_avatar || null
  );
  const [notificationsMuted, setNotificationsMuted] = useState(
    Boolean(groupInfo?.notifications_muted)
  );
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);

  useEffect(() => {
    setNotificationsMuted(Boolean(groupInfo?.notifications_muted));
  }, [groupInfo?.id, groupInfo?.notifications_muted]);

  if (!groupInfo) return null;

  const isAdmin = Number(groupInfo.admin_id) === Number(currentUser?.id);

  const sortedMembers = [...localMembers].sort((a, b) => {
    const aOnline = onlineUsers.includes(String(a.id));
    const bOnline = onlineUsers.includes(String(b.id));

    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    return (a.display_name || '').localeCompare(b.display_name || '');
  });

  const reloadGroupInfo = async () => {
    const res = await api.get(`/group-chats/${groupInfo.id}`);

    setLocalMembers(res.data.members || []);
    setLocalGroupName(res.data.group_name || '');
    setEditName(res.data.group_name || '');
    setLocalGroupAvatar(res.data.group_avatar || null);
  };

  const removeMember = async (memberId) => {
    await api.delete(`/group-chats/${groupInfo.id}/members/${memberId}`);

    setLocalMembers((prev) =>
      prev.filter((member) => Number(member.id) !== Number(memberId))
    );
  };

  const toggleNotifications = async () => {
    if (isUpdatingNotifications) return;
    const nextMuted = !notificationsMuted;
    setIsUpdatingNotifications(true);
    setNotificationsMuted(nextMuted);

    try {
      const response = await api.patch(
        `/group-chats/${groupInfo.id}/notifications`,
        { muted: nextMuted }
      );
      setNotificationsMuted(Boolean(response.data.notifications_muted));
    } catch (_) {
      setNotificationsMuted(!nextMuted);
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const groupColors = getIdentityColors(groupInfo.id || localGroupName);

  return (
    <aside className="group-info-panel">
      <div className="group-info-header">
        <button onClick={onClose}>
          <IoClose />
        </button>

        <h3>Group Info</h3>

        {isAdmin && (
          <button
            className="group-edit-btn"
            onClick={() => {
              setIsEditing((prev) => !prev);
              setIsAddingMembers(false);
            }}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <div className="group-info-main">
        <label className="group-info-avatar-edit">
          {localGroupAvatar ? (
            <img
              className="group-info-avatar"
              src={getFileUrl(localGroupAvatar)}
              alt=""
            />
          ) : (
            <div
              className="group-info-avatar-placeholder"
              style={{ backgroundColor: groupColors.background }}
            >
              {localGroupName?.[0] || '?'}
            </div>
          )}

          {isAdmin && isEditing && (
            <div className="group-avatar-edit-overlay">
              <IoCameraOutline />
            </div>
          )}

          {isAdmin && isEditing && (
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('avatar', file);

                const res = await api.patch(
                  `/group-chats/${groupInfo.id}/avatar`,
                  formData
                );

                setLocalGroupAvatar(res.data.group.group_avatar);
              }}
            />
          )}
        </label>

        {isEditing ? (
          <div className="group-edit-name-box">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
            />

            <button
              onClick={async () => {
                const res = await api.patch(
                  `/group-chats/${groupInfo.id}/name`,
                  {
                    name: editName,
                  }
                );

                setLocalGroupName(res.data.group.group_name);
                setEditName(res.data.group.group_name);
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <h2>{localGroupName}</h2>
        )}

        <p>{localMembers.length} members</p>
      </div>

      <button
        type="button"
        className="group-notifications-toggle"
        onClick={toggleNotifications}
        disabled={isUpdatingNotifications}
        aria-pressed={notificationsMuted}
      >
        <span className="group-notifications-icon">
          {notificationsMuted ? (
            <IoNotificationsOffOutline />
          ) : (
            <IoNotificationsOutline />
          )}
        </span>
        <span className="group-notifications-copy">
          <strong>{t('group_notifications', language)}</strong>
          <small>
            {t(
              notificationsMuted
                ? 'group_notifications_muted'
                : 'group_notifications_enabled',
              language
            )}
          </small>
        </span>
        <span className={`group-notifications-switch ${notificationsMuted ? 'muted' : ''}`}>
          <span />
        </span>
      </button>

      <div className="group-members-block">
        <div className="group-members-title-row">
          <h4>{isAddingMembers ? 'Add Members' : 'Members'}</h4>

          {isAdmin && isEditing && (
            <button
              className="group-add-member-btn"
              onClick={() => setIsAddingMembers((prev) => !prev)}
            >
              {isAddingMembers ? '×' : '+'}
            </button>
          )}
        </div>

        {isAddingMembers ? (
          <AddGroupMembersPanel
            groupInfo={{
              ...groupInfo,
              members: localMembers,
            }}
            compact
            onClose={() => setIsAddingMembers(false)}
            onMembersAdded={async () => {
              await reloadGroupInfo();
              setIsAddingMembers(false);
            }}
          />
        ) : (
          <>
            {sortedMembers.map((member) => {
              const isOnline = onlineUsers.includes(String(member.id));
              const isGroupAdmin =
                Number(member.id) === Number(groupInfo.admin_id);
              const memberColors = getIdentityColors(
                member.id || member.username || member.display_name
              );

              return (
                <div key={member.id} className="group-member-row-wrap">
                  <button
                    className="group-member-row"
                    onClick={() => onOpenUser(member.username)}
                  >
                    {member.avatar ? (
                      <img src={getFileUrl(member.avatar)} alt="" />
                    ) : (
                      <div
                        className="group-member-placeholder"
                        style={{ backgroundColor: memberColors.background }}
                      >
                        {member.display_name?.[0] || '?'}
                      </div>
                    )}

                    <div className="group-member-info">
                      <strong style={{ color: memberColors.background }}>
                        {member.display_name}
                      </strong>

                      <span className={isOnline ? 'online' : ''}>
                        {isOnline ? 'online' : 'offline'}
                      </span>
                    </div>

                    {isGroupAdmin && (
                      <span className="group-admin-badge">admin</span>
                    )}
                  </button>

                  {isAdmin && isEditing && !isGroupAdmin && (
                    <button
                      className="group-remove-member-btn"
                      onClick={() => removeMember(member.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <button
            className="leave-group-btn"
            onClick={() => setConfirmAction(isAdmin ? 'delete' : 'leave')}
            >
            {isAdmin ? 'Delete group' : 'Leave group'}
            </button>
        {confirmAction && (
  <div className="modal-overlay">
    <div className="delete-chat-popup">
      <h3>Are you sure?</h3>

      <p>
        {confirmAction === 'delete'
          ? 'This group will be deleted for all members.'
          : 'You will leave this group.'}
      </p>

      <div className="modal-actions">
        <button
          className="secondary-btn"
          onClick={() => setConfirmAction(null)}
        >
          Cancel
        </button>

        <button
          className="primary-btn"
          onClick={async () => {
            if (confirmAction === 'delete') {
              await api.delete(`/group-chats/${groupInfo.id}`);
            } else {
              await api.delete(`/group-chats/${groupInfo.id}/leave`);
            }

            await onGroupDeletedOrLeft?.(groupInfo.id);
          }}
        >
          {confirmAction === 'delete' ? 'Delete' : 'Leave'}
        </button>
      </div>
    </div>
  </div>
)}
    </aside>
  );
}

export default GroupInfoPanel;
