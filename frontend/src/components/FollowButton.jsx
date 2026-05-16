import { useState } from 'react';
import { followUserApi, unfollowUserApi } from '../api/followApi';

function FollowButton({ userId, initialIsFollowing = false }) {
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
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

export default FollowButton;