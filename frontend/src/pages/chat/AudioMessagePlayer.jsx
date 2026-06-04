import { useRef, useState } from 'react';
import { IoPlay, IoPause } from 'react-icons/io5';
import { getFileUrl } from '../../api/fileUrl';

const bars = [
  12, 18, 9, 22, 15, 28, 11, 20, 16, 26,
  13, 19, 24, 10, 17, 27, 14, 21, 12, 25,
  18, 9, 20, 15, 28, 11, 22, 16, 12, 18,
  9, 22, 15, 28, 11, 20, 16, 26, 13, 19,
];

function formatTime(seconds = 0) {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function AudioMessagePlayer({ src, duration = 0, isMine }) {
  const audioRef = useRef(null);
  const waveRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);

  const progress = audioDuration ? currentTime / audioDuration : 0;

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    await audio.play();
    setIsPlaying(true);
  };

  const handleWaveSeek = (e) => {
    const audio = audioRef.current;
    const wave = waveRef.current;
    if (!audio || !wave || !audioDuration) return;

    const rect = wave.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.min(Math.max(x / rect.width, 0), 1);

    audio.currentTime = percent * audioDuration;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div className={`audio-message ${isMine ? 'mine' : 'theirs'}`}>
      <button type="button" className="audio-play-btn" onClick={togglePlay}>
        {isPlaying ? <IoPause /> : <IoPlay />}
      </button>

      <div className="audio-info">
        <div className="audio-wave" ref={waveRef} onClick={handleWaveSeek}>
          {bars.map((height, index) => {
            const barProgress = index / bars.length;
            const active = barProgress <= progress;

            return (
              <span
                key={index}
                className={`audio-wave-bar ${active ? 'active' : ''}`}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>

        <div className="audio-time">
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={getFileUrl(src)}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) {
            setAudioDuration(e.currentTarget.duration);
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
    </div>
  );
}

export default AudioMessagePlayer;