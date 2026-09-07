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
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=chat_app
PORT=3001
```

### 3. Run Backend & Frontend

**Backend:**
```bash
npm run backend:dev
# Backend runs on http://localhost:3001
```

**Frontend:**
```bash
npm run frontend:dev
# Frontend runs on http://localhost:5173
```
