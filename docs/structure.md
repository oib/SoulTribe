# SoulTribe Codebase Structure

This document provides an overview of the SoulTribe project structure and its components.

## Project Overview

SoulTribe is a web application that connects people for meaningful conversations and community building. The platform features user matching, chat functionality, and community events.

## Directory Structure

```
soultribe/
├── src/                      # Main application source code
│   ├── backend/              # Python backend services
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic services
│   │   └── soultribe_cleanup.py
│   ├── frontend/             # Frontend assets
│   │   ├── js/               # JavaScript modules
│   │   ├── css/              # Stylesheets
│   │   ├── i18n/             # Internationalization
│   │   ├── assets/           # Static assets
│   │   └── public/           # Public HTML files
│   └── public/               # Public-facing files
│       ├── components/       # Reusable HTML components
│       ├── img/              # Images and icons
│       └── *.html            # Public pages
├── docs/                     # Documentation
│   ├── bootstrap/            # Setup and initialization docs
│   └── admin.md              # Administration guide
├── dev/                      # Development tools and scripts
│   ├── scripts/              # Python utility scripts
│   ├── node/                 # Node.js utilities
│   ├── translations/         # Translation management
│   └── config/               # Development configuration
├── alembic/                  # Database migrations
├── .windsurf/                # IDE configuration
├── .venv/                    # Python virtual environment
└── node_modules/             # Node.js dependencies
```

## Core Components

### Backend (Python)

**Routes:**
- `auth.py` - Authentication and authorization
- `profile.py` - User profile management
- `match.py` - User matching algorithm
- `availability.py` - Time slot management

**Services:**
- `llm/` - Language model integration (Ollama)
- `email.py` - Email communication

### Frontend (JavaScript/HTML/CSS)

**JavaScript Modules:**
- `app.js` - Main application entry point
- `login.js` - Authentication handling
- `dashboard.js` - User dashboard functionality
- `profile.js` - Profile management
- `components.js` - Reusable UI components

**Pages:**
- `index.html` - Landing page
- `login.html` - User authentication
- `dashboard.html` - Main user interface
- `profile.html` - User profile editing
- `admin/` - Administrative interfaces

### Development Tools

**Scripts:**
- Database seeding and user generation
- Translation management
- Frontend building
- Debug utilities

**Configuration:**
- `gunicorn_config.py` - Production server setup
- Environment configuration via `.env`

## Key Features

1. **User Authentication** - Secure login and registration
2. **Profile Management** - Comprehensive user profiles
3. **Matching Algorithm** - Intelligent user pairing
4. **Real-time Chat** - Communication between matched users
5. **Internationalization** - Multi-language support
6. **Admin Dashboard** - System administration tools
7. **Email Services** - Notification and verification emails

## Technology Stack

- **Backend:** Python with Flask/FastAPI
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Database:** PostgreSQL with Alembic migrations
- **Authentication:** JWT tokens
- **Email:** SMTP integration
- **AI/LLM:** Ollama integration
- **Deployment:** Gunicorn WSGI server

## Development Workflow

1. Set up virtual environment: `python -m venv .venv`
2. Install dependencies: `pip install -r requirements.txt`
3. Run database migrations: `alembic upgrade head`
4. Start development server: `./run_app.sh`
5. Build frontend assets: `dev/scripts/build-frontend.js`

## Configuration

- Environment variables in `.env`
- Database settings in `alembic.ini`
- Server configuration in `dev/config/`
- Translation files in `src/frontend/i18n/`

## Security Considerations

- JWT-based authentication
- Input validation and sanitization
- CSRF protection
- Secure password hashing
- Environment-based configuration
