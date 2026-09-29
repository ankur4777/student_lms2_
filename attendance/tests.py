from datetime import date, time

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import ParentProfile, StudentProfile, TeacherProfile, User
from academics.models import (
    AcademicSession,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from institutions.models import Organization

from .models import AttendanceSession, StudentAttendance


class CollegeAdminAttendanceAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(name="DU", code="du")
        self.org_b = Organization.objects.create(name="Other", code="other")

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
        self.teacher_user = User.objects.create_user(
            username="du-teacher",
            password="pass",
            role="teacher",
            organization=self.org_a,
        )
        self.teacher_profile = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="DU-T1",
        )
        self.student_user = User.objects.create_user(
            username="du-student",
            password="pass",
            role="student",
            organization=self.org_a,
        )
        self.student_profile = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="DU-S1",
        )
        self.parent_user = User.objects.create_user(
            username="du-parent",
            password="pass",
            role="parent",
            organization=self.org_a,
        )
        self.parent_profile = ParentProfile.objects.create(
            user=self.parent_user
        )
        ParentStudent.objects.create(
            parent=self.parent_profile,
            student=self.student_profile,
        )

        self.session_a = AcademicSession.objects.create(
            organization=self.org_a,
            name="2026-2027",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        self.classroom_a = ClassRoom.objects.create(
            organization=self.org_a,
            name="BCA",
            academic_session=self.session_a,
        )
        self.section_a = Section.objects.create(
            organization=self.org_a,
            name="A",
            classroom=self.classroom_a,
        )
        self.subject_a = Subject.objects.create(
            organization=self.org_a,
            name="Web Development",
            code="WEB",
            classroom=self.classroom_a,
        )
        self.assignment_a = TeacherAssignment.objects.create(
            teacher=self.teacher_profile,
            subject=self.subject_a,
            section=self.section_a,
            is_active=True,
        )
        StudentEnrollment.objects.create(
            student=self.student_profile,
            section=self.section_a,
            roll_number="1",
            is_active=True,
        )
        self.attendance_session_a = AttendanceSession.objects.create(
            organization=self.org_a,
            section=self.section_a,
            subject=self.subject_a,
            teacher=self.teacher_profile,
            date=date(2026, 9, 16),
            start_time=time(10, 0),
            end_time=time(11, 0),
        )
        StudentAttendance.objects.create(
            attendance_session=self.attendance_session_a,
            student=self.student_profile,
            status=StudentAttendance.Status.PRESENT,
        )

        self.teacher_user_b = User.objects.create_user(
            username="other-teacher",
            password="pass",
            role="teacher",
            organization=self.org_b,
        )
        self.teacher_profile_b = TeacherProfile.objects.create(
            user=self.teacher_user_b,
            employee_id="OT-T1",
        )
        self.student_user_b = User.objects.create_user(
            username="other-student",
            password="pass",
            role="student",
            organization=self.org_b,
        )
        self.student_profile_b = StudentProfile.objects.create(
            user=self.student_user_b,
            admission_number="OT-S1",
        )
        self.session_b = AcademicSession.objects.create(
            organization=self.org_b,
            name="2026-2027",
            start_date=date(2026, 6, 1),
            end_date=date(2027, 5, 31),
            is_active=True,
        )
        self.classroom_b = ClassRoom.objects.create(
            organization=self.org_b,
            name="BCA",
            academic_session=self.session_b,
        )
        self.section_b = Section.objects.create(
            organization=self.org_b,
            name="A",
            classroom=self.classroom_b,
        )
        self.subject_b = Subject.objects.create(
            organization=self.org_b,
            name="Science",
            code="SCI",
            classroom=self.classroom_b,
        )
        self.attendance_session_b = AttendanceSession.objects.create(
            organization=self.org_b,
            section=self.section_b,
            subject=self.subject_b,
            teacher=self.teacher_profile_b,
            date=date(2026, 9, 16),
            start_time=time(12, 0),
            end_time=time(13, 0),
        )
        StudentAttendance.objects.create(
            attendance_session=self.attendance_session_b,
            student=self.student_profile_b,
            status=StudentAttendance.Status.ABSENT,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_college_admin_lists_own_organization_sessions_only(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/attendance/college-admin/sessions/"
        )

        self.assertEqual(response.status_code, 200)
        session_ids = [item["id"] for item in response.data["sessions"]]
        self.assertIn(self.attendance_session_a.id, session_ids)
        self.assertNotIn(self.attendance_session_b.id, session_ids)

    def test_college_b_admin_lists_only_college_b_sessions(self):
        self.authenticate(self.admin_b)

        response = self.client.get(
            "/api/attendance/college-admin/sessions/"
        )

        self.assertEqual(response.status_code, 200)
        session_ids = [item["id"] for item in response.data["sessions"]]
        self.assertIn(self.attendance_session_b.id, session_ids)
        self.assertNotIn(self.attendance_session_a.id, session_ids)

    def test_own_session_detail_is_allowed(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["session"]["id"],
            self.attendance_session_a.id,
        )

    def test_cross_college_session_detail_access_is_denied(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_b.id}/"
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_session_detail_returns_student_user_id_for_navigation(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            )
        )

        self.assertEqual(response.status_code, 200)
        student_row = response.data["students"][0]
        self.assertEqual(
            student_row["student_id"],
            self.student_user.id,
        )
        self.assertEqual(
            student_row["student_profile_id"],
            self.student_profile.id,
        )

    def test_own_student_attendance_access_is_allowed(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            (
                "/api/attendance/college-admin/students/"
                f"{self.student_user.id}/"
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["student"]["username"],
            self.student_user.username,
        )

    def test_cross_college_student_attendance_access_is_denied(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            (
                "/api/attendance/college-admin/students/"
                f"{self.student_user_b.id}/"
            )
        )

        self.assertEqual(response.status_code, 404)

    def assert_foreign_filter_returns_no_sessions(self, query):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/attendance/college-admin/sessions/",
            query,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["sessions"], [])

    def test_foreign_teacher_filter_cannot_leak_data(self):
        self.assert_foreign_filter_returns_no_sessions({
            "teacher": self.teacher_user_b.id,
        })

    def test_foreign_subject_filter_cannot_leak_data(self):
        self.assert_foreign_filter_returns_no_sessions({
            "subject": self.subject_b.id,
        })

    def test_foreign_section_class_and_session_filters_cannot_leak_data(self):
        for query in [
            {"section": self.section_b.id},
            {"class": self.classroom_b.id},
            {"academic_session": self.session_b.id},
        ]:
            with self.subTest(query=query):
                self.assert_foreign_filter_returns_no_sessions(query)

    def test_mixed_own_and_foreign_filters_cannot_bypass_scope(self):
        self.assert_foreign_filter_returns_no_sessions({
            "section": self.section_a.id,
            "subject": self.subject_b.id,
        })

    def test_setup_endpoint_contains_own_organization_data_only(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/attendance/college-admin/setup/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data["teachers"]],
            [self.teacher_user.id],
        )
        self.assertEqual(
            [item["id"] for item in response.data["subjects"]],
            [self.subject_a.id],
        )
        self.assertEqual(
            [item["id"] for item in response.data["classes"]],
            [self.classroom_a.id],
        )
        self.assertEqual(
            [item["id"] for item in response.data["sections"]],
            [self.section_a.id],
        )
        self.assertEqual(
            [item["id"] for item in response.data["academic_sessions"]],
            [self.session_a.id],
        )

    def test_summary_uses_existing_attendance_percentage_rule(self):
        StudentAttendance.objects.create(
            attendance_session=self.attendance_session_a,
            student=StudentProfile.objects.create(
                user=User.objects.create_user(
                    username="du-student-2",
                    password="pass",
                    role="student",
                    organization=self.org_a,
                ),
                admission_number="DU-S2",
            ),
            status=StudentAttendance.Status.LATE,
        )
        self.authenticate(self.admin_a)

        response = self.client.get(
            "/api/attendance/college-admin/summary/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_sessions"], 1)
        self.assertEqual(response.data["present"], 1)
        self.assertEqual(response.data["absent"], 0)
        self.assertEqual(response.data["late"], 1)
        self.assertEqual(response.data["attendance_percentage"], 100)

    def test_non_admin_roles_cannot_access_college_admin_endpoints(self):
        endpoints = [
            "/api/attendance/college-admin/setup/",
            "/api/attendance/college-admin/sessions/",
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            ),
            "/api/attendance/college-admin/summary/",
            (
                "/api/attendance/college-admin/students/"
                f"{self.student_user.id}/"
            ),
        ]

        for user in [
            self.teacher_user,
            self.student_user,
            self.parent_user,
        ]:
            self.authenticate(user)
            for endpoint in endpoints:
                with self.subTest(user=user.username, endpoint=endpoint):
                    response = self.client.get(endpoint)
                    self.assertEqual(response.status_code, 403)

    def test_unauthenticated_requests_are_rejected(self):
        self.client.force_authenticate(user=None)

        endpoints = [
            "/api/attendance/college-admin/setup/",
            "/api/attendance/college-admin/sessions/",
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            ),
            "/api/attendance/college-admin/summary/",
            (
                "/api/attendance/college-admin/students/"
                f"{self.student_user.id}/"
            ),
        ]

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertIn(response.status_code, [401, 403])

    def test_college_admin_attendance_endpoints_are_read_only(self):
        self.authenticate(self.admin_a)

        post_response = self.client.post(
            "/api/attendance/college-admin/sessions/",
            {},
            format="json",
        )
        setup_post_response = self.client.post(
            "/api/attendance/college-admin/setup/",
            {},
            format="json",
        )
        summary_post_response = self.client.post(
            "/api/attendance/college-admin/summary/",
            {},
            format="json",
        )
        student_post_response = self.client.post(
            (
                "/api/attendance/college-admin/students/"
                f"{self.student_user.id}/"
            ),
            {},
            format="json",
        )
        patch_response = self.client.patch(
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            ),
            {"date": "2026-09-17"},
            format="json",
        )
        put_response = self.client.put(
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            ),
            {"date": "2026-09-17"},
            format="json",
        )
        delete_response = self.client.delete(
            (
                "/api/attendance/college-admin/sessions/"
                f"{self.attendance_session_a.id}/"
            )
        )

        self.assertEqual(post_response.status_code, 405)
        self.assertEqual(setup_post_response.status_code, 405)
        self.assertEqual(summary_post_response.status_code, 405)
        self.assertEqual(student_post_response.status_code, 405)
        self.assertEqual(patch_response.status_code, 405)
        self.assertEqual(put_response.status_code, 405)
        self.assertEqual(delete_response.status_code, 405)
