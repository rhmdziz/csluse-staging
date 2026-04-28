from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from unittest.mock import patch

from csluse.models import (
    Borrow,
    Booking,
    BookingEquipmentItem,
    Document,
    Equipment,
    Notification,
    Pengujian,
    Room,
    SuratBebasLab,
)
from csluse_auth.models import Profile

User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_URL="https://frontend.example.com",
)
class CsluseWorkflowRegressionTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        mail.outbox = []
        self.student_user, self.student_profile = self.create_user_with_profile(
            "student@example.com",
            "Student",
            "Student User",
        )
        self.staff_user, self.staff_profile = self.create_user_with_profile(
            "staff@example.com",
            "Staff",
            "Staff User",
        )
        self.lecturer_user, self.lecturer_profile = self.create_user_with_profile(
            "lecturer@example.com",
            "Lecturer",
            "Lecturer User",
        )
        self.lecturer_profile.is_mentor = True
        self.lecturer_profile.save(update_fields=["is_mentor"])
        self.admin_user, self.admin_profile = self.create_user_with_profile(
            "admin@example.com",
            "Admin",
            "Admin User",
        )
        self.second_admin_user, self.second_admin_profile = self.create_user_with_profile(
            "admin2@example.com",
            "Admin",
            "Second Admin User",
        )

        self.room = Room.objects.create(
            name="Lab A",
            capacity=20,
            number="101",
            floor=1,
        )
        self.equipment = Equipment.objects.create(
            name="Oscilloscope",
            quantity=5,
            room=self.room,
            is_moveable=True,
        )
        self.other_room = Room.objects.create(
            name="Lab B",
            capacity=15,
            number="102",
            floor=1,
        )
        self.other_equipment = Equipment.objects.create(
            name="Microscope",
            quantity=3,
            room=self.other_room,
            is_moveable=True,
        )
        self.room.pics.add(self.admin_profile)
        self.other_room.pics.add(self.lecturer_profile)

    def create_user_with_profile(self, email, role, full_name):
        user = User.objects.create_user(
            username=email.split("@")[0],
            email=email,
            password="password123",
        )
        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={
                "role": role,
                "full_name": full_name,
                "user_type": "Internal",
            },
        )
        profile.refresh_from_db()
        return user, profile

    def test_booking_requesters_endpoint_returns_unique_requesters(self):
        self.student_profile.department = "Digital Business Technology"
        self.student_profile.save(update_fields=["department"])
        self.create_booking(self.student_profile)
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/bookings/all/requesters/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(self.student_profile.id))
        self.assertEqual(response.data[0]["department"], "Digital Business Technology")

    def test_booking_all_supports_department_and_room_filters(self):
        other_user, other_profile = self.create_user_with_profile(
            "other-student@example.com",
            "Student",
            "Other Student",
        )
        other_profile.department = "Business Mathematics"
        other_profile.save(update_fields=["department"])
        self.student_profile.department = "Digital Business Technology"
        self.student_profile.save(update_fields=["department"])

        self.create_booking(self.student_profile)
        self.create_booking(other_profile)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            f"/api/bookings/all/?department=DIGITAL%20BUSINESS%20TECHNOLOGY&room={self.room.id}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["requested_by_detail"]["department"],
            "Digital Business Technology",
        )

    def test_lecturer_can_create_booking_request(self):
        start, end = self.future_window(days=3, start_hour=9)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "attendee_count": 1,
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["requested_by_detail"]["id"], str(self.lecturer_profile.id))
        self.assertEqual(response.data["purpose"], "Penelitian")

    def test_booking_request_requires_h_plus_2_start_date(self):
        start, end = self.future_window(days=1, start_hour=9)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "attendee_count": 1,
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("H+2", response.data["start_time"][0])

    def test_admin_can_bulk_import_legacy_booking_history(self):
        self.client.force_authenticate(user=self.admin_user)
        start = timezone.now() - timedelta(days=30)
        end = start + timedelta(hours=2)

        response = self.client.post(
            "/api/bookings/legacy-bulk-import/",
            {
                "rows": [
                    {
                        "index": 2,
                        "requester_name": "Peminjam Legacy",
                        "room_name": "Lab Legacy",
                        "start_time": start.isoformat(),
                        "end_time": end.isoformat(),
                        "status": "Completed",
                        "attendee_count": 12,
                        "purpose": "Penelitian",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["success_count"], 1)
        booking = Booking.objects.get()
        self.assertIsNone(booking.room_id)
        self.assertEqual(booking.room_name, "Lab Legacy")
        self.assertEqual(booking.status, "Completed")
        self.assertEqual(booking.attendee_count, 12)
        self.assertEqual(booking.requester_name, "Peminjam Legacy")
        self.assertTrue(booking.code.startswith("CSLUSE020"))

    def test_admin_can_bulk_import_legacy_sample_testing_history(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            "/api/pengujians/legacy-bulk-import/",
            {
                "rows": [
                    {
                        "index": 2,
                        "name": "Legacy Requester",
                        "email": "legacy@example.com",
                        "sample_type": "Air",
                        "status": "Completed",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["success_count"], 1)
        pengujian = Pengujian.objects.get()
        self.assertEqual(pengujian.name, "Legacy Requester")
        self.assertEqual(pengujian.status, "Completed")
        self.assertTrue(pengujian.code.startswith("CSLUSE020"))

    def test_booking_request_can_cross_weekend_when_within_three_months(self):
        start, end = self.future_weekday_window(
            4,
            min_days=2,
            start_hour=9,
            duration_days=10,
            duration_hours=7,
        )
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "attendee_count": 1,
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_booking_request_cannot_exceed_three_months(self):
        start, _ = self.future_window(days=3, start_hour=9)
        end = start + timedelta(days=100)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "attendee_count": 1,
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maksimal 3 bulan", response.data["end_time"][0])

    def test_lecturer_can_create_borrow_request(self):
        start, end = self.future_window(days=3, start_hour=11)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/borrows/",
            {
                "equipment": str(self.equipment.id),
                "quantity": 1,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["requested_by_detail"]["id"], str(self.lecturer_profile.id))
        self.assertEqual(response.data["purpose"], "Penelitian")

    def test_borrow_request_requires_h_plus_2_start_date(self):
        start, end = self.future_window(days=1, start_hour=11)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/borrows/",
            {
                "equipment": str(self.equipment.id),
                "quantity": 1,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("H+2", response.data["start_time"][0])

    def test_borrow_request_can_cross_weekend_when_within_three_months(self):
        start, end = self.future_weekday_window(
            4,
            min_days=2,
            start_hour=11,
            duration_days=10,
            duration_hours=2,
        )
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/borrows/",
            {
                "equipment": str(self.equipment.id),
                "quantity": 1,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_borrow_request_cannot_exceed_three_months(self):
        start, _ = self.future_window(days=3, start_hour=11)
        end = start + timedelta(days=100)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/borrows/",
            {
                "equipment": str(self.equipment.id),
                "quantity": 1,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("maksimal 3 bulan", response.data["end_time"][0])

    def test_borrow_request_glassware_is_limited_to_five_units(self):
        glassware = Equipment.objects.create(
            name="Beaker Set",
            quantity=12,
            category="Glassware",
            room=self.room,
            is_moveable=True,
            is_borrowable=True,
        )
        start, end = self.future_window(days=3, start_hour=11)
        self.client.force_authenticate(user=self.lecturer_user)

        response = self.client.post(
            "/api/borrows/",
            {
                "equipment": str(glassware.id),
                "quantity": 6,
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "Glassware hanya boleh dipinjam maksimal 5 unit",
            response.data["quantity"][0],
        )

    def future_window(self, *, days=1, start_hour=9, duration_hours=2):
        local_now = timezone.localtime(timezone.now()) + timedelta(days=days)
        start = local_now.replace(
            hour=start_hour,
            minute=0,
            second=0,
            microsecond=0,
        )
        end = start + timedelta(hours=duration_hours)
        return start, end

    def future_weekday_window(self, weekday, *, min_days=2, start_hour=9, duration_days=0, duration_hours=2):
        local_now = timezone.localtime(timezone.now())
        days_until_weekday = (weekday - local_now.weekday()) % 7
        while days_until_weekday < min_days:
            days_until_weekday += 7

        start = (local_now + timedelta(days=days_until_weekday)).replace(
            hour=start_hour,
            minute=0,
            second=0,
            microsecond=0,
        )
        end = start + timedelta(days=duration_days, hours=duration_hours)
        return start, end

    def create_booking(self, requested_by, *, purpose="Penelitian", requester_mentor_profile=None):
        start, end = self.future_window()
        return Booking.objects.create(
            requested_by=requested_by,
            room=self.room,
            start_time=start,
            end_time=end,
            attendee_count=1,
            purpose=purpose,
            requester_mentor="Lecturer User" if requester_mentor_profile else None,
            requester_mentor_profile=requester_mentor_profile,
        )

    def create_booking_for_room(self, requested_by, room):
        start, end = self.future_window()
        return Booking.objects.create(
            requested_by=requested_by,
            room=room,
            start_time=start,
            end_time=end,
            attendee_count=1,
            purpose="Penelitian",
        )

    def create_borrow(self, requested_by, *, status="Pending", approved_by=None, purpose="Penelitian", requester_mentor_profile=None):
        start, end = self.future_window(days=2, start_hour=11)
        return Borrow.objects.create(
            requested_by=requested_by,
            equipment=self.equipment,
            quantity=1,
            start_time=start,
            end_time=end,
            purpose=purpose,
            status=status,
            approved_by=approved_by,
            requester_mentor="Lecturer User" if requester_mentor_profile else None,
            requester_mentor_profile=requester_mentor_profile,
        )

    def create_borrow_for_equipment(self, requested_by, equipment, *, status="Pending", approved_by=None):
        start, end = self.future_window(days=2, start_hour=11)
        return Borrow.objects.create(
            requested_by=requested_by,
            equipment=equipment,
            quantity=1,
            start_time=start,
            end_time=end,
            purpose="Penelitian",
            status=status,
            approved_by=approved_by,
        )

    def create_pengujian(self, requested_by, *, status="Pending"):
        return Pengujian.objects.create(
            requested_by=requested_by,
            name="Pemohon Uji",
            institution="CSL",
            institution_address="Jl. Contoh",
            email="pemohon@example.com",
            phone_number="08123456789",
            sample_name="Sampel A",
            sample_type="Food Sample",
            sample_brand="Brand A",
            sample_packaging="Box",
            sample_weight="1 kg",
            sample_quantity="2",
            sample_testing_serving="Dingin",
            sample_testing_method="Metode A",
            sample_testing_type="Kimia",
            status=status,
        )

    def create_surat_bebas_lab(self, requested_by, *, status="Pending", note=""):
        return SuratBebasLab.objects.create(
            requested_by=requested_by,
            status=status,
            note=note,
        )

    def test_staff_cannot_access_booking_approval_scope(self):
        self.create_booking_for_room(self.student_profile, self.room)
        self.create_booking_for_room(self.student_profile, self.other_room)

        self.client.force_authenticate(self.staff_user)
        response = self.client.get("/api/bookings/all/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_cannot_access_borrow_approval_scope(self):
        self.create_borrow_for_equipment(self.student_profile, self.equipment)
        self.create_borrow_for_equipment(self.student_profile, self.other_equipment)

        self.client.force_authenticate(self.staff_user)
        response = self.client.get("/api/borrows/all/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lecturer_can_access_approval_scope_for_their_pic_room(self):
        self.create_booking_for_room(self.student_profile, self.room)
        scoped_booking = self.create_booking_for_room(self.student_profile, self.other_room)

        self.client.force_authenticate(self.lecturer_user)
        response = self.client.get("/api/bookings/all/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(scoped_booking.id))

    def test_staff_cannot_approve_pengujian_and_admin_can(self):
        self.client.force_authenticate(self.student_user)
        create_response = self.client.post(
            "/api/pengujians/",
            {
                "name": "Pemohon Uji",
                "email": "pemohon@example.com",
                "sample_type": "Food Sample",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertCountEqual(
            mail.outbox[0].to,
            ["admin@example.com", "admin2@example.com"],
        )
        mail.outbox = []
        pengujian_id = create_response.data["id"]

        self.client.force_authenticate(self.staff_user)
        denied_response = self.client.post(
            f"/api/pengujians/{pengujian_id}/approve/",
            {},
            format="json",
        )
        self.assertIn(
            denied_response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )

        self.client.force_authenticate(self.admin_user)
        approve_response = self.client.post(
            f"/api/pengujians/{pengujian_id}/approve/",
            {},
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_response.data["status"], "Approved")
        notification = Notification.objects.get(recipient=self.student_profile)
        self.assertEqual(notification.category, "Approved")
        self.assertIn("pengujian sampel", notification.message.lower())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Update status request", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ["student@example.com"])
        self.assertCountEqual(
            mail.outbox[0].cc,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertIn("https://frontend.example.com/sample-testing", mail.outbox[0].body)

    def test_student_cannot_self_approve_booking(self):
        booking = self.create_booking(self.student_profile)

        self.client.force_authenticate(self.student_user)
        response = self.client.post(
            f"/api/bookings/{booking.id}/approve/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_self_approve_booking(self):
        booking = self.create_booking(self.admin_profile)

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(
            f"/api/bookings/{booking.id}/approve/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "Approved")

    def test_booking_approval_creates_notification_for_requester(self):
        booking = self.create_booking(self.student_profile)

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(f"/api/bookings/{booking.id}/approve/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification = Notification.objects.get(recipient=self.student_profile)
        self.assertEqual(notification.category, "Approved")
        self.assertIn(booking.code, notification.message)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["student@example.com"])
        self.assertCountEqual(
            mail.outbox[0].cc,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertIn(f"https://frontend.example.com/booking-rooms/{booking.id}", mail.outbox[0].body)
        self.assertIn("disetujui", mail.outbox[0].body)

    def test_lab_clearance_rejection_creates_notification_for_requester(self):
        request_item = self.create_surat_bebas_lab(self.student_profile)

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(
            f"/api/surat-bebas-lab/{request_item.id}/reject/",
            {"note": "Masih ada tanggungan alat."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        request_item.refresh_from_db()
        self.assertEqual(request_item.status, "Rejected")
        self.assertEqual(request_item.note, "Masih ada tanggungan alat.")

        notification = Notification.objects.get(recipient=self.student_profile, category="Rejected")
        self.assertIn(request_item.code, notification.message)
        self.assertIn("Masih ada tanggungan alat.", notification.message)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["student@example.com"])
        self.assertIn("ditolak", mail.outbox[0].body)
        self.assertIn("Masih ada tanggungan alat.", mail.outbox[0].body)
        self.assertIn("https://frontend.example.com/lab-clearance", mail.outbox[0].body)

    def test_overdue_borrow_creates_reminder_notification(self):
        borrow = self.create_borrow(
            self.student_profile,
            status="Borrowed",
            approved_by=self.admin_profile,
        )
        Borrow.objects.filter(pk=borrow.pk).update(
            start_time=timezone.now() - timedelta(days=2),
            end_time=timezone.now() - timedelta(hours=1),
            status="Borrowed",
        )

        self.client.force_authenticate(self.student_user)
        response = self.client.get("/api/borrows/my/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification = Notification.objects.get(recipient=self.student_profile, category="Reminder")
        self.assertIn("overdue", notification.message.lower())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["student@example.com"])
        self.assertEqual(mail.outbox[0].cc, ["admin@example.com"])
        self.assertIn("Pengingat pengembalian alat", mail.outbox[0].subject)
        self.assertIn(f"https://frontend.example.com/borrow-equipment/{borrow.id}", mail.outbox[0].body)

    def test_overdue_borrow_email_is_only_sent_once(self):
        borrow = self.create_borrow(
            self.student_profile,
            status="Borrowed",
            approved_by=self.admin_profile,
        )
        Borrow.objects.filter(pk=borrow.pk).update(
            start_time=timezone.now() - timedelta(days=2),
            end_time=timezone.now() - timedelta(hours=1),
            status="Borrowed",
        )

        self.client.force_authenticate(self.student_user)
        first_response = self.client.get("/api/borrows/my/")
        second_response = self.client.get("/api/borrows/my/")

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Notification.objects.filter(recipient=self.student_profile, category="Reminder").count(),
            1,
        )
        self.assertEqual(len(mail.outbox), 1)

    def test_borrow_approval_email_uses_detail_route(self):
        borrow = self.create_borrow(self.student_profile)

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(f"/api/borrows/{borrow.id}/approve/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["student@example.com"])
        self.assertCountEqual(
            mail.outbox[0].cc,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertIn(f"https://frontend.example.com/borrow-equipment/{borrow.id}", mail.outbox[0].body)

    def test_notification_email_failure_does_not_break_booking_approval(self):
        booking = self.create_booking(self.student_profile)

        self.client.force_authenticate(self.admin_user)
        with patch("csluse.email_notifications.EmailMultiAlternatives.send", side_effect=RuntimeError("SMTP failed")):
            response = self.client.post(f"/api/bookings/{booking.id}/approve/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Notification.objects.filter(recipient=self.student_profile, category="Approved").exists())

    def test_missing_recipient_email_does_not_break_booking_approval(self):
        booking = self.create_booking(self.student_profile)
        self.student_user.email = ""
        self.student_user.save(update_fields=["email"])

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(f"/api/bookings/{booking.id}/approve/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Notification.objects.filter(recipient=self.student_profile, category="Approved").exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_mentor_must_approve_booking_before_pic(self):
        booking = self.create_booking(
            self.student_profile,
            purpose="Skripsi/TA",
            requester_mentor_profile=self.lecturer_profile,
        )

        self.client.force_authenticate(self.admin_user)
        early_response = self.client.post(f"/api/bookings/{booking.id}/approve/", {}, format="json")
        self.assertEqual(early_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.lecturer_user)
        mentor_list_response = self.client.get("/api/bookings/all/")
        self.assertEqual(mentor_list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mentor_list_response.data["count"], 1)

        mentor_response = self.client.post(f"/api/bookings/{booking.id}/approve/", {}, format="json")
        self.assertEqual(mentor_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mentor_response.data["status"], "Pending")
        self.assertTrue(mentor_response.data["is_approved_by_mentor"])

        self.client.force_authenticate(self.admin_user)
        final_response = self.client.post(f"/api/bookings/{booking.id}/approve/", {}, format="json")
        self.assertEqual(final_response.status_code, status.HTTP_200_OK)
        self.assertEqual(final_response.data["status"], "Approved")

    def test_mentor_must_approve_borrow_before_pic(self):
        borrow = self.create_borrow(
            self.student_profile,
            purpose="Skripsi/TA",
            requester_mentor_profile=self.lecturer_profile,
        )

        self.client.force_authenticate(self.admin_user)
        early_response = self.client.post(f"/api/borrows/{borrow.id}/approve/", {}, format="json")
        self.assertEqual(early_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.lecturer_user)
        mentor_response = self.client.post(f"/api/borrows/{borrow.id}/approve/", {}, format="json")
        self.assertEqual(mentor_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mentor_response.data["status"], "Pending")
        self.assertTrue(mentor_response.data["is_approved_by_mentor"])

        self.client.force_authenticate(self.admin_user)
        final_response = self.client.post(f"/api/borrows/{borrow.id}/approve/", {}, format="json")
        self.assertEqual(final_response.status_code, status.HTTP_200_OK)
        self.assertEqual(final_response.data["status"], "Approved")

    def test_mentor_can_access_borrow_approval_scope_for_their_guidance_request(self):
        borrow = self.create_borrow(
            self.student_profile,
            purpose="Skripsi/TA",
            requester_mentor_profile=self.lecturer_profile,
        )

        self.client.force_authenticate(self.lecturer_user)
        response = self.client.get("/api/borrows/all/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(borrow.id))

    def test_requester_can_update_own_pending_booking(self):
        booking = self.create_booking(self.student_profile)

        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/bookings/{booking.id}/",
            {"attendee_count": 3, "note": "Update catatan"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.attendee_count, 3)
        self.assertEqual(booking.note, "Update catatan")

    def test_requester_cannot_delete_other_pending_booking(self):
        booking = self.create_booking(self.student_profile)

        self.client.force_authenticate(self.staff_user)
        response = self.client.delete(f"/api/bookings/{booking.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Booking.objects.filter(id=booking.id).exists())

    def test_requester_can_update_own_pending_borrow(self):
        borrow = self.create_borrow(self.student_profile)

        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/borrows/{borrow.id}/",
            {"quantity": 2, "note": "Dipakai untuk riset"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        borrow.refresh_from_db()
        self.assertEqual(borrow.quantity, 2)
        self.assertEqual(borrow.note, "Dipakai untuk riset")

    def test_requester_cannot_update_pending_glassware_borrow_above_five_units(self):
        glassware = Equipment.objects.create(
            name="Volumetric Flask",
            quantity=10,
            category="Glassware",
            room=self.room,
            is_moveable=True,
            is_borrowable=True,
        )
        borrow = self.create_borrow_for_equipment(self.student_profile, glassware)

        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/borrows/{borrow.id}/",
            {"quantity": 6},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "Glassware hanya boleh dipinjam maksimal 5 unit",
            response.data["quantity"][0],
        )

    def test_requester_cannot_update_non_pending_borrow(self):
        borrow = self.create_borrow(self.student_profile, status="Approved")

        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/borrows/{borrow.id}/",
            {"note": "Tidak boleh berubah"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        borrow.refresh_from_db()
        self.assertNotEqual(borrow.note, "Tidak boleh berubah")

    def test_requester_can_cancel_own_approved_booking(self):
        booking = self.create_booking(self.student_profile, status="Approved")
        booking.approved_by = self.admin_profile
        booking.save(update_fields=["approved_by"])

        self.client.force_authenticate(self.student_user)
        response = self.client.post(f"/api/bookings/{booking.id}/cancel/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, "Canceled")
        self.assertEqual(len(mail.outbox), 1)
        self.assertCountEqual(
            mail.outbox[0].to,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertEqual(mail.outbox[0].cc, ["student@example.com"])

    def test_requester_can_cancel_own_approved_borrow_before_handover(self):
        borrow = self.create_borrow(self.student_profile, status="Approved")
        borrow.approved_by = self.admin_profile
        borrow.save(update_fields=["approved_by"])

        self.client.force_authenticate(self.student_user)
        response = self.client.post(f"/api/borrows/{borrow.id}/cancel/", format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        borrow.refresh_from_db()
        self.assertEqual(borrow.status, "Canceled")
        self.assertEqual(len(mail.outbox), 1)
        self.assertCountEqual(
            mail.outbox[0].to,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertEqual(mail.outbox[0].cc, ["student@example.com"])

    def test_requester_cannot_cancel_borrow_after_borrowed(self):
        borrow = self.create_borrow(
            self.student_profile,
            status="Borrowed",
            approved_by=self.admin_profile,
        )

        self.client.force_authenticate(self.student_user)
        response = self.client.post(f"/api/borrows/{borrow.id}/cancel/", format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        borrow.refresh_from_db()
        self.assertEqual(borrow.status, "Borrowed")

    def test_requester_can_update_own_pending_pengujian(self):
        pengujian = self.create_pengujian(self.student_profile)

        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/pengujians/{pengujian.id}/",
            {"sample_name": "Sampel Update", "sample_quantity": "5"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pengujian.refresh_from_db()
        self.assertEqual(pengujian.sample_name, "Sampel Update")
        self.assertEqual(pengujian.sample_quantity, "5")

    def test_requester_cannot_delete_non_pending_pengujian(self):
        pengujian = self.create_pengujian(self.student_profile, status="Approved")

        self.client.force_authenticate(self.student_user)
        response = self.client.delete(f"/api/pengujians/{pengujian.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Pengujian.objects.filter(id=pengujian.id).exists())

    def test_admin_can_bulk_delete_sample_testing_history(self):
        pengujian = self.create_pengujian(self.student_profile, status="Completed")

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(
            "/api/pengujians/bulk-delete/",
            {"ids": [str(pengujian.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deleted_count"], 1)
        self.assertFalse(Pengujian.objects.filter(id=pengujian.id).exists())

    def test_admin_can_bulk_delete_borrow_history(self):
        borrow = self.create_borrow(self.student_profile, status="Borrowed")

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(
            "/api/borrows/bulk-delete/",
            {"ids": [str(borrow.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deleted_count"], 1)
        self.assertFalse(Borrow.objects.filter(id=borrow.id).exists())

    def test_requester_can_cancel_own_approved_pengujian(self):
        pengujian = self.create_pengujian(self.student_profile, status="Approved")
        pengujian.approved_by = self.admin_profile
        pengujian.save(update_fields=["approved_by"])

        self.client.force_authenticate(self.student_user)
        response = self.client.post(
            f"/api/pengujians/{pengujian.id}/cancel/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pengujian.refresh_from_db()
        self.assertEqual(pengujian.status, "Canceled")
        self.assertEqual(len(mail.outbox), 1)
        self.assertCountEqual(
            mail.outbox[0].to,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertEqual(mail.outbox[0].cc, ["student@example.com"])

    def test_requester_can_delete_own_sample_testing_document_and_storage_file(self):
        pengujian = self.create_pengujian(self.student_profile, status="Diproses")
        document = Document.objects.create(
            pengujian=pengujian,
            document_type="payment_proof",
            document=SimpleUploadedFile(
                "payment-proof.pdf",
                b"test payment proof",
                content_type="application/pdf",
            ),
            original_name="payment-proof.pdf",
            mime_type="application/pdf",
            size=18,
            uploaded_by=self.student_profile,
        )
        storage = document.document.storage

        self.client.force_authenticate(self.student_user)
        with patch.object(storage, "delete", wraps=storage.delete) as delete_mock:
            response = self.client.delete(
                f"/api/pengujians/{pengujian.id}/documents/delete/payment_proof/"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        delete_mock.assert_called_once_with(document.document.name)
        self.assertFalse(Document.objects.filter(id=document.id).exists())

    def test_pengujian_status_becomes_diproses_after_testing_agreement_upload(self):
        pengujian = self.create_pengujian(self.student_profile, status="Approved")
        pengujian.approved_by = self.admin_profile
        pengujian.save(update_fields=["approved_by"])

        self.client.force_authenticate(self.admin_user)
        response = self.client.post(
            f"/api/pengujians/{pengujian.id}/documents/upload/",
            {
                "document_type": "testing_agreement",
                "file": SimpleUploadedFile(
                    "testing-agreement.pdf",
                    b"testing agreement",
                    content_type="application/pdf",
                ),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pengujian.refresh_from_db()
        self.assertEqual(pengujian.status, "Diproses")

    def test_pengujian_status_completed_after_receipt_and_test_result_letter_uploaded(self):
        pengujian = self.create_pengujian(self.student_profile, status="Diproses")
        pengujian.approved_by = self.admin_profile
        pengujian.save(update_fields=["approved_by"])

        self.client.force_authenticate(self.admin_user)
        receipt_response = self.client.post(
            f"/api/pengujians/{pengujian.id}/documents/upload/",
            {
                "document_type": "receipt",
                "file": SimpleUploadedFile(
                    "receipt.pdf",
                    b"receipt file",
                    content_type="application/pdf",
                ),
            },
        )

        self.assertEqual(receipt_response.status_code, status.HTTP_200_OK)
        pengujian.refresh_from_db()
        self.assertEqual(pengujian.status, "Diproses")

        result_response = self.client.post(
            f"/api/pengujians/{pengujian.id}/documents/upload/",
            {
                "document_type": "test_result_letter",
                "file": SimpleUploadedFile(
                    "test-result-letter.pdf",
                    b"test result letter",
                    content_type="application/pdf",
                ),
            },
        )

        self.assertEqual(result_response.status_code, status.HTTP_200_OK)
        pengujian.refresh_from_db()
        self.assertEqual(pengujian.status, "Completed")

    def test_booking_submission_for_thesis_notifies_mentor_then_pic_after_mentor_approval(self):
        start, end = self.future_window(days=3, start_hour=9)
        self.client.force_authenticate(user=self.student_user)

        create_response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "start_time": start.isoformat(),
                "end_time": end.isoformat(),
                "attendee_count": 1,
                "purpose": "Skripsi/TA",
                "requester_mentor_profile": str(self.lecturer_profile.id),
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["lecturer@example.com"])
        self.assertIn(f"/booking-rooms/approval/{create_response.data['id']}", mail.outbox[0].body)

        mail.outbox = []
        self.client.force_authenticate(self.lecturer_user)
        approve_response = self.client.post(
            f"/api/bookings/{create_response.data['id']}/approve/",
            {},
            format="json",
        )

        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["admin@example.com"])
        self.assertIn(f"/booking-rooms/approval/{create_response.data['id']}", mail.outbox[0].body)

    def test_pengujian_submission_notifies_all_admins(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.post(
            "/api/pengujians/",
            {
                "name": "Pemohon Uji",
                "email": "pemohon@example.com",
                "sample_type": "Food Sample",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertCountEqual(
            mail.outbox[0].to,
            ["admin@example.com", "admin2@example.com"],
        )
        self.assertIn(f"/sample-testing/approval/{response.data['id']}", mail.outbox[0].body)

    def test_notifications_endpoint_returns_current_user_notifications(self):
        booking = self.create_booking(self.student_profile)
        Notification.objects.create(
            recipient=self.student_profile,
            title=f"Peminjaman Lab {booking.code} disetujui",
            category="Approved",
            message=f"Pengajuan peminjaman lab Anda ({booking.code}) telah disetujui oleh Admin.",
        )
        Notification.objects.create(
            recipient=self.staff_profile,
            title="Other Notification",
            category="General",
            message="Pesan lain.",
        )

        self.client.force_authenticate(self.student_user)
        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["title"], f"Booking Ruangan {booking.code} disetujui")
        self.assertEqual(response.data["results"][0]["target_path"], f"/booking-rooms/{booking.id}")

    def test_notifications_endpoint_returns_null_target_for_unmapped_notification(self):
        Notification.objects.create(
            recipient=self.student_profile,
            title="Test Notification",
            category="General",
            message="Pesan umum tanpa request.",
        )

        self.client.force_authenticate(self.student_user)
        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"][0]["target_path"], None)

    def test_room_update_requires_admin_or_above(self):
        self.client.force_authenticate(self.student_user)
        response = self.client.patch(
            f"/api/rooms/{self.room.id}/",
            {"name": "Updated by Student"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_booking_equipment_filters_and_availability_use_equipment_items_relation(self):
        booking = self.create_booking(self.student_profile)
        BookingEquipmentItem.objects.create(
            booking=booking,
            equipment=self.equipment,
            quantity=1,
        )

        self.client.force_authenticate(self.student_user)
        list_response = self.client.get(f"/api/bookings/?equipment={self.equipment.id}")

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)

        availability_response = self.client.get(
            f"/api/equipments/{self.equipment.id}/availability/",
            {
                "start": booking.start_time.isoformat(),
                "end": booking.end_time.isoformat(),
            },
        )

        self.assertEqual(availability_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(availability_response.data["occupied"]), 1)
        self.assertEqual(availability_response.data["occupied"][0]["type"], "booking")

    def test_canceled_booking_does_not_block_room_availability(self):
        booking = self.create_booking(self.student_profile, status="Canceled")

        self.client.force_authenticate(self.student_user)
        response = self.client.get(
            f"/api/rooms/{self.room.id}/availability/",
            {
                "start": booking.start_time.isoformat(),
                "end": booking.end_time.isoformat(),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["occupied"], [])

    def test_canceled_booking_does_not_block_equipment_availability(self):
        booking = self.create_booking(self.student_profile, status="Canceled")
        BookingEquipmentItem.objects.create(
            booking=booking,
            equipment=self.equipment,
            quantity=1,
        )

        self.client.force_authenticate(self.student_user)
        response = self.client.get(
            f"/api/equipments/{self.equipment.id}/availability/",
            {
                "start": booking.start_time.isoformat(),
                "end": booking.end_time.isoformat(),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["occupied"], [])

    def test_canceled_booking_does_not_count_toward_room_capacity_validation(self):
        cancelled_booking = self.create_booking(
            self.student_profile,
            status="Canceled",
        )
        cancelled_booking.attendee_count = 18
        cancelled_booking.save(update_fields=["attendee_count", "updated_at"])

        other_student_user, _ = self.create_user_with_profile(
            "capacity-student@example.com",
            "Student",
            "Capacity Student",
        )

        self.client.force_authenticate(other_student_user)
        response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "purpose": "Penelitian",
                "start_time": cancelled_booking.start_time.isoformat(),
                "end_time": cancelled_booking.end_time.isoformat(),
                "attendee_count": 10,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_canceled_booking_does_not_count_toward_equipment_stock_validation(self):
        cancelled_booking = self.create_booking(
            self.student_profile,
            status="Canceled",
        )
        BookingEquipmentItem.objects.create(
            booking=cancelled_booking,
            equipment=self.equipment,
            quantity=5,
        )

        other_student_user, _ = self.create_user_with_profile(
            "equipment-student@example.com",
            "Student",
            "Equipment Student",
        )

        self.client.force_authenticate(other_student_user)
        response = self.client.post(
            "/api/bookings/",
            {
                "room": str(self.room.id),
                "purpose": "Penelitian",
                "start_time": cancelled_booking.start_time.isoformat(),
                "end_time": cancelled_booking.end_time.isoformat(),
                "attendee_count": 2,
                "equipment_items": [
                    {
                        "equipment": str(self.equipment.id),
                        "quantity": 5,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_canceled_borrow_does_not_count_toward_equipment_stock_validation(self):
        cancelled_borrow = self.create_borrow(
            self.student_profile,
            status="Canceled",
        )
        cancelled_borrow.quantity = 5
        cancelled_borrow.save(update_fields=["quantity", "updated_at"])

        other_student_user, _ = self.create_user_with_profile(
            "borrow-student@example.com",
            "Student",
            "Borrow Student",
        )

        self.client.force_authenticate(other_student_user)
        response = self.client.post(
            "/api/borrows/",
            {
                "equipment": str(self.equipment.id),
                "quantity": 5,
                "start_time": cancelled_borrow.start_time.isoformat(),
                "end_time": cancelled_borrow.end_time.isoformat(),
                "purpose": "Penelitian",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
