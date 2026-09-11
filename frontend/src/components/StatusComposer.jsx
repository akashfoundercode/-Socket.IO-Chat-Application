import React, { useState, useEffect, useRef } from 'react';
import { statusApi } from '../services/api';
import { socket } from '../socket/socket';

const BG_COLORS = [
  '#075e54', '#c2410c', '#ea580c', '#1a1a2e', '#16213e',
  '#0f3460', '#533483', '#e94560', '#f5a623', '#2c3e50',
  '#8e44ad', '#2980b9', '#27ae60', '#e74c3c', '#4a148c',
  '#880e4f', '#1b5e20', '#0d47a1', '#263238', '#311b92'
];

const FONT_STYLES = [
  { value: 'normal', label: 'Aa Sans', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { value: 'serif', label: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: 'Mono', family: '"Courier New", Courier, monospace' },
  { value: 'cursive', label: 'Script', family: '"Brush Script MT", "Segoe Script", cursive' },
  { value: 'bold', label: 'Bold', family: 'Impact, -apple-system, BlinkMacSystemFont, sans-serif' }
];

export default function StatusComposer({ userId, onClose, onPosted, privacyMode = 'contacts', audienceUserIds = [] }) {
  const [activeTab, setActiveTab] = useState('photo'); // 'video' | 'photo' | 'text'
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [cameraError, setCameraError] = useState(null);
  const [micWarning, setMicWarning] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Captured / Selected Media State
  const [capturedMedia, setCapturedMedia] = useState(null); // { type: 'image' | 'video', url: string }
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  // Video Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Text Mode State
  const [textContent, setTextContent] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [fontIndex, setFontIndex] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── 1. Camera Lifecycle & Permission Management ── */
  const stopCameraStream = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (_) { }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCameraStream = async () => {
    stopCameraStream();
    if (activeTab === 'text' || capturedMedia) return;

    setIsRequestingPermission(true);
    setCameraError(null);
    setMicWarning(false);

    const isVideo = activeTab === 'video';
    const videoConstraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('NOT_SUPPORTED');
      }

      let stream;
      let micBlocked = false;

      if (isVideo) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ ...videoConstraints, audio: true });
        } catch (err) {
          // If microphone is blocked or not available, fallback to video only so user can still record
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'NotFoundError') {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ ...videoConstraints, audio: false });
              micBlocked = true;
            } catch (videoErr) {
              throw videoErr;
            }
          } else {
            throw err;
          }
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ ...videoConstraints, audio: false });
      }

      streamRef.current = stream;
      setMicWarning(micBlocked);
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
      }
    } catch (err) {
      console.warn("Camera/Mic access error:", err);
      if (!window.isSecureContext) {
        setCameraError({
          type: 'insecure',
          title: 'HTTPS Connection Required',
          message: 'Camera and microphone require a secure HTTPS connection.'
        });
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError({
          type: 'denied',
          title: isVideo ? 'Camera & Mic Permission Blocked' : 'Camera Permission Blocked',
          message: isVideo
            ? 'Camera or microphone access is blocked. Turn on permissions to take photos or record videos.'
            : 'Camera access is blocked. Turn on camera permission to take photos for your status.'
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError({
          type: 'not_found',
          title: 'No Camera Device Found',
          message: 'No camera was detected on this device. You can choose a photo or video from your gallery.'
        });
      } else if (err.message === 'NOT_SUPPORTED') {
        setCameraError({
          type: 'unsupported',
          title: 'Camera Not Supported',
          message: 'Camera capture is not supported on this browser.'
        });
      } else {
        setCameraError({
          type: 'unknown',
          title: 'Camera Unavailable',
          message: err.message || 'Unable to access camera. Please check permissions and try again.'
        });
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  useEffect(() => {
    startCameraStream();
    return () => {
      stopCameraStream();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [activeTab, facingMode, capturedMedia]);

  // Focus textarea in text mode
  useEffect(() => {
    if (activeTab === 'text') {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [activeTab]);

  /* ── 2. Photo Capture ── */
  const handleCapturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;
    if (!videoRef.current || !streamRef.current) {
      startCameraStream();
      return;
    }
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      // Mirror if front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      stopCameraStream();
      setCapturedMedia({ type: 'image', url: dataUrl });
    } catch (err) {
      console.error("Photo capture failed:", err);
    }
  };

  /* ── 3. Video Recording ── */
  const handleStartRecording = () => {
    if (!streamRef.current || isRecording) return;
  const handleStartRecording = async () => {
    if (isRecording) return;

    if (!streamRef.current || !streamRef.current.active) {
      await startCameraStream();
    }
    if (!streamRef.current) {
      startCameraStream();
      alert("Camera is not accessible. Please ensure permissions are granted.");
      return;
    }
    if (isRecording) return;

    try {
      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? { mimeType: 'video/webm;codecs=vp8,opus' }
        : MediaRecorder.isTypeSupported('video/mp4')
          ? { mimeType: 'video/mp4' }
          : {};

      // Check supported MIME types in order of best device compatibility
      const candidateTypes = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm'
      ];
      let selectedMimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
      const getBestSupportedVideoMimeType = () => {
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
        const candidateTypes = [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=h264,opus',
          'video/webm',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4'
        ];
        for (const type of candidateTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedMimeType = type;
            break;
            return type;
          }
        }
        return '';
      };

      const selectedMimeType = getBestSupportedVideoMimeType();
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};

      let recorder;
      try {
        recorder = new MediaRecorder(streamRef.current, options);
      } catch (e) {
        console.warn("Could not create MediaRecorder with options, falling back to default:", e);
        recorder = new MediaRecorder(streamRef.current);
      }

      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const recorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const actualMimeType = recorder.mimeType || selectedMimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: actualMimeType });

        if (!blob || blob.size === 0) {
          console.warn("Recorded video blob has size 0!");
          setIsRecording(false);
          setRecordDuration(0);
          return;
        }

        // Create Object URL for instant, high-performance playback in preview
        const blobUrl = URL.createObjectURL(blob);
        stopCameraStream();

        setCapturedMedia({
          type: 'video',
          url: blobUrl,
          blob: blob,
          dataUrl: null
        });

        // Convert blob to base64 DataURL for backend upload
        const reader = new FileReader();
        reader.onloadend = () => {
          stopCameraStream();
          setCapturedMedia({ type: 'video', url: reader.result });
          setCapturedMedia(prev => (prev && prev.url === blobUrl ? { ...prev, dataUrl: reader.result } : prev));
        };
        reader.readAsDataURL(blob);

        setIsRecording(false);
        setRecordDuration(0);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };

      recorder.start(250);
      recorder.start(200);
      setIsRecording(true);
      setRecordDuration(0);

      const startTime = Date.now();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordDuration(elapsed);
        // Limit max status video to 30 seconds
        if (elapsed >= 30) {
          handleStopRecording();
        }
      }, 500);
    } catch (err) {
      console.error("Video recording error:", err);
      alert("Could not start video recording: " + (err.message || err));
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
      } catch (_) { }
      mediaRecorderRef.current.stop();
      try {
        mediaRecorderRef.current.stop();
      } catch (_) { }
    }
  };

  /* ── 4. Gallery Pickers ── */
  const handlePhotoGallerySelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1440;
        const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        stopCameraStream();
        setCapturedMedia({ type: 'image', url: dataUrl });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleVideoGallerySelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) return;
    if (file.size > 25 * 1024 * 1024) {
      alert('Video file must be under 25MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    stopCameraStream();
    setCapturedMedia({
      type: 'video',
      url: objectUrl,
      blob: file,
      dataUrl: null
    });

    const reader = new FileReader();
    reader.onload = (ev) => {
      stopCameraStream();
      setCapturedMedia({ type: 'video', url: ev.target.result });
      setCapturedMedia(prev => (prev && prev.url === objectUrl ? { ...prev, dataUrl: ev.target.result } : prev));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── 5. Switchers ── */
  const cycleBackgroundColor = () => {
    setBgIndex((prev) => (prev + 1) % BG_COLORS.length);
  };

  const cycleFontStyle = () => {
    setFontIndex((prev) => (prev + 1) % FONT_STYLES.length);
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleRetakeOrDiscard = () => {
    if (capturedMedia?.url && capturedMedia.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(capturedMedia.url);
      } catch (_) { }
    }
    setCapturedMedia(null);
    setCaption('');
  };

  /* ── 6. Final Status Submission ── */
  const handlePostStatus = async () => {
    if (posting) return;

    if ((privacyMode === 'only_share' || privacyMode === 'contacts_except') && audienceUserIds.length === 0 && privacyMode === 'only_share') {
      alert('Select at least one saved contact for this status.');
      return;
    }

    let payload = null;
    if (activeTab === 'text') {
      const text = textContent.trim();
      if (!text) return;
      payload = {
        userId,
        type: 'text',
        content: text,
        caption: null,
        bgColor: BG_COLORS[bgIndex],
        fontStyle: FONT_STYLES[fontIndex].value,
        privacyMode,
        audienceUserIds
      };
    } else if (capturedMedia) {
      let finalContent = capturedMedia.dataUrl || capturedMedia.url;
      // If dataUrl is not ready yet, read from blob synchronously before posting
      if ((!finalContent || finalContent.startsWith('blob:')) && capturedMedia.blob) {
        try {
          finalContent = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(capturedMedia.blob);
          });
        } catch (err) {
          console.error("Failed to read video blob:", err);
        }
      }

      payload = {
        userId,
        type: capturedMedia.type,
        content: capturedMedia.url,
        content: finalContent,
        caption: caption.trim() || null,
        bgColor: '#075e54',
        fontStyle: 'normal',
        privacyMode,
        audienceUserIds
      };
    }

    if (!payload) return;
    if (!payload || !payload.content) return;

    setPosting(true);
    try {
      const res = await statusApi.createStatus(payload);
      socket.emit('status_posted', { userId, status: res?.status });
      if (capturedMedia?.url && capturedMedia.url.startsWith('blob:')) {
        try { URL.revokeObjectURL(capturedMedia.url); } catch (_) { }
      }
      onPosted?.();
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to post status');
    } finally {
      setPosting(false);
    }
  };

  const currentBg = BG_COLORS[bgIndex];
  const currentFont = FONT_STYLES[fontIndex];

  return (
    <div className="wa-composer-overlay" onClick={onClose}>
      <div className="wa-composer-card" onClick={e => e.stopPropagation()}>

        {/* ── TOP HEADER / TOOLBAR ── */}
        <div className="wa-composer-top-bar">
          <button
            type="button"
            className="wa-composer-circle-btn"
            onClick={capturedMedia ? handleRetakeOrDiscard : onClose}
            title={capturedMedia ? "Discard & Retake" : "Close"}
          >
            {capturedMedia ? <i className="fa-solid fa-arrow-left"></i> : <span>✕</span>}
          </button>

          <div className="wa-composer-top-actions">
            {activeTab === 'text' && !capturedMedia && (
              <>
                <button
                  type="button"
                  className="wa-composer-pill-btn"
                  onClick={cycleFontStyle}
                  title="Switch Font Style"
                >
                  <span style={{ fontFamily: currentFont.family, fontWeight: 700, fontSize: 16 }}>
                    {currentFont.label.split(' ')[0]}
                  </span>
                </button>
                <button
                  type="button"
                  className="wa-composer-circle-btn"
                  onClick={cycleBackgroundColor}
                  title="Switch Background Color"
                  style={{ background: currentBg, border: '2px solid rgba(255,255,255,0.85)' }}
                >
                  <i className="fa-solid fa-palette" style={{ color: '#fff', fontSize: 14 }}></i>
                </button>
              </>
            )}

            {(activeTab === 'photo' || activeTab === 'video') && !capturedMedia && (
              <button
                type="button"
                className="wa-composer-circle-btn"
                onClick={toggleCameraFacing}
                title="Flip Camera"
              >
                <i className="fa-solid fa-camera-rotate" style={{ fontSize: 15 }}></i>
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN VIEWFINDER / CONTENT AREA ── */}
        <div className="wa-composer-body">

          {/* 1. MEDIA PREVIEW (When photo or video is captured / chosen) */}
          {capturedMedia && (
            <div className="wa-composer-preview-container">
              {capturedMedia.type === 'image' ? (
                <img src={capturedMedia.url} alt="Status Preview" className="wa-composer-media-fit" />
              ) : (
                <video src={capturedMedia.url} controls autoPlay playsInline loop className="wa-composer-media-fit" />
              )}
            </div>
          )}

          {/* 2. TEXT MODE CANVAS */}
          {!capturedMedia && activeTab === 'text' && (
            <div
              className="wa-composer-text-canvas"
              style={{ background: currentBg }}
              onClick={() => textareaRef.current?.focus()}
            >
              <textarea
                ref={textareaRef}
                className="wa-composer-text-input"
                placeholder="Type a status..."
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                maxLength={700}
                style={{
                  fontFamily: currentFont.family,
                  fontWeight: currentFont.value === 'bold' ? 800 : 500
                }}
              />
            </div>
          )}

          {/* 3. CAMERA VIEWFINDER (For Photo / Video) */}
          {!capturedMedia && (activeTab === 'photo' || activeTab === 'video') && (
            <div className="wa-composer-camera-viewfinder">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`wa-composer-camera-feed ${facingMode === 'user' ? 'mirrored' : ''}`}
              />

              {/* Microphone warning banner (when camera works but mic is blocked) */}
              {micWarning && !cameraError && (
                <div className="wa-composer-mic-warning-banner">
                  <div className="wa-composer-mic-warning-text">
                    <i className="fa-solid fa-microphone-slash"></i>
                    <span>Microphone blocked (recording without sound)</span>
                  </div>
                  <button
                    type="button"
                    className="wa-composer-mic-retry-btn"
                    onClick={startCameraStream}
                    title="Allow microphone access"
                  >
                    Turn on Mic
                  </button>
                </div>
              )}

              {/* Full Camera / Mic Permission & Error Card */}
              {cameraError && (
                <div className="wa-composer-camera-err-box">
                  <i className="fa-solid fa-video-slash" style={{ fontSize: 32, marginBottom: 10, color: '#f87171' }}></i>
                  <p>{cameraError}</p>
                  <button type="button" className="wa-composer-permission-retry" onClick={startCameraStream}>
                    <i className="fa-solid fa-rotate-right"></i> Retry camera
                  </button>
                  <div className="wa-composer-perm-icon-wrap">
                    <div className="wa-composer-perm-icon-badge">
                      <i className="fa-solid fa-camera"></i>
                    </div>
                    {activeTab === 'video' && (
                      <div className="wa-composer-perm-icon-badge mic">
                        <i className="fa-solid fa-microphone"></i>
                      </div>
                    )}
                  </div>

                  <h3 className="wa-composer-perm-title">{cameraError.title}</h3>
                  <p className="wa-composer-perm-desc">{cameraError.message}</p>

                  <div className="wa-composer-perm-actions">
                    <button
                      type="button"
                      className="wa-composer-perm-primary-btn"
                      onClick={startCameraStream}
                      disabled={isRequestingPermission}
                    >
                      {isRequestingPermission ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                          <span>Requesting...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-shield-halved"></i>
                          <span>Turn on Permissions</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="wa-composer-perm-secondary-btn"
                      onClick={() => {
                        if (activeTab === 'video') videoInputRef.current?.click();
                        else photoInputRef.current?.click();
                      }}
                    >
                      <i className={`fa-solid ${activeTab === 'video' ? 'fa-film' : 'fa-image'}`}></i>
                      <span>Upload from Gallery</span>
                    </button>
                  </div>

                  {cameraError.type === 'denied' && (
                    <div className="wa-composer-perm-guide">
                      <button
                        type="button"
                        className="wa-composer-perm-guide-toggle"
                        onClick={() => setShowPermissionGuide(prev => !prev)}
                      >
                        <i className="fa-solid fa-circle-info"></i>
                        <span>{showPermissionGuide ? 'Hide settings guide' : 'How to allow in browser settings'}</span>
                        <i className={`fa-solid fa-chevron-${showPermissionGuide ? 'up' : 'down'}`}></i>
                      </button>

                      {showPermissionGuide && (
                        <div className="wa-composer-perm-steps">
                          <div className="wa-composer-perm-step">
                            <span className="wa-step-num">1</span>
                            <span>Tap the <strong>🔒 Lock / ⚙️ Tune</strong> icon next to the URL in browser bar.</span>
                          </div>
                          <div className="wa-composer-perm-step">
                            <span className="wa-step-num">2</span>
                            <span>Select <strong>Permissions / Site settings</strong>.</span>
                          </div>
                          <div className="wa-composer-perm-step">
                            <span className="wa-step-num">3</span>
                            <span>Set <strong>Camera</strong> {activeTab === 'video' ? '& Microphone' : ''} to <strong>Allow</strong>.</span>
                          </div>
                          <div className="wa-composer-perm-step">
                            <span className="wa-step-num">4</span>
                            <span>Tap <strong>"Turn on Permissions"</strong> button above.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="wa-composer-recording-badge">
                  <span className="wa-composer-red-dot"></span>
                  <span>00:{recordDuration < 10 ? `0${recordDuration}` : recordDuration}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── BOTTOM DOCK CONTROLS ── */}
        <div className="wa-composer-bottom-dock">

          {/* If media is captured: Show Caption Bar + Send Button */}
          {capturedMedia ? (
            <div className="wa-composer-caption-bar">
              <input
                type="text"
                className="wa-composer-caption-input"
                placeholder="Add a caption..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={250}
                onKeyDown={e => { if (e.key === 'Enter') handlePostStatus(); }}
              />
              <button
                type="button"
                className="wa-composer-send-fab"
                disabled={posting}
                onClick={handlePostStatus}
                title="Send Status"
              >
                {posting ? (
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-paper-plane"></i>
                )}
              </button>
            </div>
          ) : activeTab === 'text' ? (
            /* If Text mode: Floating Send Button at bottom */
            <div className="wa-composer-text-dock">
              <div style={{ flex: 1 }}></div>
              <button
                type="button"
                className="wa-composer-send-fab"
                disabled={!textContent.trim() || posting}
                onClick={handlePostStatus}
                title="Send Status"
              >
                {posting ? (
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-paper-plane"></i>
                )}
              </button>
            </div>
          ) : (
            /* If Photo or Video Camera Live View: Shutter / Record + Gallery */
            <div className="wa-composer-camera-controls">
              {/* Hidden file inputs */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoGallerySelect}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleVideoGallerySelect}
              />

              {/* Gallery button (Left) */}
              <button
                type="button"
                className="wa-composer-dock-icon-btn"
                title="Choose from Gallery"
                onClick={() => {
                  if (activeTab === 'video') videoInputRef.current?.click();
                  else photoInputRef.current?.click();
                }}
              >
                <i className={`fa-solid ${activeTab === 'video' ? 'fa-film' : 'fa-images'}`}></i>
              </button>

              {/* Central Trigger: Photo Shutter or Video Record Button */}
              {activeTab === 'photo' ? (
                <button
                  type="button"
                  className="wa-composer-shutter-btn"
                  onClick={handleCapturePhoto}
                  title="Take Photo"
                >
                  <div className="wa-composer-shutter-inner"></div>
                </button>
              ) : (
                <button
                  type="button"
                  className={`wa-composer-record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  <div className="wa-composer-record-inner"></div>
                </button>
              )}

              {/* Right Spacer / Camera Flip shortcut */}
              <button
                type="button"
                className="wa-composer-dock-icon-btn"
                onClick={toggleCameraFacing}
                title="Flip Camera"
              >
                <i className="fa-solid fa-rotate"></i>
              </button>
            </div>
          )}

          {/* Mode Switcher Tabs: VIDEO | PHOTO | TEXT (only when not viewing captured media) */}
          {!capturedMedia && (
            <div className="wa-composer-mode-tabs">
              <button
                type="button"
                className={`wa-composer-tab ${activeTab === 'video' ? 'active' : ''}`}
                onClick={() => { if (!isRecording) setActiveTab('video'); }}
              >
                VIDEO
              </button>
              <button
                type="button"
                className={`wa-composer-tab ${activeTab === 'photo' ? 'active' : ''}`}
                onClick={() => { if (!isRecording) setActiveTab('photo'); }}
              >
                PHOTO
              </button>
              <button
                type="button"
                className={`wa-composer-tab ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => { if (!isRecording) setActiveTab('text'); }}
              >
                TEXT
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

