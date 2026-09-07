import React, { useState, useEffect, useRef } from 'react';
import { profileApi } from '../services/api';

const PRESET_ABOUTS = [
  'Available',
  'Busy',
  'At work',
  'In a meeting',
  'At school',
  'At the movies',
  'Battery about to die',
  'Can’t talk, WhatsApp only',
  'Urgent calls only',
  'Hey there! I am using WhatsApp.'
];

const PRESET_AVATARS = [
  '🧑‍💻', '👨‍💼', '👩‍💼', '😎', '🦁', '🚀', '🌟', '🎧',
  '⚡', '🔥', '🐶', '🐱', '👑', '🎨', '⚽'
];

export default function ProfileSettings({ userId, onBack, onProfileUpdated }) {
  const [profile, setProfile] = useState({
    name: '',
    about: 'Available',
    avatar: '🧑‍💻',
    avatarPrivacy: 'everyone',
    phone: userId,
    fullPhone: userId
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempAbout, setTempAbout] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef(null);

  // 1. Fetch Profile on load
  useEffect(() => {
    async function loadProfile() {
      if (!userId) return;
      try {
        setLoading(true);
        const data = await profileApi.getProfile(userId, userId);
        if (data && data.success && data.user) {
          const u = data.user;
          const userState = {
            name: u.name || u.fullPhone || userId,
            about: u.about || 'Available',
            avatar: u.avatar || '🧑‍💻',
            avatarPrivacy: u.avatarPrivacy || 'everyone',
            phone: u.phone || userId,
            fullPhone: u.fullPhone || userId
          };
          setProfile(userState);
          setTempName(userState.name);
          setTempAbout(userState.about);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [userId]);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // 2. Save Name
  const handleSaveName = async (e) => {
    e.preventDefault();
    const cleanName = tempName.trim();
    if (!cleanName) return;

    setSaving(true);
    setErrorMsg('');
    try {
      const updated = { ...profile, name: cleanName };
      await profileApi.updateProfile(userId, updated);
      setProfile(updated);
      setEditingName(false);
      showToast('Name updated successfully!');
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setErrorMsg('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  // 3. Save About
  const handleSaveAbout = async (selectedAbout) => {
    const textToSave = selectedAbout || tempAbout.trim();
    if (!textToSave) return;

    setSaving(true);
    setErrorMsg('');
    try {
      const updated = { ...profile, about: textToSave };
      await profileApi.updateProfile(userId, updated);
      setProfile(updated);
      setEditingAbout(false);
      showToast('About status updated!');
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setErrorMsg('Failed to update about');
    } finally {
      setSaving(false);
    }
  };

  // 4. Save Avatar (Emoji, Image URL, or Uploaded Data)
  const handleSaveAvatar = async (avatarData) => {
    setSaving(true);
    setShowAvatarModal(false);
    setErrorMsg('');
    try {
      const updated = { ...profile, avatar: avatarData };
      await profileApi.updateProfile(userId, updated);
      setProfile(updated);
      showToast('Profile photo updated!');
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setErrorMsg('Failed to update photo');
    } finally {
      setSaving(false);
    }
  };

  // 5. Handle File Upload from device / gallery
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & crop to square 400x400
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        const width = img.width;
        const height = img.height;
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = Math.min(minDim, MAX_DIM);
        canvas.height = Math.min(minDim, MAX_DIM);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        handleSaveAvatar(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  // 6. Save Privacy Setting
  const handleSavePrivacy = async (newPrivacy) => {
    if (profile.avatarPrivacy === newPrivacy) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const updated = { ...profile, avatarPrivacy: newPrivacy };
      await profileApi.updateProfile(userId, updated);
      setProfile(updated);
      const label = newPrivacy === 'everyone' ? 'Everyone' : newPrivacy === 'contacts' ? 'My Contacts' : 'Nobody (Show to me only)';
      showToast(`Privacy set to: ${label}`);
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setErrorMsg('Failed to update privacy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="wa-profile-screen">
        <header className="wa-profile-header">
          <button type="button" className="wa-profile-back" onClick={onBack}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <span>Profile</span>
        </header>
        <div className="wa-profile-loading">
          <i className="fa-solid fa-circle-notch fa-spin"></i>
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="wa-profile-screen">
      {/* WhatsApp Profile Top Header */}
      <header className="wa-profile-header">
        <button type="button" className="wa-profile-back" onClick={onBack} title="Back">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <span>Profile</span>
      </header>

      {/* Success Toast */}
      {successToast && (
        <div className="wa-profile-toast">
          <i className="fa-solid fa-circle-check"></i>
          <span>{successToast}</span>
        </div>
      )}

      {errorMsg && (
        <div className="wa-profile-error-toast">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="wa-profile-body">
        {/* Big Avatar with Camera Icon */}
        <div className="wa-profile-avatar-wrap">
          <div
            className="wa-profile-avatar"
            onClick={() => setShowAvatarModal(true)}
            title="Change Profile Photo"
          >
            {profile.avatar && profile.avatar.length <= 4 ? (
              <span className="wa-avatar-emoji">{profile.avatar}</span>
            ) : profile.avatar ? (
              <img src={profile.avatar} alt="Avatar" className="wa-avatar-img" />
            ) : (
              <i className="fa-solid fa-user" style={{ fontSize: '48px', color: '#9ca3af' }}></i>
            )}
            <div className="wa-avatar-overlay">
              <i className="fa-solid fa-camera"></i>
            </div>
          </div>
        </div>

        {/* Hidden File Input for Device Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* 1. Name Section */}
        <div className="wa-profile-card">
          <div className="wa-profile-card-icon">
            <i className="fa-solid fa-user"></i>
          </div>

          <div className="wa-profile-card-content">
            <div className="wa-card-label">Name</div>
            {!editingName ? (
              <div className="wa-card-value-row">
                <span className="wa-card-value">{profile.name}</span>
                <button
                  type="button"
                  className="wa-card-edit-btn"
                  onClick={() => {
                    setTempName(profile.name);
                    setEditingName(true);
                  }}
                  title="Edit Name"
                >
                  <i className="fa-solid fa-pen"></i>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveName} className="wa-inline-edit-form">
                <input
                  type="text"
                  className="wa-inline-input"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                  required
                />
                <div className="wa-inline-actions">
                  <button type="button" className="wa-inline-cancel" onClick={() => setEditingName(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="wa-inline-save" disabled={saving || !tempName.trim()}>
                    Save
                  </button>
                </div>
              </form>
            )}
            <div className="wa-card-hint">
              This is not your username or PIN. This name will be visible to your WhatsApp contacts.
            </div>
          </div>
        </div>

        {/* 2. Profile Photo Privacy Section */}
        <div className="wa-profile-card">
          <div className="wa-profile-card-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>

          <div className="wa-profile-card-content">
            <div className="wa-card-label">Profile Photo Privacy</div>
            <div className="wa-privacy-options-list">
              {/* Option 1: Everyone */}
              <div
                className={`wa-privacy-option-item ${profile.avatarPrivacy === 'everyone' ? 'active' : ''}`}
                onClick={() => handleSavePrivacy('everyone')}
              >
                <div className="wa-privacy-radio-circle">
                  {profile.avatarPrivacy === 'everyone' && <i className="fa-solid fa-check"></i>}
                </div>
                <div className="wa-privacy-option-content">
                  <div className="wa-privacy-title">
                    <i className="fa-solid fa-globe"></i> Everyone
                  </div>
                  <div className="wa-privacy-desc">Anyone who searches or chats with you can see your profile photo</div>
                </div>
              </div>

              {/* Option 2: My Contacts */}
              <div
                className={`wa-privacy-option-item ${profile.avatarPrivacy === 'contacts' ? 'active' : ''}`}
                onClick={() => handleSavePrivacy('contacts')}
              >
                <div className="wa-privacy-radio-circle">
                  {profile.avatarPrivacy === 'contacts' && <i className="fa-solid fa-check"></i>}
                </div>
                <div className="wa-privacy-option-content">
                  <div className="wa-privacy-title">
                    <i className="fa-solid fa-users"></i> My Contacts
                  </div>
                  <div className="wa-privacy-desc">Only users you have active chats/conversations with can see your photo</div>
                </div>
              </div>

              {/* Option 3: Nobody (Show to me only) */}
              <div
                className={`wa-privacy-option-item ${profile.avatarPrivacy === 'nobody' ? 'active' : ''}`}
                onClick={() => handleSavePrivacy('nobody')}
              >
                <div className="wa-privacy-radio-circle">
                  {profile.avatarPrivacy === 'nobody' && <i className="fa-solid fa-check"></i>}
                </div>
                <div className="wa-privacy-option-content">
                  <div className="wa-privacy-title">
                    <i className="fa-solid fa-lock"></i> Nobody (Show to me only)
                  </div>
                  <div className="wa-privacy-desc">Only you can see your photo. Others see a generic default avatar</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. About / Status Section */}
        <div className="wa-profile-card">
          <div className="wa-profile-card-icon">
            <i className="fa-solid fa-circle-info"></i>
          </div>

          <div className="wa-profile-card-content">
            <div className="wa-card-label">About</div>
            {!editingAbout ? (
              <div className="wa-card-value-row">
                <span className="wa-card-value">{profile.about}</span>
                <button
                  type="button"
                  className="wa-card-edit-btn"
                  onClick={() => {
                    setTempAbout(profile.about);
                    setEditingAbout(true);
                  }}
                  title="Edit About"
                >
                  <i className="fa-solid fa-pen"></i>
                </button>
              </div>
            ) : (
              <div className="wa-inline-about-box">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveAbout();
                  }}
                  className="wa-inline-edit-form"
                >
                  <input
                    type="text"
                    className="wa-inline-input"
                    value={tempAbout}
                    onChange={(e) => setTempAbout(e.target.value)}
                    autoFocus
                    required
                  />
                  <div className="wa-inline-actions">
                    <button type="button" className="wa-inline-cancel" onClick={() => setEditingAbout(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="wa-inline-save" disabled={saving || !tempAbout.trim()}>
                      Save
                    </button>
                  </div>
                </form>

                <div className="wa-preset-about-title">Select or choose from presets:</div>
                <div className="wa-preset-about-list">
                  {PRESET_ABOUTS.map((statusText, idx) => (
                    <div
                      key={idx}
                      className={`wa-preset-item ${profile.about === statusText ? 'active' : ''}`}
                      onClick={() => handleSaveAbout(statusText)}
                    >
                      <span>{statusText}</span>
                      {profile.about === statusText && <i className="fa-solid fa-check"></i>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Phone Number Section */}
        <div className="wa-profile-card">
          <div className="wa-profile-card-icon">
            <i className="fa-solid fa-phone"></i>
          </div>

          <div className="wa-profile-card-content">
            <div className="wa-card-label">Phone</div>
            <div className="wa-card-value-row">
              <span className="wa-card-value">{profile.fullPhone || profile.phone || userId}</span>
              <span className="wa-locked-tag"><i className="fa-solid fa-lock"></i> Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Picker & Upload Modal */}
      {showAvatarModal && (
        <div className="wa-modal-overlay" onClick={() => setShowAvatarModal(false)}>
          <div className="wa-avatar-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h3>Profile Photo</h3>
              <button type="button" className="wa-modal-close" onClick={() => setShowAvatarModal(false)}>
                ✕
              </button>
            </div>

            {/* Actions: Upload Photo & Remove Photo */}
            <div className="wa-avatar-modal-actions">
              <button
                type="button"
                className="wa-upload-photo-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fa-solid fa-cloud-arrow-up"></i> Upload Photo from Device
              </button>

              {profile.avatar && (
                <button
                  type="button"
                  className="wa-remove-photo-btn"
                  onClick={() => handleSaveAvatar(null)}
                >
                  <i className="fa-solid fa-trash-can"></i> Remove Photo
                </button>
              )}
            </div>

            <div className="wa-avatar-divider-text">── OR CHOOSE AVATAR ──</div>

            {/* Avatar Emoji Grid */}
            <div className="wa-avatar-grid">
              {PRESET_AVATARS.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`wa-avatar-choice ${profile.avatar === emoji ? 'selected' : ''}`}
                  onClick={() => handleSaveAvatar(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

