PYTHON ?= python
MANAGE = $(PYTHON) manage.py

.PHONY: run migrate makemigrations createsuperuser test format lint collectstatic

run:
	$(MANAGE) runserver

migrate:
	$(MANAGE) migrate

makemigrations:
	$(MANAGE) makemigrations

createsuperuser:
	$(MANAGE) createsuperuser

test:
	pytest

format:
	black .
	isort .

lint:
	flake8 .
	mypy .

collectstatic:
	$(MANAGE) collectstatic --noinput
