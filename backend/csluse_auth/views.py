import logging
import os

from django.core.exceptions import PermissionDenied
from django.http import HttpResponseRedirect
from django.urls import reverse
from requests import RequestException

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.helpers import (
    complete_social_login,
    render_authentication_error,
)
from allauth.socialaccount.providers.base import ProviderException
from allauth.socialaccount.providers.base.constants import AuthError
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.microsoft.views import MicrosoftGraphOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Error
from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView, OAuth2LoginView
from dj_rest_auth.jwt_auth import set_jwt_cookies
from dj_rest_auth.utils import jwt_encode
from rest_framework.generics import GenericAPIView
from allauth.account.models import EmailAddress
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .adapters import (
    MICROSOFT_EXPECTED_EMAIL_SESSION_KEY,
    build_frontend_auth_url,
    is_campus_email,
    normalize_email,
)
from .serializers import EmailVerificationStatusSerializer, LoginRoutingSerializer

logger = logging.getLogger(__name__)


def is_microsoft_oauth_configured():
    return bool(
        os.getenv("MICROSOFT_CLIENT_ID")
        and os.getenv("MICROSOFT_CLIENT_SECRET")
        and os.getenv("MICROSOFT_TENANT_ID")
    )


def clear_microsoft_oauth_session(request):
    request.session.pop(MICROSOFT_EXPECTED_EMAIL_SESSION_KEY, None)
    request.session.modified = True


def redirect_frontend_auth_error(request, error_code):
    logger.warning(
        "Microsoft OAuth redirecting with error",
        extra={
            "error_code": error_code,
            "expected_email": request.session.get(MICROSOFT_EXPECTED_EMAIL_SESSION_KEY),
        },
    )
    clear_microsoft_oauth_session(request)
    return HttpResponseRedirect(build_frontend_auth_url(error=error_code))


def append_jwt_cookies(request, response, login):
    user = getattr(login, "user", None)
    if user is None and getattr(request, "user", None) and request.user.is_authenticated:
        user = request.user

    if user is not None:
        access_token, refresh_token = jwt_encode(user)
        set_jwt_cookies(response, access_token, refresh_token)
        logger.info(
            "Microsoft OAuth JWT cookies set",
            extra={
                "user_id": str(getattr(user, "pk", "")),
                "email": getattr(user, "email", ""),
                "location": response.get("Location", ""),
            },
        )
    else:
        logger.warning(
            "Microsoft OAuth completed without authenticated user for JWT cookies",
            extra={"location": response.get("Location", "")},
        )
    return response


class GoogleOAuth2CallbackView(OAuth2CallbackView):
    def dispatch(self, request, *args, **kwargs):
        provider = self.adapter.get_provider()
        state, resp = self._get_state(request, provider)
        if resp:
            return resp
        if "error" in request.GET or "code" not in request.GET:
            auth_error = request.GET.get("error", None)
            if auth_error == self.adapter.login_cancelled_error:
                error = AuthError.CANCELLED
            else:
                error = AuthError.UNKNOWN
            return render_authentication_error(
                request,
                provider,
                error=error,
                extra_context={
                    "state": state,
                    "callback_view": self,
                },
            )
        app = provider.app
        client = self.adapter.get_client(self.request, app)

        try:
            access_token = self.adapter.get_access_token_data(
                request, app, client, pkce_code_verifier=state.get("pkce_code_verifier")
            )
            token = self.adapter.parse_token(access_token)
            if app.pk:
                token.app = app
            login = self.adapter.complete_login(
                request, app, token, response=access_token
            )
            login.token = token
            login.state = state
            response = complete_social_login(request, login)
        except (
            PermissionDenied,
            OAuth2Error,
            RequestException,
            ProviderException,
        ) as exc:
            return render_authentication_error(
                request, provider, exception=exc, extra_context={"state": state}
            )

        if getattr(login, "user", None):
            append_jwt_cookies(request, response, login)

        return response


