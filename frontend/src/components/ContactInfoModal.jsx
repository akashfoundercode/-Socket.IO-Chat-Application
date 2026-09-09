import React, { useState } from 'react';
import { chatApi } from '../services/api';
import QRCode from 'qrcode';
import Avatar from './Avatar';

export default function ContactInfoModal({
  recipientProfile,
  recipientId,
  isOnline,
  onlineUsers,
  isBlockedByMe,
  isBlockedByThem,
  onClose,
  onStartCall,
  onBlock,
  onUnblock,
  onRenameContact,
  isGroup = false,
  groupDetails = null,
  currentUserId = '',
  onUpdateGroup,
  onAddGroupMember,
  onUpdateGroupMemberRole,
  onRemoveGroupMember,
  onLeaveGroup
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [groupMemberInput, setGroupMemberInput] = useState('');
  const [groupMemberResults, setGroupMemberResults] = useState([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [groupMessagePermission, setGroupMessagePermission] = useState(groupDetails?.messagePermission || 'everyone');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [groupUpdateMessage, setGroupUpdateMessage] = useState('');
  const [inviteQr, setInviteQr] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const cleanGroupId = String(recipientId || '').replace(/^group:/, '');
  const groupInviteName = String(groupDetails?.name || 'Group').trim();
  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?joinGroup=${encodeURIComponent(cleanGroupId)}&groupName=${encodeURIComponent(groupInviteName)}&via=link`
    : '';
  const qrInviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?joinGroup=${encodeURIComponent(cleanGroupId)}&groupName=${encodeURIComponent(groupInviteName)}&via=qr`
    : '';

  React.useEffect(() => {
    if (!isGroup || !qrInviteLink) return;
    QRCode.toDataURL(qrInviteLink, { width: 220, margin: 2 })
      .then(setInviteQr)
      .catch(() => setInviteQr(''));
  }, [isGroup, qrInviteLink]);

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard?.writeText(inviteLink);
    setGroupUpdateMessage('Invitation link copied');
    window.setTimeout(() => setGroupUpdateMessage(''), 2500);
  };

  const shareInviteLink = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      await navigator.share({ title: `Join ${displayName}`, text: `Join ${displayName} on WhatsApp`, url: inviteLink });
    } else {
      await copyInviteLink();
    }
  };

  const shareInviteQr = async () => {
    if (!inviteQr) return;
    try {
      const blob = await (await fetch(inviteQr)).blob();
      const file = new File([blob], `${groupInviteName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-invite.png`, { type: 'image/png' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Join ${groupInviteName}`, text: inviteLink, files: [file] });
      } else {
        const link = document.createElement('a');
        link.href = inviteQr;
        link.download = file.name;
        link.click();
      }
    } catch (error) {
      setGroupUpdateMessage('Could not share QR code');
      window.setTimeout(() => setGroupUpdateMessage(''), 2500);
    }
  };


  if (!recipientProfile && !recipientId) return null;

  const displayPhone = recipientProfile?.fullPhone || recipientProfile?.phone || recipientId || '';
  const profileName = recipientProfile?.profileName;
  const customName = recipientProfile?.customName;
  const displayName = isGroup ? (groupDetails?.name || 'Group Info') : (customName || profileName || displayPhone || recipientProfile?.name || recipientId || 'Contact Info');
  const isBlocked = isBlockedByMe || isBlockedByThem;
  const avatar = isBlocked ? null : (isGroup ? groupDetails?.avatar : recipientProfile?.avatar);
  const about = isBlocked ? '' : (recipientProfile?.about || 'Hey there! I am using WhatsApp.');
  const groupFileInputRef = React.useRef(null);
  const currentGroupMember = groupDetails?.members?.find((member) => {
    const mId = String(member.userId || '').replace(/\D/g, '');
    const cId = String(currentUserId || '').replace(/\D/g, '');
    const mPhone = String(member.fullPhone || member.phone || '').replace(/\D/g, '');
    return (mId && cId && mId === cId) || (mPhone && cId && mPhone === cId) || String(member.userId) === String(currentUserId);
  });
  const isCreator = groupDetails?.creatorId && (
    String(groupDetails.creatorId) === String(currentUserId) ||
    String(groupDetails.creatorId).replace(/\D/g, '') === String(currentUserId || '').replace(/\D/g, '')
  );
  const isGroupAdmin = isGroup && (currentGroupMember?.role === 'admin' || isCreator || !groupDetails?.members || groupDetails.members.length === 0);
  const isMemberOnline = (member) => {
    const id = String(member.fullPhone || member.userId || '').trim();
    const variants = [id, id.startsWith('+') ? id.slice(1) : `+${id}`, id.replace(/^\+/, '')];
    return variants.some((variant) => onlineUsers?.has(variant));
  };

  const handleStartEdit = () => {
    setNameInput(isGroup ? (groupDetails?.name || '') : (customName || ''));
    setIsEditingName(true);
  };

  const handleSaveName = async (e, isReset = false) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    const finalName = isReset ? '' : nameInput.trim();
    try {
      if (isGroup) {
        if (!finalName || !onUpdateGroup) return;
        await onUpdateGroup(recipientId, { name: finalName });
        setGroupUpdateMessage('Group name updated');
      } else {
        if (!onRenameContact) return;
        await onRenameContact(recipientId, finalName);
      }
      setIsEditingName(false);
      window.setTimeout(() => setGroupUpdateMessage(''), 2500);
    } catch (err) {
      console.error('Failed to save contact name:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGroupAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setIsSavingGroup(true);
      try {
        await onUpdateGroup?.(recipientId, { avatar: String(reader.result || '') });
        setGroupUpdateMessage('Group photo updated');
        window.setTimeout(() => setGroupUpdateMessage(''), 2500);
      } finally {
        setIsSavingGroup(false);
      }
    };
    reader.readAsDataURL(file);
  };

  React.useEffect(() => {
    const query = groupMemberInput.trim();
    if (!isGroupAdmin || !query) {
      setGroupMemberResults([]);
      setIsSearchingMembers(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setIsSearchingMembers(true);
      try {
        const result = await chatApi.searchUsers(query, currentUserId);
        const existingIds = new Set((groupDetails?.members || []).map((member) => String(member.userId)));
        setGroupMemberResults((result?.users || []).filter((user) => !existingIds.has(String(user.id))));
      } catch (error) {
        setGroupMemberResults([]);
      } finally {
        setIsSearchingMembers(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [groupMemberInput, isGroupAdmin, currentUserId, groupDetails?.members]);

  React.useEffect(() => {
    setGroupMessagePermission(groupDetails?.messagePermission || 'everyone');
  }, [groupDetails?.messagePermission]);

  const addGroupMember = async () => {
    if (!groupMemberInput.trim()) return;
    setIsSavingGroup(true);
    try {
      await onAddGroupMember?.(recipientId, groupMemberInput.trim());
      setGroupMemberInput('');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const updateGroupMessagePermission = async (event) => {
    const permission = event.target.value;
    setGroupMessagePermission(permission);
    setIsSavingGroup(true);
    try {
      await onUpdateGroup?.(recipientId, { messagePermission: permission });
      setGroupUpdateMessage(permission === 'admins' ? 'Only admins can message now' : 'Everyone can message now');
      window.setTimeout(() => setGroupUpdateMessage(''), 2500);
    } finally {
      setIsSavingGroup(false);
    }
  };

  return (
    <div className="wa-contact-info-overlay" onClick={onClose}>
      <div className="wa-contact-info-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="wa-contact-info-header">
          <button type="button" className="wa-contact-close-btn" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <h3>{isGroup ? 'Group Info' : 'Contact Info'}</h3>
        </div>

        <div className="wa-contact-info-body">
          {/* Large Avatar Header */}
          <div className="wa-contact-avatar-section">
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                marginBottom: '10px',
                cursor: isGroup && isGroupAdmin ? 'pointer' : 'default'
              }}
              onClick={() => {
                if (isGroup && isGroupAdmin) {
                  groupFileInputRef.current?.click();
                }
              }}
              title={isGroup && isGroupAdmin ? 'Tap to change group photo' : displayName}
            >
              <Avatar
                src={avatar}
                name={displayName}
                isGroup={isGroup}
                size={110}
                style={{
                  border: '3px solid rgba(255,255,255,0.4)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
                }}
              />
              {isGroup && isGroupAdmin && (
                <label
                  className="wa-group-avatar-edit"
                  title="Change group photo"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="fa-solid fa-camera"></i>
                  <input
                    type="file"
                    ref={groupFileInputRef}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleGroupAvatarFile}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>

            {isGroup && isGroupAdmin && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className="wa-group-photo-action-btn"
                  onClick={() => groupFileInputRef.current?.click()}
                  title="Upload group photo"
                >
                  <i className="fa-solid fa-camera"></i> {avatar ? 'Change Photo' : 'Upload Photo'}
                </button>
                {avatar && (
                  <button
                    type="button"
                    className="wa-group-photo-action-btn remove"
                    onClick={async () => {
                      setIsSavingGroup(true);
                      try {
                        await onUpdateGroup?.(recipientId, { avatar: '' });
                        setGroupUpdateMessage('Group photo removed');
                        window.setTimeout(() => setGroupUpdateMessage(''), 2500);
                      } finally {
                        setIsSavingGroup(false);
                      }
                    }}
                    title="Remove group photo"
                  >
                    <i className="fa-solid fa-trash-can"></i> Remove
                  </button>
                )}
              </div>
            )}

            {/* Contact Name & Inline Edit */}
            {isEditingName ? (
              <form onSubmit={(e) => handleSaveName(e, false)} style={{ width: '100%', maxWidth: '280px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="e.g. Akash Boss (Private Nickname)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #f97316',
                    fontSize: '14px',
                    marginBottom: '8px',
                    outline: 'none',
                    textAlign: 'center'
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="wa-delete-cancel-btn"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setIsEditingName(false)}
                  >
                    Cancel
                  </button>
                  {customName && (
                    <button
                      type="button"
                      className="wa-delete-cancel-btn"
                      style={{ padding: '6px 12px', fontSize: '12px', color: '#dc2626', borderColor: '#fca5a5' }}
                      onClick={(e) => handleSaveName(e, true)}
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="submit"
                    className="wa-auth-green-btn"
                    style={{ padding: '6px 14px', fontSize: '12px', margin: 0 }}
                    disabled={isSaving}
                  >
                    {isSaving ? '...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '6px', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <h2 className="wa-contact-name" style={{ margin: 0 }}>{displayName}</h2>
                  <button
                    type="button"
                    className="wa-contact-edit-pencil"
                    title="Edit contact name (private to you)"
                    onClick={handleStartEdit}
                  >
                    <i className="fa-solid fa-pencil"></i>
                  </button>
                </div>

                {customName ? (
                  <div className="wa-contact-phone-sub">
                    {displayPhone}
                    {profileName && profileName !== displayPhone && (
                      <span style={{ color: '#f97316', marginLeft: '6px' }}>• ~{profileName}</span>
                    )}
                  </div>
                ) : profileName && profileName !== displayPhone ? (
                  <div className="wa-contact-phone-sub" style={{ color: '#f97316', fontWeight: '500' }}>
                    ~{profileName}
                  </div>
                ) : null}
              </div>
            )}

            {!isGroup && (
              <div className="wa-contact-status-badge">
                <span className={`status-dot ${isOnline && !isBlocked ? 'online' : 'offline'}`}></span>
                <span>{isBlocked ? 'Offline' : isOnline ? 'Online' : 'Offline'}</span>
              </div>
            )}

            {/* Quick Action Buttons */}
            {!isBlocked && (
              <div className="wa-contact-quick-actions">
                <button
                  type="button"
                  className="wa-contact-action-btn"
                  onClick={() => {
                    onClose();
                    onStartCall && onStartCall('voice');
                  }}
                >
                  <i className="fa-solid fa-phone"></i>
                  <span>Audio</span>
                </button>
                <button
                  type="button"
                  className="wa-contact-action-btn"
                  onClick={() => {
                    onClose();
                    onStartCall && onStartCall('video');
                  }}
                >
                  <i className="fa-solid fa-video"></i>
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  className="wa-contact-action-btn"
                  onClick={onClose}
                >
                  <i className="fa-solid fa-message"></i>
                  <span>Message</span>
                </button>
              </div>
            )}
          </div>

          {groupUpdateMessage && (
            <div className="wa-group-update-toast">
              <i className="fa-solid fa-circle-check"></i>
              <span>{groupUpdateMessage}</span>
            </div>
          )}

          {isGroup ? (
            <div className="wa-group-info-content">
              <div className="wa-group-info-summary">
                <span>{groupDetails?.memberCount || groupDetails?.members?.length || 0} members</span>
                <span>{groupDetails?.messagePermission === 'admins' ? 'Admins can message' : 'All members can message'}</span>
              </div>

              <div className="wa-group-invite-card">
                <div className="wa-group-info-section-title">Invite to group</div>
                {inviteQr && <img src={inviteQr} alt="Group invitation QR code" className="wa-group-invite-qr" />}
                <div className="wa-group-invite-link">{inviteLink}</div>
                <div className="wa-group-invite-actions">
                  <button type="button" className="wa-group-invite-btn" onClick={copyInviteLink}>
                    <i className="fa-regular fa-copy"></i> Copy link
                  </button>
                  <button type="button" className="wa-group-invite-btn" onClick={shareInviteLink}>
                    <i className="fa-solid fa-share-nodes"></i> Share
                  </button>
                  <button type="button" className="wa-group-invite-btn" onClick={shareInviteQr}>
                    <i className="fa-solid fa-qrcode"></i> Share QR
                  </button>
                </div>
              </div>

              <div className="wa-group-message-permission">
                <div>
                  <strong>Who can send messages?</strong>
                  <small>{groupDetails?.messagePermission === 'admins' ? 'Only admins can send messages' : 'All group members can send messages'}</small>
                </div>
                {isGroupAdmin ? (
                  <select value={groupMessagePermission} onChange={updateGroupMessagePermission} disabled={isSavingGroup}>
                    <option value="everyone">Everyone</option>
                    <option value="admins">Only admins</option>
                  </select>
                ) : (
                  <span className="wa-group-permission-readonly">
                    {groupDetails?.messagePermission === 'admins' ? 'Admins only' : 'Everyone'}
                  </span>
                )}
              </div>

              {isGroupAdmin && (
                <div className="wa-group-info-section">
                  <div className="wa-group-info-section-title">Add member</div>
                  <div className="wa-group-add-member-row">
                    <input value={groupMemberInput} onChange={(event) => setGroupMemberInput(event.target.value)} placeholder="Search name or contact number" />
                  </div>
                  {groupMemberInput.trim() && (
                    <div className="wa-group-contact-results">
                      {isSearchingMembers ? (
                        <div className="wa-group-contact-state">Searching contacts...</div>
                      ) : groupMemberResults.length > 0 ? (
                        groupMemberResults.map((user) => (
                          <button
                            type="button"
                            className="wa-group-contact-result"
                            key={user.id}
                            disabled={isSavingGroup}
                            onClick={async () => {
                              setIsSavingGroup(true);
                              try {
                                await onAddGroupMember?.(recipientId, user.fullPhone || user.phone || user.id);
                                setGroupMemberInput('');
                                setGroupMemberResults([]);
                              } finally {
                                setIsSavingGroup(false);
                              }
                            }}
                          >
                            <span className="wa-group-contact-avatar">
                              {user.avatar ? <img src={user.avatar} alt="" /> : <i className="fa-solid fa-user"></i>}
                            </span>
                            <span className="wa-group-contact-copy">
                              <strong>{user.name || user.fullPhone || user.phone}</strong>
                              <small>{user.fullPhone || user.phone}</small>
                            </span>
                            <i className="fa-solid fa-plus"></i>
                          </button>
                        ))
                      ) : (
                        <div className="wa-group-contact-state">No matching contact found</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="wa-group-info-section">
                <div className="wa-group-info-section-title">Members</div>
                {groupDetails?.members?.map((member) => (
                  <div className="wa-group-info-member" key={member.userId}>
                    <div className="wa-group-info-member-main">
                      <Avatar
                        src={member.avatar}
                        name={member.name || member.fullPhone || member.userId}
                        size={40}
                        showOnline={false}
                      />
                      <div>
                        <strong className="wa-group-member-name-line">
                          {member.name || member.fullPhone || member.userId}
                          {isMemberOnline(member) && <span className="wa-group-online-dot" title="Online"></span>}
                        </strong>
                        <small className="wa-group-member-meta">
                          <span>{member.fullPhone || member.userId}</span>
                          <span className={isMemberOnline(member) ? 'wa-group-member-online-text' : 'wa-group-member-offline-text'}>
                            {isMemberOnline(member) ? 'Online' : 'Offline'}
                          </span>
                          <span>{member.role === 'admin' ? 'Admin' : 'Member'}</span>
                        </small>
                      </div>
                    </div>
                    {isGroupAdmin &&
                      String(member.userId).replace(/^\+/, '') !== String(currentUserId).replace(/^\+/, '') &&
                      String(member.userId).replace(/^\+/, '') !== String(groupDetails?.creatorId || '').replace(/^\+/, '') && (
                        <div className="wa-group-member-action-btns" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="wa-group-role-btn"
                            onClick={() => {
                              const nextRole = member.role === 'admin' ? 'member' : 'admin';
                              const isMake = nextRole === 'admin';
                              const memberDisplayName = member.name || member.fullPhone || member.userId;
                              setConfirmDialog({
                                title: isMake ? `Make ${memberDisplayName} admin?` : `Dismiss ${memberDisplayName} as admin?`,
                                message: isMake
                                  ? `This member will be able to edit group info, add or remove members.`
                                  : `This member will no longer have admin rights.`,
                                confirmText: isMake ? 'Make admin' : 'Dismiss admin',
                                confirmColor: isMake ? '#00a884' : '#ea4335',
                                onConfirm: async () => {
                                  setConfirmDialog(null);
                                  await onUpdateGroupMemberRole?.(recipientId, member.userId, nextRole);
                                }
                              });
                            }}
                          >
                            {member.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          </button>
                          <button
                            type="button"
                            className="wa-group-remove-btn"
                            onClick={() => {
                              const memberDisplayName = member.name || member.fullPhone || member.userId;
                              setConfirmDialog({
                                title: `Remove ${memberDisplayName}?`,
                                message: `Remove ${memberDisplayName} from "${displayName}"? They will no longer be able to send or view messages.`,
                                confirmText: 'Remove',
                                confirmColor: '#ea4335',
                                onConfirm: async () => {
                                  setConfirmDialog(null);
                                  await onRemoveGroupMember?.(recipientId, member.userId);
                                }
                              });
                            }}
                            title="Remove member"
                          >
                            <i className="fa-solid fa-user-xmark"></i> Remove
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Exit / Leave Group Section */}
              <div className="wa-contact-card danger-card" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="wa-contact-danger-btn block-btn"
                  onClick={() => {
                    setConfirmDialog({
                      title: `Exit "${displayName}" group?`,
                      message: 'You will no longer be able to send or receive messages in this group.',
                      confirmText: 'Exit group',
                      confirmColor: '#ea4335',
                      onConfirm: async () => {
                        setConfirmDialog(null);
                        onClose && onClose();
                        await onLeaveGroup?.(recipientId);
                      }
                    });
                  }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket"></i>
                  <span>Exit group</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Custom Contact Name Note Card */}
              <div className="wa-contact-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="wa-card-label">Private Contact Name</div>
                  <div className="wa-card-value">{customName || <span style={{ color: '#8696a0', fontStyle: 'italic' }}>Not set (Tap edit to give a nickname)</span>}</div>
                  {profileName && profileName !== displayPhone && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                      User's WhatsApp Profile Name: <strong>~{profileName}</strong>
                    </div>
                  )}
                </div>
                {!isEditingName && (
                  <button
                    type="button"
                    className="wa-contact-card-edit-btn"
                    onClick={handleStartEdit}
                    title="Edit name"
                  >
                    <i className="fa-solid fa-pencil"></i> {customName ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>

              {/* About / Bio Card */}
              {about && (
                <div className="wa-contact-card">
                  <div className="wa-card-label">About</div>
                  <div className="wa-card-value about-text">{about}</div>
                </div>
              )}

              {/* Phone Number Card */}
              <div className="wa-contact-card">
                <div className="wa-card-label">Mobile Number</div>
                <div className="wa-card-value phone-val">
                  <span>{displayPhone}</span>
                  <span className="wa-badge-verified">Verified User</span>
                </div>
              </div>

              {/* Security & Encryption Card */}
              <div className="wa-contact-card encryption-card">
                <div className="wa-enc-left">
                  <i className="fa-solid fa-lock"></i>
                  <div>
                    <div className="wa-enc-title">Encryption</div>
                    <div className="wa-enc-desc">Messages and calls are end-to-end encrypted. Tap to verify.</div>
                  </div>
                </div>
              </div>

              {/* Block / Unblock Action Card */}
              <div className="wa-contact-card danger-card">
                {isBlockedByMe ? (
                  <button
                    type="button"
                    className="wa-contact-danger-btn unblock-btn"
                    onClick={() => {
                      setConfirmDialog({
                        title: `Unblock ${displayName}?`,
                        message: 'This contact will be able to send you messages and call you.',
                        confirmText: 'Unblock',
                        confirmColor: '#00a884',
                        onConfirm: async () => {
                          setConfirmDialog(null);
                          onUnblock && onUnblock(recipientId);
                        }
                      });
                    }}
                  >
                    <i className="fa-solid fa-unlock"></i>
                    <span>Unblock {displayName}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wa-contact-danger-btn block-btn"
                    onClick={() => {
                      setConfirmDialog({
                        title: `Block ${displayName}?`,
                        message: 'Blocked contacts will no longer be able to call you or send you messages.',
                        confirmText: 'Block',
                        confirmColor: '#ea4335',
                        onConfirm: async () => {
                          setConfirmDialog(null);
                          onBlock && onBlock(recipientId);
                        }
                      });
                    }}
                  >
                    <i className="fa-solid fa-ban"></i>
                    <span>Block {displayName}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Professional In-App Confirmation Modal */}
      {confirmDialog && (
        <div className="wa-confirm-dialog-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="wa-confirm-dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="wa-confirm-dialog-title">{confirmDialog.title}</h3>
            {confirmDialog.message && (
              <p className="wa-confirm-dialog-desc">{confirmDialog.message}</p>
            )}
            <div className="wa-confirm-dialog-actions">
              <button
                type="button"
                className="wa-confirm-dialog-btn cancel"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wa-confirm-dialog-btn confirm"
                style={{ backgroundColor: confirmDialog.confirmColor || '#ea4335' }}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
