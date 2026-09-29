from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from academics.models import AcademicSession, ClassRoom, ParentStudent, Section, StudentEnrollment
from accounts.models import ParentProfile, StudentProfile, TeacherProfile, User
from institutions.models import Organization
from .models import Notice


class NoticeAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org_a = Organization.objects.create(name="College A", code="NA")
        self.org_b = Organization.objects.create(name="College B", code="NB")

        self.admin_a = self.user("admin-a", "college_admin", self.org_a)
        self.admin_b = self.user("admin-b", "college_admin", self.org_b)
        self.student_user = self.user("student-a", "student", self.org_a)
        self.teacher_user = self.user("teacher-a", "teacher", self.org_a)
        self.parent_user = self.user("parent-a", "parent", self.org_a)

        self.student = StudentProfile.objects.create(
            user=self.student_user, admission_number="NOTICE-STUDENT"
        )
        TeacherProfile.objects.create(
            user=self.teacher_user, employee_id="NOTICE-TEACHER"
        )
        self.parent = ParentProfile.objects.create(user=self.parent_user)

        self.session = AcademicSession.objects.create(
            organization=self.org_a,
            name="2026-27",
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timedelta(days=365),
            is_active=True,
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org_a,
            name="Digital Marketing",
            academic_session=self.session,
        )
        self.section = Section.objects.create(
            organization=self.org_a,
            name="A",
            classroom=self.classroom,
        )
        StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="1",
            is_active=True,
        )
        ParentStudent.objects.create(parent=self.parent, student=self.student)

    def user(self, username, role, organization):
        return User.objects.create_user(
            username=username,
            password="pass",
            role=role,
            organization=organization,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def create_notice(self, audience=Notice.Audience.EVERYONE, **kwargs):
        data = {
            "organization": self.org_a,
            "title": kwargs.pop("title", "General Notice"),
            "message": kwargs.pop("message", "Important announcement"),
            "audience": audience,
            "created_by": self.admin_a,
            **kwargs,
        }
        return Notice.objects.create(**data)

    def test_college_admin_can_create_notice(self):
        self.auth(self.admin_a)
        response = self.client.post(
            "/api/notices/college-admin/",
            {
                "title": "Holiday",
                "message": "College closed tomorrow",
                "audience": "everyone",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Notice.objects.count(), 1)
        self.assertEqual(Notice.objects.first().organization, self.org_a)

    def test_non_admin_cannot_manage_notices(self):
        for user in [self.student_user, self.teacher_user, self.parent_user]:
            with self.subTest(role=user.role):
                self.auth(user)
                response = self.client.get("/api/notices/college-admin/")
                self.assertEqual(response.status_code, 403)

    def test_college_admin_list_is_organization_isolated(self):
        self.create_notice(title="College A Notice")
        Notice.objects.create(
            organization=self.org_b,
            title="College B Notice",
            message="Private",
            audience=Notice.Audience.EVERYONE,
            created_by=self.admin_b,
        )
        self.auth(self.admin_a)
        response = self.client.get("/api/notices/college-admin/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "College A Notice")

    def test_cross_organization_notice_detail_is_hidden(self):
        foreign = Notice.objects.create(
            organization=self.org_b,
            title="Foreign",
            message="Private",
            audience=Notice.Audience.EVERYONE,
            created_by=self.admin_b,
        )
        self.auth(self.admin_a)
        response = self.client.get(f"/api/notices/college-admin/{foreign.id}/")
        self.assertEqual(response.status_code, 404)

    def test_cross_organization_class_is_rejected(self):
        foreign_session = AcademicSession.objects.create(
            organization=self.org_b,
            name="2026",
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timedelta(days=365),
        )
        foreign_class = ClassRoom.objects.create(
            organization=self.org_b,
            name="Foreign Class",
            academic_session=foreign_session,
        )
        self.auth(self.admin_a)
        response = self.client.post(
            "/api/notices/college-admin/",
            {
                "title": "Bad Target",
                "message": "No",
                "audience": "class",
                "classroom": foreign_class.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_student_sees_everyone_students_class_and_section_notices(self):
        self.create_notice(Notice.Audience.EVERYONE, title="Everyone")
        self.create_notice(Notice.Audience.STUDENTS, title="Students")
        self.create_notice(Notice.Audience.CLASS, title="Class", classroom=self.classroom)
        self.create_notice(Notice.Audience.SECTION, title="Section", section=self.section)
        self.create_notice(Notice.Audience.TEACHERS, title="Teachers")
        self.auth(self.student_user)

        response = self.client.get("/api/notices/feed/")

        self.assertEqual(response.status_code, 200)
        titles = {item["title"] for item in response.data}
        self.assertEqual(titles, {"Everyone", "Students", "Class", "Section"})

    def test_teacher_sees_only_everyone_and_teacher_notices(self):
        self.create_notice(Notice.Audience.EVERYONE, title="Everyone")
        self.create_notice(Notice.Audience.TEACHERS, title="Teachers")
        self.create_notice(Notice.Audience.STUDENTS, title="Students")
        self.auth(self.teacher_user)
        response = self.client.get("/api/notices/feed/")
        self.assertEqual({item["title"] for item in response.data}, {"Everyone", "Teachers"})

    def test_parent_sees_parent_and_child_targeted_notices(self):
        self.create_notice(Notice.Audience.PARENTS, title="Parents")
        self.create_notice(Notice.Audience.CLASS, title="Class", classroom=self.classroom)
        self.create_notice(Notice.Audience.SECTION, title="Section", section=self.section)
        self.create_notice(Notice.Audience.TEACHERS, title="Teachers")
        self.auth(self.parent_user)
        response = self.client.get("/api/notices/feed/")
        self.assertEqual(
            {item["title"] for item in response.data},
            {"Parents", "Class", "Section"},
        )

    def test_future_expired_and_inactive_notices_are_hidden(self):
        self.create_notice(
            title="Future",
            publish_at=timezone.now() + timedelta(days=1),
        )
        self.create_notice(
            title="Expired",
            publish_at=timezone.now() - timedelta(days=2),
            expires_at=timezone.now() - timedelta(days=1),
        )
        self.create_notice(title="Inactive", is_active=False)
        self.create_notice(title="Visible")
        self.auth(self.student_user)
        response = self.client.get("/api/notices/feed/")
        self.assertEqual([item["title"] for item in response.data], ["Visible"])

    def test_filter_options_are_organization_scoped(self):
        self.auth(self.admin_a)
        response = self.client.get("/api/notices/college-admin/filters/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["classes"][0]["name"], "Digital Marketing")
        self.assertEqual(response.data["sections"][0]["name"], "A")
