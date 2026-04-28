from django.db.models import Q
from django.utils import timezone

from csluse_auth.models import Profile
from csluse_auth.permissions import ADMINISTRATOR, SUPER_ADMINISTRATOR

from .email_notifications import (
    approval_cta_label,
    build_email_context,
    notification_cta_label,
    notification_cta_url,
    send_notification_email,
)
from .models import Notification


REQUEST_LABELS = {
    "booking": "peminjaman lab",
    "borrow": "peminjaman alat",
    "pengujian": "pengujian sampel",
    "lab_clearance": "surat bebas laboratorium",
}


def _profile_display_name(profile):
    if not profile:
        return None
    return (
        getattr(profile, "full_name", None)
        or getattr(getattr(profile, "user", None), "email", None)
        or str(profile)
    )


def _request_label(kind):
    return REQUEST_LABELS.get(kind, "request")


def _request_identifier(instance, fallback):
    return (
        getattr(instance, "code", None)
        or getattr(instance, "sample_name", None)
        or getattr(instance, "name", None)
        or fallback
    )


def _profile_user(profile):
    return getattr(profile, "user", None) if profile else None


def _profile_email(profile):
    user = _profile_user(profile)
    email = getattr(user, "email", None)
    return (email or "").strip() or None


def _distinct_emails(*sources):
    emails = []
    seen = set()
    for source in sources:
        if not source:
            continue
        items = [source] if isinstance(source, str) else list(source)
        for item in items:
            email = str(item or "").strip()
            if not email:
                continue
            lowered = email.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            emails.append(email)
    return emails


def _profile_emails(profiles):
    return _distinct_emails(_profile_email(profile) for profile in profiles if profile is not None)


def _requester_email(instance):
    return _profile_email(getattr(instance, "requested_by", None))


def _approver_email(instance):
    return _profile_email(getattr(instance, "approved_by", None))


def _mentor_email(instance):
    return _profile_email(getattr(instance, "requester_mentor_profile", None))


def _admin_emails(exclude_emails=None):
    exclude_emails = {
        str(email).strip().lower()
        for email in (exclude_emails or [])
        if str(email or "").strip()
    }
    profiles = (
        Profile.objects
        .select_related("user")
        .filter(
            Q(role="Admin")
            | Q(user__groups__name__in=[ADMINISTRATOR, SUPER_ADMINISTRATOR])
            | Q(user__is_superuser=True)
        )
        .distinct()
    )
    emails = []
    for profile in profiles:
        email = _profile_email(profile)
        if not email or email.lower() in exclude_emails:
            continue
        emails.append(email)
    return _distinct_emails(emails)


def _reviewer_profiles(instance, kind):
    if kind == "booking":
        room = getattr(instance, "room", None)
        if room is None:
            return []
        return list(room.pics.select_related("user").all())
    if kind == "borrow":
        room = getattr(getattr(instance, "equipment", None), "room", None)
        if room is None:
            return []
        return list(room.pics.select_related("user").all())
    return []


def _is_thesis_request(instance):
    return getattr(instance, "purpose", None) == "Skripsi/TA"


def _create_notification(recipient, *, title, category, message):
    if recipient is None:
        return None
    return Notification.objects.create(
        recipient=recipient,
        title=title,
        category=category,
        message=message,
    )


def _notification_recipient_name(instance, recipient):
    return (
        _profile_display_name(recipient)
        or getattr(instance, "name", None)
        or _profile_email(recipient)
        or "Pengguna"
    )


def _notification_email_extra_context(
    instance,
    *,
    recipient,
    kind,
    title,
    message,
    cta_url,
    cta_label,
):
    return {
        "user_display": _notification_recipient_name(instance, recipient),
        "notification_title": title,
        "notification_message": message,
        "request_label": _request_label(kind).title(),
        "request_label_lower": _request_label(kind),
        "request_identifier": _request_identifier(instance, _request_label(kind).title()),
        "cta_url": cta_url,
        "cta_label": cta_label,
    }


def _generic_email_context(instance, *, kind, title, message, audience="requester", cta_label=None):
    return build_email_context(
        extra_context={
            "notification_title": title,
            "notification_message": message,
            "cta_url": notification_cta_url(kind, instance, audience=audience),
            "cta_label": cta_label or (
                approval_cta_label(kind) if audience == "approval" else notification_cta_label(kind)
            ),
        }
    )


