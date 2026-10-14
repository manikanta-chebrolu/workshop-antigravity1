# 🌌 Nexus AI Studio

<div align="center">

![Nexus AI Banner](frontend/assets/avatar.jpg)

### **Next-Generation Intelligent AI Studio**
*A decoupled, high-performance conversational AI application powered by Google Gemini and Supabase PostgreSQL.*

[![Node.js Version](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
- [Environment Configuration](#-environment-configuration)
- [Database Setup & Migrations](#-database-setup--migrations)
- [API Reference](#-api-reference)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🌟 Overview

**Nexus AI Studio** is a modern, responsive conversational workspace designed with a decoupled architecture. Built without bulky web frameworks, the backend leverages a pure, zero-dependency Node.js HTTP server supporting native **Server-Sent Events (SSE)** streaming, direct **Google Gemini API** integration, and automated persistence with **Supabase PostgreSQL**.

---

## ✨ Key Features

- **⚡ Zero-Dependency Backend**: Express-free, ultra-lightweight Node.js native HTTP server with low latency and minimal memory overhead.
- **🧠 Google Gemini SSE Streaming**: Real-time token streaming with fallback support and custom model selection (`gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0`).
- **🎭 AI Expert Personas**: Switch seamlessly between specialized prompt personas:
  - 🌐 **Nexus Core**: Versatile general intelligence
  - 💻 **CodeMaster Pro**: Senior software architect & developer
  - 🔬 **Research Scholar**: Academic analysis & literature synthesizer
  - 🎨 **Creative Visionary**: Concept designer & storyteller
  - 📈 **Growth Strategist**: Venture builder & product strategist
- **🗄️ Supabase PostgreSQL Cloud Persistence**: Automated multi-session sync, full chat history, message tracking, and Row Level Security (RLS).
- **🎙️ Voice Integration**:
  - **Speech-to-Text**: Hands-free voice dictation via Web Speech API.
  - **Text-to-Speech**: Natural audio readout of model responses with customizable voice controls.
- **🎨 Glassmorphic Ambient UI**:
  - Interactive background particle canvas.
  - Sleek dark theme with curated color tokens.
  - Syntax-highlighted code blocks with 1-click clipboard copy.
  - Full Markdown rendering (tables, blockquotes, lists, links).
- **🛡️ Security & Privacy First**:
  - Environment variable separation (`backend/.env` vs `frontend/.env`).
  - Sensitive API keys remain server-side and are never exposed to browser clients.
  - Path traversal safeguards and forbidden `.env` browser downloads.

---

## 🏗️ Architecture & Tech Stack

```mermaid
graph TD
    Client["🖥️ Frontend (Vanilla JS + CSS Glassmorphism)"]
    Server["⚡ Node.js HTTP Server (:3000)"]
    Gemini["🧠 Google Gemini API (SSE Stream)"]
    Supabase["🗄️ Supabase PostgreSQL (Chats & Messages)"]

    Client -->|"POST /api/chat (SSE)"| Server
    Server -->|"Stream Tokens"| Gemini
    Gemini -->|"Chunks"| Server
    Server -->|"Server-Sent Events"| Client
    Server <-->|"Sync & Query"| Supabase
    Client -->|"GET /api/database/*"| Server
```

### Technology Highlights
- **Frontend**: HTML5, Vanilla JavaScript (ES Modules), Custom CSS Glassmorphism, Web Speech API, HTML5 Canvas.
- **Backend**: Native Node.js HTTP, HTTPS, URL, FS modules.
- **Database**: PostgreSQL hosted on Supabase (`@supabase/supabase-js`, `pg`).
- **AI**: Google Generative Language API (Gemini REST & SSE).

---

## 📂 Project Structure

```text
workshop anti gravity/
├── backend/
│   ├── routes/
│   │   ├── chat.js            # Gemini SSE streaming handler & persona prompts
│   │   └── database.js        # Supabase synchronization & status endpoints
│   ├── scripts/
│   │   └── migrate.js         # Automated Supabase PostgreSQL migration script
│   ├── services/
│   │   └── supabase.js        # Supabase JS client & database helper methods
│   ├── config.js              # Environment variable parser & security sanitizer
│   ├── package.json           # Backend dependencies (@supabase/supabase-js, pg)
│   ├── server.js              # Main Node.js HTTP server & static file host
│   ├── supabase_schema.sql    # Reference SQL schema
│   └── .env.example           # Backend environment template
├── frontend/
│   ├── assets/
│   │   └── avatar.jpg         # Nexus AI avatar & brand asset
│   ├── js/
│   │   ├── api.js             # API client & SSE stream processor
│   │   ├── app.js             # Core UI state machine & event handling
│   │   ├── audio.js           # Speech synthesis & recognition engine
│   │   └── markdown.js        # Custom Markdown parser & syntax highlighter
│   ├── index.css              # Glassmorphic design system & animations
│   ├── index.html             # Application markup & UI layout
│   └── .env.example           # Public frontend environment template
├── supabase/
│   └── migrations/
│       └── 20261014000000_create_nexus_tables.sql # Production idempotent DB migration
├── .env.example               # Root environment reference
├── .gitignore                 # Excludes .env, node_modules, and cache
├── package.json               # Project metadata & npm run dev scripts
└── README.md                  # Project documentation
```

---

## 📋 Prerequisites

Before running the application, make sure you have:

1. **[Node.js](https://nodejs.org/)** (v18.0.0 or higher recommended)
2. **[Google Gemini API Key](https://aistudio.google.com/)**
3. **[Supabase Project](https://supabase.com/)** (Free or Pro tier)

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone <YOUR_REPOSITORY_URL>
cd "workshop anti gravity"

# Install root & backend dependencies
npm install
```

### 2. Configure Environment Variables

Create your local `.env` files from the provided templates:

#### A. Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:

```ini
PORT=3000
NODE_ENV=development

# 🟢 Supabase Configuration (Dashboard -> Project Settings -> API)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-role-key

# 🔌 Supabase Direct Postgres Connection (for migrations)
# Found in Supabase -> Project Settings -> Database -> Connection string (URI)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# 🧠 Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
```

#### B. Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:

```ini
APP_NAME="Nexus AI"
APP_ENV=development
API_BASE_URL=http://localhost:3000
DEFAULT_PERSONA=core
```

---

## 🗄️ Database Setup & Migrations

The database migration sets up the `chats` and `messages` tables, triggers for automated timestamps, performance indexes, and Row Level Security (RLS) policies.

Choose **either** method below:

### Option A: One-Command CLI Migration (Recommended)

Ensure `DATABASE_URL` is set in `backend/.env`, then run:

```bash
npm run db:migrate
```

Or pass your connection string directly:

```bash
node backend/scripts/migrate.js "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

### Option B: Supabase Dashboard SQL Editor

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** -> **New query**.
3. Copy the contents of [`supabase/migrations/20261014000000_create_nexus_tables.sql`](file:///supabase/migrations/20261014000000_create_nexus_tables.sql).
4. Click **Run**.

---

## 💻 Running the Application

Start the local server:

```bash
npm run dev
# or
npm start
```

Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chat` | Streams Gemini AI responses using Server-Sent Events (SSE). |
| `GET` | `/api/health` | Returns backend operational health & database connection state. |
| `GET` | `/api/config` | Exposes sanitized, safe public settings to the frontend. |
| `GET` | `/api/database/status` | Returns Supabase connectivity information. |
| `POST` | `/api/database/test` | Verifies live Supabase credentials and database read/write. |
| `GET` | `/api/database/chats` | Retrieves all saved conversations. |
| `POST` | `/api/database/chats` | Saves or updates a chat conversation. |
| `DELETE` | `/api/database/chats/:id` | Deletes a conversation and cascades message cleanup. |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Enter</kbd> | Send message |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Insert new line in message prompt |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Start a new chat |
| <kbd>Esc</kbd> | Close open modals or menus |

---

## 🛠️ Troubleshooting

### Port 3000 Already in Use (`EADDRINUSE`)
If port 3000 is occupied by another application, either terminate the process or specify a different port in `backend/.env`:
```ini
PORT=3001
```

### Supabase Connection Shows "Not Configured"
- Verify that `SUPABASE_URL` and `SUPABASE_KEY` are defined in `backend/.env`.
- Ensure there are no surrounding spaces or trailing slashes in the URL.
- Restart the server with `npm run dev`.

### Gemini API Returns 400 or 403
- Ensure your `GEMINI_API_KEY` is valid and active in [Google AI Studio](https://aistudio.google.com/).
- Check your network connectivity and regional Gemini availability.

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it for personal or commercial projects.