google_oauth2_callback = GoogleOAuth2CallbackView.adapter_view(GoogleOAuth2Adapter)


microsoft_oauth2_login = OAuth2LoginView.adapter_view(MicrosoftGraphOAuth2Adapter)


class MicrosoftOAuth2LoginStartView(GenericAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        email = normalize_email(request.GET.get("email"))
        if not email or not is_campus_email(email):
            return redirect_frontend_auth_error(request, "microsoft_domain_invalid")
        if not is_microsoft_oauth_configured():
            return redirect_frontend_auth_error(request, "microsoft_not_configured")

        request.session[MICROSOFT_EXPECTED_EMAIL_SESSION_KEY] = email
        request.session.modified = True
        logger.info("Microsoft OAuth start", extra={"expected_email": email})
        try:
            return microsoft_oauth2_login(request)
        except ImmediateHttpResponse as exc:
            return exc.response


class MicrosoftOAuth2CallbackView(OAuth2CallbackView):
    def dispatch(self, request, *args, **kwargs):
        logger.info(
            "Microsoft OAuth callback received",
            extra={
                "expected_email": request.session.get(MICROSOFT_EXPECTED_EMAIL_SESSION_KEY),
                "has_code": "code" in request.GET,
                "has_error": "error" in request.GET,
            },
        )
        auth_error = request.GET.get("error", None)
        if auth_error:
            if auth_error == self.adapter.login_cancelled_error:
                return redirect_frontend_auth_error(request, "microsoft_cancelled")
            return redirect_frontend_auth_error(request, "microsoft_failed")
        if "code" not in request.GET:
            return redirect_frontend_auth_error(request, "microsoft_failed")

        provider = self.adapter.get_provider()
        state, resp = self._get_state(request, provider)
        if resp:
            return resp

        app = provider.app
        client = self.adapter.get_client(self.request, app)

        try:
            access_token = self.adapter.get_access_token_data(
                request, app, client, pkce_code_verifier=state.get("pkce_code_verifier")
            )
            token = self.adapter.parse_token(access_token)
            if app.pk:
                token.app = app
            login = self.adapter.complete_login(
                request, app, token, response=access_token
            )
            login.token = token
            login.state = state
            response = complete_social_login(request, login)
            logger.info(
                "Microsoft OAuth social login completed",
                extra={
                    "login_user_email": getattr(getattr(login, "user", None), "email", ""),
                    "request_user_authenticated": bool(
                        getattr(getattr(request, "user", None), "is_authenticated", False)
                    ),
                    "location": response.get("Location", ""),
                },
            )
            response = append_jwt_cookies(request, response, login)
            clear_microsoft_oauth_session(request)
            return response
        except ImmediateHttpResponse as exc:
            return exc.response
        except (
            PermissionDenied,
            OAuth2Error,
            RequestException,
            ProviderException,
        ) as exc:
            logger.exception("Microsoft OAuth callback failed: %s", exc)
            return redirect_frontend_auth_error(request, "microsoft_failed")


microsoft_oauth2_callback = MicrosoftOAuth2CallbackView.adapter_view(
    MicrosoftGraphOAuth2Adapter
)


class LoginRouteView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = LoginRoutingSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        if not is_campus_email(email):
            return Response({"mode": "local"})

        if not is_microsoft_oauth_configured():
            return Response(
                {
                    "detail": "Microsoft login belum dikonfigurasi.",
                    "code": "microsoft_not_configured",
                },
                status=503,
            )

        authorization_url = request.build_absolute_uri(
            reverse("microsoft_login_start")
        )
        return Response(
            {
                "mode": "microsoft",
                "authorization_url": f"{authorization_url}?email={email}",
            }
        )


class EmailVerificationStatusView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = EmailVerificationStatusSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()

        address = EmailAddress.objects.filter(email__iexact=email).first()
        if not address:
            return Response({"exists": False, "verified": False})

        return Response({"exists": True, "verified": bool(address.verified)})
