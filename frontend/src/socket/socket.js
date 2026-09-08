import { io } from 'socket.io-client';

const getSocketUrl = () => {
  const productionBackendUrl = 'https://whatsapp.siberiancrane.tech';
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.port === '5173')) {
    return window.location.origin;
  }
  return productionBackendUrl;
};

export const socket = io(getSocketUrl(), {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  secure: false,
  rejectUnauthorized: false
});

// Auto re-join on reconnect using saved session
socket.on('connect', () => {
  try {
    const saved = localStorage.getItem('wa_session');
    if (saved) {
      const user = JSON.parse(saved);
      const userId = user?.fullPhone || user?.id;
      if (userId) socket.emit('join', userId);
    }
  } catch { }
});
