from app.services.email.base import EmailService
from app.services.email.gmail_smtp import GmailSmtpEmailService


def get_email_service() -> EmailService:
    return GmailSmtpEmailService()
