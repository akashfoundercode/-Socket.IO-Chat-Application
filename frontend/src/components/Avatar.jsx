import React, { useState, useEffect } from 'react';

export default function Avatar({
  src,
  name = '',
  isGroup = false,
  size = 40,
  className = '',
  style = {},
  showOnline = false,
  isOnline = false,
  onClick
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const rawSrc = String(src || '').trim();
  const isInvalid = !rawSrc ||
    rawSrc === 'null' ||
    rawSrc === 'undefined' ||
    rawSrc.toLowerCase() === 'avatar' ||
    rawSrc.toLowerCase() === 'contact avatar' ||
    rawSrc.toLowerCase() === 'group' ||
    rawSrc.toLowerCase() === 'user';

  const isEmoji = !isInvalid && rawSrc.length <= 4 &&
    !rawSrc.startsWith('/') &&
    !rawSrc.startsWith('http') &&
    !rawSrc.startsWith('data:');

  const numSize = typeof size === 'number' ? size : parseInt(size, 10) || 40;
  const sizeStyle = {
    width: `${numSize}px`,
    height: `${numSize}px`,
    minWidth: `${numSize}px`,
    minHeight: `${numSize}px`,
    borderRadius: '50%'
  };

  const iconFontSize = `${Math.max(14, Math.round(numSize * 0.45))}px`;
  const emojiFontSize = `${Math.max(16, Math.round(numSize * 0.55))}px`;

  return (
    <div
      className={`wa-custom-avatar ${isGroup ? 'group-avatar' : ''} ${className}`}
      style={{ ...sizeStyle, ...style }}
      onClick={onClick}
      title={name || (isGroup ? 'Group' : 'User')}
    >
      {!isInvalid && !hasError ? (
        isEmoji ? (
          <span className="wa-custom-avatar-emoji" style={{ fontSize: emojiFontSize }}>
            {rawSrc}
          </span>
        ) : (
          <img
            src={rawSrc}
            alt=""
            className="wa-custom-avatar-img"
            onError={() => setHasError(true)}
            loading="lazy"
          />
        )
      ) : (
        <div className="wa-custom-avatar-dummy" style={{ fontSize: iconFontSize }}>
          {isGroup ? (
            <i className="fa-solid fa-users" aria-hidden="true"></i>
          ) : (
            <i className="fa-solid fa-user" aria-hidden="true"></i>
          )}
        </div>
      )}

      {showOnline && (
        <span
          className={`wa-custom-avatar-online-dot ${isOnline ? 'online' : 'offline'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

