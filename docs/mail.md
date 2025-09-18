# Email Handling in the Application

## Overview
The application uses Python's built-in `smtplib` and `email` modules to handle email functionality. Currently, the implementation is minimal and primarily used for testing purposes.

## Current Implementation

### Test Scripts
There are two test scripts available for email functionality:

1. `/dev/scripts/testmail.py`
2. `/dev/tests/testmail.py`

Both scripts contain the same basic email sending functionality:

```python
import smtplib
from email.message import EmailMessage

# Create email message
msg = EmailMessage()
msg["From"] = "test@keisanki.net"
msg["To"] = "oib@bubuit.net"
msg["Subject"] = "Test"
msg.set_content("Hello world")

# Send email using local SMTP server
with smtplib.SMTP("localhost") as smtp:
    smtp.send_message(msg)
```

## Configuration

### SMTP Server
- The application is configured to use a local SMTP server running on `localhost`
- No authentication is currently configured for the SMTP connection
- The connection is not using TLS/SSL

### Email Settings
- **From Address**: `test@keisanki.net` (hardcoded in test scripts)
- **To Address**: `oib@bubuit.net` (hardcoded in test scripts)

## Integration Points

Currently, email functionality is not integrated into the main application. The existing implementation is limited to test scripts and would need to be properly integrated with the application's configuration system for production use.

## Future Improvements

1. Move email configuration to environment variables or a configuration file
2. Add support for SMTP authentication
3. Implement TLS/SSL for secure email transmission
4. Create email templates for different types of notifications
5. Add error handling and retry logic for failed email deliveries
6. Integrate with the application's logging system

## Testing

To test the email functionality, you can run either of the test scripts:

```bash
python3 dev/scripts/testmail.py
# or
python3 dev/tests/testmail.py
```

Make sure you have a local SMTP server running on `localhost` before testing.
