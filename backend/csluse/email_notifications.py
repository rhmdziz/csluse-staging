import logging
import re
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


logger = logging.getLogger(__name__)


REQUEST_DETAIL_PATHS = {
    "booking": "/booking-rooms/{id}",
    "borrow": "/borrow-equipment/{id}",
    "pengujian": "/sample-testing",
}

REQUEST_APPROVAL_PATHS = {
    "booking": "/booking-rooms/approval/{id}",
    "borrow": "/borrow-equipment/approval/{id}",
    "pengujian": "/sample-testing/approval/{id}",
}


def _frontend_url():
    return (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")


def _backend_url(request=None):
    if request is not None:
        return request.build_absolute_uri("/").rstrip("/")
    return ""


def _logo_url(context):
    backend_url = (context.get("backend_url") or "").rstrip("/")
    frontend_url = (context.get("frontend_url") or "").rstrip("/")
    if backend_url:
        return f"{backend_url}/static/logo/stem-name%202.png"
    if frontend_url:
        return f"{frontend_url}/logo/stem-name%202.png"
    return ""


def _render_notification_template(template_name, context):
    template_path = Path(settings.BASE_DIR) / "templates" / template_name
    content = template_path.read_text(encoding="utf-8")

    def replace(match):
        key = match.group("key").strip()
        return str(context.get(key, ""))

    return re.sub(r"{{\s*(?P<key>[a-zA-Z0-9_]+)\s*}}", replace, content)


def notification_cta_url(kind, instance, audience="requester"):
    frontend_url = _frontend_url()
    if not frontend_url:
        return ""

    if audience == "approval":
        path_template = REQUEST_APPROVAL_PATHS.get(kind, "/notifications")
    else:
        path_template = REQUEST_DETAIL_PATHS.get(kind, "/notifications")
    instance_id = getattr(instance, "pk", None)
    if "{id}" in path_template:
        if instance_id is None:
            return f"{frontend_url}/notifications"
        path = path_template.format(id=instance_id)
    else:
        path = path_template
    return f"{frontend_url}{path}"


def notification_cta_label(kind):
    if kind == "pengujian":
        return "Lihat Daftar Pengujian"
    return "Lihat Detail Request"


def approval_cta_label(kind):
    if kind == "pengujian":
        return "Buka Approval Pengujian"
    return "Buka Halaman Approval"


def _normalize_email_list(value):
    if not value:
        return []
    if isinstance(value, str):
        values = [value]
    else:
        values = list(value)

    normalized = []
    seen = set()
    for item in values:
        email = str(item or "").strip()
        if not email:
            continue
        lowered = email.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        normalized.append(email)
    return normalized


def send_notification_email(
    recipient_email,
    *,
    template_base,
    context,
    cc_emails=None,
):
    to_emails = _normalize_email_list(recipient_email)
    cc_emails = _normalize_email_list(cc_emails)

    if not to_emails:
        return False

    try:
        render_context = {
            **context,
            "logo_url": _logo_url(context),
        }
        subject = _render_notification_template(f"{template_base}_subject.txt", render_context).strip()
        text_body = _render_notification_template(f"{template_base}_message.txt", render_context)
        html_body = _render_notification_template(f"{template_base}_message.html", render_context)

        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            to=to_emails,
            cc=cc_emails,
        )
        message.attach_alternative(html_body, "text/html")
        message.send()
        return True
    except Exception:
        logger.exception(
            "Failed to send notification email to to=%s cc=%s",
            to_emails,
            cc_emails,
        )
        return False


def build_email_context(*, request=None, extra_context=None):
    context = {
        "frontend_url": _frontend_url(),
        "backend_url": _backend_url(request),
    }
    if extra_context:
        context.update(extra_context)
    return context
