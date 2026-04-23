from django.conf import settings
from django.http import HttpResponseRedirect
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EmailVerificationStatusView,
    LoginView,
    LogoutView,
    MicrosoftOAuth2LoginStartView,
    microsoft_oauth2_callback,
)
from .viewsets import (
    ProfileViewSet,
)

def password_reset_confirm_redirect(request, uidb64, token):
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    return HttpResponseRedirect(
        f"{frontend_url}/reset-password/{uidb64}/{token}/"
    )

router = DefaultRouter()
router.register(r'user/profile', ProfileViewSet, basename='profile')

urlpatterns = [
    path(
        'login/',
        LoginView.as_view(),
        name='login',
    ),
    path(
        'password/reset/confirm/<uidb64>/<token>/',
        password_reset_confirm_redirect,
        name='password_reset_confirm',
    ),
    path(
        'oauth/microsoft/login/',
        MicrosoftOAuth2LoginStartView.as_view(),
        name='microsoft_login_start',
    ),
    path(
        'oauth/microsoft/login/callback/',
        microsoft_oauth2_callback,
        name='microsoft_callback',
    ),
    path(
        'registration/check-email/',
        EmailVerificationStatusView.as_view(),
        name='email_verification_status',
    ),
    path(
        'logout/',
        LogoutView.as_view(),
        name='logout',
    ),
    path('', include(router.urls)),
    path('', include('dj_rest_auth.urls')),
    path('oauth/', include('allauth.urls')),
    path('registration/', include('dj_rest_auth.registration.urls')),
]
