import { useEffect, useState } from 'react';
import { getWhoToFollowApi } from '../api/usersApi';
import FollowButton from './FollowButton';

function WhoToFollow({ onOpenUser }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getWhoToFollowApi();
        setUsers(data);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, []);

  return (
    <div className="side-card">
      <h3>Who to follow</h3>

      {users.map((user) => (
        <div key={user.id} className="follow-user">
          <div
            className="follow-user-info"
            onClick={() => onOpenUser(user.username)}
          >
            {user.avatar ? (
              <img
                src={`http://localhost:5000${user.avatar}`}
                alt=""
              />
            ) : (
              <div className="follow-avatar-placeholder">
                {user.display_name?.[0] || '?'}
              </div>
            )}

            <span>{user.display_name}</span>
          </div>

          <FollowButton
            userId={user.id}
            initialIsFollowing={user.is_following}
            />
        </div>
      ))}
    </div>
  );
}

export default WhoToFollow;