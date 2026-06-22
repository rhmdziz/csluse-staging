from django.contrib import admin

from .models import Department, Profile


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "updated_at")
    search_fields = ("name",)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "user",
        "full_name",
        "initials",
        "role",
        "institution",
        "user_groups",
        "user_type",
        "department",
        "batch",
    )
    search_fields = ("email", "user__email", "full_name", "initials", "id_number", "institution")
    list_filter = ("role", "user_type", "department", "batch")
    readonly_fields = ("user_groups",)

    def user_groups(self, obj):
        """Show Django auth groups attached to the user."""
        if obj.user is None:
            return "-"
        return ", ".join(obj.user.groups.values_list("name", flat=True))

    user_groups.short_description = "Groups"
