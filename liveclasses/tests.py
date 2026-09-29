from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from academics.models import (
    AcademicSession,
    ClassRoom,
    Section,
    Subject,
    StudentEnrollment,
    TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile, User
from institutions.models import Organization

from .models import LiveClass, LiveClassRecording


class CollegeAdminLiveClassManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(
            name="DU",
            code="du",
        )
        self.org_b = Organization.objects.create(
            name="Other",
            code="other",
        )
        self.admin_a = User.objects.create_user(
            username="du-admin",
            password="pass",
            role="college_admin",
            organization=self.org_a,
        )
        self.admin_b = User.objects.create_user(
            username="other-admin",
            password="pass",
            role="college_admin",
            organization=self.org_b,
        )
        self.teacher_user_a = User.objects.create_user(
            username="teacher-a",
            password="pass",
            role="teacher",
            organization=self.org_a,
        )
        self.teacher_profile_a = TeacherProfile.objects.create(
            user=self.teacher_user_a,
            employee_id="TA",
        )
        self.teacher_user_b = User.objects.create_user(
            username="teacher-b",
            password="pass",
            role="teacher",
            organization=self.org_b,
        )
        self.teacher_profile_b = TeacherProfile.objects.create(
            user=self.teacher_user_b,
            employee_id="TB",
        )
        self.student_user = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org_a,
        )
        StudentProfile.objects.create(
            user=self.student_user,
            admission_number="S1",
        )
        self.parent_user = User.objects.create_user(
            username="parent",
            password="pass",
            role="parent",
            organization=self.org_a,
        )
        ParentProfile.objects.create(user=self.parent_user)

        self.assignment_a = self.create_assignment(
            self.org_a,
            self.teacher_profile_a,
            "2026",
            "Class A",
            "A",
            "Math",
        )
        self.assignment_b = self.create_assignment(
            self.org_b,
            self.teacher_profile_b,
            "2026",
            "Class B",
            "B",
            "Science",
        )
        self.live_class_a = LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.assignment_a,
            title="DU Math",
            class_date=date(2026, 9, 20),
            start_time=time(10, 0),
            end_time=time(11, 0),
            meeting_link="https://example.com/du",
        )
        self.live_class_b = LiveClass.objects.create(
            organization=self.org_b,
            teacher_assignment=self.assignment_b,
            title="Other Science",
            class_date=date(2026, 9, 20),
            start_time=time(12, 0),
            end_time=time(13, 0),
            meeting_link="https://example.com/other",
        )

    def create_assignment(
        self,
        organization,
        teacher_profile,
        session_name,
        class_name,
        section_name,
        subject_name,
    ):
        session = AcademicSession.objects.create(
            organization=organization,
            name=session_name,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        classroom = ClassRoom.objects.create(
            organization=organization,
            name=class_name,
            academic_session=session,
        )
        section = Section.objects.create(
            organization=organization,
            name=section_name,
            classroom=classroom,
        )
        subject = Subject.objects.create(
            organization=organization,
            name=subject_name,
            code=subject_name[:3].upper(),
            classroom=classroom,
        )
        return TeacherAssignment.objects.create(
            teacher=teacher_profile,
            subject=subject,
            section=section,
            is_active=True,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_list_is_tenant_scoped(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/live-classes/college-admin/classes/"
        )

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["classes"]]
        self.assertIn("DU Math", titles)
        self.assertNotIn("Other Science", titles)

    def test_create_schedules_live_class_for_admin_organization(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/live-classes/college-admin/classes/",
            {
                "teacher_assignment": self.assignment_a.id,
                "title": "Scheduled Class",
                "description": "Intro",
                "class_date": "2026-09-21",
                "start_time": "09:00",
                "end_time": "10:00",
                "meeting_link": "https://example.com/class",
                "organization": self.org_b.id,
                "organization_id": self.org_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        live_class = LiveClass.objects.get(title="Scheduled Class")
        self.assertEqual(live_class.organization, self.org_a)
        self.assertEqual(live_class.status, LiveClass.Status.SCHEDULED)

    def test_cross_college_teacher_assignment_is_rejected(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/live-classes/college-admin/classes/",
            {
                "teacher_assignment": self.assignment_b.id,
                "title": "Invalid",
                "class_date": "2026-09-21",
                "start_time": "09:00",
                "end_time": "10:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_detail_edit_and_cancel_are_tenant_scoped(self):
        self.authenticate(self.admin_a)
        detail_url = (
            f"/api/live-classes/college-admin/classes/"
            f"{self.live_class_b.id}/"
        )
        cancel_url = (
            f"/api/live-classes/college-admin/classes/"
            f"{self.live_class_b.id}/cancel/"
        )

        detail_response = self.client.get(detail_url)
        edit_response = self.client.patch(
            detail_url,
            {"title": "Changed"},
            format="json",
        )
        cancel_response = self.client.post(cancel_url)

        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(edit_response.status_code, 404)
        self.assertEqual(cancel_response.status_code, 404)
        self.live_class_b.refresh_from_db()
        self.assertEqual(self.live_class_b.title, "Other Science")
        self.assertEqual(
            self.live_class_b.status,
            LiveClass.Status.SCHEDULED,
        )

    def test_cancel_sets_status_without_deleting_class(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            (
                f"/api/live-classes/college-admin/classes/"
                f"{self.live_class_a.id}/cancel/"
            )
        )

        self.assertEqual(response.status_code, 200)
        self.live_class_a.refresh_from_db()
        self.assertEqual(
            self.live_class_a.status,
            LiveClass.Status.CANCELLED,
        )
        self.assertTrue(
            LiveClass.objects.filter(id=self.live_class_a.id).exists()
        )

    def test_cancelled_and_completed_classes_are_protected(self):
        self.authenticate(self.admin_a)
        self.live_class_a.status = LiveClass.Status.CANCELLED
        self.live_class_a.save(update_fields=["status"])

        edit_cancelled = self.client.patch(
            (
                f"/api/live-classes/college-admin/classes/"
                f"{self.live_class_a.id}/"
            ),
            {"title": "Changed"},
            format="json",
        )

        completed = LiveClass.objects.create(
            organization=self.org_a,
            teacher_assignment=self.assignment_a,
            title="Completed",
            class_date=date(2026, 9, 19),
            start_time=time(9, 0),
            end_time=time(10, 0),
            status=LiveClass.Status.COMPLETED,
        )
        edit_completed_schedule = self.client.patch(
            f"/api/live-classes/college-admin/classes/{completed.id}/",
            {"class_date": "2026-09-22"},
            format="json",
        )
        cancel_completed = self.client.post(
            (
                f"/api/live-classes/college-admin/classes/"
                f"{completed.id}/cancel/"
            )
        )

        self.assertEqual(edit_cancelled.status_code, 400)
        self.assertEqual(edit_completed_schedule.status_code, 400)
        self.assertEqual(cancel_completed.status_code, 400)

    def test_other_roles_and_unauthenticated_requests_are_rejected(self):
        for user in [
            self.teacher_user_a,
            self.student_user,
            self.parent_user,
        ]:
            self.authenticate(user)
            response = self.client.get(
                "/api/live-classes/college-admin/classes/"
            )
            self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=None)
        response = self.client.get(
            "/api/live-classes/college-admin/classes/"
        )
        self.assertIn(response.status_code, [401, 403])

    def test_setup_returns_only_same_organization_assignments(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/live-classes/college-admin/setup/"
        )

        self.assertEqual(response.status_code, 200)
        assignment_ids = [
            item["assignment_id"]
            for item in response.data["teacher_assignments"]
        ]
        self.assertIn(self.assignment_a.id, assignment_ids)
        self.assertNotIn(self.assignment_b.id, assignment_ids)

    def test_invalid_time_range_is_rejected(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/live-classes/college-admin/classes/",
            {
                "teacher_assignment": self.assignment_a.id,
                "title": "Bad Time",
                "class_date": "2026-09-21",
                "start_time": "10:00",
                "end_time": "09:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class LiveClassTeacherStudentIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_du = Organization.objects.create(name="DU", code="du")
        self.org_other = Organization.objects.create(
            name="Other College",
            code="other-college",
        )

        self.session_du = AcademicSession.objects.create(
            organization=self.org_du,
            name="2026-2027",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        self.classroom_du = ClassRoom.objects.create(
            organization=self.org_du,
            name="BCA",
            academic_session=self.session_du,
        )
        self.section_a = Section.objects.create(
            organization=self.org_du,
            name="A",
            classroom=self.classroom_du,
        )
        self.section_b = Section.objects.create(
            organization=self.org_du,
            name="B",
            classroom=self.classroom_du,
        )
        self.subject_du = Subject.objects.create(
            organization=self.org_du,
            name="Web Development",
            code="WEB",
            classroom=self.classroom_du,
        )

        self.teacher_user = User.objects.create_user(
            username="du-teacher",
            password="pass",
            role="teacher",
            organization=self.org_du,
        )
        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="DU-T1",
        )
        self.other_teacher_user = User.objects.create_user(
            username="du-other-teacher",
            password="pass",
            role="teacher",
            organization=self.org_du,
        )
        self.other_teacher_profile = TeacherProfile.objects.create(
            user=self.other_teacher_user,
            employee_id="DU-T2",
        )
        self.cross_org_teacher_user = User.objects.create_user(
            username="other-teacher",
            password="pass",
            role="teacher",
            organization=self.org_other,
        )
        self.cross_org_teacher_profile = TeacherProfile.objects.create(
            user=self.cross_org_teacher_user,
            employee_id="OT-T1",
        )

        self.assignment = TeacherAssignment.objects.create(
            teacher=self.teacher_profile,
            subject=self.subject_du,
            section=self.section_a,
            is_active=True,
        )
        self.other_assignment = TeacherAssignment.objects.create(
            teacher=self.other_teacher_profile,
            subject=self.subject_du,
            section=self.section_b,
            is_active=True,
        )

        self.live_class = LiveClass.objects.create(
            organization=self.org_du,
            teacher_assignment=self.assignment,
            title="Web Development Live Class",
            class_date=timezone.localdate() + timedelta(days=1),
            start_time=time(10, 0),
            end_time=time(11, 0),
            meeting_link="https://meet.example.com/du-web",
        )

        self.student_profile = self.create_student(
            "du-student-a",
            self.org_du,
            "DU-S1",
            self.section_a,
        )
        self.other_section_student = self.create_student(
            "du-student-b",
            self.org_du,
            "DU-S2",
            self.section_b,
        )
        self.inactive_student = self.create_student(
            "du-student-inactive",
            self.org_du,
            "DU-S3",
            self.section_a,
            is_active=False,
        )

        other_session = AcademicSession.objects.create(
            organization=self.org_other,
            name="2026-2027",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        other_classroom = ClassRoom.objects.create(
            organization=self.org_other,
            name="BCA",
            academic_session=other_session,
        )
        other_section = Section.objects.create(
            organization=self.org_other,
            name="A",
            classroom=other_classroom,
        )
        self.cross_org_student = self.create_student(
            "other-student",
            self.org_other,
            "OT-S1",
            other_section,
        )

    def create_student(
        self,
        username,
        organization,
        admission_number,
        section,
        is_active=True,
    ):
        user = User.objects.create_user(
            username=username,
            password="pass",
            role="student",
            organization=organization,
        )
        student_profile = StudentProfile.objects.create(
            user=user,
            admission_number=admission_number,
        )
        StudentEnrollment.objects.create(
            student=student_profile,
            section=section,
            is_active=is_active,
        )
        return student_profile

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def teacher_class_titles(self, user):
        self.authenticate(user)
        response = self.client.get("/api/live-classes/teacher/classes/")
        self.assertEqual(response.status_code, 200)
        return [item["title"] for item in response.data["classes"]]

    def student_class_response(self, user):
        self.authenticate(user)
        return self.client.get("/api/live-classes/student/classes/")

    def test_assigned_teacher_can_see_college_admin_live_class(self):
        titles = self.teacher_class_titles(self.teacher_user)

        self.assertIn("Web Development Live Class", titles)

    def test_other_teachers_cannot_see_assigned_teacher_live_class(self):
        same_org_titles = self.teacher_class_titles(self.other_teacher_user)
        cross_org_titles = self.teacher_class_titles(
            self.cross_org_teacher_user
        )

        self.assertNotIn("Web Development Live Class", same_org_titles)
        self.assertNotIn("Web Development Live Class", cross_org_titles)

    def test_active_enrolled_student_can_see_live_class(self):
        response = self.student_class_response(self.student_profile.user)

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data]
        self.assertIn("Web Development Live Class", titles)

    def test_wrong_section_cross_org_and_inactive_students_cannot_see_class(self):
        for profile in [
            self.other_section_student,
            self.cross_org_student,
            self.inactive_student,
        ]:
            response = self.student_class_response(profile.user)
            titles = [
                item["title"]
                for item in response.data
            ] if response.status_code == 200 else []
            links = [
                item["meeting_link"]
                for item in response.data
            ] if response.status_code == 200 else []

            self.assertNotIn("Web Development Live Class", titles)
            self.assertNotIn("https://meet.example.com/du-web", links)

    def test_student_dashboard_uses_same_active_enrollment_visibility(self):
        self.authenticate(self.student_profile.user)
        response = self.client.get("/api/accounts/student/dashboard/")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["upcoming_classes"]]
        self.assertIn("Web Development Live Class", titles)

        self.authenticate(self.other_section_student.user)
        response = self.client.get("/api/accounts/student/dashboard/")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.data["upcoming_classes"]]
        self.assertNotIn("Web Development Live Class", titles)

    def test_recording_playback_requires_authorized_active_enrollment(self):
        self.live_class.status = LiveClass.Status.COMPLETED
        self.live_class.save(update_fields=["status"])
        recording = LiveClassRecording.objects.create(
            live_class=self.live_class,
            uploaded_by=self.teacher_profile,
            title="Web Development Recording",
            is_available=True,
        )

        playback_url = (
            f"/api/live-classes/student/recordings/"
            f"{recording.public_id}/play/"
        )

        for profile in [
            self.other_section_student,
            self.cross_org_student,
            self.inactive_student,
        ]:
            self.authenticate(profile.user)
            response = self.client.get(playback_url)
            self.assertEqual(response.status_code, 403)

    def complete_class_date(self, live_class):
        live_class.class_date = timezone.localdate() - timedelta(days=1)
        live_class.save(update_fields=["class_date"])

    def test_assigned_teacher_can_start_and_complete_class(self):
        self.complete_class_date(self.live_class)
        self.authenticate(self.teacher_user)

        start_response = self.client.patch(
            f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
            {"status": LiveClass.Status.LIVE},
            format="json",
        )
        complete_response = self.client.patch(
            f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
            {"status": LiveClass.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(start_response.status_code, 200)
        self.assertEqual(complete_response.status_code, 200)
        self.live_class.refresh_from_db()
        self.assertEqual(self.live_class.status, LiveClass.Status.COMPLETED)

    def test_teacher_can_complete_missed_started_class_after_end(self):
        self.complete_class_date(self.live_class)
        self.authenticate(self.teacher_user)

        response = self.client.patch(
            f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
            {"status": LiveClass.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.live_class.refresh_from_db()
        self.assertEqual(self.live_class.status, LiveClass.Status.COMPLETED)

    def test_unrelated_cross_org_teacher_and_student_cannot_update_status(self):
        self.complete_class_date(self.live_class)

        for user, expected_status in [
            (self.other_teacher_user, 404),
            (self.cross_org_teacher_user, 404),
            (self.student_profile.user, 403),
        ]:
            self.authenticate(user)
            response = self.client.patch(
                f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
                {"status": LiveClass.Status.COMPLETED},
                format="json",
            )
            self.assertEqual(response.status_code, expected_status)

        self.live_class.refresh_from_db()
        self.assertEqual(self.live_class.status, LiveClass.Status.SCHEDULED)

    def test_cancelled_and_completed_classes_are_protected_from_transitions(self):
        self.complete_class_date(self.live_class)
        self.authenticate(self.teacher_user)

        self.live_class.status = LiveClass.Status.CANCELLED
        self.live_class.save(update_fields=["status"])

        cancelled_response = self.client.patch(
            f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
            {"status": LiveClass.Status.COMPLETED},
            format="json",
        )

        self.live_class.status = LiveClass.Status.COMPLETED
        self.live_class.save(update_fields=["status"])

        completed_response = self.client.patch(
            f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
            {"status": LiveClass.Status.LIVE},
            format="json",
        )

        self.assertEqual(cancelled_response.status_code, 400)
        self.assertEqual(completed_response.status_code, 400)

    def test_future_class_cannot_be_completed(self):
        self.authenticate(self.teacher_user)

        response = self.client.patch(
            f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
            {"status": LiveClass.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.live_class.refresh_from_db()
        self.assertEqual(self.live_class.status, LiveClass.Status.SCHEDULED)

    @override_settings(TIME_ZONE="Asia/Kolkata")
    def test_live_class_ended_in_local_timezone_can_be_completed(self):
        self.live_class.class_date = date(2026, 9, 16)
        self.live_class.end_time = time(16, 15)
        self.live_class.status = LiveClass.Status.LIVE
        self.live_class.save(
            update_fields=["class_date", "end_time", "status"]
        )
        current_time = datetime(
            2026,
            9,
            16,
            10,
            46,
            tzinfo=dt_timezone.utc,
        )

        with (
            timezone.override("Asia/Kolkata"),
            mock.patch("liveclasses.views.timezone.now", return_value=current_time),
        ):
            self.authenticate(self.teacher_user)
            list_response = self.client.get(
                "/api/live-classes/teacher/classes/"
            )

            self.assertEqual(list_response.status_code, 200)
            live_class_data = next(
                item
                for item in list_response.data["classes"]
                if item["id"] == self.live_class.id
            )
            self.assertTrue(live_class_data["can_complete"])

            complete_response = self.client.patch(
                f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
                {"status": LiveClass.Status.COMPLETED},
                format="json",
            )

        self.assertEqual(complete_response.status_code, 200)
        self.live_class.refresh_from_db()
        self.assertEqual(self.live_class.status, LiveClass.Status.COMPLETED)

    @override_settings(TIME_ZONE="Asia/Kolkata")
    def test_local_future_end_time_cannot_be_completed(self):
        self.live_class.class_date = date(2026, 9, 16)
        self.live_class.end_time = time(16, 15)
        self.live_class.status = LiveClass.Status.LIVE
        self.live_class.save(
            update_fields=["class_date", "end_time", "status"]
        )
        current_time = datetime(
            2026,
            9,
            16,
            10,
            30,
            tzinfo=dt_timezone.utc,
        )

        with (
            timezone.override("Asia/Kolkata"),
            mock.patch("liveclasses.views.timezone.now", return_value=current_time),
        ):
            self.authenticate(self.teacher_user)
            list_response = self.client.get(
                "/api/live-classes/teacher/classes/"
            )
            complete_response = self.client.patch(
                f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
                {"status": LiveClass.Status.COMPLETED},
                format="json",
            )

        self.assertEqual(list_response.status_code, 200)
        live_class_data = next(
            item
            for item in list_response.data["classes"]
            if item["id"] == self.live_class.id
        )
        self.assertFalse(live_class_data["can_complete"])
        self.assertEqual(complete_response.status_code, 400)
        self.live_class.refresh_from_db()
        self.assertEqual(self.live_class.status, LiveClass.Status.LIVE)

    @override_settings(TIME_ZONE="Asia/Kolkata")
    def test_cancelled_class_has_no_complete_action(self):
        self.live_class.class_date = date(2026, 9, 16)
        self.live_class.end_time = time(16, 15)
        self.live_class.status = LiveClass.Status.CANCELLED
        self.live_class.save(
            update_fields=["class_date", "end_time", "status"]
        )
        current_time = datetime(
            2026,
            9,
            16,
            10,
            46,
            tzinfo=dt_timezone.utc,
        )

        with (
            timezone.override("Asia/Kolkata"),
            mock.patch("liveclasses.views.timezone.now", return_value=current_time),
        ):
            self.authenticate(self.teacher_user)
            response = self.client.get("/api/live-classes/teacher/classes/")

        self.assertEqual(response.status_code, 200)
        live_class_data = next(
            item
            for item in response.data["classes"]
            if item["id"] == self.live_class.id
        )
        self.assertFalse(live_class_data["can_complete"])

    @override_settings(TIME_ZONE="Asia/Kolkata")
    def test_unrelated_teacher_denied_for_local_ended_live_class(self):
        self.live_class.class_date = date(2026, 9, 16)
        self.live_class.end_time = time(16, 15)
        self.live_class.status = LiveClass.Status.LIVE
        self.live_class.save(
            update_fields=["class_date", "end_time", "status"]
        )
        current_time = datetime(
            2026,
            9,
            16,
            10,
            46,
            tzinfo=dt_timezone.utc,
        )

        with (
            timezone.override("Asia/Kolkata"),
            mock.patch("liveclasses.views.timezone.now", return_value=current_time),
        ):
            self.authenticate(self.other_teacher_user)
            response = self.client.patch(
                f"/api/live-classes/teacher/classes/{self.live_class.id}/status/",
                {"status": LiveClass.Status.COMPLETED},
                format="json",
            )

        self.assertEqual(response.status_code, 404)

    def test_completed_class_becomes_recording_eligible(self):
        self.complete_class_date(self.live_class)
        self.live_class.status = LiveClass.Status.COMPLETED
        self.live_class.save(update_fields=["status"])
        self.authenticate(self.teacher_user)

        response = self.client.get(
            "/api/live-classes/teacher/recordings/eligible-classes/"
        )

        self.assertEqual(response.status_code, 200)
        class_ids = [item["id"] for item in response.data]
        self.assertIn(self.live_class.id, class_ids)

    def test_recording_upload_remains_attached_to_same_live_class(self):
        self.complete_class_date(self.live_class)
        self.live_class.status = LiveClass.Status.COMPLETED
        self.live_class.save(update_fields=["status"])
        self.authenticate(self.teacher_user)

        video = SimpleUploadedFile(
            "class.mp4",
            b"test video",
            content_type="video/mp4",
        )
        response = self.client.post(
            "/api/live-classes/teacher/recordings/upload/",
            {
                "live_class": self.live_class.id,
                "title": "Web Development Recording",
                "video": video,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        recording = LiveClassRecording.objects.get(
            public_id=response.data["public_id"]
        )
        self.assertEqual(recording.live_class_id, self.live_class.id)
