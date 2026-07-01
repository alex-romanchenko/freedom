import { useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { searchUsersApi } from '../api/usersApi';
import { getFileUrl } from '../api/fileUrl';
import { t } from '../utils/i18n';

function UserSearch({ onOpenUser, language }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [searched, setSearched] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      setUsers([]);
      setSearched(false);
      setIsOpen(false);
      return;
    }

    try {
      const data = await searchUsersApi(query.trim());
      setUsers(data);
      setSearched(true);
      setIsOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setUsers([]);
    setSearched(false);
    setIsOpen(false);
  };

  return (
    <div className="twitter-search">
      <div className="twitter-search-box">
        <FiSearch className="twitter-search-icon" />

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);

            if (!e.target.value.trim()) {
              setUsers([]);
              setSearched(false);
              setIsOpen(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (searched) setIsOpen(true);
          }}
          placeholder={t('search', language)}
        />

        {query && (
          <button
            className="twitter-search-clear"
            type="button"
            onClick={clearSearch}
          >
            <FiX />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="twitter-search-dropdown">
          {users.length === 0 && searched && (
            <div className="search-empty">
              {t('no_users_found', language)}
            </div>
          )}

          {users.map((user) => (
            <div
              key={user.id}
              className="twitter-search-user"
              onClick={() => {
                onOpenUser(user.username);
                clearSearch();
              }}
            >
              {user.avatar ? (
                <img
                  src={getFileUrl(user.avatar)}
                  alt=""
                />
              ) : (
                <div className="twitter-search-avatar">
                  {user.display_name?.[0] || '?'}
                </div>
              )}

              <div>
                <strong>{user.display_name}</strong>
                <p>@{user.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserSearch;
