from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import (
    AcademicSession,
    ClassRoom,
    Section,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile
from documents.models import Document
from institutions.models import Organization


User = get_user_model()


class CollegeAdminDocumentAPITests(APITestCase):
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
        ParentProfile.objects.create(user=self.parent_user)

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
            roll_number="5",
        )
        self.document = Document.objects.create(
            organization=self.org,
            uploaded_by=self.teacher_user,
            teacher_assignment=self.teacher_assignment,
            title="Own Notes",
            description="Algebra notes",
            document_type=Document.Type.NOTES,
            file=SimpleUploadedFile(
                "own.txt",
                b"own document",
                content_type="text/plain",
            ),
            is_published=True,
        )

        self.other_teacher_user = User.objects.create_user(
            username="otherteacher",
            password="pass",
            role="teacher",
            organization=self.other_org,
        )
        self.other_teacher = TeacherProfile.objects.create(
            user=self.other_teacher_user,
            employee_id="T-2",
        )
        self.other_session = AcademicSession.objects.create(
            organization=self.other_org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        self.other_classroom = ClassRoom.objects.create(
            organization=self.other_org,
            name="Class 11",
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
            classroom=self.other_classroom,
        )
        self.other_teacher_assignment = TeacherAssignment.objects.create(
            teacher=self.other_teacher,
            subject=self.other_subject,
            section=self.other_section,
        )
        self.other_document = Document.objects.create(
            organization=self.other_org,
            uploaded_by=self.other_teacher_user,
            teacher_assignment=self.other_teacher_assignment,
            title="Foreign Notes",
            description="Foreign document",
            document_type=Document.Type.NOTES,
            file=SimpleUploadedFile(
                "foreign.txt",
                b"foreign document",
                content_type="text/plain",
            ),
            is_published=True,
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def test_college_admin_can_list_own_organization_documents(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-document-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data["documents"]]
        self.assertIn(self.document.id, ids)

    def test_foreign_organization_documents_excluded_from_list(self):
        self.authenticate()

        response = self.client.get(reverse("college-admin-document-list"))

        ids = [item["id"] for item in response.data["documents"]]
        self.assertNotIn(self.other_document.id, ids)

    def test_own_document_detail_allowed(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-document-detail",
                kwargs={"document_id": self.document.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["document"]["title"], "Own Notes")

    def test_foreign_document_detail_returns_404(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-document-detail",
                kwargs={"document_id": self.other_document.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_own_document_download_allowed(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-document-download",
                kwargs={"document_id": self.document.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_foreign_document_download_returns_404(self):
        self.authenticate()

        response = self.client.get(
            reverse(
                "college-admin-document-download",
                kwargs={"document_id": self.other_document.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_search_cannot_leak_foreign_documents(self):
        self.authenticate()

        response = self.client.get(
            reverse("college-admin-document-list"),
            {"search": "Foreign"},
        )

        self.assertEqual(response.data["count"], 0)

    def test_filters_cannot_leak_foreign_documents(self):
        self.authenticate()

        response = self.client.get(
            reverse("college-admin-document-list"),
            {
                "teacher": self.other_teacher.id,
                "subject": self.other_subject.id,
                "class": self.other_classroom.id,
                "section": self.other_section.id,
                "academic_session": self.other_session.id,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_student_denied(self):
        self.authenticate(self.student_user)

        response = self.client.get(reverse("college-admin-document-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_denied(self):
        self.authenticate(self.teacher_user)

        response = self.client.get(reverse("college-admin-document-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_parent_denied(self):
        self.authenticate(self.parent_user)

        response = self.client.get(reverse("college-admin-document-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_user_denied(self):
        response = self.client.get(reverse("college-admin-document-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_college_admin_endpoints_are_read_only(self):
        self.authenticate()

        list_response = self.client.post(
            reverse("college-admin-document-list"),
            {"title": "Nope"},
        )
        detail_response = self.client.patch(
            reverse(
                "college-admin-document-detail",
                kwargs={"document_id": self.document.id},
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
        self.document.refresh_from_db()
        self.assertEqual(self.document.title, "Own Notes")

    def test_existing_teacher_and_student_document_flows_remain(self):
        self.authenticate(self.teacher_user)

        teacher_response = self.client.get(reverse("teacher-document-list"))

        self.assertEqual(teacher_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(teacher_response.data["documents"]), 1)

        self.authenticate(self.student_user)

        student_response = self.client.get(reverse("student-document-list"))

        self.assertEqual(student_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(student_response.data["documents"]), 1)
