import React, { useState } from 'react';
import ContactInfoModal from './ContactInfoModal';

export default function ChatHeader({
  userId,
  recipientId,
  recipientName,
  recipientProfile,
  recipientAvatar,
  recipientAbout,
  isRecipientOnline,
  isConnected,
  isTyping,
  onlineUsers,
  isBlockedByMe,
  isBlockedByThem,
  onStartCall,
  onBack,
  onBlock,
  onUnblock,
  onRenameContact,
  isGroup = false,
  groupDetails = null,
  onUpdateGroup,
  onAddGroupMember,
  onUpdateGroupMemberRole
}) {
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const displayPhone = recipientProfile?.fullPhone || recipientProfile?.phone || recipientId || '';
  const customName = recipientProfile?.customName;
  const profileName = recipientProfile?.profileName;
  const displayName = isGroup
    ? (groupDetails?.name || 'Group chat')
    : (customName || profileName || recipientName || recipientProfile?.name || displayPhone || recipientId || 'Select Chat');
  const showSubtitleProfile = !isGroup && !customName && profileName && profileName !== displayPhone;

  const isBlocked = isBlockedByMe || isBlockedByThem;
  const effectiveAvatar = isBlocked ? null : recipientAvatar;
  const effectiveOnline = isBlocked ? false : isRecipientOnline;
  const currentGroupMember = groupDetails?.members?.find((member) => (
    String(member.userId) === String(userId) ||
    String(member.fullPhone || '').replace(/^\+/, '') === String(userId).replace(/^\+/, '')
  ));
  const isGroupAdmin = isGroup && currentGroupMember?.role === 'admin';
  const groupOnlineCount = isGroup
    ? (groupDetails?.members || []).filter((member) => {
      const id = String(member.fullPhone || member.userId || '').trim();
      const variants = [id, id.startsWith('+') ? id.slice(1) : `+${id}`, id.replace(/^\+/, '')];
      return variants.some((variant) => onlineUsers?.has(variant));
    }).length
    : 0;
  const isSuperAdmin = isGroup && (
    String(groupDetails?.creatorId) === String(userId) ||
    String(groupDetails?.creatorId || '').replace(/^\+/, '') === String(userId).replace(/^\+/, '')
  );

  const statusText = isBlockedByMe
    ? 'Blocked'
    : isBlockedByThem
      ? 'offline'
      : isTyping
        ? 'typing...'
        : !isConnected
          ? 'connecting...'
          : effectiveOnline
            ? 'online'
            : 'offline';

  const handleOpenRename = (e) => {
    if (e) e.stopPropagation();
    setShowMenu(false);
    setCustomNameInput(customName || '');
    setShowRenameModal(true);
  };

  const handleSaveRename = async (e, isReset = false) => {
    if (e) e.preventDefault();
    if (!onRenameContact) return;

    setIsSavingRename(true);
    const finalName = isReset ? '' : customNameInput.trim();
    try {
      await onRenameContact(recipientId, finalName);
      setShowRenameModal(false);
    } catch (err) {
      console.error('Rename error:', err);
    } finally {
      setIsSavingRename(false);
    }
  };

  const openGroupSettings = () => {
    setShowMenu(false);
    setShowContactInfo(true);
  };

  return (
    <>
      <header className="wa-chat-header">
        <div className="wa-chat-header-left">
          <button type="button" className="wa-header-back" onClick={onBack} title="Back">
            <i className="fa-solid fa-arrow-left"></i>
          </button>

          <div
            className="wa-avatar"
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setShowContactInfo(true)}
            title="View Contact Info"
          >
            {isGroup ? (
              groupDetails?.avatar ? <img src={groupDetails.avatar} alt="Group" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <i className="fa-solid fa-users"></i>
            ) : effectiveAvatar ? (
              effectiveAvatar.length <= 4 ? (
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{effectiveAvatar}</span>
              ) : (
                <img
                  src={effectiveAvatar}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              )
            ) : (
              <i className="fa-solid fa-user"></i>
            )}
            {/* Online Green Dot Badge */}
            {!isGroup && effectiveOnline && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#f97316',
                  borderRadius: '50%',
                  border: '2px solid #ffffff'
                }}
                title="Online"
              />
            )}
          </div>

          <div className="wa-chat-title-wrap">
            <div className="wa-chat-name-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                className="wa-chat-name"
                onClick={() => setShowContactInfo(true)}
                title={displayName}
                style={{ cursor: 'pointer' }}
              >
                {displayName}
              </span>
              {!isGroup && <button
                type="button"
                className="wa-header-rename-btn"
                title="Edit contact name (only visible to you)"
                onClick={handleOpenRename}
              >
                <i className="fa-solid fa-pencil"></i>
              </button>}
            </div>
            <div className="wa-chat-status">
              {isGroup ? (
                <span>{groupOnlineCount > 0 ? `${groupOnlineCount} online` : 'offline'}</span>
              ) : customName ? (
                <span style={{ opacity: 0.85, marginRight: '4px' }}>{displayPhone} •</span>
              ) : showSubtitleProfile ? (
                <span style={{ opacity: 0.85, marginRight: '4px' }}>~{profileName} •</span>
              ) : null}
              {!isGroup && <span
                style={{
                  color: isBlockedByMe
                    ? '#f87171'
                    : isTyping && !isBlocked
                      ? '#f97316'
                      : effectiveOnline
                        ? '#dcfce7'
                        : 'rgba(255,255,255,0.75)',
                  fontWeight: isTyping && !isBlocked ? '700' : 'normal',
                  fontStyle: isTyping && !isBlocked ? 'italic' : 'normal',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                {isTyping && !isBlocked ? (
                  <>
                    <span>typing</span>
                    <span className="wa-typing-dots">
                      <span className="dot">.</span>
                      <span className="dot">.</span>
                      <span className="dot">.</span>
                    </span>
                  </>
                ) : (
                  statusText
                )}
              </span>}
            </div>
          </div>
        </div>

        <div className="wa-chat-header-actions">
          {!isBlocked && (
            <>
              <button
                type="button"
                className="wa-action-icon"
                title="Video Call"
                onClick={() => onStartCall && onStartCall('video')}
              >
                <i className="fa-solid fa-video"></i>
              </button>
              <button
                type="button"
                className="wa-action-icon"
                title="Voice Call"
                onClick={() => onStartCall && onStartCall('voice')}
              >
                <i className="fa-solid fa-phone"></i>
              </button>
            </>
          )}

          <div className="wa-menu-anchor" style={{ position: 'relative' }}>
            <button
              type="button"
              className="wa-action-icon"
              title="More Options"
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>

            {showMenu && (
              <div className="wa-dropdown-menu" style={{ right: 0, top: '35px' }}>
                <button
                  type="button"
                  className="wa-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    setShowContactInfo(true);
                  }}
                >
                  <i className="fa-solid fa-user"></i> Contact info
                </button>

                {isGroup ? (
                  <button
                    type="button"
                    className="wa-menu-item"
                    onClick={openGroupSettings}
                  >
                    <i className="fa-solid fa-circle-info"></i> Group info
                  </button>
                ) : <button
                  type="button"
                  className="wa-menu-item"
                  onClick={handleOpenRename}
                >
                  <i className="fa-solid fa-user-pen"></i> Edit contact name
                </button>}

                {!isGroup && (isBlockedByMe ? (
                  <button
                    type="button"
                    className="wa-menu-item"
                    style={{ color: '#f97316' }}
                    onClick={() => {
                      setShowMenu(false);
                      onUnblock && onUnblock(recipientId);
                    }}
                  >
                    <i className="fa-solid fa-unlock"></i> Unblock contact
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wa-menu-item"
                    style={{ color: '#ea4335' }}
                    onClick={() => {
                      setShowMenu(false);
                      if (window.confirm(`Block ${displayName}? Blocked contacts will no longer be able to call you or send you messages.`)) {
                        onBlock && onBlock(recipientId);
                      }
                    }}
                  >
                    <i className="fa-solid fa-ban"></i> Block contact
                  </button>
                ))}

                <button
                  type="button"
                  className="wa-menu-item"
                  onClick={() => {
                    setShowMenu(false);
                    onBack && onBack();
                  }}
                >
                  <i className="fa-solid fa-xmark"></i> Close chat
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Dynamic Recipient Contact Info Modal */}
      {showContactInfo && (
        <ContactInfoModal
          recipientId={recipientId}
          recipientProfile={{
            name: displayName,
            profileName: recipientProfile?.profileName,
            customName: recipientProfile?.customName,
            phone: displayPhone,
            fullPhone: displayPhone,
            avatar: effectiveAvatar,
            about: isBlocked ? '' : recipientAbout
          }}
          isOnline={effectiveOnline}
          isBlockedByMe={isBlockedByMe}
          isBlockedByThem={isBlockedByThem}
          onClose={() => setShowContactInfo(false)}
          onStartCall={onStartCall}
          onBlock={onBlock}
          onUnblock={onUnblock}
          onRenameContact={onRenameContact}
          isGroup={isGroup}
          groupDetails={groupDetails}
          currentUserId={userId}
          onlineUsers={onlineUsers}
          onUpdateGroup={onUpdateGroup}
          onAddGroupMember={onAddGroupMember}
          onUpdateGroupMemberRole={onUpdateGroupMemberRole}
        />
      )}

      {/* Modal: Edit Contact Name (Private per-user alias) */}
      {showRenameModal && (
        <div className="wa-modal-overlay" onClick={() => !isSavingRename && setShowRenameModal(false)}>
          <div className="wa-rename-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header" style={{ marginBottom: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>Edit Contact Name</h3>
              <button
                type="button"
                className="wa-modal-close"
                onClick={() => !isSavingRename && setShowRenameModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="wa-rename-info-pill">
              <i className="fa-solid fa-shield-halved" style={{ color: '#f97316', fontSize: '14px' }}></i>
              <span>This custom name is private and only visible to you on your device.</span>
            </div>

            <form onSubmit={(e) => handleSaveRename(e, false)} className="wa-modal-form" style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Contact Name / Nickname:
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul Manager, Bhai, etc."
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  marginBottom: '16px',
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="wa-delete-cancel-btn"
                  disabled={isSavingRename}
                  onClick={() => setShowRenameModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                {recipientProfile?.customName && (
                  <button
                    type="button"
                    className="wa-delete-cancel-btn"
                    disabled={isSavingRename}
                    onClick={(e) => handleSaveRename(e, true)}
                    title="Reset to default WhatsApp name"
                    style={{ flex: 1, color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    Reset
                  </button>
                )}
                <button
                  type="submit"
                  className="wa-auth-green-btn"
                  disabled={isSavingRename}
                  style={{ flex: 1.4, margin: 0 }}
                >
                  {isSavingRename ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
