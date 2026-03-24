# Repository Guidelines

## Project Structure & Module Organization
- `apps/*`: Django domain apps (users, departments, courses, assessments, notifications, documents, academic_calendar, common).
- `config/`: Project settings (`dev`, `test`, `prod`), `asgi.py`, `wsgi.py`, Celery config.
- `frontend/`: Vite + React + TypeScript SPA (`src`, `public`).
- `tests/`: Pytest tests and factories.
- `requirements/*.txt`, `Makefile`, `Dockerfile`, `docker-compose.yml`, `.env(.example)`.

## Build, Test, and Development Commands
- Backend (local): `make run`, `make migrate`, `make makemigrations`, `make createsuperuser`.
- Tests: `make test` or `pytest` (uses `config.settings.test`).
- Lint/format: `make format` (Black+isort), `make lint` (Flake8+MyPy).
- Docker dev: `docker-compose up --build` then `docker-compose exec web python manage.py migrate`.
- Frontend: `cd frontend && npm run dev | build | lint | preview`.

## Coding Style & Naming Conventions
- Python: Black (line length 100), isort (profile `black`), Flake8, MyPy. Use 4‑space indent, `snake_case` for modules/functions, `PascalCase` for classes.
- TS/React: ESLint enforced; `PascalCase` components; `camelCase` variables/props; place components under `frontend/src`.
- Config: keep settings in `config/settings/*`; environment via `.env` (never hard‑code secrets).

## Testing Guidelines
- Frameworks: `pytest`, `pytest-django`; discovery for `tests.py`, `test_*.py`, `*_tests.py`.
- Use factories in `tests/factories.py`; prefer model factories over fixtures.
- DB: tests default to SQLite (see `config.settings.test`). Keep tests isolated and fast.
- Aim for strong coverage on serializers, permissions, and API views.

## Commit & Pull Request Guidelines
- Use Conventional Commits style: `type(scope): summary` (e.g., `feat(assessments): add exam model`).
- PRs include: clear description, linked issues, migration notes, API/behavior changes, and frontend screenshots when relevant.
- Ensure `make format` and `make lint` pass; add tests for new behavior.

## Security & Configuration Tips
- Copy `.env.example` → `.env`; set `SECRET_KEY`, `DEBUG`, `DB_*`, `REDIS_URL`, `ALLOWED_HOSTS`, `EMAIL_BACKEND`.
- Postgres and Redis run via `docker-compose`; don’t commit secrets or generated files.
- New apps: add to `INSTALLED_APPS`, wire URLs in `config/urls.py`, and define permissions.

## Agent-Specific Notes
- Prefer Makefile targets; avoid ad‑hoc scripts.
- Keep changes minimal and scoped to the touched module.
- Do not introduce new services/dependencies without discussion.

