from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .viewsets import MentorViewSet


router = SimpleRouter()
router.register(r"mentors", MentorViewSet, basename="mentor-users")

urlpatterns = [
    path("", include(router.urls)),
]
