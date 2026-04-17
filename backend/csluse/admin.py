from django.contrib import admin

from .models import *

admin.site.register(Image)
admin.site.register(Room)


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "status", "quantity", "room", "is_moveable", "is_shareable", "is_borrowable", "is_useable")
    list_filter = ("status", "category", "is_moveable", "is_shareable", "is_borrowable", "is_useable")
    search_fields = ("name", "description")
    list_editable = ("is_useable",)


admin.site.register(Booking)
admin.site.register(Borrow)
admin.site.register(Notification)
admin.site.register(Announcement)
admin.site.register(Schedule)
admin.site.register(FAQ)
admin.site.register(Pengujian)
admin.site.register(Use)
admin.site.register(Document)
admin.site.register(Software)
admin.site.register(BookingEquipmentItem)
admin.site.register(Material)
