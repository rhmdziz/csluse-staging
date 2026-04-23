from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .viewsets import MentorViewSet


router = DefaultRouter()
router.register(r"mentors", MentorViewSet, basename="mentor-users")

urlpatterns = [
    path("", include(router.urls)),
]
