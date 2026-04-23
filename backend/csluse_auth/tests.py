from allauth.account.models import EmailAddress
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.test import TestCase
from datetime import timedelta
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework import status
from rest_framework.test import APITestCase

from csluse.models import Booking, Borrow, Equipment, Pengujian, Room
from csluse_auth.models import Profile
from csluse_auth.audit import log_admin_action
from csluse_auth.permissions import ADMINISTRATOR, SUPER_ADMINISTRATOR, assign_role

User = get_user_model()


class AuthBaseTestMixin:
    def create_user(
        self,
        *,
        email,
        full_name="Test User",
        role="Guest",
        department=None,
        batch=None,
        id_number=None,
        user_type="External",
        institution=None,
        verified=False,
        group_role=None,
    ):
        username = email.split("@")[0]
        user = User.objects.create_user(
            username=f"{username}_{User.objects.count() + 1}",
            email=email,
            password="testpass123",
        )
        profile = user.profile
        profile.full_name = full_name
        profile.role = role
        profile.department = department
        profile.batch = batch
        profile.id_number = id_number
        profile.user_type = user_type
        profile.institution = institution
        profile.save()

        if group_role:
            assign_role(user, group_role)

        if verified:
            EmailAddress.objects.create(
                user=user,
                email=email,
                verified=True,
                primary=True,
            )

        return user


class ProfileModelTests(AuthBaseTestMixin, TestCase):
    def test_profile_save_normalizes_initials_and_clears_invalid_institution(self):
        user = self.create_user(
            email="profile@example.com",
            full_name="Jane Doe",
            role="Guest",
            institution="External Lab",
        )

        profile = user.profile
        profile.initials = ""
        profile.save()
        self.assertEqual(profile.initials, "JDJ")
        self.assertEqual(profile.institution, "External Lab")

        profile.role = "Staff"
        profile.institution = "Should Be Cleared"
        profile.save()
        profile.refresh_from_db()

        self.assertEqual(profile.initials, "JDJ")
        self.assertIsNone(profile.institution)


