from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import (
    AcademicSession,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile
from institutions.models import Organization
from studentresults.models import Exam, StudentResult


User = get_user_model()


class CollegeAdminResultsAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Org One", code="ORG1")
        self.other_org = Organization.objects.create(
            name="Org Two",
            code="ORG2",
        )

        self.admin = User.objects.create_user(
            username="admin",
            password="pass",
            role="college_admin",
            organization=self.org,
        )
        self.teacher_user = User.objects.create_user(
            username="teacher",
            password="pass",
            role="teacher",
            organization=self.org,
            first_name="Tina",
            last_name="Teacher",
        )
        self.student_user = User.objects.create_user(
            username="student",
            password="pass",
            role="student",
            organization=self.org,
            first_name="Sam",
            last_name="Student",
        )
        self.parent_user = User.objects.create_user(
            username="parent",
            password="pass",
            role="parent",
            organization=self.org,
        )

        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="T-1",
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="S-1",
        )
        self.parent = ParentProfile.objects.create(user=self.parent_user)
        ParentStudent.objects.create(parent=self.parent, student=self.student)

        self.session = AcademicSession.objects.create(
            organization=self.org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org,
            name="Class 10",
            academic_session=self.session,
        )
        self.section = Section.objects.create(
            organization=self.org,
            name="A",
            classroom=self.classroom,
        )
        self.subject = Subject.objects.create(
            organization=self.org,
            name="Math",
            code="MATH",
            classroom=self.classroom,
        )
        self.teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher,
            subject=self.subject,
            section=self.section,
        )
        self.enrollment = StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="7",
        )
        self.published_exam = Exam.objects.create(
            organization=self.org,
            section=self.section,
            name="Midterm",
            exam_date=date(2026, 9, 20),
            is_published=True,
        )
        self.unpublished_exam = Exam.objects.create(
            organization=self.org,
            section=self.section,
            name="Internal",
            exam_date=date(2026, 9, 25),
            is_published=False,
        )
        self.result = StudentResult.objects.create(
            exam=self.published_exam,
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            marks_obtained=80,
            maximum_marks=100,
            remarks="Good",
        )
        self.unpublished_result = StudentResult.objects.create(
            exam=self.unpublished_exam,
            student=self.student,
            subject=self.subject,
            teacher=self.teacher,
            marks_obtained=70,
            maximum_marks=100,
            remarks="Draft",
        )

        self.other_teacher_user = User.objects.create_user(
            username="otherteacher",
            password="pass",
            role="teacher",
            organization=self.other_org,
        )
        self.other_student_user = User.objects.create_user(
            username="otherstudent",
            password="pass",
            role="student",
            organization=self.other_org,
        )
        self.other_teacher = TeacherProfile.objects.create(
            user=self.other_teacher_user,
            employee_id="T-2",
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            admission_number="S-2",
        )
        self.other_session = AcademicSession.objects.create(
            organization=self.other_org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        self.other_classroom = ClassRoom.objects.create(
            organization=self.other_org,
            name="Class 10",
            academic_session=self.other_session,
        )
        self.other_section = Section.objects.create(
            organization=self.other_org,
            name="B",
            classroom=self.other_classroom,
        )
        self.other_subject = Subject.objects.create(
            organization=self.other_org,
            name="Science",
            code="SCI",
            classroom=self.other_classroom,
        )
        TeacherAssignment.objects.create(
            teacher=self.other_teacher,
            subject=self.other_subject,
            section=self.other_section,
        )
        StudentEnrollment.objects.create(
            student=self.other_student,
            section=self.other_section,
            roll_number="9",
        )
        self.other_exam = Exam.objects.create(
            organization=self.other_org,
            section=self.other_section,
            name="Foreign",
            exam_date=date(2026, 9, 22),
            is_published=True,
        )
        StudentResult.objects.create(
            exam=self.other_exam,
            student=self.other_student,
            subject=self.other_subject,
            teacher=self.other_teacher,
            marks_obtained=88,
            maximum_marks=100,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def test_college_admin_can_list_own_organization_exams(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-results"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["exams"]]
        self.assertIn(self.published_exam.id, ids)
        self.assertIn(self.unpublished_exam.id, ids)

    def test_foreign_organization_exams_are_excluded(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-results"))

        ids = [item["id"] for item in response.data["exams"]]
        self.assertNotIn(self.other_exam.id, ids)

    def test_college_admin_can_open_own_exam_detail(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-result-detail",
                kwargs={"exam_id": self.published_exam.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["exam"]["name"], "Midterm")

    def test_cross_college_exam_detail_returns_404(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-result-detail",
                kwargs={"exam_id": self.other_exam.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_foreign_student_results_cannot_leak(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-result-detail",
                kwargs={"exam_id": self.published_exam.id},
            )
        )

        usernames = [item["username"] for item in response.data["students"]]
        self.assertEqual(usernames, ["student"])
        self.assertNotIn("otherstudent", usernames)

    def test_setup_contains_only_same_organization_data(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-results-setup"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        teacher_ids = [item["id"] for item in response.data["teachers"]]
        subject_ids = [item["id"] for item in response.data["subjects"]]
        section_ids = [item["id"] for item in response.data["sections"]]
        class_ids = [item["id"] for item in response.data["classes"]]
        self.assertIn(self.teacher.id, teacher_ids)
        self.assertNotIn(self.other_teacher.id, teacher_ids)
        self.assertNotIn(self.other_subject.id, subject_ids)
        self.assertNotIn(self.other_section.id, section_ids)
        self.assertNotIn(self.other_classroom.id, class_ids)

    def test_foreign_teacher_filter_cannot_expose_foreign_results(self):
        self.authenticate()

        response = self.client.get(
            reverse("college-admin-results"),
            {"teacher": self.other_teacher.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_foreign_subject_filter_cannot_expose_foreign_results(self):
        self.authenticate()

        response = self.client.get(
            reverse("college-admin-results"),
            {"subject": self.other_subject.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_foreign_section_and_class_filters_cannot_expose_results(self):
        self.authenticate()

        section_response = self.client.get(
            reverse("college-admin-results"),
            {"section": self.other_section.id},
        )
        class_response = self.client.get(
            reverse("college-admin-results"),
            {"class": self.other_classroom.id},
        )

        self.assertEqual(section_response.data["count"], 0)
        self.assertEqual(class_response.data["count"], 0)

    def test_teacher_cannot_access_college_admin_endpoints(self):
        self.authenticate(self.teacher_user)

        response = self.client.get(reverse("college-admin-results"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_access_college_admin_endpoints(self):
        self.authenticate(self.student_user)

        response = self.client.get(reverse("college-admin-results"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_parent_cannot_access_college_admin_endpoints(self):
        self.authenticate(self.parent_user)

        response = self.client.get(reverse("college-admin-results"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_requests_are_rejected(self):
        response = self.client.get(reverse("college-admin-results"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_college_admin_endpoints_reject_write_methods(self):
        self.authenticate()

        list_response = self.client.post(
            reverse("college-admin-results"),
            {"name": "Nope"},
        )
        detail_response = self.client.patch(
            reverse(
                "college-admin-result-detail",
                kwargs={"exam_id": self.published_exam.id},
            ),
            {"name": "Changed"},
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assertEqual(
            detail_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.published_exam.refresh_from_db()
        self.assertEqual(self.published_exam.name, "Midterm")

    def test_college_admin_can_monitor_unpublished_own_org_results(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-result-detail",
                kwargs={"exam_id": self.unpublished_exam.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["exam"]["is_published"])
        self.assertEqual(response.data["summary"]["results_entered"], 1)

    def test_student_unpublished_result_protection_remains(self):
        self.authenticate(self.student_user)

        response = self.client.get(reverse("student-results"))

        exam_ids = [item["id"] for item in response.data["exams"]]
        self.assertIn(self.published_exam.id, exam_ids)
        self.assertNotIn(self.unpublished_exam.id, exam_ids)

    def test_parent_unpublished_result_protection_remains(self):
        self.authenticate(self.parent_user)

        response = self.client.get(
            reverse(
                "parent-student-results",
                kwargs={"student_id": self.student.id},
            )
        )

        exam_ids = [item["id"] for item in response.data["exams"]]
        self.assertIn(self.published_exam.id, exam_ids)
        self.assertNotIn(self.unpublished_exam.id, exam_ids)
