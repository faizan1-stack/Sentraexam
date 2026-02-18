# Sentraexam

Full-stack academic management platform with a Django backend and React frontend.

## Backend

Backend API for the Sentraexam academic management platform built with Django, Django REST Framework, and PostgreSQL.

### Features

- Role-based access for Administrators, Heads of Department, Teachers, and Students.
- Department, course, timetable, assessment, assignment, and notification management.
- JWT authentication with refresh token rotation and token blacklisting.
- Celery-powered async jobs and Redis-based websockets/event support (hooks ready).
- API schema generation with OpenAPI 3 via drf-spectacular.

## Frontend

Frontend application built with React, Vite, and TypeScript.

## Getting Started (Development)

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Build and start the development containers:
    ```bash
    docker-compose -f docker-compose.dev.yml up --build
    ```
3.  Once the containers are running, your applications will be available at:

    - **Frontend**: `http://localhost:5173`
    - **Backend**: `http://localhost:8000`

4.  To create an admin user, run the following command in a separate terminal:
    ```bash
    docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
    ```

API documentation is available at `http://localhost:8000/api/docs/`.

## Production

1.  Build and start the production containers:
    ```bash
    docker-compose up --build
    ```
2.  Your applications will be available at:
    - **Frontend**: `http://localhost`
    - **Backend**: `http://localhost:8000`

## Running Tests

bash
pytest

## Project Structure

- `apps/users`: Custom user model, authentication flows, role management.
- `apps/departments`: Department, course allocation, timetable ownership.
- `apps/courses`: Course catalog, enrollment relationships.
- `apps/assessments`: Exams, assignments, grading workflows.
- `apps/notifications`: Announcements, inbox, delivery tracking.
- `apps/documents`: Secure academic document storage.
- `apps/academic_calendar`: Institutional calendars and events.
- `frontend`: React frontend application.

## Tooling

- Formatting with Black and isort.
- Type checking with mypy.
- Pre-commit hooks ready via `.pre-commit-config.yaml` (add as needed).
```
