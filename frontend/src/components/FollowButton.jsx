import { useState } from 'react';
import { followUserApi, unfollowUserApi } from '../api/followApi';
import { t } from '../utils/i18n';

function FollowButton({ userId, initialIsFollowing = false, language }) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const handleClick = async () => {
    try {
      if (isFollowing) {
        await unfollowUserApi(userId);
        setIsFollowing(false);
      } else {
        await followUserApi(userId);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button
      className={`follow-btn ${isFollowing ? 'following' : ''}`}
      onClick={handleClick}
    >
      {isFollowing ? t('following', language) : t('follow', language)}
    </button>
  );
}

export default FollowButton;
