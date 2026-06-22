from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .viewsets import DepartmentViewSet, MentorViewSet


router = SimpleRouter()
router.register(r"mentors", MentorViewSet, basename="mentor-users")
router.register(r"departments", DepartmentViewSet, basename="department-users")

urlpatterns = [
    path("", include(router.urls)),
]
