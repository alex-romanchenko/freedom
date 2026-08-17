import { useEffect, useMemo, useState } from 'react';
import {
  IoCallOutline,
  IoChatbubbleOutline,
  IoClose,
  IoDocumentOutline,
  IoEllipsisVertical,
  IoFlagOutline,
  IoMicOutline,
  IoMusicalNotesOutline,
  IoNotificationsOffOutline,
  IoNotificationsOutline,
  IoPersonRemoveOutline,
  IoVideocamOutline,
  IoBanOutline,
} from 'react-icons/io5';
import api from '../../api/api';
import { getFileUrl } from '../../api/fileUrl';
import { getIdentityColors } from '../../utils/identityColors';
import AudioMessagePlayer from './AudioMessagePlayer';
import ChatMediaGallery from './ChatMediaGallery';

const copy = {
  uk: { chat: 'Написати', enable: 'Увімкнути', disable: 'Вимкнути', audio: 'Аудіо', video: 'Відео', media: 'Медіа', files: 'Файли', music: 'Музика', voice: 'Голосові', empty: 'У чаті ще немає таких файлів', remove: 'Видалити користувача', block: 'Заблокувати', report: 'Поскаржитись', online: 'Онлайн', last: 'Був(ла) в мережі' },
  ru: { chat: 'Написать', enable: 'Включить', disable: 'Отключить', audio: 'Звонок', video: 'Видео', media: 'Медиа', files: 'Файлы', music: 'Музыка', voice: 'Голосовые', empty: 'В чате ещё нет таких файлов', remove: 'Удалить контакт', block: 'Заблокировать', report: 'Пожаловаться', online: 'В сети', last: 'Был(а) в сети' },
  en: { chat: 'Chat', enable: 'Enable', disable: 'Disable', audio: 'Call', video: 'Video', media: 'Media', files: 'Files', music: 'Music', voice: 'Voice', empty: 'There are no such files in this chat yet', remove: 'Remove contact', block: 'Block', report: 'Report', online: 'Online', last: 'Last seen' },
};

function ContactInfoPanel({ conversation, onlineUsers, language, onClose, onStartCall }) {
  const [tab, setTab] = useState('media');
  const [attachments, setAttachments] = useState([]);
  const [muted, setMuted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const labels = copy[language] || copy.en;
  const online = onlineUsers.includes(String(conversation.user_id));

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/messages/${conversation.id}/attachments`),
      api.get(`/messages/${conversation.id}/notifications`),
    ]).then(([media, settings]) => {
      if (!active) return;
      setAttachments(media.data || []);
      setMuted(Boolean(settings.data?.muted));
    }).catch(() => active && setAttachments([]));
    return () => { active = false; };
  }, [conversation.id]);

  const media = useMemo(() => attachments.filter((item) => {
    const mime = item.file_mime || '';
    if (tab === 'media') return item.image || item.video;
    if (tab === 'files') return item.file && !mime.startsWith('audio/');
    if (tab === 'music') return item.file && mime.startsWith('audio/');
    return item.audio;
  }), [attachments, tab]);

  const toggleMuted = async () => {
    const next = !muted;
    setMuted(next);
    try {
      const response = await api.patch(`/messages/${conversation.id}/notifications`, { muted: next });
      setMuted(Boolean(response.data?.muted));
    } catch (_) {
      setMuted(!next);
    }
  };

  const action = async (type) => {
    setMenuOpen(false);
    if (type === 'remove') await api.delete(`/follow/${conversation.user_id}`);
    if (type === 'block') await api.post(`/safety/blocks/${conversation.user_id}`);
    if (type === 'report') await api.post('/safety/reports', { entityType: 'user', reportedUserId: conversation.user_id, reason: 'other' });
    if (type !== 'report') onClose(true);
  };

  const lastSeen = conversation.last_seen
    ? new Date(conversation.last_seen).toLocaleString(language === 'uk' ? 'uk-UA' : language === 'ru' ? 'ru-RU' : 'en-US')
    : '';
  const identity = getIdentityColors(conversation.username || conversation.display_name || conversation.id);
  const tabs = [['media', labels.media], ['files', labels.files], ['music', labels.music], ['voice', labels.voice]];
  const galleryMedia = attachments
    .filter((item) => item.image || item.video)
    .map((item) => ({ path: item.image || item.video, type: item.video ? 'video' : 'image' }));

  return <aside className="contact-info-panel">
    <div className="contact-info-topbar">
      <button onClick={() => onClose(false)}><IoClose /></button>
      <div className="contact-menu-wrap">
        <button onClick={() => setMenuOpen((value) => !value)}><IoEllipsisVertical /></button>
        {menuOpen && <div className="contact-actions-menu">
          <button onClick={() => action('remove')}><IoPersonRemoveOutline />{labels.remove}</button>
          <button onClick={() => action('block')}><IoBanOutline />{labels.block}</button>
          <button onClick={() => action('report')}><IoFlagOutline />{labels.report}</button>
        </div>}
      </div>
    </div>
    <div className="contact-info-profile">
      {conversation.avatar ? <img src={getFileUrl(conversation.avatar)} alt="" /> : <div style={{ background: identity.background }}>{conversation.display_name?.[0] || '?'}</div>}
      <h2>{conversation.display_name}</h2>
      <p className={online ? 'contact-online' : ''}>{online ? labels.online : lastSeen ? `${labels.last} ${lastSeen}` : ''}</p>
    </div>
    <div className="contact-info-buttons">
      <button onClick={() => onClose(false)}><IoChatbubbleOutline /><span>{labels.chat}</span></button>
      <button onClick={toggleMuted}>{muted ? <IoNotificationsOffOutline /> : <IoNotificationsOutline />}<span>{muted ? labels.enable : labels.disable}</span></button>
      <button onClick={() => onStartCall(false)}><IoCallOutline /><span>{labels.audio}</span></button>
      <button onClick={() => onStartCall(true)}><IoVideocamOutline /><span>{labels.video}</span></button>
    </div>
    <div className="contact-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div className={`contact-attachments ${tab === 'media' ? 'grid' : ''}`}>
      {media.length === 0 ? <p>{labels.empty}</p> : media.map((item) => {
        const url = getFileUrl(item.image || item.video || item.file || item.audio);
        if (tab === 'media') return <button key={item.id} type="button" className="contact-media-item" onClick={() => setGalleryIndex(galleryMedia.findIndex((entry) => entry.path === (item.image || item.video)))}>{item.video ? <video src={url} muted preload="metadata" playsInline /> : <img src={url} alt="" />}{item.video && <IoVideocamOutline />}</button>;
        if (tab === 'music' || tab === 'voice') return <AudioMessagePlayer key={item.id} src={item.file || item.audio} duration={item.audio_duration || 0} isMine={false} isMusic={tab === 'music'} />;
        const Icon = tab === 'files' ? IoDocumentOutline : tab === 'music' ? IoMusicalNotesOutline : IoMicOutline;
        return <a key={item.id} href={url} target="_blank" rel="noreferrer" className="contact-file-item"><Icon /><span>{item.file_name || labels[tab]}</span></a>;
      })}
    </div>
    {galleryIndex !== null && <ChatMediaGallery media={galleryMedia} index={galleryIndex} onChange={setGalleryIndex} onClose={() => setGalleryIndex(null)} />}
  </aside>;
}

export default ContactInfoPanel;