def _send_generic_request_email(
    instance,
    *,
    kind,
    title,
    message,
    to_emails,
    cc_emails=None,
    audience="requester",
    cta_label=None,
):
    to_emails = _distinct_emails(to_emails)
    cc_emails = _distinct_emails(cc_emails)
    if not to_emails:
        return False
    context = _generic_email_context(
        instance,
        kind=kind,
        title=title,
        message=message,
        audience=audience,
        cta_label=cta_label,
    )
    return send_notification_email(
        to_emails,
        template_base="csluse/email/request_notification",
        context=context,
        cc_emails=cc_emails,
    )


def _send_request_status_email(
    instance,
    *,
    kind,
    title,
    message,
    status_value,
):
    requester_email = _requester_email(instance)
    if not requester_email:
        return False

    cc_emails = []
    if status_value == "Approved":
        cc_emails.extend(_admin_emails(exclude_emails=[requester_email]))
        if kind in {"booking", "borrow"} and _is_thesis_request(instance):
            cc_emails.extend([_mentor_email(instance)])
        if kind in {"booking", "borrow"}:
            cc_emails.extend([_approver_email(instance)])

    cta_url = notification_cta_url(kind, instance)
    cta_label = notification_cta_label(kind)
    context = build_email_context(
        extra_context={
            **_notification_email_extra_context(
                instance,
                recipient=getattr(instance, "requested_by", None),
                kind=kind,
                title=title,
                message=message,
                cta_url=cta_url,
                cta_label=cta_label,
            ),
            "status_label": (
                "disetujui"
                if status_value == "Approved"
                else "dibatalkan"
                if status_value == "Canceled"
                else "ditolak"
            ),
        },
    )
    return send_notification_email(
        requester_email,
        template_base="csluse/email/request_status",
        context=context,
        cc_emails=cc_emails,
    )


def _send_borrow_overdue_email(
    instance,
    *,
    title,
    message,
    due_text,
    equipment_name,
):
    recipient_email = _requester_email(instance)
    if not recipient_email:
        return False

    cta_url = notification_cta_url("borrow", instance)
    context = build_email_context(
        extra_context={
            **_notification_email_extra_context(
                instance,
                recipient=getattr(instance, "requested_by", None),
                kind="borrow",
                title=title,
                message=message,
                cta_url=cta_url,
                cta_label="Lihat Detail Peminjaman",
            ),
            "equipment_name": equipment_name,
            "due_text": due_text,
        },
    )
    return send_notification_email(
        recipient_email,
        template_base="csluse/email/borrow_overdue",
        context=context,
        cc_emails=[_approver_email(instance)],
    )


def notify_request_status(instance, *, kind, status_value, actor_profile=None, request=None):
    recipient = getattr(instance, "requested_by", None)
    if recipient is None:
        return

    request_label = _request_label(kind)
    request_identifier = _request_identifier(instance, request_label.title())
    actor_name = _profile_display_name(actor_profile) or "tim laboratorium"
    if status_value == "Approved":
        category = "Approved"
        action_label = "disetujui"
    elif status_value == "Canceled":
        category = "General"
        action_label = "dibatalkan"
    else:
        category = "Rejected"
        action_label = "ditolak"
    title = f"{request_label.title()} {request_identifier} {action_label}"
    message = (
        f"Pengajuan {request_label} Anda ({request_identifier}) telah "
        f"{action_label} oleh {actor_name}."
    )

    _create_notification(
        recipient,
        title=title,
        category=category,
        message=message,
    )
    if status_value == "Canceled":
        reviewer_emails = _distinct_emails(
            [_approver_email(instance)],
            _admin_emails(exclude_emails=[_requester_email(instance)]),
        )
        _send_generic_request_email(
            instance,
            kind=kind,
            title=title,
            message=message,
            to_emails=reviewer_emails,
            cc_emails=[_requester_email(instance)],
            audience="approval",
        )
        return

    _send_request_status_email(
        instance,
        kind=kind,
        title=title,
        message=message,
        status_value=status_value,
    )


