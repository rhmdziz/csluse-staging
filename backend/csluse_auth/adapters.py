"""
Custom adapters for django-allauth to handle email confirmation for API
"""
from urllib.parse import quote, urlencode

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.models import EmailAddress
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model
from django.conf import settings
from django.http import HttpResponseRedirect

from .models import Profile


User = get_user_model()

MICROSOFT_PROVIDER = "microsoft"
MICROSOFT_LOGIN_ERROR_QUERY_KEY = "auth_error"
MICROSOFT_LOGIN_PROVIDER_QUERY_KEY = "auth_provider"


def normalize_email(value):
    return str(value or "").strip().lower()


def is_microsoft_provider(provider):
    provider_id = getattr(provider, "id", provider)
    return str(provider_id or "").strip().lower() == MICROSOFT_PROVIDER


def is_campus_email(email):
    normalized = normalize_email(email)
    if "@" not in normalized:
        return False
    domain = normalized.split("@", 1)[1]
    campus_domain = settings.MICROSOFT_ALLOWED_DOMAIN
    return domain == campus_domain or domain.endswith(
        f".{campus_domain}"
    )


def build_frontend_auth_url(*, error=None):
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    if not error:
        return f"{frontend_url}/dashboard"

    query = urlencode(
        {
            MICROSOFT_LOGIN_PROVIDER_QUERY_KEY: MICROSOFT_PROVIDER,
            MICROSOFT_LOGIN_ERROR_QUERY_KEY: error,
        }
    )
    return f"{frontend_url}/login?{query}"


class CustomAccountAdapter(DefaultAccountAdapter):
    """
    Custom account adapter to redirect email confirmation to frontend
    """
    
    def get_email_confirmation_url(self, request, emailconfirmation):
        """
        Override to return frontend URL instead of backend URL
        """
        # Frontend URL with the confirmation key
        frontend_url = settings.FRONTEND_URL
        key = emailconfirmation.key
        email = emailconfirmation.email_address.email
        encoded_email = quote(email)
        return f"{frontend_url}/signup-guest/verify/{key}/?email={encoded_email}"
    
    def send_confirmation_mail(self, request, emailconfirmation, signup):
        """
        Override to use frontend URL in confirmation email
        """
        if request is not None and getattr(request, "_skip_email_confirmation", False):
            return
        activate_url = self.get_email_confirmation_url(request, emailconfirmation)
        backend_url = request.build_absolute_uri("/") if request else ""
        ctx = {
            "user": emailconfirmation.email_address.user,
            "activate_url": activate_url,
            "current_site": request.get_host(),
            "key": emailconfirmation.key,
            "frontend_url": settings.FRONTEND_URL.rstrip("/"),
            "backend_url": backend_url.rstrip("/"),
        }
        
        if signup:
            email_template = 'account/email/email_confirmation_signup'
        else:
            email_template = 'account/email/email_confirmation'
            
        self.send_mail(email_template, emailconfirmation.email_address.email, ctx)

    def send_password_reset_mail(self, request, email, context):
        backend_url = request.build_absolute_uri("/") if request else ""
        context["frontend_url"] = settings.FRONTEND_URL.rstrip("/")
        context["backend_url"] = backend_url.rstrip("/")
        self.send_mail("account/email/password_reset_key", email, context)


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def on_authentication_error(
        self,
        request,
        provider,
        error=None,
        exception=None,
        extra_context=None,
    ):
        if is_microsoft_provider(provider):
            raise ImmediateHttpResponse(
                self._redirect_with_error(request, "microsoft_failed")
            )
        return super().on_authentication_error(
            request,
            provider,
            error=error,
            exception=exception,
            extra_context=extra_context,
        )

    def pre_social_login(self, request, sociallogin):
        super().pre_social_login(request, sociallogin)

        if not is_microsoft_provider(getattr(sociallogin, "provider", None)):
            return

        email = normalize_email(getattr(sociallogin.user, "email", ""))
        if not email:
            raise ImmediateHttpResponse(
                self._redirect_with_error(request, "microsoft_missing_email")
            )
        if not is_campus_email(email):
            raise ImmediateHttpResponse(
                self._redirect_with_error(request, "microsoft_domain_invalid")
            )

        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user and not sociallogin.is_existing:
            sociallogin.connect(request, existing_user)

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        if is_microsoft_provider(getattr(sociallogin, "provider", None)):
            user.email = normalize_email(getattr(user, "email", ""))
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)
        if not is_microsoft_provider(getattr(sociallogin, "provider", None)):
            return user

        email = normalize_email(user.email)
        if email:
            email_address, _ = EmailAddress.objects.get_or_create(
                user=user,
                email=email,
                defaults={"verified": True, "primary": True},
            )
            if not email_address.verified or not email_address.primary:
                email_address.verified = True
                email_address.primary = True
                email_address.save(update_fields=["verified", "primary"])

        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={"user_type": "Internal", "role": "Guest"},
        )
        if hasattr(user, "profile"):
            user.profile.user_type = profile.user_type
            user.profile.role = profile.role
        return user

    def _redirect_with_error(self, request, error_code):
        return HttpResponseRedirect(build_frontend_auth_url(error=error_code))
