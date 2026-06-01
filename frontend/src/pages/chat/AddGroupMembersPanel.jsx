import { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import api from '../../api/api';
import { getFileUrl } from '../../api/fileUrl';

function AddGroupMembersPanel({
  groupInfo,
  onClose,
  onMembersAdded,
  compact = false,
}) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    async function loadFriends() {
      const res = await api.get('/follows');

      const existingMemberIds = groupInfo.members.map((member) =>
        Number(member.id)
      );

      const availableFriends = res.data.filter(
        (friend) => !existingMemberIds.includes(Number(friend.id))
      );

      setFriends(availableFriends);
    }

    loadFriends();
  }, [groupInfo.members]);

  const filteredFriends = friends.filter((user) => {
    const value = `${user.display_name || ''} ${user.username || ''}`.toLowerCase();
    return value.includes(search.toLowerCase());
  });

  const toggleUser = (user) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((item) => item.id === user.id);

      if (exists) {
        return prev.filter((item) => item.id !== user.id);
      }

      return [...prev, user];
    });
  };

  const removeSelectedUser = (userId) => {
    setSelectedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  const addMembers = async () => {
    if (selectedUsers.length === 0) return;

    await api.post(`/group-chats/${groupInfo.id}/members`, {
      memberIds: selectedUsers.map((user) => user.id),
    });

    await onMembersAdded?.();
    onClose();
  };

  return (
    <div className={`create-group-panel ${compact ? 'compact' : ''}`}>
      <div className="create-group-header">
        <button onClick={onClose}>
          <IoClose />
        </button>

        <h3>Add Members</h3>
      </div>

      <div className="selected-users-row">
        {selectedUsers.map((user) => (
          <button
            key={user.id}
            className="selected-user-chip"
            onClick={() => removeSelectedUser(user.id)}
          >
            {user.avatar ? (
              <img src={getFileUrl(user.avatar)} alt="" />
            ) : (
              <span className="selected-user-avatar-placeholder">
                {user.display_name?.[0] || '?'}
              </span>
            )}

            <strong>{user.display_name || user.username}</strong>
            <IoClose />
          </button>
        ))}
      </div>

      <input
        className="create-group-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Who would you like to add?"
      />

      <div className="create-group-footer">
        <button
          className="create-group-next-btn"
          disabled={selectedUsers.length === 0}
          onClick={addMembers}
        >
          Add
        </button>
      </div>

      <div className="create-group-users">
        {filteredFriends.length === 0 && (
          <p className="username" style={{ padding: '12px' }}>
            No friends to add
          </p>
        )}

        {filteredFriends.map((user) => {
          const checked = selectedUsers.some((item) => item.id === user.id);

          return (
            <button
              key={user.id}
              className="create-group-user-row"
              onClick={() => toggleUser(user)}
            >
              {user.avatar ? (
                <img src={getFileUrl(user.avatar)} alt="" />
              ) : (
                <div className="create-group-user-placeholder">
                  {user.display_name?.[0] || '?'}
                </div>
              )}

              <div className="create-group-user-info">
                <strong>{user.display_name || user.username}</strong>
                <span>@{user.username}</span>
              </div>

              <span className={`create-group-checkbox ${checked ? 'checked' : ''}`}>
                {checked ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AddGroupMembersPanel;