import { useEffect, useState } from 'react';
import { IoClose, IoCameraOutline } from 'react-icons/io5';
import api from '../../api/api';
import { getFileUrl } from '../../api/fileUrl';

function CreateGroupPanel({ onClose, onGroupCreated }) {
  const [step, setStep] = useState(1);
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);

  useEffect(() => {
    async function loadFriends() {
      const res = await api.get('/follows');
      setFriends(res.data);
    }

    loadFriends();
  }, []);

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

const createGroup = async () => {
  if (!groupName.trim() || selectedUsers.length === 0) return;

  const formData = new FormData();

  formData.append('name', groupName.trim());

  selectedUsers.forEach((user) => {
    formData.append('memberIds[]', user.id);
  });

  if (avatarFile) {
    formData.append('avatar', avatarFile);
  }

  await api.post('/group-chats', formData);

  onGroupCreated?.();
  onClose();
};

  return (
    <div className="create-group-panel">
      <div className="create-group-header">
        <button onClick={step === 1 ? onClose : () => setStep(1)}>
          <IoClose />
        </button>

        <h3>{step === 1 ? 'New Group' : 'Group details'}</h3>
      </div>

      {step === 1 ? (
        <>
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
                onClick={() => setStep(2)}
            >
                Next →
            </button>
            </div>

          <div className="create-group-users">
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
        </>
      ) : (
        <>
          <label className="create-group-avatar">
            {avatarFile ? (
              <img src={URL.createObjectURL(avatarFile)} alt="" />
            ) : (
              <IoCameraOutline />
            )}

            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
          </label>

          <input
            className="create-group-name-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
          />

          <div className="create-group-selected-list">
            <h4>{selectedUsers.length} members</h4>

            {selectedUsers.map((user) => (
              <div key={user.id} className="create-group-selected-row">
                {user.avatar ? (
                  <img src={getFileUrl(user.avatar)} alt="" />
                ) : (
                  <div>{user.display_name?.[0] || '?'}</div>
                )}

                <span>{user.display_name || user.username}</span>
              </div>
            ))}
          </div>
          <div className="create-group-footer">
            <button
              className="create-group-next-btn"
              disabled={!groupName.trim()}
              onClick={createGroup}
            >
              Create
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CreateGroupPanel;