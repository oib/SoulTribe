# SoulTribe.chat Database Documentation

## Database Connection

### Connection String
```
postgresql+psycopg2://soultribe:660165ff44a860a5@127.0.0.1:5432/soultribe
```

### Environment Variables
- `DATABASE_URL`: Connection string for the database
- Default value (development): `postgresql+psycopg2://soultribe:pass@127.0.0.1:5432/soultribe`

### Accessing the Database

#### Using psql
```bash
PGPASSWORD=660165ff44a860a5 psql -h 127.0.0.1 -U soultribe -d soultribe
```

#### Using Python with SQLAlchemy
```python
from sqlalchemy import create_engine
import os

# Load from environment or use default
db_url = os.getenv("DATABASE_URL", "postgresql+psycopg2://soultribe:pass@127.0.0.1:5432/soultribe")
engine = create_engine(db_url)
```

## Database Schema

### Tables

#### 1. `user`
Core user account information
- `id` (SERIAL): Primary key
- `email` (VARCHAR): User's email address (unique)
- `password_hash` (VARCHAR): Hashed password (Argon2)
- `email_verified_at` (TIMESTAMP): When email was verified (NULL if not verified)
- `created_at` (TIMESTAMP): Account creation timestamp

#### 2. `profile`
Extended user profile information
- `user_id` (INTEGER): Foreign key to `user.id`
- `full_name` (VARCHAR): User's full name
- `display_name` (VARCHAR): Public display name
- `bio` (TEXT, nullable): Short biography
- `timezone` (VARCHAR, nullable): User's timezone (e.g., 'Europe/Vienna')
- `created_at` (TIMESTAMP): Profile creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

#### 3. `availabilityslot`
User availability time slots
- `id` (SERIAL): Primary key
- `user_id` (INTEGER): Foreign key to `user.id`
- `start_dt_utc` (TIMESTAMP): Start time in UTC
- `end_dt_utc` (TIMESTAMP): End time in UTC
- `start_dt_local` (TIMESTAMP): Start time in user's local timezone
- `end_dt_local` (TIMESTAMP): End time in user's local timezone
- `timezone` (VARCHAR): Timezone used for this slot (e.g., 'Europe/Vienna')
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

#### 4. `emailverificationtoken`
Email verification tokens
- `id` (SERIAL): Primary key
- `user_id` (INTEGER): Foreign key to `user.id`
- `token` (VARCHAR): Unique verification token
- `expires_at` (TIMESTAMP): Token expiration timestamp
- `used_at` (TIMESTAMP, nullable): When token was used (NULL if unused)
- `created_at` (TIMESTAMP): Creation timestamp

#### 5. `passwordresettoken`
Password reset tokens
- `id` (SERIAL): Primary key
- `user_id` (INTEGER): Foreign key to `user.id`
- `token` (VARCHAR): Unique reset token
- `expires_at` (TIMESTAMP): Token expiration timestamp
- `used_at` (TIMESTAMP, nullable): When token was used (NULL if unused)
- `created_at` (TIMESTAMP): Creation timestamp

#### 6. `match`
User matches
- `id` (SERIAL): Primary key
- `user1_id` (INTEGER): Foreign key to `user.id`
- `user2_id` (INTEGER): Foreign key to `user.id`
- `status` (VARCHAR): Match status (e.g., 'pending', 'accepted', 'rejected')
- `created_at` (TIMESTAMP): Match creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

#### 7. `meetup`
Scheduled meetups between users
- `id` (SERIAL): Primary key
- `match_id` (INTEGER): Foreign key to `match.id`
- `scheduled_time` (TIMESTAMP): When the meetup is scheduled for
- `status` (VARCHAR): Meetup status (e.g., 'proposed', 'confirmed', 'completed')
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

## Common Queries

### Find User by Email
```sql
SELECT * FROM "user" WHERE email = 'testuser@soultribe.chat';
```

### Get User Profile
```sql
SELECT u.*, p.* 
FROM "user" u
JOIN profile p ON u.id = p.user_id
WHERE u.email = 'testuser@soultribe.chat';
```

### Find Available Time Slots for a User
```sql
SELECT * FROM availabilityslot 
WHERE user_id = 1 
  AND start_dt_utc > NOW()
ORDER BY start_dt_utc;
```

### Find Pending Matches
```sql
SELECT u1.email as user1_email, u2.email as user2_email, m.*
FROM match m
JOIN "user" u1 ON m.user1_id = u1.id
JOIN "user" u2 ON m.user2_id = u2.id
WHERE m.status = 'pending';
```

## Data Location Guide

### User Authentication
- Table: `user`
- Key fields: `id`, `email`, `password_hash`, `email_verified_at`

### User Profile
- Table: `profile`
- Key fields: `full_name`, `display_name`, `bio`, `timezone`

### Availability
- Table: `availabilityslot`
- Key fields: `start_dt_utc`, `end_dt_utc`, `timezone`

### Email Verification
- Table: `emailverificationtoken`
- Key fields: `token`, `expires_at`, `used_at`

### Password Reset
- Table: `passwordresettoken`
- Key fields: `token`, `expires_at`, `used_at`

### Matching System
- Tables: `match`, `meetup`
- Key fields: `status`, `scheduled_time`

## Maintenance

### Backing Up the Database
```bash
pg_dump -h 127.0.0.1 -U soultribe -d soultribe > soultribe_backup_$(date +%Y%m%d).sql
```

### Restoring from Backup
```bash
psql -h 127.0.0.1 -U soultribe -d soultribe < soultribe_backup_20230918.sql
```

### Checking Database Size
```sql
SELECT pg_size_pretty(pg_database_size('soultribe'));
```

## Notes
- Always use parameterized queries to prevent SQL injection
- Database credentials should never be hardcoded in the application
- Regular backups are recommended
- Consider using a connection pooler in production for better performance
