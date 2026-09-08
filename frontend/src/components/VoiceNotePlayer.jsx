import React, { useState, useRef, useEffect } from 'react';

// Generates consistent waveform pattern based on mediaUrl string or random seed
const generateWaveformData = (seedString, count = 34) => {
  let hash = 0;
  for (let i = 0; i < (seedString || '').length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const bars = [];
  for (let i = 0; i < count; i++) {
    const x = Math.sin((i + Math.abs(hash % 100)) * 0.45) * 0.5 + 0.5;
    const y = Math.cos((i * 1.3) + Math.abs(hash % 50)) * 0.3 + 0.5;
    const height = Math.max(18, Math.min(100, Math.round(((x + y) / 2) * 82 + 18)));
    bars.push(height);
  }
  return bars;
};

export default function VoiceNotePlayer({
  mediaUrl,
  isSent,
  senderAvatar,
  senderName
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const isRetriedRef = useRef(false);

  const normalizedMediaUrl = React.useMemo(() => {
    if (!mediaUrl) return '';
    if (typeof mediaUrl === 'string') {
      // Already a full URL
      if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) return mediaUrl;
      // data: URL (base64) - use as-is
      if (mediaUrl.startsWith('data:')) return mediaUrl;
      // /uploads/voice/... -> /api/chat/media/voice/...
      if (mediaUrl.startsWith('/uploads/')) {
        return mediaUrl.replace('/uploads/', '/api/chat/media/');
      }
      // /api/chat/media/... -> already correct
      if (mediaUrl.startsWith('/api/chat/media/')) return mediaUrl;
      // /api/chat/uploads/... -> fix
      if (mediaUrl.startsWith('/api/chat/uploads/')) {
        return mediaUrl.replace('/api/chat/uploads/', '/api/chat/media/');
      }
    }
    return mediaUrl;
  }, [mediaUrl]);

  const waveformBars = useRef(generateWaveformData(mediaUrl, 34)).current;

  // Setup HTMLAudioElement listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !normalizedMediaUrl) return;

    setIsPlaying(false);
    setCurrentTime(0);
    isRetriedRef.current = false;

    const probeWebMDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (audio.duration === Infinity || isNaN(audio.duration) || audio.duration === 0) {
        // Fix for Chromium WebM duration bug: seek to a large time, browser recalculates duration
        const onProbeSeeked = () => {
          audio.removeEventListener('seeked', onProbeSeeked);
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
          }
          audio.currentTime = 0;
        };
        audio.addEventListener('seeked', onProbeSeeked);
        audio.currentTime = 1e101;
      }
    };

    const onLoadedMetadata = () => {
      probeWebMDuration();
    };

    const onCanPlay = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        if (duration === 0 || duration !== audio.duration) {
          setDuration(audio.duration);
        }
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    };

    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    const onError = (e) => {
      console.warn('Audio playback error:', audio.error?.message || e);
      if (typeof normalizedMediaUrl === 'string' && normalizedMediaUrl.startsWith('/') && !isRetriedRef.current) {
        isRetriedRef.current = true;
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        // Keep full path including /api/chat prefix
        const fallbackUrl = `http://${host}:3001${normalizedMediaUrl}`;
        console.log('Retrying audio with fallback:', fallbackUrl);
        audio.src = fallbackUrl;
        audio.load();
      }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('error', onError);
    };
  }, [normalizedMediaUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !normalizedMediaUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      try {
        if (audio.readyState === 0) {
          audio.load();
        }
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (err) {
        console.error('Audio play error:', err);
      }
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !mediaUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const totalDuration = (duration > 0 && isFinite(duration))
      ? duration
      : ((audio.duration > 0 && isFinite(audio.duration)) ? audio.duration : 1);
    const targetTime = ratio * totalDuration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const cyclePlaybackRate = (e) => {
    e.stopPropagation();
    const rates = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatAudioTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = (duration > 0 && isFinite(duration))
    ? (currentTime / duration) * 100
    : (currentTime > 0 ? Math.min(100, (currentTime % 30) * 3.33) : 0);

  return (
    <div className={`wa-voice-note-card ${isSent ? 'sent' : 'received'}`}>
      <audio
        ref={audioRef}
        src={normalizedMediaUrl}
        preload="auto"
        playsInline
      />

      {/* Voice Note Avatar with Mic Badge */}
      <div className="wa-vn-avatar-wrap">
        <div className="wa-vn-avatar">
          {senderAvatar ? (
            senderAvatar.length <= 4 ? (
              <span>{senderAvatar}</span>
            ) : (
              <img src={senderAvatar} alt="Sender" />
            )
          ) : (
            <i className="fa-brands fa-whatsapp" aria-label="Default avatar"></i>
          )}
        </div>
        <div className="wa-vn-mic-badge">
          <i className="fa-solid fa-microphone"></i>
        </div>
      </div>

      {/* Play/Pause Button */}
      <button
        type="button"
        className={`wa-vn-play-btn ${isPlaying ? 'playing' : ''}`}
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
      </button>

      {/* Waveform Visualizer & Timeline */}
      <div className="wa-vn-body">
        <div
          className="wa-vn-waveform-container"
          onClick={handleSeek}
          title="Click to seek"
        >
          {waveformBars.map((height, idx) => {
            const barPercent = (idx / waveformBars.length) * 100;
            const isPlayed = barPercent <= progressPercent;
            return (
              <div
                key={idx}
                className={`wa-vn-wave-bar ${isPlayed ? 'played' : ''} ${isPlaying ? 'animating' : ''}`}
                style={{
                  height: `${height}%`,
                  animationDelay: `${(idx % 6) * 0.08}s`
                }}
              />
            );
          })}
        </div>

        {/* Duration & Speed Controls */}
        <div className="wa-vn-footer">
          <span className="wa-vn-time">
            {isPlaying || currentTime > 0
              ? formatAudioTime(currentTime)
              : duration > 0
                ? formatAudioTime(duration)
                : '0:00'}
          </span>

          <button
            type="button"
            className={`wa-vn-speed-btn ${playbackRate > 1 ? 'boosted' : ''}`}
            onClick={cyclePlaybackRate}
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}


