# SoulTribe.chat

[![Live Site](https://img.shields.io/badge/Live%20Site-soultribe.chat-blue)](https://soultribe.chat)
[![GitHub](https://img.shields.io/badge/GHub-oib%2FSoulTribe-black)](https://github.com/oib/SoulTribe)

Connect with your soul tribe - meaningful conversations and community building.

## Overview

SoulTribe is a web platform that brings people together for authentic conversations and meaningful connections. Using intelligent matching algorithms, the platform helps users find compatible conversation partners and build lasting relationships.

## Features

- **Smart Matching**: Intelligent algorithm to connect compatible users
- **Real-time Chat**: Secure messaging between matched users
- **Profile Management**: Comprehensive user profiles with interests and preferences
- **Availability Scheduling**: Easy time slot management for conversations
- **Multi-language Support**: Internationalization with i18next
- **Admin Dashboard**: Comprehensive administration tools
- **Email Notifications**: Verification and communication emails
- **Mobile Responsive**: Works seamlessly on all devices

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- PostgreSQL
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/soultribe.git
   cd soultribe
   ```

2. **Set up Python environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install Node.js dependencies**
   ```bash
   npm install
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and other settings
   ```

5. **Set up database**
   ```bash
   alembic upgrade head
   ```

6. **Build frontend assets**
   ```bash
   npm run build
   ```

7. **Start the application**
   ```bash
   ./run_app.sh
   ```

Visit `http://localhost:8000` to access the application.

## 🌐 Live Site

**Check out the live site at [soultribe.chat](https://soultribe.chat)**

## 📙 Documentation

## Development

### Project Structure

```
soultribe/
├── src/
│   ├── backend/          # Python FastAPI backend
│   ├── frontend/         # JavaScript, CSS, and static files
│   └── public/           # Public HTML pages
├── docs/                 # Documentation
├── dev/                  # Development scripts and tools
└── alembic/             # Database migrations
```

### Development Scripts

- `npm run build` - Build frontend assets
- `./run_app.sh` - Start development server
- `alembic revision --autogenerate -m "description"` - Create migration
- `alembic upgrade head` - Apply migrations

### Database Management

The project uses Alembic for database migrations:

```bash
# Create new migration
alembic revision --autogenerate -m "Add new feature"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Development Tools

- **User Seeding**: `dev/scripts/seed_dev.py` - Create test users
- **Translation Management**: `dev/translations/` - Update translations
- **Debug Scripts**: `dev/scripts/debug_match_find.py` - Debug matching algorithm

## Configuration

### Environment Variables

Key environment variables in `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost/soultribe
SECRET_KEY=your-secret-key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Database

The application uses PostgreSQL with SQLModel for ORM. Database schema is managed through Alembic migrations.

## Technology Stack

- **Backend**: Python, FastAPI, SQLModel, Alembic
- **Frontend**: Vanilla JavaScript, HTML5, CSS3, i18next
- **Database**: PostgreSQL
- **Authentication**: JWT tokens
- **Email**: SMTP integration
- **Deployment**: Gunicorn, systemd

## API Documentation

Once running, visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI).

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style

- Python: Follow PEP 8
- JavaScript: Use ES6+ features
- CSS: Use BEM methodology for class names
- Commit messages: Use conventional commits

## Security

- JWT-based authentication
- Password hashing with Argon2
- Input validation and sanitization
- CSRF protection
- Environment-based configuration

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Check the [documentation](docs/)
- Review the [admin guide](docs/admin.md)

## Acknowledgments

- Thanks to all contributors who help make SoulTribe better
- Special thanks to the open-source community for the tools and libraries that make this project possible
