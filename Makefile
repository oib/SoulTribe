# Simple Makefile to run dev server and manage systemd services (Gunicorn only)

# Config (pinned to 8001)
APP   ?= main:app
USER  ?= $(shell whoami)
VENV  ?= .venv
GUNI  := $(VENV)/bin/gunicorn
PIP   := $(VENV)/bin/pip

.PHONY: help venv install dev dev-8001 build-frontend clean-frontend
help:
	@echo "Targets:"
	@echo "  venv          - create virtualenv"
	@echo "  install       - install requirements"
	@echo "  dev           - run gunicorn (uvicorn workers) on 8001 with --reload"
	@echo "  dev-8001      - alias for dev"
	@echo "  build-frontend- build frontend assets into soul/public/"
	@echo "  clean-frontend- remove generated frontend assets"
	@echo "  svcg-enable   - enable systemd gunicorn service for USER=$(USER)"
	@echo "  svcg-start    - start systemd gunicorn service"
	@echo "  svcg-stop     - stop systemd gunicorn service"

venv:
	python3 -m venv $(VENV)

install: venv
	$(PIP) install -r requirements.txt

dev:
	$(GUNI) -k uvicorn.workers.UvicornWorker --reload --bind 0.0.0.0:8001 --workers 2 --threads 2 --timeout 60 $(APP)

dev-8001:
	$(MAKE) dev

build-frontend:
	npm run build-frontend

clean-frontend:
	rm -rf soul/public/css soul/public/js soul/public/i18n soul/public/img soul/public/favicon.* soul/public/sw.js

# Systemd (system-wide) — requires gunicorn service to be installed under /etc/systemd/system
svcg-enable:
	sudo systemctl enable soultribe-gunicorn@$(USER)

svcg-start:
	sudo systemctl start soultribe-gunicorn@$(USER)

svcg-stop:
	sudo systemctl stop soultribe-gunicorn@$(USER) || true
