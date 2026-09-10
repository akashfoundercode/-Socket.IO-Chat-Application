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

export default function StatusComposer({ userId, onClose, onPosted }) {
  const [activeTab, setActiveTab] = useState('photo'); // 'video' | 'photo' | 'text'
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [cameraError, setCameraError] = useState(null);

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

  /* ── 1. Camera Lifecycle Management ── */
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

    try {
      setCameraError(null);
      const isVideo = activeTab === 'video';
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: isVideo
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
      }
    } catch (err) {
      console.warn("Camera access warning:", err.message);
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission was denied. You can still pick files from gallery.' : 'Camera is not available on this device.');
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

    try {
      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? { mimeType: 'video/webm;codecs=vp8,opus' }
        : MediaRecorder.isTypeSupported('video/mp4')
          ? { mimeType: 'video/mp4' }
          : {};

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
        const reader = new FileReader();
        reader.onloadend = () => {
          stopCameraStream();
          setCapturedMedia({ type: 'video', url: reader.result });
        };
        reader.readAsDataURL(blob);
        setIsRecording(false);
        setRecordDuration(0);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordDuration(0);

      const startTime = Date.now();
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
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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

    const reader = new FileReader();
    reader.onload = (ev) => {
      stopCameraStream();
      setCapturedMedia({ type: 'video', url: ev.target.result });
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
    setCapturedMedia(null);
    setCaption('');
  };

  /* ── 6. Final Status Submission ── */
  const handlePostStatus = async () => {
    if (posting) return;

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
        fontStyle: FONT_STYLES[fontIndex].value
      };
    } else if (capturedMedia) {
      payload = {
        userId,
        type: capturedMedia.type,
        content: capturedMedia.url,
        caption: caption.trim() || null,
        bgColor: '#075e54',
        fontStyle: 'normal'
      };
    }

    if (!payload) return;

    setPosting(true);
    try {
      const res = await statusApi.createStatus(payload);
      socket.emit('status_posted', { userId, status: res?.status });
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

              {cameraError && (
                <div className="wa-composer-camera-err-box">
                  <i className="fa-solid fa-video-slash" style={{ fontSize: 32, marginBottom: 10, color: '#f87171' }}></i>
                  <p>{cameraError}</p>
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

