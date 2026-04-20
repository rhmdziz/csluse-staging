import os
from django.apps import AppConfig

from django.apps import AppConfig as DjangoAppConfig
from django.conf import settings


def _ensure_google_socialapp(*_, **__):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    secret = os.getenv("GOOGLE_CLIENT_SECRET")

    site_domain = os.getenv("DJANGO_SITE_DOMAIN", "localhost")
    site_name = os.getenv("DJANGO_SITE_NAME", site_domain)

    if not client_id or not secret:
        return

    try:
        from django.contrib.sites.models import Site
        from allauth.socialaccount.models import SocialApp
    except Exception:
        return

    try:
        site_id = getattr(settings, "SITE_ID", 1)
        site, _ = Site.objects.get_or_create(
            id=site_id,
            defaults={"domain": "localhost", "name": "localhost"},
        )

        app, _ = SocialApp.objects.get_or_create(
            provider="google",
            name="Google",
            defaults={
                "client_id": client_id,
                "secret": secret,
                "key": "",
            },
        )

        updated = False
        if app.client_id != client_id:
            app.client_id = client_id
            updated = True
        if app.secret != secret:
            app.secret = secret
            updated = True
        if updated:
            app.save(update_fields=["client_id", "secret"])

        app.sites.add(site)
    except Exception:
        return


def _ensure_microsoft_socialapp(*_, **__):
    client_id = os.getenv("MICROSOFT_CLIENT_ID")
    secret = os.getenv("MICROSOFT_CLIENT_SECRET")
    tenant_id = os.getenv("MICROSOFT_TENANT_ID")
    login_url = os.getenv("MICROSOFT_AUTHORITY", "https://login.microsoftonline.com")
    graph_url = os.getenv("MICROSOFT_GRAPH_URL", "https://graph.microsoft.com")

    site_domain = os.getenv("DJANGO_SITE_DOMAIN", "localhost")
    site_name = os.getenv("DJANGO_SITE_NAME", site_domain)

    if not client_id or not secret or not tenant_id:
        return

    try:
        from django.contrib.sites.models import Site
        from allauth.socialaccount.models import SocialApp
    except Exception:
        return

    try:
        site_id = getattr(settings, "SITE_ID", 1)
        site, _ = Site.objects.get_or_create(
            id=site_id,
            defaults={"domain": site_domain, "name": site_name},
        )

        app, _ = SocialApp.objects.get_or_create(
            provider="microsoft",
            name="Microsoft",
            defaults={
                "client_id": client_id,
                "secret": secret,
                "key": "",
                "settings": {
                    "tenant": tenant_id,
                    "login_url": login_url,
                    "graph_url": graph_url,
                },
            },
        )

        updated = False
        if app.client_id != client_id:
            app.client_id = client_id
            updated = True
        if app.secret != secret:
            app.secret = secret
            updated = True

        current_settings = dict(getattr(app, "settings", {}) or {})
        next_settings = {
            "tenant": tenant_id,
            "login_url": login_url,
            "graph_url": graph_url,
        }
        if current_settings != next_settings:
            app.settings = next_settings
            updated = True

        if updated:
            app.save(update_fields=["client_id", "secret", "settings"])

        app.sites.add(site)
    except Exception:
        return


class CsluseAuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'csluse_auth'

    def ready(self):
        # Ensure signal handlers are registered
        from . import signals  # noqa: F401
        from django.db.models.signals import post_migrate

        post_migrate.connect(_ensure_google_socialapp, dispatch_uid="ensure_google_socialapp")
        post_migrate.connect(
            _ensure_microsoft_socialapp,
            dispatch_uid="ensure_microsoft_socialapp",
        )

        # Also try at startup (useful when env vars change and you don't rerun migrate)
        _ensure_google_socialapp()
        _ensure_microsoft_socialapp()
