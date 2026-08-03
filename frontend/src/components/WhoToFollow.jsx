import { useEffect, useState } from 'react';
import { getWhoToFollowApi } from '../api/usersApi';
import FollowButton from './FollowButton';
import { getFileUrl } from '../api/fileUrl';
import { t } from '../utils/i18n';
import { getIdentityColors } from '../utils/identityColors';

function WhoToFollow({ onOpenUser, language }) {
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
      <h3>{t('who_to_follow', language)}</h3>

      {users.map((user) => {
        const colors = getIdentityColors(user.id || user.username);

        return (
        <div key={user.id} className="follow-user">
          <div
            className="follow-user-info"
            onClick={() => onOpenUser(user.username)}
          >
            {user.avatar ? (
              <img
                src={getFileUrl(user.avatar)}
                alt=""
              />
            ) : (
              <div
                className="follow-avatar-placeholder"
                style={{
                  backgroundColor: colors.background,
                  color: colors.foreground,
                }}
              >
                {user.display_name?.[0] || '?'}
              </div>
            )}

            <span>{user.display_name}</span>
          </div>

          <FollowButton
            userId={user.id}
            initialIsFollowing={user.is_following}
            language={language}
          />
        </div>
        );
      })}
    </div>
  );
}

export default WhoToFollow;