def notify_lab_clearance_status(instance, *, status_value, actor_profile=None, request=None):
    recipient = getattr(instance, "requested_by", None)
    if recipient is None:
        return

    request_identifier = _request_identifier(instance, "Surat Bebas Lab")
    actor_name = _profile_display_name(actor_profile) or "tim laboratorium"
    if status_value == "Approved":
        category = "Approved"
        action_label = "disetujui"
    else:
        category = "Rejected"
        action_label = "ditolak"

    title = f"Surat bebas laboratorium {request_identifier} {action_label}"
    message = (
        f"Pengajuan surat bebas laboratorium Anda ({request_identifier}) telah "
        f"{action_label} oleh {actor_name}."
    )

    note = str(getattr(instance, "note", "") or "").strip()
    if status_value == "Rejected" and note:
        message = f"{message} Catatan: {note}"

    _create_notification(
        recipient,
        title=title,
        category=category,
        message=message,
    )

    requester_email = _requester_email(instance)
    if not requester_email:
        return

    cta_url = notification_cta_url("lab_clearance", instance)
    cta_label = notification_cta_label("lab_clearance")
    context = build_email_context(
        request=request,
        extra_context={
            **_notification_email_extra_context(
                instance,
                recipient=recipient,
                kind="lab_clearance",
                title=title,
                message=message,
                cta_url=cta_url,
                cta_label=cta_label,
            ),
            "status_label": "disetujui" if status_value == "Approved" else "ditolak",
        },
    )
    send_notification_email(
        requester_email,
        template_base="csluse/email/request_status",
        context=context,
    )


def notify_borrow_overdue(instance, request=None):
    recipient = getattr(instance, "requested_by", None)
    if recipient is None:
        return

    borrow_identifier = _request_identifier(instance, "Borrow")
    equipment_name = getattr(getattr(instance, "equipment", None), "name", "alat")
    due_at = getattr(instance, "end_time", None)
    due_text = (
        timezone.localtime(due_at).strftime("%d %b %Y %H:%M WIB")
        if due_at else "jadwal pengembalian"
    )
    title = f"Peminjaman {borrow_identifier} melewati batas waktu"
    message = (
        f"Peminjaman alat Anda ({borrow_identifier}) untuk {equipment_name} "
        f"sudah overdue sejak {due_text}. Segera lakukan pengembalian."
    )

    _create_notification(
        recipient,
        title=title,
        category="Reminder",
        message=message,
    )
    _send_borrow_overdue_email(
        instance,
        title=title,
        message=message,
        due_text=due_text,
        equipment_name=equipment_name,
    )


def notify_new_request_submission(instance, *, kind):
    request_label = _request_label(kind)
    request_identifier = _request_identifier(instance, request_label.title())
    requester_name = _profile_display_name(getattr(instance, "requested_by", None)) or "pemohon"
    title = f"Pengajuan {request_label.title()} baru {request_identifier}"
    message = (
        f"Terdapat pengajuan {request_label} baru dari {requester_name} "
        f"dengan ID {request_identifier} yang membutuhkan tindak lanjut."
    )

    if kind == "pengujian":
        _send_generic_request_email(
            instance,
            kind=kind,
            title=title,
            message=message,
            to_emails=_admin_emails(),
            audience="approval",
        )
        return

    if _is_thesis_request(instance):
        _send_generic_request_email(
            instance,
            kind=kind,
            title=title,
            message=message,
            to_emails=[_mentor_email(instance)],
            audience="approval",
            cta_label="Buka Pengajuan",
        )
        return

    _send_generic_request_email(
        instance,
        kind=kind,
        title=title,
        message=message,
        to_emails=_profile_emails(_reviewer_profiles(instance, kind)),
        audience="approval",
        cta_label="Buka Pengajuan",
    )


def notify_post_mentor_approval(instance, *, kind, actor_profile=None):
    request_label = _request_label(kind)
    request_identifier = _request_identifier(instance, request_label.title())
    actor_name = _profile_display_name(actor_profile) or "dosen pembimbing"
    title = f"Pengajuan {request_label.title()} siap direview {request_identifier}"
    message = (
        f"Pengajuan {request_label} dengan ID {request_identifier} telah disetujui oleh "
        f"{actor_name} dan sekarang menunggu approval lanjutan dari PIC ruangan."
    )
    _send_generic_request_email(
        instance,
        kind=kind,
        title=title,
        message=message,
        to_emails=_profile_emails(_reviewer_profiles(instance, kind)),
        audience="approval",
        cta_label="Buka Halaman Approval",
    )
