# Sentraexam

Sentraexam is a full-stack university management and examination platform.

It provides role-based workflows for `Admin`, `HOD`, `Teacher`, and `Student` users, including course management, enrollments, assessments, scheduling, proctoring, notifications, documents, and academic calendar.

## Technology Stack

### Backend
- Python 3.11+
- Django 5.x
- Django REST Framework
- JWT auth (`djangorestframework-simplejwt`)
- PostgreSQL (default in base settings)
- Celery + Redis
- Django Channels + channels-redis (WebSocket notifications)
- drf-spectacular (OpenAPI/Swagger)
- AI/proctoring libs: OpenCV, Ultralytics (YOLO), Pillow, NumPy, Google Generative AI SDK
- File/media integrations: ImageKit (configured through env)

### Frontend
- React 19 + TypeScript
- Vite
- Ant Design
- React Router
- TanStack Query
- Axios
- Recharts
- Day.js

### DevOps / Tooling
- Docker + Docker Compose
- Makefile commands for common backend tasks
- Pytest
- Black, isort, Flake8, MyPy

## Core Modules

- `apps/users`: custom user model, role system, auth tokens, dashboard APIs
- `apps/departments`: departments and memberships
- `apps/courses`: courses and enrollment workflow
- `apps/assessments`: assessments, scheduling approval flow, sessions, submissions, grading
- `apps/proctoring`: snapshots, violations, face reference, settings, clips, session recordings
- `apps/notifications`: announcements + per-user notifications + WebSocket consumer
- `apps/documents`: categories, document storage, access logs
- `apps/academic_calendar`: year, term, events, timetable
- `frontend/`: SPA for all role dashboards and workflows

## How It Works (High-Level)

1. User authenticates with JWT (`/api/auth/token/`).
2. Frontend renders role-specific routes and dashboards.
3. Domain workflows are handled via REST endpoints:
   - departments, courses, enrollments
   - assessments (create → approve → schedule → start session → submit → grade)
   - proctoring snapshots/violations
   - notifications and announcements
4. Background and real-time processing:
   - Celery handles async jobs/reminders
   - Channels delivers live notifications through `/ws/notifications/`
5. Data is stored in PostgreSQL; media files are saved in `media/` (or external storage when configured).

## API Surface

Base URL: `/api/`

- `auth/` (accounts, token, dashboards)
- `departments/`
- `courses/`
- `assessments/` (including sessions/submissions)
- `proctoring/`
- `notifications/`
- `documents/`
- `calendar/`

API docs:
- Swagger: `/api/docs/`
- OpenAPI schema: `/api/schema/`
- Redoc: `/api/redoc/`

## Setup Instructions

## 1) Local Backend Setup

```bash
python -m venv venv
# PowerShell
.\venv\Scripts\Activate.ps1

pip install -r requirements/dev.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## 2) Local Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:5173`
Backend default: `http://localhost:8000`

## 3) Docker Setup (Recommended for full stack)

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Then run migrations/superuser in container if needed.

## Environment Configuration

Main env file: `.env`

Common keys:
- `DJANGO_SETTINGS_MODULE`
- `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`
- `REDIS_URL`, `CHANNELS_ENABLED`
- `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
- `GEMINI_API_KEY`

Do not commit secrets. Keep `.env` private.

## Test / Lint / Format

```bash
make test
make lint
make format
```

## Project Commands

```bash
make run
make migrate
make makemigrations
make createsuperuser
```

## Diagram Files

- `class-diagram.md`
- `er-diagram.md`
- `architecture-diagram.md`
- `sequence-diagram.md`
- `use-case-diagram.md`

These diagrams describe the current backend/frontend architecture and major business flows.
