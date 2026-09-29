from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from institutions.models import Organization
from notifications.models import Notification


User = get_user_model()


class NotificationSecurityTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Org One", code="ORG1")
        self.other_org = Organization.objects.create(
            name="Org Two",
            code="ORG2",
        )
        self.student = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.other_student = User.objects.create_user(
            username="otherstudent",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.foreign_student = User.objects.create_user(
            username="foreignstudent",
            password="pass",
            role="student",
            organization=self.other_org,
        )
        self.own_notification = Notification.objects.create(
            organization=self.org,
            user=self.student,
            title="Own",
            message="Own notification",
            notification_type=Notification.Type.GENERAL,
            related_url="/student/dashboard",
        )
        self.other_user_notification = Notification.objects.create(
            organization=self.org,
            user=self.other_student,
            title="Other",
            message="Other user notification",
            notification_type=Notification.Type.GENERAL,
        )
        self.foreign_notification = Notification.objects.create(
            organization=self.other_org,
            user=self.foreign_student,
            title="Foreign",
            message="Foreign notification",
            notification_type=Notification.Type.GENERAL,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.student)

    def test_user_lists_only_own_notifications(self):
        self.authenticate()

        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["notifications"]]
        self.assertIn(self.own_notification.id, ids)
        self.assertNotIn(self.other_user_notification.id, ids)
        self.assertNotIn(self.foreign_notification.id, ids)

    def test_unread_count_is_scoped_to_user(self):
        self.authenticate()

        response = self.client.get(reverse("notification-unread-count"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 1)

    def test_mark_read_own_notification(self):
        self.authenticate()

        response = self.client.patch(
            reverse(
                "notification-mark-read",
                kwargs={"notification_id": self.own_notification.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.own_notification.refresh_from_db()
        self.assertTrue(self.own_notification.is_read)

    def test_cannot_mark_other_users_notification_read(self):
        self.authenticate()

        response = self.client.patch(
            reverse(
                "notification-mark-read",
                kwargs={
                    "notification_id": self.other_user_notification.id
                },
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.other_user_notification.refresh_from_db()
        self.assertFalse(self.other_user_notification.is_read)

    def test_cannot_mark_foreign_organization_notification_read(self):
        self.authenticate()

        response = self.client.patch(
            reverse(
                "notification-mark-read",
                kwargs={"notification_id": self.foreign_notification.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.foreign_notification.refresh_from_db()
        self.assertFalse(self.foreign_notification.is_read)

    def test_showing_notifications_does_not_mark_read(self):
        self.authenticate()

        self.client.get(reverse("notification-list"))

        self.own_notification.refresh_from_db()
        self.assertFalse(self.own_notification.is_read)

    def test_read_all_is_scoped_to_user(self):
        self.authenticate()

        response = self.client.patch(reverse("notification-mark-all-read"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.own_notification.refresh_from_db()
        self.other_user_notification.refresh_from_db()
        self.foreign_notification.refresh_from_db()
        self.assertTrue(self.own_notification.is_read)
        self.assertFalse(self.other_user_notification.is_read)
        self.assertFalse(self.foreign_notification.is_read)

    def test_unauthenticated_denied(self):
        response = self.client.get(reverse("notification-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