class UserWithProfileViewSetTests(AuthBaseTestMixin, APITestCase):
    def setUp(self):
        self.admin = self.create_user(
            email="admin@example.com",
            full_name="Admin User",
            role="Admin",
        )
        assign_role(self.admin, ADMINISTRATOR)
        self.client.force_authenticate(user=self.admin)

    def test_list_filters_users_and_returns_role_aggregates(self):
        self.create_user(
            email="alice@example.com",
            full_name="Alice Student",
            role="Student",
            department="Digital Business Technology",
            batch="2024",
            id_number="STD-001",
            user_type="Internal",
            verified=True,
        )
        self.create_user(
            email="bob@example.com",
            full_name="Bob Lecturer",
            role="Lecturer",
            department="Digital Business Technology",
            id_number="LEC-001",
            user_type="Internal",
        )
        self.create_user(
            email="charlie@example.com",
            full_name="Charlie Student",
            role="Student",
            department="Business Mathematics",
            batch="2024",
            id_number="STD-002",
            user_type="Internal",
            verified=True,
        )

        response = self.client.get(
            "/api/admin/users/",
            {
                "department": "Digital Business Technology",
                "batch": "2024",
                "search": "Alice",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["email"], "alice@example.com")
        self.assertTrue(response.data["results"][0]["is_verified"])
        self.assertEqual(response.data["aggregates"]["total"], 1)
        self.assertEqual(response.data["aggregates"]["student"], 1)
        self.assertEqual(response.data["aggregates"]["lecturer"], 0)
        self.assertEqual(response.data["aggregates"]["guest"], 0)

    def test_bulk_delete_skips_super_administrator_and_deletes_regular_users(self):
        deletable_user = self.create_user(
            email="deletable@example.com",
            full_name="Delete Me",
            role="Student",
            batch="2024",
        )
        protected_user = self.create_user(
            email="superadmin@example.com",
            full_name="Protected User",
            role="Admin",
            group_role=SUPER_ADMINISTRATOR,
        )

        response = self.client.post(
            "/api/admin/users/bulk-delete/",
            {"ids": [deletable_user.pk, protected_user.pk, 999999]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deleted_count"], 1)
        self.assertEqual(response.data["failed_count"], 2)
        self.assertEqual(response.data["deleted_ids"], [deletable_user.pk])
        self.assertCountEqual(response.data["failed_ids"], [protected_user.pk, 999999])
        self.assertFalse(User.objects.filter(pk=deletable_user.pk).exists())
        self.assertTrue(User.objects.filter(pk=protected_user.pk).exists())
        self.assertEqual(
            LogEntry.objects.filter(
                user=self.admin,
                object_id=str(deletable_user.pk),
                action_flag=DELETION,
            ).count(),
            1,
        )

    def test_list_aggregates_follow_role_filter(self):
        self.create_user(
            email="student-filter@example.com",
            full_name="Student Filter",
            role="Student",
            department="Digital Business Technology",
            batch="2024",
            id_number="STD-010",
            user_type="Internal",
            verified=True,
        )
        self.create_user(
            email="guest-filter@example.com",
            full_name="Guest Filter",
            role="Guest",
            institution="External Lab",
            user_type="External",
            verified=True,
        )

        response = self.client.get("/api/admin/users/", {"role": "Guest"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["aggregates"]["total"], 1)
        self.assertEqual(response.data["aggregates"]["guest"], 1)
        self.assertEqual(response.data["aggregates"]["student"], 0)


class AdminActionViewSetTests(AuthBaseTestMixin, APITestCase):
    def setUp(self):
        self.admin = self.create_user(
            email="audit-admin@example.com",
            full_name="Audit Admin",
            role="Admin",
        )
        assign_role(self.admin, ADMINISTRATOR)
        self.client.force_authenticate(user=self.admin)

    def test_recent_only_returns_actions_from_admin_actors(self):
        student = self.create_user(
            email="student-audit@example.com",
            full_name="Student Audit",
            role="Student",
            verified=True,
        )
        admin_target = self.create_user(
            email="managed-user@example.com",
            full_name="Managed User",
            role="Guest",
            verified=True,
        )

        log_admin_action(self.admin, admin_target.profile, DELETION, "Admin deleted a managed profile.")
        log_admin_action(student, student.profile, DELETION, "Student updated own profile.")

        response = self.client.get("/api/admin/actions/recent/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["actor"], self.admin.email)
        self.assertEqual(response.data[0]["object_id"], str(admin_target.profile.pk))


class JwtCookieAuthFlowTests(AuthBaseTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user(
            email="jwt-user@example.com",
            full_name="JWT User",
            role="Student",
            department="Digital Business Technology",
            batch="2024",
            id_number="STD-999",
            user_type="Internal",
            verified=True,
        )

    def _expired_access_token(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=-1))
        return str(token)

    def _valid_refresh_token(self):
        return str(RefreshToken.for_user(self.user))

    def _expired_refresh_token(self):
        token = RefreshToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=-1))
        return str(token)

    def test_profile_request_with_expired_access_returns_unauthorized(self):
        self.client.cookies["access"] = self._expired_access_token()

        response = self.client.get("/api/auth/user/profile/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_endpoint_uses_refresh_cookie_to_issue_new_access_token(self):
        self.client.cookies["refresh"] = self._valid_refresh_token()

        response = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("access", response.cookies)

    def test_refresh_endpoint_rejects_expired_refresh_cookie(self):
        self.client.cookies["refresh"] = self._expired_refresh_token()

        response = self.client.post("/api/auth/token/refresh/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_succeeds_after_refreshing_expired_access_cookie(self):
        self.client.cookies["access"] = self._expired_access_token()
        self.client.cookies["refresh"] = self._valid_refresh_token()

        refresh_response = self.client.post("/api/auth/token/refresh/", {}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)

        self.client.cookies["access"] = refresh_response.cookies["access"].value
        profile_response = self.client.get("/api/auth/user/profile/")

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["email"], self.user.email)


class PicUserViewSetTests(AuthBaseTestMixin, APITestCase):
    def setUp(self):
        self.admin = self.create_user(
            email="pic-admin@example.com",
            full_name="PIC Admin",
            role="Admin",
        )
        assign_role(self.admin, ADMINISTRATOR)
        self.client.force_authenticate(user=self.admin)

    def test_dropdown_returns_all_eligible_pic_candidates(self):
        assigned_lecturer = self.create_user(
            email="assigned-lecturer@example.com",
            full_name="Assigned Lecturer",
            role="Lecturer",
        )
        eligible_admin = self.create_user(
            email="eligible-admin@example.com",
            full_name="Eligible Admin",
            role="Admin",
        )
        self.create_user(
            email="staff-user@example.com",
            full_name="Staff User",
            role="Staff",
        )
        room = Room.objects.create(name="Lab A", number="101")
        room.pics.add(assigned_lecturer.profile)

        response = self.client.get("/api/admin/pic-users/dropdown/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(str(assigned_lecturer.profile.id), returned_ids)
        self.assertIn(str(eligible_admin.profile.id), returned_ids)
        self.assertNotIn(str(self.admin.profile.id), returned_ids)

    def test_assigned_dropdown_returns_only_assigned_pic_users(self):
        assigned_lecturer = self.create_user(
            email="assigned-only@example.com",
            full_name="Assigned Only",
            role="Lecturer",
        )
        unassigned_admin = self.create_user(
            email="unassigned-admin@example.com",
            full_name="Unassigned Admin",
            role="Admin",
        )
        room = Room.objects.create(name="Lab B", number="102")
        room.pics.add(assigned_lecturer.profile)

        response = self.client.get("/api/admin/pic-users/assigned-dropdown/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertIn(str(assigned_lecturer.profile.id), returned_ids)
        self.assertNotIn(str(unassigned_admin.profile.id), returned_ids)


class AdminDashboardKpisTests(AuthBaseTestMixin, APITestCase):
    def setUp(self):
        self.admin = self.create_user(
            email="dashboard-admin@example.com",
            full_name="Dashboard Admin",
            role="Admin",
            verified=True,
            group_role=ADMINISTRATOR,
        )
        self.client.force_authenticate(user=self.admin)

        room = Room.objects.create(
            name="Lab A",
            capacity=20,
            number="101",
            floor=1,
        )
        equipment = Equipment.objects.create(
            name="Oscilloscope",
            quantity=2,
            room=room,
        )
        requester = self.create_user(
            email="requester@example.com",
            full_name="Requester User",
            role="Student",
            department="Digital Business Technology",
            batch="2024",
            id_number="STD-100",
            user_type="Internal",
            verified=True,
        )
        start_time = timezone.localtime(timezone.now()).replace(
            hour=9,
            minute=0,
            second=0,
            microsecond=0,
        )
        if start_time <= timezone.localtime(timezone.now()):
            start_time = start_time + timedelta(days=1)
        end_time = start_time + timedelta(hours=2)

        Booking.objects.create(
            requested_by=requester.profile,
            room=room,
            start_time=start_time,
            end_time=end_time,
        )
        Borrow.objects.create(
            requested_by=requester.profile,
            equipment=equipment,
            start_time=start_time,
            end_time=end_time + timedelta(days=1),
        )
        Pengujian.objects.create(
            name="Sample Request",
            email="sample@example.com",
            sample_type="Liquid",
            requested_by=requester.profile,
        )

    def test_admin_dashboard_kpis_include_pengujian_totals(self):
        response = self.client.get("/api/admin/dashboard/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_rooms"], 1)
        self.assertEqual(response.data["total_equipments"], 1)
        self.assertEqual(response.data["total_bookings"], 1)
        self.assertEqual(response.data["total_borrows"], 1)
        self.assertEqual(response.data["total_pengujians"], 1)
