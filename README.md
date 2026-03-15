# Autonomous AI Knowledge Worker

A full-stack application leveraging a Next.js frontend and a FastAPI backend to empower users with an autonomous AI knowledge worker. The system automates tasks such as fetching news, tracking stocks, creating dynamic reports, and more.

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4, Framer Motion for animations
- **Backend**: FastAPI (Python), SQLite Database
- **Database**: Local SQLite (`backend/data/app.db`)

## Project Structure

```
├── backend/                  # FastAPI backend server
│   ├── main.py               # Main entry point for backend
│   ├── routes/               # API endpoints (auth, news, stock, search, etc.)
│   ├── utils/                # Utility scripts and helpers
│   ├── db.py                 # SQLite database setup and queries
│   └── scheduler.py          # Background tasks scheduler
│
└── frontend/                 # Next.js frontend application
    ├── app/                  # Next.js App Router
    │   ├── components/       # Reusable React components
    │   ├── page.tsx          # Main dashboard page
    │   └── layout.tsx        # Global layout component
    └── package.json          # Frontend dependencies
```

## Getting Started

### 1. Start the Backend

Make sure you have Python installed.

```bash
cd backend
python -m venv venv
# Activate virtual environment
# On Windows: venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

The backend server will run on `http://127.0.0.1:8000`.

### 2. Start the Frontend

Make sure you have Node.js installed.

```bash
cd frontend
npm install
npm run dev
```

The frontend application will be available at `http://localhost:3000`.

## Default Credentials

The project comes with a default set of login credentials:

- **Username**: `admin`
- **Password**: `1234`

## Features

- **Authentication**: Secure login system.
- **Dynamic Dashboard**: View stock info, search data, and top news.
- **Reporting**: Autogenerate insights and fetch PDF reports.
- **History Tracking**: Keep track of user actions through the database history.
