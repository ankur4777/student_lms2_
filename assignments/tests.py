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
from assignments.models import Assignment, AssignmentSubmission
from institutions.models import Organization


User = get_user_model()


class CollegeAdminAssignmentAPITests(APITestCase):
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
            is_active=True,
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
        self.assignment = Assignment.objects.create(
            organization=self.org,
            teacher_assignment=self.teacher_assignment,
            title="Algebra",
            instructions="Solve problems",
            due_date=date(2026, 9, 30),
            is_published=True,
        )
        self.submission = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            submission_text="Done",
            status=AssignmentSubmission.Status.GRADED,
            marks_obtained=9,
            feedback="Good",
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
        self.other_admin = User.objects.create_user(
            username="otheradmin",
            password="pass",
            role="college_admin",
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
        self.other_teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.other_teacher,
            subject=self.other_subject,
            section=self.other_section,
        )
        StudentEnrollment.objects.create(
            student=self.other_student,
            section=self.other_section,
            roll_number="9",
        )
        self.other_assignment = Assignment.objects.create(
            organization=self.other_org,
            teacher_assignment=self.other_teacher_assignment,
            title="Physics",
            due_date=date(2026, 10, 1),
        )
        AssignmentSubmission.objects.create(
            assignment=self.other_assignment,
            student=self.other_student,
            submission_text="Foreign",
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def test_college_admin_can_list_own_organization_assignments(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-assignments"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["assignments"][0]["id"],
            self.assignment.id,
        )

    def test_college_admin_cannot_see_another_organization_assignments(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-assignments"))

        ids = [item["id"] for item in response.data["assignments"]]
        self.assertNotIn(self.other_assignment.id, ids)

    def test_cross_college_assignment_detail_returns_404(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-assignment-detail",
                kwargs={"assignment_id": self.other_assignment.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_college_submissions_cannot_leak(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-assignment-detail",
                kwargs={"assignment_id": self.assignment.id},
            )
        )

        usernames = [item["username"] for item in response.data["students"]]
        self.assertEqual(usernames, ["student"])
        self.assertNotIn("otherstudent", usernames)

    def test_teacher_cannot_access_college_admin_endpoints(self):
        self.authenticate(self.teacher_user)

        response = self.client.get(reverse("college-admin-assignments"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_cannot_access_college_admin_endpoints(self):
        self.authenticate(self.student_user)

        response = self.client.get(reverse("college-admin-assignments"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_parent_cannot_access_college_admin_endpoints(self):
        self.authenticate(self.parent_user)

        response = self.client.get(reverse("college-admin-assignments"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(reverse("college-admin-assignments"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_filters_cannot_expose_foreign_organization_data(self):
        self.authenticate()

        response = self.client.get(
            reverse("college-admin-assignments"),
            {"teacher": self.other_teacher.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_college_admin_endpoints_are_read_only(self):
        self.authenticate()

        list_response = self.client.post(
            reverse("college-admin-assignments"),
            {"title": "Nope"},
        )
        detail_response = self.client.patch(
            reverse(
                "college-admin-assignment-detail",
                kwargs={"assignment_id": self.assignment.id},
            ),
            {"title": "Changed"},
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assertEqual(
            detail_response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.title, "Algebra")

    def test_own_organization_assignment_detail_works(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-assignment-detail",
                kwargs={"assignment_id": self.assignment.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["assignment"]["title"], "Algebra")
        self.assertEqual(response.data["summary"]["total_students"], 1)

    def test_submission_counts_details_contain_only_authorized_students(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-assignment-detail",
                kwargs={"assignment_id": self.assignment.id},
            )
        )

        self.assertEqual(response.data["assignment"]["submission_count"], 1)
        self.assertEqual(response.data["assignment"]["graded_count"], 1)
        self.assertEqual(len(response.data["students"]), 1)
        self.assertEqual(response.data["students"][0]["status"], "graded")


class TeacherAssignmentGradingValidationTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Org One", code="ORG1")
        self.other_org = Organization.objects.create(
            name="Org Two",
            code="ORG2",
        )

        self.teacher_user = User.objects.create_user(
            username="teacher-grade",
            password="pass",
            role="teacher",
            organization=self.org,
        )
        self.other_teacher_user = User.objects.create_user(
            username="teacher-other-section",
            password="pass",
            role="teacher",
            organization=self.org,
        )
        self.cross_org_teacher_user = User.objects.create_user(
            username="teacher-cross-org",
            password="pass",
            role="teacher",
            organization=self.other_org,
        )
        self.student_user = User.objects.create_user(
            username="student-grade",
            password="pass",
            role="student",
            organization=self.org,
        )

        self.teacher = TeacherProfile.objects.create(
            user=self.teacher_user,
            employee_id="GT-1",
        )
        self.other_teacher = TeacherProfile.objects.create(
            user=self.other_teacher_user,
            employee_id="GT-2",
        )
        self.cross_org_teacher = TeacherProfile.objects.create(
            user=self.cross_org_teacher_user,
            employee_id="GT-3",
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            admission_number="GS-1",
        )

        self.session = AcademicSession.objects.create(
            organization=self.org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        self.classroom = ClassRoom.objects.create(
            organization=self.org,
            name="Class 8",
            academic_session=self.session,
        )
        self.section = Section.objects.create(
            organization=self.org,
            name="A",
            classroom=self.classroom,
        )
        self.subject = Subject.objects.create(
            organization=self.org,
            name="English",
            classroom=self.classroom,
        )
        self.teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.teacher,
            subject=self.subject,
            section=self.section,
        )
        StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="11",
        )
        self.assignment = Assignment.objects.create(
            organization=self.org,
            teacher_assignment=self.teacher_assignment,
            title="Essay",
            due_date=date(2026, 9, 30),
        )
        self.submission = AssignmentSubmission.objects.create(
            assignment=self.assignment,
            student=self.student,
            submission_text="Essay text",
        )

        self.url = reverse(
            "teacher-grade-submission",
            kwargs={"submission_id": self.submission.id},
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.teacher_user)

    def test_valid_marks_success(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {"marks_obtained": "95.50"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        self.assertEqual(str(self.submission.marks_obtained), "95.50")
        self.assertEqual(self.submission.status, "graded")

    def test_negative_marks_return_400(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {"marks_obtained": "-1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("marks_obtained", response.data)

    def test_non_numeric_marks_return_400(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {"marks_obtained": "abc"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("marks_obtained", response.data)

    def test_extremely_large_marks_return_400_not_500(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {"marks_obtained": "999999999999999999999999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("marks_obtained", response.data)

    def test_valid_feedback_and_marks_still_save(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {
                "marks_obtained": "88",
                "feedback": "Well done",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.submission.refresh_from_db()
        self.assertEqual(str(self.submission.marks_obtained), "88.00")
        self.assertEqual(self.submission.feedback, "Well done")
        self.assertIsNotNone(self.submission.graded_at)

    def test_unauthorized_teacher_cannot_grade(self):
        self.authenticate(self.other_teacher_user)

        response = self.client.patch(
            self.url,
            {"marks_obtained": "80"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_organization_teacher_cannot_grade(self):
        self.authenticate(self.cross_org_teacher_user)

        response = self.client.patch(
            self.url,
            {"marks_obtained": "80"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
