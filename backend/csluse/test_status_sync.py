from datetime import datetime, time, timedelta
import io
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from csluse.models import Booking, Borrow, Equipment, Room
from csluse.viewsets import (
    normalize_status_value,
    sync_booking_statuses,
    sync_borrow_statuses,
)

User = get_user_model()


class CSLUseStatusTestCase(TestCase):
    def create_profile(self, *, email, full_name="Test User", role="Student"):
        username = email.split("@")[0]
        user = User.objects.create_user(
            username=f"{username}_{User.objects.count() + 1}",
            email=email,
            password="testpass123",
        )
        profile = user.profile
        profile.full_name = full_name
        profile.role = role
        profile.user_type = "Internal"
        profile.save()
        return profile

    def setUp(self):
        self.requester = self.create_profile(
            email="requester@example.com",
            full_name="Requester User",
        )
        self.room = Room.objects.create(
            name="Chemical Lab",
            capacity=24,
            number="101",
            floor=1,
        )
        self.equipment = Equipment.objects.create(
            name="Microscope",
            quantity=5,
            room=self.room,
        )

    def future_datetime(self, *, day_offset=1, hour=9):
        target_date = timezone.localdate() + timedelta(days=day_offset)
        return timezone.make_aware(datetime.combine(target_date, time(hour=hour)))

    def test_normalize_status_value_maps_known_aliases(self):
        self.assertEqual(normalize_status_value("pending"), "Pending")
        self.assertEqual(
            normalize_status_value("returned pending inspection"),
            "Returned Pending Inspection",
        )
        self.assertEqual(normalize_status_value("lost_damaged"), "Lost/Damaged")
        self.assertEqual(normalize_status_value("Custom"), "Custom")
        self.assertEqual(normalize_status_value(""), "")
        self.assertIsNone(normalize_status_value(None))

    def test_sync_booking_statuses_updates_pending_and_approved_records(self):
        now = timezone.now()
        future_start = self.future_datetime(day_offset=1, hour=9)
        future_end = self.future_datetime(day_offset=1, hour=10)
        expired_booking = Booking.objects.create(
            requested_by=self.requester,
            room=self.room,
            start_time=future_start,
            end_time=future_end,
            status="Pending",
        )
        completed_booking = Booking.objects.create(
            requested_by=self.requester,
            room=self.room,
            start_time=future_start,
            end_time=future_end,
            status="Pending",
        )
        active_booking = Booking.objects.create(
            requested_by=self.requester,
            room=self.room,
            start_time=self.future_datetime(day_offset=2, hour=9),
            end_time=self.future_datetime(day_offset=2, hour=10),
            status="Pending",
        )

        Booking.objects.filter(pk=expired_booking.pk).update(
            start_time=now - timedelta(hours=3),
            end_time=now - timedelta(hours=1),
            status="Pending",
        )
        Booking.objects.filter(pk=completed_booking.pk).update(
            start_time=now - timedelta(hours=4),
            end_time=now - timedelta(hours=2),
            status="Approved",
        )

        sync_booking_statuses()

        expired_booking.refresh_from_db()
        completed_booking.refresh_from_db()
        active_booking.refresh_from_db()

        self.assertEqual(expired_booking.status, "Expired")
        self.assertEqual(completed_booking.status, "Completed")
        self.assertEqual(active_booking.status, "Pending")

    def test_sync_borrow_statuses_expires_pending_and_marks_overdue(self):
        now = timezone.now()
        future_start = self.future_datetime(day_offset=1, hour=9)
        expired_borrow = Borrow.objects.create(
            requested_by=self.requester,
            equipment=self.equipment,
            quantity=1,
            start_time=future_start,
            end_time=self.future_datetime(day_offset=2, hour=9),
            status="Pending",
        )
        overdue_borrow = Borrow.objects.create(
            requested_by=self.requester,
            equipment=self.equipment,
            quantity=1,
            start_time=future_start,
            end_time=self.future_datetime(day_offset=2, hour=9),
            status="Pending",
        )
        active_borrow = Borrow.objects.create(
            requested_by=self.requester,
            equipment=self.equipment,
            quantity=1,
            start_time=self.future_datetime(day_offset=3, hour=9),
            end_time=self.future_datetime(day_offset=4, hour=9),
            status="Pending",
        )

        Borrow.objects.filter(pk=expired_borrow.pk).update(
            start_time=now - timedelta(hours=4),
            end_time=now + timedelta(hours=2),
            status="Pending",
        )
        Borrow.objects.filter(pk=overdue_borrow.pk).update(
            start_time=now - timedelta(days=2),
            end_time=now - timedelta(hours=1),
            status="Borrowed",
        )

        sync_borrow_statuses()

        expired_borrow.refresh_from_db()
        overdue_borrow.refresh_from_db()
        active_borrow.refresh_from_db()

        self.assertEqual(expired_borrow.status, "Expired")
        self.assertEqual(overdue_borrow.status, "Overdue")
        self.assertEqual(active_borrow.status, "Pending")

    def test_sync_request_statuses_command_can_target_borrow_only(self):
        now = timezone.now()
        borrow = Borrow.objects.create(
            requested_by=self.requester,
            equipment=self.equipment,
            quantity=1,
            start_time=self.future_datetime(day_offset=1, hour=9),
            end_time=self.future_datetime(day_offset=2, hour=9),
            status="Borrowed",
        )
        Borrow.objects.filter(pk=borrow.pk).update(
            start_time=now - timedelta(days=2),
            end_time=now - timedelta(hours=1),
            status="Borrowed",
        )

        stdout = io.StringIO()
        call_command(
            "sync_request_statuses",
            "--target",
            "borrow",
            "--quiet",
            stdout=stdout,
        )

        borrow.refresh_from_db()
        self.assertEqual(borrow.status, "Overdue")
        self.assertIn('"borrow"', stdout.getvalue())

    def test_booking_save_generates_incrementing_codes(self):
        frozen_now = timezone.make_aware(datetime(2026, 3, 15, 9, 30, 0))

        with patch("csluse.models.timezone.now", return_value=frozen_now):
            first = Booking.objects.create(
                requested_by=self.requester,
                room=self.room,
                start_time=self.future_datetime(day_offset=1, hour=9),
                end_time=self.future_datetime(day_offset=1, hour=10),
            )
            second = Booking.objects.create(
                requested_by=self.requester,
                room=self.room,
                start_time=self.future_datetime(day_offset=2, hour=9),
                end_time=self.future_datetime(day_offset=2, hour=10),
            )

        self.assertEqual(first.code, "PR2603-001")
        self.assertEqual(second.code, "PR2603-002")

    def test_borrow_save_generates_expected_prefix(self):
        frozen_now = timezone.make_aware(datetime(2026, 3, 15, 9, 30, 0))

        with patch("csluse.models.timezone.now", return_value=frozen_now):
            borrow_request = Borrow.objects.create(
                requested_by=self.requester,
                equipment=self.equipment,
                quantity=1,
                start_time=self.future_datetime(day_offset=1, hour=9),
                end_time=self.future_datetime(day_offset=2, hour=9),
            )

        self.assertEqual(borrow_request.code, "PA2603-001")
