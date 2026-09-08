# Socket.IO Real-Time Chat Application

This project is separated into a modular **Backend** (Node.js/Express/Socket.IO) and **Frontend** (React.js/Vite in JavaScript).

---

## 📁 Project Structure

```
socket-demo/
├── backend/                  # Node.js + Express + Socket.IO + MySQL
│   ├── src/
│   │   ├── config/database.js
│   │   ├── controllers/chat.controller.js
│   │   ├── models/chat.model.js
│   │   ├── routes/chat.routes.js
│   │   ├── sockets/chat.socket.js
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
│
├── frontend/                 # React.js (Vite + JavaScript/JSX)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatHeader.jsx
│   │   │   ├── JoinModal.jsx
│   │   │   ├── MessageInput.jsx
│   │   │   └── MessageList.jsx
│   │   ├── socket/socket.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── package.json              # Monorepo runner scripts
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
# Install root, backend, and frontend dependencies
npm run install:all
```
*(Or install individually: `cd backend && npm install` and `cd frontend && npm install`)*

### 2. Configure Backend Environment
Create `backend/.env` (from `backend/.env.example`):
```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
# Local MySQL credentials
MYSQL_USER=whatsapp_clone
MYSQL_PASSWORD=whatsapp_clone
MYSQL_DATABASE=whatsapp_clone
PORT=5000
```

### 3. Run Backend & Frontend

**Backend:**
```bash
npm run backend:dev
# Backend runs on http://localhost:5000
```

**Frontend:**
```bash
npm run frontend:dev
# Frontend runs on http://localhost:5173
```

### Production HTTPS

Run the Node backend internally on port `5000` and serve the Vite `frontend/dist` directory through Nginx. The Nginx config at `deploy/nginx/whatsapp.siberiancrane.tech.conf` redirects HTTP to HTTPS and proxies `/api`, `/uploads`, and `/socket.io` to the backend.

Install the TLS certificate with Certbot after DNS points `whatsapp.siberiancrane.tech` to the server:

```bash
sudo certbot certonly --nginx -d whatsapp.siberiancrane.tech
```

Do not commit real certificates, private keys, or production `.env` files.
