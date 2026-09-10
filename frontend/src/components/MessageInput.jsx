import React, { useState, useRef } from 'react';
import EmojiPicker from './EmojiPicker';

export default function MessageInput({
  recipientId,
  onRecipientChange,
  onSendMessage,
  onTyping,
  isBlockedByMe,
  isBlockedByThem,
  onUnblock,
  groupId = null,
  groupMembers = [],
  replyTo = null,
  onClearReply,
  canSendMessages = true,
  onDraftChange,
  draftValue = ''
}) {
  const [text, setText] = useState('');
  const [showRecipientInput, setShowRecipientInput] = useState(!recipientId);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Image sharing states
  const [pendingImage, setPendingImage] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Location sharing states
  const [isLocating, setIsLocating] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const textareaRef = useRef(null);

  // Advanced Voice Recording states & refs
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState('');
  const [recordDuration, setRecordDuration] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [audioLevels, setAudioLevels] = useState(Array(18).fill(15));

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const cachedStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const pressStartTimeRef = useRef(0);
  const recordingStartTimeRef = useRef(0);
  const pointerStartPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const isCancelledRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const isLockedRef = useRef(false);
  const isInitializingMicRef = useRef(false);

  const isBlocked = isBlockedByMe || isBlockedByThem;

  const warmUpMic = () => {
    if (cachedStreamRef.current || isBlocked || !recipientId?.trim()) return;
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((stream) => { cachedStreamRef.current = stream; })
      .catch(() => { });
  };

  React.useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, []);

  const formatRecordTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const cleanupRecordingResources = () => {
    isInitializingMicRef.current = false;
    isPointerDownRef.current = false;
    isLockedRef.current = false;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) { }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) { }
      mediaStreamRef.current = null;
    }
    recorderRef.current = null;
    setIsRecording(false);
    setIsLocked(false);
    setIsCanceling(false);
    setDragOffset(0);
    setRecordDuration(0);
    setAudioLevels(Array(12).fill(15));
  };

  const startRecording = async (forceLock = false) => {
    if (isBlocked || !canSendMessages || !recipientId?.trim()) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Voice recording is not supported in this browser.');
      cleanupRecordingResources();
      return;
    }

    isInitializingMicRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      setMicPermissionError('');
      mediaStreamRef.current = stream;

      if (isCancelledRef.current) {
        cleanupRecordingResources();
        return;
      }

      // Setup Web Audio API Analyser for real-time live frequency meter waves
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioLevels = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            const barsCount = 12;
            const step = Math.max(1, Math.floor(dataArray.length / barsCount));
            const newLevels = [];
            for (let i = 0; i < barsCount; i++) {
              const val = dataArray[i * step] || 0;
              const normalized = Math.max(14, Math.min(100, Math.round((val / 255) * 100)));
              newLevels.push(normalized);
            }
            setAudioLevels(newLevels);
            animFrameRef.current = requestAnimationFrame(updateAudioLevels);
          };
          animFrameRef.current = requestAnimationFrame(updateAudioLevels);
        }
      } catch (audioErr) {
        console.warn('Web Audio Analyser not supported:', audioErr);
      }

      const getBestSupportedMimeType = () => {
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
          'audio/aac',
          'audio/wav'
        ];
        for (const t of candidates) {
          if (MediaRecorder.isTypeSupported(t)) {
            return t;
          }
        }
        return '';
      };

      const supportedType = getBestSupportedMimeType();
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (isCancelledRef.current) {
          chunksRef.current = [];
          cleanupRecordingResources();
          return;
        }

        const totalBytes = chunksRef.current.reduce((acc, c) => acc + (c.size || 0), 0);
        if (totalBytes < 150) {
          chunksRef.current = [];
          cleanupRecordingResources();
          return;
        }

        const mime = recorder.mimeType || supportedType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size >= 150) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const replySnippet = replyTo ? (
              replyTo.type === 'voice' ? '🎤 Voice message' :
                replyTo.type === 'image' ? '📷 Photo' :
                  replyTo.type === 'location' ? '📍 Location' :
                    (replyTo.text || '')
            ) : null;

            onSendMessage(recipientId.trim(), 'Voice message', 'voice', reader.result, {
              replyToId: replyTo?.id || null,
              replyToText: replySnippet,
              replyToSender: replyTo ? (replyTo.from || '') : null
            });
            onClearReply?.();
          };
          reader.readAsDataURL(blob);
        }
        cleanupRecordingResources();
      };

      recorder.start(100);
      recorderRef.current = recorder;
      isInitializingMicRef.current = false;
      setIsRecording(true);
      setIsCanceling(false);
      setRecordDuration(0);
      setDragOffset(0);

      if (forceLock) {
        setIsLocked(true);
        isLockedRef.current = true;
      }

      const startTimestamp = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimestamp) / 1000);
        setRecordDuration(secs);
      }, 500);

    } catch (error) {
      isInitializingMicRef.current = false;
      cleanupRecordingResources();
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        const message = !window.isSecureContext
          ? 'Microphone needs a secure HTTPS connection.'
          : 'Microphone permission is blocked. Allow Microphone in the browser Lock/Camera settings, then tap Retry.';
        setMicPermissionError(message);
      } else {
        setMicPermissionError(`Microphone error: ${error.message || 'Permission unavailable'}`);
      }
    }
  };

  const stopAndSendRecording = (isCancel = false) => {
    isCancelledRef.current = Boolean(isCancel);
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch (e) {
        cleanupRecordingResources();
      }
    } else {
      cleanupRecordingResources();
    }
  };

  // Pointer / Touch Handlers for Hold to Record & Drag to Cancel
  const handleMicPointerDown = (e) => {
    if (isBlocked || !recipientId.trim() || text.trim()) return;

    // If already recording in hands-free mode, do nothing on pointer down
    if (isRecording && isLockedRef.current) return;

    e.preventDefault();
    pressStartTimeRef.current = Date.now();
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = true;
    isPointerDownRef.current = true;
    isCancelledRef.current = false;

    const isMouse = e.pointerType === 'mouse';
    if (isMouse) {
      // Desktop: Start in click-to-record locked hands-free mode
      isLockedRef.current = true;
      setIsLocked(true);
      startRecording(true);
    } else {
      // Mobile touch: Start in hold-to-record mode
      isLockedRef.current = false;
      setIsLocked(false);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) { }
      startRecording(false);
    }
  };

  const handleMicPointerMove = (e) => {
    if (isLockedRef.current || !isDraggingRef.current) return;
    const deltaX = e.clientX - pointerStartPosRef.current.x;
    const deltaY = e.clientY - pointerStartPosRef.current.y;

    if (deltaX < 0) {
      const offset = Math.max(-120, deltaX);
      setDragOffset(offset);
      if (deltaX < -50) {
        setIsCanceling(true);
        isCancelledRef.current = true;
      } else {
        setIsCanceling(false);
        isCancelledRef.current = false;
      }
    } else {
      setDragOffset(0);
      setIsCanceling(false);
      isCancelledRef.current = false;
    }

    if (deltaY < -45) {
      setIsLocked(true);
      isLockedRef.current = true;
      setDragOffset(0);
      setIsCanceling(false);
      isCancelledRef.current = false;
    }
  };

  const handleMicPointerUp = (e) => {
    if (e.pointerType === 'mouse') {
      // Desktop mouse up: keep recording if locked
      return;
    }

    isPointerDownRef.current = false;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) { }

    if (isCanceling || isCancelledRef.current) {
      stopAndSendRecording(true);
      return;
    }

    if (isLockedRef.current) {
      return;
    }

    if (isInitializingMicRef.current) {
      return;
    }

    const elapsed = Date.now() - (pressStartTimeRef.current || 0);
    if (elapsed < 300) {
      // Short tap on mobile: switch to locked hands-free recording
      setIsLocked(true);
      isLockedRef.current = true;
      return;
    }

    stopAndSendRecording(false);
  };

  const handleMicPointerCancel = () => {
    if (isLockedRef.current) return;
    isPointerDownRef.current = false;
    isDraggingRef.current = false;
    stopAndSendRecording(true);
  };

  // Debounced Typing emitter
  React.useEffect(() => {
    setText(draftValue || '');
  }, [draftValue, recipientId]);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollH, 20), 120)}px`;
    }
  }, [text]);

  const handleTextChange = (e) => {
    if (isBlocked || !canSendMessages) return;
    const val = e.target.value;
    setText(val);
    onDraftChange?.(recipientId, val);

    if (onTyping) {
      if (val.trim()) {
        onTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          onTyping(false);
        }, 2500);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        onTyping(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (isBlocked || !canSendMessages) return;
    const trimmed = text.trim();
    if (trimmed && recipientId.trim()) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (onTyping) onTyping(false);
      const mentions = groupId
        ? groupMembers.filter((member) => trimmed.includes(`@${member.name || member.fullPhone || member.userId}`)).map((member) => member.userId)
        : [];
      const replySnippet = replyTo ? (
        replyTo.type === 'voice' ? '🎤 Voice message' :
          replyTo.type === 'image' ? '📷 Photo' :
            replyTo.type === 'location' ? '📍 Location' :
              (replyTo.text || '')
      ) : null;
      onSendMessage(recipientId.trim(), trimmed, 'text', null, {
        replyToId: replyTo?.id || null,
        replyToText: replySnippet,
        replyToSender: replyTo ? (replyTo.from || '') : null,
        mentions
      });
      setText('');
      onDraftChange?.(recipientId, '');
      onClearReply?.();
      setShowEmojiPicker(false);
      setShowAttachMenu(false);
    }
  };

  const handleSelectEmoji = (emoji) => {
    if (isBlocked) return;
    setText((prev) => prev + emoji);
  };

  // When image is picked from file dialog
  const handleImageSelected = (e) => {
    if (isBlocked) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Optimize & resize for crisp messaging
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPendingImage(dataUrl);
        setImageCaption('');
        setShowImagePreview(true);
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  // Send Image with optional caption
  const handleSendImage = () => {
    if (isBlocked || !canSendMessages || !pendingImage || !recipientId.trim()) return;
    const replySnippet = replyTo ? (
      replyTo.type === 'voice' ? '🎤 Voice message' :
        replyTo.type === 'image' ? '📷 Photo' :
          replyTo.type === 'location' ? '📍 Location' :
            (replyTo.text || '')
    ) : null;
    onSendMessage(recipientId.trim(), imageCaption.trim(), 'image', pendingImage, {
      replyToId: replyTo?.id || null,
      replyToText: replySnippet,
      replyToSender: replyTo ? (replyTo.from || '') : null
    });
    setPendingImage(null);
    setImageCaption('');
    setShowImagePreview(false);
    onClearReply?.();
  };

  // 📍 Fetch Current GPS Location
  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setShowAttachMenu(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setPendingLocation({
          latitude,
          longitude,
          accuracy: Math.round(accuracy || 10),
          title: 'Current Location'
        });
        setShowLocationModal(true);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        console.error('Geolocation error:', error);
        alert(`Could not get location: ${error.message || 'Permission denied'}. Please allow location access in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // 📍 Send Location Message
  const handleSendLocation = () => {
    if (!pendingLocation || !recipientId.trim() || isBlocked || !canSendMessages) return;
    const locationPayload = JSON.stringify({
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude,
      accuracy: pendingLocation.accuracy,
      title: pendingLocation.title || 'Current Location'
    });

    const replySnippet = replyTo ? (
      replyTo.type === 'voice' ? '🎤 Voice message' :
        replyTo.type === 'image' ? '📷 Photo' :
          replyTo.type === 'location' ? '📍 Location' :
            (replyTo.text || '')
    ) : null;

    onSendMessage(recipientId.trim(), locationPayload, 'location', null, {
      replyToId: replyTo?.id || null,
      replyToText: replySnippet,
      replyToSender: replyTo ? (replyTo.from || '') : null
    });
    setShowLocationModal(false);
    setPendingLocation(null);
    onClearReply?.();
  };

  return (
    <div className="wa-bottom-bar">
      {/* Hidden File Input for Image Attachment */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
        style={{ display: 'none' }}
        onChange={handleImageSelected}
      />

      {/* Location Share Preview Modal */}
      {showLocationModal && pendingLocation && !isBlocked && (
        <div className="wa-location-modal-overlay" onClick={() => setShowLocationModal(false)}>
          <div className="wa-location-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-location-modal-header">
              <button
                type="button"
                className="wa-location-close-btn"
                onClick={() => {
                  setShowLocationModal(false);
                  setPendingLocation(null);
                }}
                title="Cancel"
              >
                ✕
              </button>
              <h3>Share Location</h3>
              <div style={{ width: '24px' }}></div>
            </div>

            <div className="wa-location-modal-body">
              {/* Interactive OpenStreetMap Pin Map */}
              <div className="wa-location-map-container">
                <iframe
                  title="GPS Location Map"
                  className="wa-location-iframe"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${pendingLocation.longitude - 0.006}%2C${pendingLocation.latitude - 0.004}%2C${pendingLocation.longitude + 0.006}%2C${pendingLocation.latitude + 0.004}&layer=mapnik&marker=${pendingLocation.latitude}%2C${pendingLocation.longitude}`}
                />
                <div className="wa-location-marker-pulse">
                  <i className="fa-solid fa-location-dot"></i>
                </div>
              </div>

              {/* Location Details Info */}
              <div className="wa-location-info-card">
                <div className="wa-location-info-left">
                  <div className="wa-loc-icon-circle">
                    <i className="fa-solid fa-location-crosshairs"></i>
                  </div>
                  <div>
                    <div className="wa-loc-title">Send Your Current Location</div>
                    <div className="wa-loc-subtitle">
                      Accurate to {pendingLocation.accuracy} meters • ({pendingLocation.latitude.toFixed(5)}, {pendingLocation.longitude.toFixed(5)})
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="wa-location-modal-footer">
              <button
                type="button"
                className="wa-send-location-btn"
                onClick={handleSendLocation}
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Send Location to {recipientId}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Send Preview Modal */}
      {showImagePreview && pendingImage && !isBlocked && (
        <div className="wa-image-preview-modal">
          <div className="wa-image-preview-header">
            <button
              type="button"
              className="wa-image-preview-close"
              onClick={() => {
                setShowImagePreview(false);
                setPendingImage(null);
                setImageCaption('');
              }}
              title="Cancel"
            >
              ✕
            </button>
            <span>Send Photo to {recipientId}</span>
            <div style={{ width: '24px' }}></div>
          </div>

          <div className="wa-image-preview-body">
            <img src={pendingImage} alt="Preview" className="wa-preview-display-img" />
          </div>

          <div className="wa-image-preview-footer">
            <div className="wa-caption-input-wrap">
              <i className="fa-regular fa-face-smile" style={{ color: '#8696a0' }}></i>
              <input
                type="text"
                className="wa-caption-input"
                placeholder="Add a caption..."
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendImage();
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="wa-preview-send-btn"
              onClick={handleSendImage}
              title="Send Photo"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Attachment Menu Popup */}
      {showAttachMenu && !isBlocked && (
        <div className="wa-attach-popup-menu">
          <button
            type="button"
            className="wa-attach-menu-item item-gallery"
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
          >
            <div className="wa-attach-circle gallery">
              <i className="fa-solid fa-image"></i>
            </div>
            <span>Photos & Videos</span>
          </button>

          <button
            type="button"
            className="wa-attach-menu-item item-location"
            onClick={handleFetchLocation}
          >
            <div className="wa-attach-circle location">
              <i className="fa-solid fa-location-dot"></i>
            </div>
            <span>Location</span>
          </button>
        </div>
      )}

      {/* WhatsApp Categorized Full Emoji Picker */}
      {showEmojiPicker && !isBlocked && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {replyTo && (
        <div className="wa-reply-preview">
          <div className="wa-reply-preview-bar"></div>
          <div className="wa-reply-preview-content">
            <div className="wa-reply-preview-sender">
              Replying to {replyTo.from || 'Message'}
            </div>
            <div className="wa-reply-preview-snippet">
              {replyTo.type === 'voice' ? '🎤 Voice message' : replyTo.type === 'image' ? '📷 Photo' : replyTo.type === 'location' ? '📍 Location' : (replyTo.text || '')}
            </div>
          </div>
          <button type="button" className="wa-reply-preview-close" onClick={onClearReply} title="Cancel reply">
            ✕
          </button>
        </div>
      )}

      {groupId && text.includes('@') && (
        <div className="wa-mention-menu">
          {groupMembers.filter((member) => (member.name || member.fullPhone || member.userId || '').toLowerCase().includes(text.split('@').pop().toLowerCase())).slice(0, 5).map((member) => {
            const label = member.name || member.fullPhone || member.userId;
            return (
              <button
                type="button"
                key={member.userId}
                onClick={() => setText((prev) => `${prev.slice(0, prev.lastIndexOf('@'))}@${label} `)}
              >
                @{label}
              </button>
            );
          })}
        </div>
      )}

      {/* Top Recipient Changer Bar */}
      {(!recipientId || showRecipientInput) && !isBlocked && (
        <div className="wa-recipient-bar">
          <label htmlFor="recipient">To:</label>
          <input
            id="recipient"
            type="text"
            placeholder="Recipient phone e.g. +919876543210"
            value={recipientId}
            onChange={(e) => onRecipientChange(e.target.value)}
            autoFocus
          />
          {recipientId && (
            <button
              type="button"
              className="wa-recipient-done-btn"
              onClick={() => setShowRecipientInput(false)}
            >
              OK
            </button>
          )}
        </div>
      )}

      {/* If Blocked, Display WhatsApp style Block Notice Bar */}
      {!canSendMessages ? (
        <div className="wa-blocked-bar wa-group-admin-only-bar">
          <div className="wa-blocked-content">
            <i className="fa-solid fa-lock"></i>
            <span>Only group admins can send messages.</span>
          </div>
        </div>
      ) : isBlocked ? (
        <div className="wa-blocked-bar">
          {isBlockedByMe ? (
            <div className="wa-blocked-content">
              <span>You blocked this contact.</span>
              <button
                type="button"
                className="wa-unblock-link-btn"
                onClick={() => onUnblock && onUnblock(recipientId)}
              >
                Tap to unblock
              </button>
            </div>
          ) : (
            <div className="wa-blocked-content">
              <span>You cannot send messages to this contact because you have been blocked.</span>
            </div>
          )}
        </div>
      ) : (
        /* WhatsApp Message Input Row */
        <>
          {micPermissionError && !text.trim() && (
            <div className="wa-mic-permission-error">
              <span><i className="fa-solid fa-microphone-slash"></i> {micPermissionError}</span>
              <button type="button" onClick={() => startRecording(false)}>Retry</button>
            </div>
          )}
          <form className="wa-input-row" onSubmit={handleSubmit}>
            {isRecording ? (
              /* Live Recording Active Capsule with Waveform Visualizer */
              <div className={`wa-recording-capsule ${isCanceling ? 'canceling' : ''}`}>
                <div className="wa-rec-timer-wrap">
                  <div className="wa-rec-pulse-dot" />
                  <span className="wa-rec-timer">{formatRecordTime(recordDuration)}</span>
                </div>

                {/* Dynamic Live Audio Frequency Meter Waves */}
                <div className="wa-rec-waveform-meter">
                  {audioLevels.map((lvl, idx) => (
                    <span
                      key={idx}
                      className="wa-rec-meter-bar"
                      style={{ height: `${lvl}%` }}
                    />
                  ))}
                </div>

                {/* Slide to Cancel or Release to Delete Alert */}
                {!isLocked ? (
                  <div
                    className="wa-rec-cancel-slide"
                    style={{ transform: `translateX(${dragOffset}px)` }}
                  >
                    {isCanceling ? (
                      <span className="wa-rec-cancel-text trash">
                        <i className="fa-solid fa-trash-can" style={{ color: '#ef4444' }}></i>
                        Release to cancel
                      </span>
                    ) : (
                      <span className="wa-rec-cancel-text">
                        <i className="fa-solid fa-chevron-left"></i>
                        Slide to cancel
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="wa-rec-locked-actions">
                    <button
                      type="button"
                      className="wa-rec-locked-btn delete"
                      onClick={() => stopAndSendRecording(true)}
                      title="Cancel recording"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Normal Typing Capsule */
              <div className="wa-input-capsule">
                <button
                  type="button"
                  className={`wa-capsule-icon ${showEmojiPicker ? 'active' : ''}`}
                  title="Emoji Keyboard"
                  onClick={() => {
                    setShowEmojiPicker((prev) => !prev);
                    setShowAttachMenu(false);
                  }}
                >
                  <i className={showEmojiPicker ? 'fa-solid fa-keyboard' : 'fa-regular fa-face-smile'}></i>
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  className="wa-main-input"
                  placeholder={recipientId ? 'Message' : 'Set recipient first'}
                  value={text}
                  onChange={handleTextChange}
                  onFocus={() => {
                    setTimeout(() => {
                      window.scrollTo(0, 0);
                      const msgContainer = document.querySelector('.wa-messages-container') || document.querySelector('.wa-chat-pane');
                      if (msgContainer) {
                        msgContainer.scrollTop = msgContainer.scrollHeight;
                      }
                    }, 250);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={!recipientId.trim() || !canSendMessages}
                />

                <button
                  type="button"
                  className={`wa-capsule-icon ${showAttachMenu ? 'active' : ''}`}
                  title="Attach File or Location"
                  onClick={() => {
                    setShowAttachMenu((prev) => !prev);
                    setShowEmojiPicker(false);
                  }}
                >
                  {isLocating ? (
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#f97316' }}></i>
                  ) : (
                    <i className="fa-solid fa-paperclip"></i>
                  )}
                </button>

                <button
                  type="button"
                  className="wa-capsule-icon"
                  title="Change recipient"
                  onClick={() => setShowRecipientInput((prev) => !prev)}
                >
                  <i className="fa-solid fa-address-book"></i>
                </button>
              </div>
            )}

            {text.trim() ? (
              <button
                type="submit"
                className="wa-send-mic-btn"
                disabled={!recipientId.trim() || !canSendMessages}
                title="Send Message"
              >
                <i className="fa-solid fa-paper-plane"></i>
              </button>
            ) : (
              <button
                type="button"
                className={`wa-send-mic-btn ${isRecording ? 'recording' : ''} ${isCanceling ? 'canceling' : ''}`}
                disabled={!recipientId.trim()}
                onPointerDown={handleMicPointerDown}
                onPointerMove={handleMicPointerMove}
                onPointerUp={handleMicPointerUp}
                onPointerCancel={handleMicPointerCancel}
                onClick={isRecording && isLocked ? () => stopAndSendRecording(false) : undefined}
                title={isRecording ? (isLocked ? 'Send voice note' : 'Release to send, drag left to cancel') : 'Click or hold to record voice note'}
              >
                {isLocked ? (
                  <i className="fa-solid fa-paper-plane"></i>
                ) : isRecording ? (
                  <i className="fa-solid fa-microphone"></i>
                ) : (
                  <i className="fa-solid fa-microphone"></i>
                )}
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}


