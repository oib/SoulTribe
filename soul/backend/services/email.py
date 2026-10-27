from __future__ import annotations

from typing import Optional
import os
import sys
import smtplib
from email.message import EmailMessage

DEV_MODE = os.getenv("EMAIL_DEV_MODE", "0") == "1"
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "25"))
EMAIL_FROM = os.getenv("EMAIL_FROM", "noreply@soultribe.chat")


def _log_email(to: str, subject: str, html: str, text: Optional[str] = None) -> None:
    print("[email.dev] To:", to, file=sys.stdout)
    print("[email.dev] Subject:", subject, file=sys.stdout)
    if text:
        print("[email.dev] Text:\n" + text, file=sys.stdout)
    print("[email.dev] HTML:\n" + html, file=sys.stdout)


def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> None:
    """Send an email using localhost SMTP, mirroring docs/mail.md behavior.
    Falls back to logging when EMAIL_DEV_MODE=1.
    """
    if DEV_MODE:
        _log_email(to, subject, html, text)
        return

    # Build the email
    msg = EmailMessage()
    msg["From"] = EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    # Prefer provided text, else derive from HTML by stripping tags lightly
    plain = text if text is not None else ""
    if not plain:
        try:
            # very light fallback; real impl can use html2text
            plain = html.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
            plain = plain.replace("<p>", "\n").replace("</p>", "\n")
            plain = plain.replace("<a ", "<").replace("</a>", "")
        except Exception:
            plain = ""
    msg.set_content(plain or "")
    msg.add_alternative(html, subtype="html")

    # Send via localhost SMTP (no TLS/auth per docs)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.send_message(msg)
