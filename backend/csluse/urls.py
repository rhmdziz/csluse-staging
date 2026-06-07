from django.urls import path, include
from . import viewsets as views
from rest_framework.routers import SimpleRouter


router = SimpleRouter()
router.register(r'images', views.ImageViewSet, basename='images')
router.register(r'rooms', views.RoomViewSet, basename='rooms')
router.register(r'equipments', views.EquipmentViewSet, basename='equipments')
router.register(r'materials', views.MaterialViewSet, basename='materials')
router.register(r'softwares', views.SoftwareViewSet, basename='softwares')
router.register(r'bookings', views.BookingViewSet, basename='bookings')
router.register(r'borrows', views.BorrowViewSet, basename='borrows')
router.register(r'announcements', views.AnnouncementViewSet, basename='announcements')
router.register(r'schedules', views.ScheduleViewSet, basename='schedules')
router.register(r'calendar', views.CalendarViewSet, basename='calendar')
router.register(r'dashboard-overview', views.DashboardOverviewViewSet, basename='dashboard-overview')
router.register(r'faqs', views.FAQViewSet, basename='faqs')
router.register(r'pengujians', views.PengujianViewSet, basename='pengujians')
router.register(r'notifications', views.NotificationViewSet, basename='notifications')
router.register(r'surat-bebas-lab', views.SuratBebasLabViewSet, basename='surat-bebas-lab')

urlpatterns = [
    path('', include(router.urls)),
]
