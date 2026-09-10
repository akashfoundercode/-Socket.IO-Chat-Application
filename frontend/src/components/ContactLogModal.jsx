import React, { useState, useEffect, useRef } from 'react';
import { chatApi } from '../services/api';
import Avatar from './Avatar';

const COUNTRY_OPTIONS = [
  { code: '+91', name: 'India', flag: '🇮🇳', digits: 10 },
  { code: '+1', name: 'USA/Canada', flag: '🇺🇸', digits: 10 },
  { code: '+44', name: 'UK', flag: '🇬🇧', digits: 10 },
  { code: '+971', name: 'UAE', flag: '🇦🇪', digits: 9 },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', digits: 9 },
  { code: '+61', name: 'Australia', flag: '🇦🇺', digits: 9 },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', digits: 10 },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', digits: 10 },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', digits: 10 },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', digits: 8 },
];

export default function ContactLogModal({
  isOpen,
  onClose,
  userId,
  currentUser,
  onlineUsers = [],
  onSelectChat,
  onStartCall,
  theme = 'orange'
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Contact Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Rename/Edit Contact State
  const [editingContact, setEditingContact] = useState(null);
  const [editNameInput, setEditNameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Deleting Contact State
  const [deletingId, setDeletingId] = useState(null);

  const searchInputRef = useRef(null);

  const loadContacts = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await chatApi.getContacts(userId);
      if (data?.success && Array.isArray(data.contacts)) {
        setContacts(data.contacts);
      }
    } catch (err) {
      console.error('Failed to load contacts log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      setShowAddForm(false);
      setEditingContact(null);
      setFormError('');
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const isUserOnline = (contactId, fullPhone, phone) => {
    if (!Array.isArray(onlineUsers) && !(onlineUsers instanceof Set)) return false;
    const candidates = [contactId, fullPhone, phone].filter(Boolean);
    if (onlineUsers instanceof Set) {
      return candidates.some((c) => onlineUsers.has(c));
    }
    return candidates.some((c) => onlineUsers.includes(c));
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanDigits = newPhone.replace(/\D/g, '');
    if (!cleanDigits) {
      setFormError('Phone number is required');
      return;
    }

    if (selectedCountry.digits && cleanDigits.length !== selectedCountry.digits) {
      setFormError(`Please enter ${selectedCountry.digits} digits for ${selectedCountry.name}`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await chatApi.addContact(
        selectedCountry.code,
        cleanDigits,
        newName.trim(),
        userId
      );

      if (res?.success) {
        setNewPhone('');
        setNewName('');
        setShowAddForm(false);
        await loadContacts();
      } else {
        setFormError(res?.message || 'Failed to save contact');
      }
    } catch (err) {
      setFormError(err.message || 'Error saving contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartRename = (contact) => {
    setEditingContact(contact);
    setEditNameInput(contact.customName || contact.name || '');
  };

  const handleConfirmRename = async (e) => {
    e.preventDefault();
    if (!editingContact) return;
    setIsRenaming(true);
    try {
      const targetId = editingContact.fullPhone || editingContact.id;
      await chatApi.renameContact(userId, targetId, editNameInput.trim());
      setEditingContact(null);
      await loadContacts();
    } catch (err) {
      alert(err.message || 'Failed to rename contact');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteContact = async (contact) => {
    const targetId = contact.fullPhone || contact.id;
    const displayName = contact.customName || contact.name || targetId;
    if (!window.confirm(`Delete "${displayName}" from your saved contacts?`)) return;

    setDeletingId(targetId);
    try {
      await chatApi.deleteContact(targetId, userId);
      setContacts((prev) => prev.filter((c) => (c.fullPhone || c.id) !== targetId));
    } catch (err) {
      alert(err.message || 'Failed to delete contact');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenChat = (contact) => {
    const targetId = contact.fullPhone || contact.id;
    onClose();
    if (onSelectChat) {
      onSelectChat(targetId);
    }
  };

  const handleCall = (contact, type = 'voice') => {
    const targetId = contact.fullPhone || contact.id;
    onClose();
    if (onStartCall) {
      onStartCall(targetId, type);
    }
  };

  // Filter contacts by search query
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (c.customName || c.name || '').toLowerCase();
    const profile = (c.profileName || '').toLowerCase();
    const phone = (c.fullPhone || c.phone || c.id || '').toLowerCase();
    const about = (c.about || '').toLowerCase();
    return name.includes(q) || profile.includes(q) || phone.includes(q) || about.includes(q);
  });

  return (
    <div className="wa-contact-log-overlay" onClick={onClose}>
      <div className="wa-contact-log-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="wa-contact-log-header">
          <div className="wa-contact-log-header-left">
            <div className="wa-contact-log-header-icon">
              <i className="fa-solid fa-address-book"></i>
            </div>
            <div>
              <h3>Contacts Log</h3>
              <p className="wa-contact-log-sub">
                {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'} saved
              </p>
            </div>
          </div>

          <div className="wa-contact-log-header-actions">
            <button
              type="button"
              className={`wa-contact-log-action-btn ${showAddForm ? 'active' : ''}`}
              title="Add New Contact"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setFormError('');
              }}
            >
              <i className={`fa-solid ${showAddForm ? 'fa-minus' : 'fa-user-plus'}`}></i>
              <span>{showAddForm ? 'Close Form' : 'New Contact'}</span>
            </button>

            <button
              type="button"
              className="wa-contact-log-close-btn"
              title="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Add Contact Card Accordion */}
        {showAddForm && (
          <form className="wa-contact-log-add-card" onSubmit={handleSaveContact}>
            <div className="wa-contact-log-add-title">
              <i className="fa-solid fa-user-plus"></i> Save New Contact
            </div>

            {formError && (
              <div className="wa-contact-log-error">
                <i className="fa-solid fa-triangle-exclamation"></i> {formError}
              </div>
            )}

            <div className="wa-contact-log-form-row">
              <div className="wa-contact-log-country-select-wrap">
                <select
                  value={selectedCountry.code}
                  onChange={(e) => {
                    const c = COUNTRY_OPTIONS.find((opt) => opt.code === e.target.value);
                    if (c) setSelectedCountry(c);
                  }}
                  className="wa-contact-log-select"
                >
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code} ({country.name})
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="tel"
                className="wa-contact-log-input"
                placeholder={`${selectedCountry.digits} digits mobile number`}
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                autoFocus
              />
            </div>

            <div className="wa-contact-log-form-row" style={{ marginTop: '10px' }}>
              <input
                type="text"
                className="wa-contact-log-input"
                placeholder="Contact Name (e.g. Rahul Sharma)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="wa-contact-log-form-actions">
              <button
                type="button"
                className="wa-contact-log-btn-cancel"
                onClick={() => setShowAddForm(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="wa-contact-log-btn-save"
                disabled={isSaving || !newPhone.trim()}
              >
                {isSaving ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i> Saving...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i> Save Contact
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Search Bar */}
        <div className="wa-contact-log-search-wrap">
          <div className="wa-contact-log-search-box">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search saved contacts by name, number, or bio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="wa-search-clear"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Contacts List Body */}
        <div className="wa-contact-log-body">
          {loading ? (
            <div className="wa-contact-log-center-msg">
              <i className="fa-solid fa-circle-notch fa-spin"></i>
              <span>Loading your contacts...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="wa-contact-log-empty-state">
              <div className="wa-contact-log-empty-icon">
                <i className="fa-regular fa-address-book"></i>
              </div>
              <h4>{searchQuery ? 'No matching contacts found' : 'No contacts saved yet'}</h4>
              <p>
                {searchQuery
                  ? 'Try searching with another name or phone number.'
                  : 'Tap "+ New Contact" to save numbers and chat instantly.'}
              </p>
              {!searchQuery && !showAddForm && (
                <button
                  type="button"
                  className="wa-contact-log-empty-btn"
                  onClick={() => setShowAddForm(true)}
                >
                  <i className="fa-solid fa-user-plus"></i> Add Your First Contact
                </button>
              )}
            </div>
          ) : (
            <div className="wa-contact-log-list">
              {filteredContacts.map((contact) => {
                const targetId = contact.fullPhone || contact.id;
                const online = isUserOnline(contact.id, contact.fullPhone, contact.phone);
                const isEditing = editingContact?.id === contact.id;

                return (
                  <div key={contact.id} className="wa-contact-card">
                    {/* Avatar with Online Dot */}
                    <div className="wa-contact-avatar-wrap" onClick={() => handleOpenChat(contact)}>
                      <Avatar
                        src={contact.avatar}
                        name={contact.customName || contact.name || targetId}
                        size={48}
                      />
                      {online && <span className="wa-contact-online-badge" title="Online"></span>}
                    </div>

                    {/* Info */}
                    <div className="wa-contact-info" onClick={() => handleOpenChat(contact)}>
                      {isEditing ? (
                        <form
                          className="wa-contact-rename-inline"
                          onSubmit={handleConfirmRename}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            className="wa-contact-rename-input"
                            value={editNameInput}
                            onChange={(e) => setEditNameInput(e.target.value)}
                            placeholder="Enter name"
                            autoFocus
                          />
                          <button type="submit" className="wa-contact-rename-ok" disabled={isRenaming}>
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            type="button"
                            className="wa-contact-rename-cancel"
                            onClick={() => setEditingContact(null)}
                          >
                            ✕
                          </button>
                        </form>
                      ) : (
                        <div className="wa-contact-name-row">
                          <span className="wa-contact-name">
                            {contact.customName || contact.name || targetId}
                          </span>
                          {contact.customName && contact.profileName && (
                            <span className="wa-contact-profile-tag" title="Profile Name">
                              ~{contact.profileName}
                            </span>
                          )}
                          {contact.isSaved && (
                            <span className="wa-contact-saved-pill" title="Saved in Contacts">
                              <i className="fa-solid fa-bookmark"></i>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="wa-contact-phone-row">
                        <span className="wa-contact-phone">{contact.fullPhone || contact.id}</span>
                        {online ? (
                          <span className="wa-contact-status-online">Online</span>
                        ) : contact.lastSeen ? (
                          <span className="wa-contact-status-offline">
                            Last seen {new Date(contact.lastSeen).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        ) : null}
                      </div>

                      {contact.about && (
                        <div className="wa-contact-about-snippet">
                          <i className="fa-solid fa-quote-left"></i> {contact.about}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="wa-contact-actions">
                      <button
                        type="button"
                        className="wa-contact-btn-action chat"
                        title="Chat"
                        onClick={() => handleOpenChat(contact)}
                      >
                        <i className="fa-solid fa-message"></i>
                      </button>

                      <button
                        type="button"
                        className="wa-contact-btn-action voice"
                        title="Voice Call"
                        onClick={() => handleCall(contact, 'voice')}
                      >
                        <i className="fa-solid fa-phone"></i>
                      </button>

                      <button
                        type="button"
                        className="wa-contact-btn-action video"
                        title="Video Call"
                        onClick={() => handleCall(contact, 'video')}
                      >
                        <i className="fa-solid fa-video"></i>
                      </button>

                      <button
                        type="button"
                        className="wa-contact-btn-action edit"
                        title="Edit Name"
                        onClick={() => handleStartRename(contact)}
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>

                      <button
                        type="button"
                        className="wa-contact-btn-action delete"
                        title="Delete Contact"
                        disabled={deletingId === targetId}
                        onClick={() => handleDeleteContact(contact)}
                      >
                        {deletingId === targetId ? (
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                          <i className="fa-solid fa-trash-can"></i>
                        )}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
