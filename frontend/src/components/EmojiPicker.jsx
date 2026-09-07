import React, { useState } from 'react';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹',
      '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
      '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐',
      '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟',
      '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭',
      '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡',
      '🤫', '🫠', '🤥', '😶', '🫥', '😐', '😑', '😬', '🫨', '😮',
      '😯', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴',
      '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿',
      '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures & People',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷',
      '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊',
      '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
      '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '👀', '👁️', '👅', '👄', '💋', '🩸',
      '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓', '👴',
      '👮', '👷', '💂', '🕵️', '👩‍⚕️', '👨‍⚕️', '🧑‍💻', '👨‍💻', '👩‍💻', '🤴', '👸'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊',
      '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉',
      '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
      '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
      '🐙', '🦑', '🦐', '🦞', '🦀', '🐠', '🐟', '🐬', '🐳', '🦈',
      '🐊', '🐅', '🐆', '🦓', '🦍', '🐘', '🦛', '🦏', '🐪', '🦒',
      '🌸', '🌺', '🌻', '🌹', '🌷', '💐', '🌴', '🌲', '🌳', '🍀',
      '🌱', '🌿', '🍃', '🍁', '🍄', '🔥', '⚡', '✨', '🌟', '🌈'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦',
      '🥒', '🌶️', '🌽', '🥕', '🥔', '🥐', '🍞', '🥖', '🥨', '🧀',
      '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟',
      '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🍝', '🍜',
      '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍧', '🍨',
      '🍦', '🍰', '🎂', '🧁', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩',
      '🍪', '☕️', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷'
    ]
  },
  {
    id: 'sports',
    name: 'Activities & Sports',
    icon: '⚽',
    emojis: [
      '⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🏓', '🏸', '🏒', '🏏', '⛳️', '🏹', '🎣', '🥊', '🥋', '🛹',
      '🛼', '🎿', '🏂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🏇', '🧘',
      '🏄', '🏊', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎫',
      '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
      '🎸', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: '🚗',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚',
      '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚂', '🚆',
      '🚇', '✈️', '🛫', '🛬', '🚀', '🛸', '🚁', '⛵️', '🚤', '🛳️',
      '⚓️', '⛽️', '🚦', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏟️', '🎡',
      '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🏕️', '⛺️', '🏠', '🏢'
    ]
  },
  {
    id: 'symbols',
    name: 'Hearts & Symbols',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
      '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '☯️', '💯', '💢',
      '💥', '💫', '💬', '💭', '🗯️', '🔔', '🔕', '📣', '📢', '⚠️',
      '⛔️', '🚫', '✅', '❌', '❓', '❗️', '➕', '➖', '➗', '✖️',
      '💲', '™️', '©️', '®️', '🔒', '🔓', '🔑', '💡', '📌', '🎉'
    ]
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: '🇮🇳',
    emojis: [
      '🇮🇳', '🇺🇸', '🇬🇧', '🇦🇪', '🇸🇦', '🇦🇺', '🇵🇰', '🇧🇩', '🇳🇵', '🇸🇬',
      '🇨🇦', '🇩🇪', '🇫🇷', '🇯🇵', '🇰🇷', '🇧🇷', '🇷🇺', '🇿🇦', '🇨🇳', '🇮🇹',
      '🇪🇸', '🇲🇽', '🇦🇷', '🇳🇿', '🇹🇷', '🇨🇭', '🚩', '🏁', '🎌', '🏴',
      '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️'
    ]
  }
];

export default function EmojiPicker({ onSelectEmoji, onClose }) {
  const [activeTab, setActiveTab] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeTab) || EMOJI_CATEGORIES[0];

  // Filter emojis if searching
  const filteredEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji) => emoji.includes(searchQuery.trim()))
    : currentCategory.emojis;

  return (
    <div className="wa-emoji-picker-container" onClick={(e) => e.stopPropagation()}>
      {/* Search & Header */}
      <div className="wa-emoji-header">
        <div className="wa-emoji-search-box">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="wa-emoji-clear-btn">
              ✕
            </button>
          )}
        </div>
        <button type="button" className="wa-emoji-close-btn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      {/* Category Tabs */}
      {!searchQuery.trim() && (
        <div className="wa-emoji-tabs-bar">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`wa-emoji-tab-btn ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
              title={cat.name}
            >
              <span>{cat.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Category Label */}
      {!searchQuery.trim() && (
        <div className="wa-emoji-category-title">{currentCategory.name}</div>
      )}

      {/* Emoji Grid */}
      <div className="wa-emoji-grid">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            className="wa-emoji-item-btn"
            onClick={() => onSelectEmoji(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
