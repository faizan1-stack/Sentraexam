# Sentraexam - Complete Setup Guide

A comprehensive guide to set up the Sentraexam academic management platform on your local machine.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:

| Software | Version | Download Link |
|----------|---------|---------------|
| **Python** | 3.11+ | [python.org](https://www.python.org/downloads/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

> [!NOTE]
> This guide uses SQLite for local development (no database server required). For production, PostgreSQL is recommended.

---

## 🚀 Quick Start (Local Development)

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Sentraexam.git
cd Sentraexam
```

---

### Step 2: Backend Setup

#### 2.1 Create Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 2.2 Install Python Dependencies

```bash
pip install -r requirements/base.txt
```

#### 2.3 Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with the following values for **local development**:

```env
DEBUG=True
SECRET_KEY=your-secret-key-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1

# Frontend API URL
VITE_API_BASE_URL=http://localhost:8000/api

# SQLite Database (Local Development)
DB_NAME=sentraexam
DB_USER=sentraexam
DB_PASSWORD=sentraexam
DB_HOST=localhost
DB_PORT=5432

# Redis (optional for local dev)
REDIS_URL=redis://localhost:6379/0

# Email (console output for development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=no-reply@sentraexam.local

# Use local settings (SQLite + no Celery)
DJANGO_SETTINGS_MODULE=config.settings.local

# Google Gemini API Key (for AI proctoring gaze analysis - optional)
GEMINI_API_KEY=your-gemini-api-key
```

> [!IMPORTANT]
> For local development without Docker, set `DJANGO_SETTINGS_MODULE=config.settings.local`. This uses SQLite and disables Celery.

#### 2.4 Run Database Migrations

```bash
python manage.py migrate
```

#### 2.5 Create Test Accounts (Optional)

To create sample users for testing:
```bash
python manage.py create_test_accounts
```

This creates the following accounts (password: `Test@123` for all):

| Email | Role |
|-------|------|
| admin@sentraexam.com | Admin |
| hod@sentraexam.com | Head of Department |
| teacher@sentraexam.com | Teacher |
| student@sentraexam.com | Student |

#### 2.6 Create Test Assessments (Optional)

```bash
python manage.py create_test_assessments
```

#### 2.7 Start the Backend Server

```bash
python manage.py runserver
```

The API will be available at: **http://localhost:8000**

API Documentation: **http://localhost:8000/api/docs/**

---

### Step 3: Frontend Setup

Open a **new terminal** and navigate to the frontend directory:

```bash
cd frontend
```

#### 3.1 Install Node Dependencies

```bash
npm install
```

#### 3.2 Configure Frontend Environment

Create `.env` file in the `frontend` directory:
```bash
echo "VITE_API_BASE_URL=http://localhost:8000/api" > .env
```

#### 3.3 Start the Development Server

```bash
npm run dev
```

The frontend will be available at: **http://localhost:5173**

---

## 🔧 Configuration Options

### Settings Modules

| Module | Use Case |
|--------|----------|
| `config.settings.local` | Local dev with SQLite, no Celery |
| `config.settings.dev` | Docker dev with PostgreSQL |
| `config.settings.base` | Production/Base settings |

### Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SECRET_KEY` | Django secret key | ✅ Yes |
| `DEBUG` | Enable debug mode | ✅ Yes |
| `ALLOWED_HOSTS` | Comma-separated hosts | ✅ Yes |
| `DJANGO_SETTINGS_MODULE` | Settings module path | ✅ Yes |
| `DB_NAME` | Database name | For PostgreSQL |
| `DB_USER` | Database user | For PostgreSQL |
| `DB_PASSWORD` | Database password | For PostgreSQL |
| `DB_HOST` | Database host | For PostgreSQL |
| `REDIS_URL` | Redis connection URL | For Celery |
| `GEMINI_API_KEY` | Google Gemini API key | For AI gaze analysis |

---

## 🐳 Docker Setup (Alternative)

If you prefer Docker:

```bash
# Development
docker-compose -f docker-compose.dev.yml up --build

# Production
docker-compose up --build
```

---

## 📁 Project Structure

```
Sentraexam/
├── apps/                    # Django applications
│   ├── users/               # User management, authentication
│   ├── departments/         # Department management
│   ├── courses/             # Course catalog, enrollments
│   ├── assessments/         # Exams, quizzes, assignments
│   ├── proctoring/          # AI-powered exam proctoring
│   ├── notifications/       # Announcements, inbox
│   └── documents/           # Document storage
├── config/                  # Django settings
│   └── settings/
│       ├── base.py          # Base/Production settings
│       ├── dev.py           # Docker development
│       └── local.py         # Local SQLite development
├── frontend/                # React + Vite application
│   ├── src/
│   │   ├── api/             # API client functions
│   │   ├── components/      # Reusable UI components
│   │   ├── features/        # Feature-specific pages
│   │   └── contexts/        # React contexts
│   └── package.json
├── requirements/            # Python dependencies
│   ├── base.txt             # Core dependencies
│   └── dev.txt              # Development tools
├── .env.example             # Environment template
└── manage.py                # Django management script
```

---

## 🎓 Key Features

### For Students
- Take proctored online exams
- View course materials and assessments
- Submit assignments and receive grades

### For Teachers
- Create and manage assessments
- View AI proctoring reports with violation details
- Grade submissions with feedback

### For Administrators/HODs
- Manage departments, courses, and users
- Approve assessments and schedules
- Monitor system-wide statistics

---

## 🤖 AI Proctoring System

The platform includes an AI-powered proctoring system:

| Feature | Technology |
|---------|------------|
| Person Detection | YOLOv8 (local, free) |
| Phone Detection | YOLOv8 (local, free) |
| Gaze Analysis | Google Gemini API (optional) |
| Face Verification | Google Gemini API (optional) |

> [!TIP]
> YOLOv8 model (~6MB) downloads automatically on first use. No GPU required.

---

## ❓ Troubleshooting

### Common Issues

**1. `ModuleNotFoundError: No module named 'xyz'`**
```bash
# Ensure virtual environment is activated
.\venv\Scripts\Activate.ps1  # Windows
source venv/bin/activate      # macOS/Linux

# Reinstall dependencies
pip install -r requirements/base.txt
```

**2. Database migration errors**
```bash
# Reset SQLite database
del db.sqlite3  # Windows
rm db.sqlite3   # macOS/Linux

# Re-run migrations
python manage.py migrate
```

**3. Frontend API connection errors**
- Ensure backend is running on port 8000
- Check `VITE_API_BASE_URL` in `frontend/.env`

**4. CORS errors**
- Add your frontend URL to `ALLOWED_HOSTS` and CORS settings

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

## 📄 License

This project is proprietary. All rights reserved.
