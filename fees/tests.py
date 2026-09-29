from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from academics.models import (
    AcademicSession,
    ClassRoom,
    ParentStudent,
    Section,
    StudentEnrollment,
)
from accounts.models import ParentProfile, StudentProfile, TeacherProfile
from institutions.models import Organization

from .models import FeeInstallment, FeePayment, FeeStructure, StudentFee


User = get_user_model()


class CollegeAdminFeeStructureAPITests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Org One",
            code="ORG1",
        )
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
        self.other_admin = User.objects.create_user(
            username="other-admin",
            password="pass",
            role="college_admin",
            organization=self.other_org,
        )
        self.teacher_user = User.objects.create_user(
            username="teacher",
            password="pass",
            role="teacher",
            organization=self.org,
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
        TeacherProfile.objects.create(
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
        self.enrollment = StudentEnrollment.objects.create(
            student=self.student,
            section=self.section,
            roll_number="1",
        )
        self.other_student_user = User.objects.create_user(
            username="other-student",
            password="pass",
            role="student",
            organization=self.other_org,
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            admission_number="OS-1",
        )
        self.other_session = AcademicSession.objects.create(
            organization=self.other_org,
            name="2026",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
        )
        self.other_classroom = ClassRoom.objects.create(
            organization=self.other_org,
            name="Other Class",
            academic_session=self.other_session,
        )
        self.other_section = Section.objects.create(
            organization=self.other_org,
            name="B",
            classroom=self.other_classroom,
        )
        self.other_enrollment = StudentEnrollment.objects.create(
            student=self.other_student,
            section=self.other_section,
            roll_number="2",
        )

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def structure_payload(self, **overrides):
        payload = {
            "academic_session_id": self.session.id,
            "class_room_id": self.classroom.id,
            "name": "Annual Fee",
            "description": "Annual class fee",
            "total_amount": "1500.00",
            "due_date": "2027-06-30",
            "is_active": True,
            "components": [
                {
                    "name": "Tuition Fee",
                    "amount": "1000.00",
                    "description": "Monthly tuition",
                },
                {
                    "name": "Exam Fee",
                    "amount": "500.00",
                    "description": "",
                },
            ],
        }
        payload.update(overrides)
        return payload

    def create_structure(self, **overrides):
        self.authenticate()
        return self.client.post(
            "/api/fees/college-admin/structures/",
            self.structure_payload(**overrides),
            format="json",
        )

    def make_structure(self, organization=None):
        organization = organization or self.org
        if organization == self.org:
            session = self.session
            classroom = self.classroom
        else:
            session = self.other_session
            classroom = self.other_classroom

        return FeeStructure.objects.create(
            organization=organization,
            academic_session=session,
            class_room=classroom,
            name=f"{organization.code} Fee",
            total_amount=Decimal("1500.00"),
            due_date=date(2027, 6, 30),
        )

    def student_fee_payload(self, structure=None, **overrides):
        structure = structure or self.make_structure()
        payload = {
            "student_profile_id": self.student.id,
            "enrollment_id": self.enrollment.id,
            "academic_session_id": self.session.id,
            "fee_structure_id": structure.id,
            "discount_amount": "0.00",
            "fine_amount": "0.00",
            "due_date": "2027-06-30",
        }
        payload.update(overrides)
        return payload

    def assign_student_fee(self, structure=None, **overrides):
        self.authenticate()
        return self.client.post(
            "/api/fees/college-admin/student-fees/",
            self.student_fee_payload(structure, **overrides),
            format="json",
        )

    def class_fee_payload(self, structure=None, **overrides):
        structure = structure or self.make_structure()
        payload = {
            "academic_session_id": self.session.id,
            "classroom_id": self.classroom.id,
            "section_id": "",
            "fee_structure_id": structure.id,
            "discount_amount": "0.00",
            "fine_amount": "0.00",
            "due_date": "2027-06-30",
        }
        payload.update(overrides)
        return payload

    def assign_class_fee(self, structure=None, **overrides):
        self.authenticate()
        return self.client.post(
            "/api/fees/college-admin/assign-class/",
            self.class_fee_payload(structure, **overrides),
            format="json",
        )

    def make_student(self, username, admission_number, organization=None):
        organization = organization or self.org
        user = User.objects.create_user(
            username=username,
            password="pass",
            role="student",
            organization=organization,
        )
        return StudentProfile.objects.create(
            user=user,
            admission_number=admission_number,
        )

    def enroll(self, student, section=None, is_active=True, roll_number="9"):
        return StudentEnrollment.objects.create(
            student=student,
            section=section or self.section,
            roll_number=roll_number,
            is_active=is_active,
        )

    def test_authentication_required(self):
        response = self.client.get(
            "/api/fees/college-admin/structures/"
        )

        self.assertEqual(response.status_code, 401)

    def test_college_admin_role_required(self):
        for user in [
            self.teacher_user,
            self.student_user,
            self.parent_user,
        ]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(
                    "/api/fees/college-admin/structures/"
                )
                self.assertEqual(response.status_code, 403)

    def test_setup_returns_same_organization_sessions_and_classes(self):
        self.authenticate()

        response = self.client.get(
            "/api/fees/college-admin/setup/"
        )

        self.assertEqual(response.status_code, 200)
        session_ids = [
            session["id"]
            for session in response.data["academic_sessions"]
        ]
        class_ids = [
            classroom["id"]
            for classroom in response.data["classes"]
        ]
        self.assertIn(self.session.id, session_ids)
        self.assertIn(self.classroom.id, class_ids)
        self.assertNotIn(self.other_session.id, session_ids)
        self.assertNotIn(self.other_classroom.id, class_ids)

    def test_fee_component_creation_and_structure_retrieval(self):
        create_response = self.create_structure()

        self.assertEqual(create_response.status_code, 201)
        structure = FeeStructure.objects.get(name="Annual Fee")
        self.assertEqual(structure.organization, self.org)
        self.assertEqual(structure.components.count(), 2)

        detail_response = self.client.get(
            f"/api/fees/college-admin/structures/{structure.id}/"
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(
            len(detail_response.data["structure"]["components"]),
            2,
        )

    def test_same_organization_listing_and_cross_college_isolation(self):
        self.create_structure()
        other_structure = FeeStructure.objects.create(
            organization=self.other_org,
            academic_session=self.other_session,
            class_room=self.other_classroom,
            name="Foreign Fee",
            total_amount=Decimal("500.00"),
        )
        self.authenticate()

        response = self.client.get(
            "/api/fees/college-admin/structures/"
        )

        ids = [
            structure["id"]
            for structure in response.data["structures"]
        ]
        self.assertNotIn(other_structure.id, ids)
        self.assertEqual(len(ids), 1)

    def test_foreign_academic_session_rejected(self):
        response = self.create_structure(
            academic_session_id=self.other_session.id,
            class_room_id=self.classroom.id,
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(FeeStructure.objects.exists())

    def test_foreign_class_rejected(self):
        response = self.create_structure(
            academic_session_id=self.session.id,
            class_room_id=self.other_classroom.id,
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(FeeStructure.objects.exists())

    def test_organization_payload_tampering_is_ignored(self):
        response = self.create_structure(
            organization=self.other_org.id,
            organization_id=self.other_org.id,
        )

        self.assertEqual(response.status_code, 201)
        structure = FeeStructure.objects.get(name="Annual Fee")
        self.assertEqual(structure.organization, self.org)

    def test_decimal_component_total_validation(self):
        response = self.create_structure(
            total_amount="1500.50",
            components=[
                {"name": "Tuition Fee", "amount": "1000.00"},
                {"name": "Exam Fee", "amount": "500.00"},
            ],
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(FeeStructure.objects.exists())

    def test_negative_amount_rejected(self):
        response = self.create_structure(total_amount="-1.00")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(FeeStructure.objects.exists())

    def test_cross_tenant_detail_access_blocked(self):
        other_structure = FeeStructure.objects.create(
            organization=self.other_org,
            academic_session=self.other_session,
            class_room=self.other_classroom,
            name="Foreign Fee",
            total_amount=Decimal("500.00"),
        )
        self.authenticate()

        response = self.client.get(
            f"/api/fees/college-admin/structures/{other_structure.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_patch_updates_components_and_blocks_foreign_class(self):
        create_response = self.create_structure()
        structure_id = create_response.data["structure"]["id"]

        patch_response = self.client.patch(
            f"/api/fees/college-admin/structures/{structure_id}/",
            {
                "total_amount": "2000.00",
                "components": [
                    {"name": "Tuition Fee", "amount": "1500.00"},
                    {"name": "Library Fee", "amount": "500.00"},
                ],
            },
            format="json",
        )
        foreign_response = self.client.patch(
            f"/api/fees/college-admin/structures/{structure_id}/",
            {
                "class_room_id": self.other_classroom.id,
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(foreign_response.status_code, 404)
        structure = FeeStructure.objects.get(id=structure_id)
        self.assertEqual(structure.components.count(), 2)
        self.assertEqual(structure.total_amount, Decimal("2000.00"))

    def test_assignment_setup_includes_org_students_enrollments_and_structures(self):
        structure = self.make_structure()
        other_structure = self.make_structure(self.other_org)
        self.authenticate()

        response = self.client.get("/api/fees/college-admin/setup/")

        self.assertEqual(response.status_code, 200)
        student_ids = [
            student["student_profile_id"]
            for student in response.data["students"]
        ]
        enrollment_ids = [
            enrollment["id"]
            for enrollment in response.data["enrollments"]
        ]
        structure_ids = [
            item["id"]
            for item in response.data["fee_structures"]
        ]
        self.assertIn(self.student.id, student_ids)
        self.assertIn(self.enrollment.id, enrollment_ids)
        self.assertIn(structure.id, structure_ids)
        self.assertNotIn(self.other_student.id, student_ids)
        self.assertNotIn(self.other_enrollment.id, enrollment_ids)
        self.assertNotIn(other_structure.id, structure_ids)

    def test_student_fee_creation_and_payable_calculation(self):
        response = self.assign_student_fee(
            discount_amount="100.00",
            fine_amount="25.00",
            organization=self.other_org.id,
            organization_id=self.other_org.id,
        )

        self.assertEqual(response.status_code, 201)
        student_fee = StudentFee.objects.get()
        self.assertEqual(student_fee.organization, self.org)
        self.assertEqual(student_fee.original_amount, Decimal("1500.00"))
        self.assertEqual(student_fee.discount_amount, Decimal("100.00"))
        self.assertEqual(student_fee.fine_amount, Decimal("25.00"))
        self.assertEqual(student_fee.payable_amount, Decimal("1425.00"))
        self.assertEqual(response.data["student_fee"]["status"], "pending")

    def test_student_fee_authentication_and_role_required(self):
        response = self.client.get("/api/fees/college-admin/student-fees/")
        self.assertEqual(response.status_code, 401)

        for user in [self.teacher_user, self.student_user, self.parent_user]:
            self.authenticate(user)
            response = self.client.get("/api/fees/college-admin/student-fees/")
            self.assertEqual(response.status_code, 403)

    def test_cross_college_student_enrollment_and_structure_rejected(self):
        own_structure = self.make_structure()
        foreign_structure = self.make_structure(self.other_org)

        foreign_student_response = self.assign_student_fee(
            own_structure,
            student_profile_id=self.other_student.id,
            enrollment_id=self.enrollment.id,
        )
        foreign_enrollment_response = self.assign_student_fee(
            own_structure,
            enrollment_id=self.other_enrollment.id,
        )
        foreign_structure_response = self.assign_student_fee(
            foreign_structure,
            fee_structure_id=foreign_structure.id,
        )

        self.assertEqual(foreign_student_response.status_code, 404)
        self.assertEqual(foreign_enrollment_response.status_code, 404)
        self.assertEqual(foreign_structure_response.status_code, 404)

    def test_duplicate_student_fee_assignment_rejected(self):
        structure = self.make_structure()
        first = self.assign_student_fee(structure)
        second = self.assign_student_fee(structure)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(StudentFee.objects.count(), 1)

    def test_college_admin_can_assign_fee_to_entire_class(self):
        structure = self.make_structure()
        second_student = self.make_student("student-2", "S-2")
        self.enroll(second_student, roll_number="2")

        response = self.assign_class_fee(structure)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["eligible_students"], 2)
        self.assertEqual(response.data["assigned"], 2)
        self.assertEqual(
            StudentFee.objects.filter(
                organization=self.org,
                academic_session=self.session,
                fee_structure=structure,
            ).count(),
            2,
        )

    def test_bulk_assignment_excludes_other_class_and_inactive_enrollment(self):
        structure = self.make_structure()
        other_classroom = ClassRoom.objects.create(
            organization=self.org,
            name="Class 11",
            academic_session=self.session,
        )
        other_section = Section.objects.create(
            organization=self.org,
            name="C",
            classroom=other_classroom,
        )
        other_class_student = self.make_student("same-org-other-class", "S-3")
        self.enroll(other_class_student, other_section)
        inactive_student = self.make_student("inactive-enrollment", "S-4")
        self.enroll(inactive_student, is_active=False)

        response = self.assign_class_fee(structure)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["assigned"], 1)
        self.assertTrue(StudentFee.objects.filter(student=self.student).exists())
        self.assertFalse(StudentFee.objects.filter(student=other_class_student).exists())
        self.assertFalse(StudentFee.objects.filter(student=inactive_student).exists())

    def test_specific_section_excludes_other_sections(self):
        structure = self.make_structure()
        section_b = Section.objects.create(
            organization=self.org,
            name="B",
            classroom=self.classroom,
        )
        section_b_student = self.make_student("section-b-student", "S-5")
        self.enroll(section_b_student, section_b)

        response = self.assign_class_fee(
            structure,
            section_id=self.section.id,
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["eligible_students"], 1)
        self.assertTrue(StudentFee.objects.filter(student=self.student).exists())
        self.assertFalse(StudentFee.objects.filter(student=section_b_student).exists())

    def test_all_sections_assigns_to_all_active_students_in_class(self):
        structure = self.make_structure()
        section_b = Section.objects.create(
            organization=self.org,
            name="B",
            classroom=self.classroom,
        )
        section_b_student = self.make_student("section-b-all", "S-6")
        self.enroll(section_b_student, section_b)

        response = self.assign_class_fee(structure, section_id="")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["assigned"], 2)
        self.assertTrue(StudentFee.objects.filter(student=self.student).exists())
        self.assertTrue(StudentFee.objects.filter(student=section_b_student).exists())

    def test_bulk_assignment_blocks_cross_org_classroom_and_section_tampering(self):
        structure = self.make_structure()

        classroom_response = self.assign_class_fee(
            structure,
            classroom_id=self.other_classroom.id,
        )
        section_response = self.assign_class_fee(
            structure,
            section_id=self.other_section.id,
        )

        self.assertEqual(classroom_response.status_code, 404)
        self.assertEqual(section_response.status_code, 404)
        self.assertEqual(StudentFee.objects.count(), 0)

    def test_college_a_admin_cannot_assign_fee_to_college_b_students(self):
        structure = self.make_structure()
        self.authenticate(self.admin)

        response = self.client.post(
            "/api/fees/college-admin/assign-class/",
            {
                "academic_session_id": self.other_session.id,
                "classroom_id": self.other_classroom.id,
                "section_id": "",
                "fee_structure_id": structure.id,
                "due_date": "2027-06-30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(StudentFee.objects.filter(student=self.other_student).exists())

    def test_duplicate_bulk_assignment_skips_existing_fees(self):
        structure = self.make_structure()
        second_student = self.make_student("student-duplicate", "S-7")
        self.enroll(second_student)

        first = self.assign_class_fee(structure)
        second = self.assign_class_fee(structure)

        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data["assigned"], 2)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.data["assigned"], 0)
        self.assertEqual(second.data["skipped_existing"], 2)
        self.assertEqual(StudentFee.objects.count(), 2)

    def test_bulk_assignment_parent_and_student_visibility_without_parent_duplicate(self):
        structure = self.make_structure()
        parent = ParentProfile.objects.get(user=self.parent_user)
        ParentStudent.objects.create(
            parent=parent,
            student=self.student,
            relationship=ParentStudent.Relationship.FATHER,
        )

        response = self.assign_class_fee(structure)
        self.authenticate(self.parent_user)
        parent_response = self.client.get(
            f"/api/fees/parent/student/{self.student.id}/"
        )
        self.authenticate(self.student_user)
        student_response = self.client.get("/api/fees/student/")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(parent_response.status_code, 200)
        self.assertEqual(len(parent_response.data["student_fees"]), 1)
        self.assertEqual(student_response.status_code, 200)
        self.assertEqual(len(student_response.data["student_fees"]), 1)
        self.assertEqual(StudentFee.objects.count(), 1)

    def test_parent_with_multiple_children_sees_fee_under_correct_child_only(self):
        structure = self.make_structure()
        parent = ParentProfile.objects.get(user=self.parent_user)
        ParentStudent.objects.create(parent=parent, student=self.student)
        other_classroom = ClassRoom.objects.create(
            organization=self.org,
            name="Class 12",
            academic_session=self.session,
        )
        other_section = Section.objects.create(
            organization=self.org,
            name="D",
            classroom=other_classroom,
        )
        other_child = self.make_student("other-child", "S-8")
        self.enroll(other_child, other_section)
        ParentStudent.objects.create(parent=parent, student=other_child)

        self.assign_class_fee(structure)
        self.authenticate(self.parent_user)
        child_a_response = self.client.get(
            f"/api/fees/parent/student/{self.student.id}/"
        )
        child_b_response = self.client.get(
            f"/api/fees/parent/student/{other_child.id}/"
        )

        self.assertEqual(len(child_a_response.data["student_fees"]), 1)
        self.assertEqual(len(child_b_response.data["student_fees"]), 0)

    def test_non_admin_roles_cannot_use_bulk_assignment_endpoint(self):
        structure = self.make_structure()

        for user in [self.teacher_user, self.student_user, self.parent_user]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.post(
                    "/api/fees/college-admin/assign-class/",
                    self.class_fee_payload(structure),
                    format="json",
                )
                self.assertEqual(response.status_code, 403)

    def test_preview_endpoint_returns_only_eligible_students(self):
        self.make_structure()
        inactive_student = self.make_student("preview-inactive", "S-9")
        self.enroll(inactive_student, is_active=False)
        self.authenticate()

        response = self.client.get(
            "/api/fees/college-admin/class-students/",
            {
                "academic_session_id": self.session.id,
                "classroom_id": self.classroom.id,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["eligible_students"], 1)
        self.assertEqual(
            response.data["students"][0]["student_profile_id"],
            self.student.id,
        )

    def test_final_post_ignores_tampered_frontend_student_ids(self):
        structure = self.make_structure()
        same_org_other_classroom = ClassRoom.objects.create(
            organization=self.org,
            name="Class 13",
            academic_session=self.session,
        )
        same_org_other_section = Section.objects.create(
            organization=self.org,
            name="E",
            classroom=same_org_other_classroom,
        )
        same_org_other_student = self.make_student("tampered-student", "S-10")
        self.enroll(same_org_other_student, same_org_other_section)

        response = self.assign_class_fee(
            structure,
            student_ids=[
                self.other_student.id,
                same_org_other_student.id,
            ],
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(StudentFee.objects.filter(student=self.student).exists())
        self.assertFalse(StudentFee.objects.filter(student=self.other_student).exists())
        self.assertFalse(StudentFee.objects.filter(student=same_org_other_student).exists())

    def test_student_fee_detail_cross_tenant_blocked(self):
        foreign_structure = self.make_structure(self.other_org)
        foreign_fee = StudentFee.objects.create(
            organization=self.other_org,
            student=self.other_student,
            academic_session=self.other_session,
            fee_structure=foreign_structure,
            original_amount=Decimal("1500.00"),
            discount_amount=Decimal("0.00"),
            fine_amount=Decimal("0.00"),
            payable_amount=Decimal("1500.00"),
            due_date=date(2027, 6, 30),
        )
        self.authenticate()

        response = self.client.get(
            f"/api/fees/college-admin/student-fees/{foreign_fee.id}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_installment_creation_and_invalid_total_rejected(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]

        first = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/installments/",
            {
                "name": "First Term",
                "amount": "1000.00",
                "due_date": "2026-04-30",
                "sequence": 1,
            },
            format="json",
        )
        too_much = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/installments/",
            {
                "name": "Second Term",
                "amount": "600.00",
                "due_date": "2026-05-30",
                "sequence": 2,
            },
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(too_much.status_code, 400)
        self.assertEqual(FeeInstallment.objects.count(), 1)

    def test_payment_recording_partial_full_and_history_preserved(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]

        partial = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "500.00",
                "payment_date": "2026-04-01",
                "payment_method": FeePayment.Method.CASH,
                "reference_number": "R1",
            },
            format="json",
        )
        detail_after_partial = self.client.get(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/"
        )
        full = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "1000.00",
                "payment_date": "2026-04-02",
                "payment_method": FeePayment.Method.UPI,
                "reference_number": "R2",
            },
            format="json",
        )
        detail_after_full = self.client.get(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/"
        )

        self.assertEqual(partial.status_code, 201)
        self.assertEqual(full.status_code, 201)
        self.assertEqual(
            detail_after_partial.data["student_fee"]["status"],
            "partially_paid",
        )
        self.assertEqual(
            detail_after_full.data["student_fee"]["status"],
            "paid",
        )
        self.assertEqual(
            len(detail_after_full.data["student_fee"]["payments"]),
            2,
        )

    def test_overdue_calculation(self):
        response = self.assign_student_fee(due_date="2000-01-01")
        student_fee_id = response.data["student_fee"]["id"]

        detail = self.client.get(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/"
        )

        self.assertEqual(detail.data["student_fee"]["status"], "overdue")

    def test_overpayment_rejected(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]

        payment = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "1500.01",
                "payment_method": FeePayment.Method.CASH,
            },
            format="json",
        )

        self.assertEqual(payment.status_code, 400)
        self.assertEqual(FeePayment.objects.count(), 0)

    def test_installment_payment_and_overpayment_rules(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]
        installment_response = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/installments/",
            {
                "name": "First Term",
                "amount": "500.00",
                "due_date": "2026-04-30",
                "sequence": 1,
            },
            format="json",
        )
        installment_id = installment_response.data["installment"]["id"]

        overpay = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "500.01",
                "payment_method": FeePayment.Method.CASH,
                "installment_id": installment_id,
            },
            format="json",
        )
        valid = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "500.00",
                "payment_method": FeePayment.Method.CASH,
                "installment_id": installment_id,
            },
            format="json",
        )

        self.assertEqual(overpay.status_code, 400)
        self.assertEqual(valid.status_code, 201)

    def test_foreign_installment_rejected_for_payment(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]
        foreign_structure = self.make_structure(self.other_org)
        foreign_fee = StudentFee.objects.create(
            organization=self.other_org,
            student=self.other_student,
            academic_session=self.other_session,
            fee_structure=foreign_structure,
            original_amount=Decimal("1500.00"),
            discount_amount=Decimal("0.00"),
            fine_amount=Decimal("0.00"),
            payable_amount=Decimal("1500.00"),
            due_date=date(2027, 6, 30),
        )
        foreign_installment = FeeInstallment.objects.create(
            student_fee=foreign_fee,
            name="Foreign",
            amount=Decimal("500.00"),
            due_date=date(2026, 4, 30),
        )

        payment = self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "100.00",
                "payment_method": FeePayment.Method.CASH,
                "installment_id": foreign_installment.id,
            },
            format="json",
        )

        self.assertEqual(payment.status_code, 404)

    def test_existing_payments_prevent_lowering_payable_amount_too_far(self):
        response = self.assign_student_fee()
        student_fee_id = response.data["student_fee"]["id"]
        self.client.post(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/payments/",
            {
                "amount": "1000.00",
                "payment_method": FeePayment.Method.CASH,
            },
            format="json",
        )

        patch = self.client.patch(
            f"/api/fees/college-admin/student-fees/{student_fee_id}/",
            {
                "discount_amount": "600.00",
            },
            format="json",
        )

        self.assertEqual(patch.status_code, 400)
        self.assertEqual(FeePayment.objects.count(), 1)


class StudentFeesAPITests(APITestCase):
    setUp = CollegeAdminFeeStructureAPITests.setUp
    authenticate = CollegeAdminFeeStructureAPITests.authenticate
    make_structure = CollegeAdminFeeStructureAPITests.make_structure

    def make_student_fee(self, student=None, organization=None, **overrides):
        organization = organization or self.org
        student = student or self.student
        if organization == self.org:
            session = self.session
            classroom = self.classroom
        else:
            session = self.other_session
            classroom = self.other_classroom
        structure = FeeStructure.objects.create(
            organization=organization,
            academic_session=session,
            class_room=classroom,
            name=f"{organization.code} Fee {FeeStructure.objects.count() + 1}",
            total_amount=Decimal("1500.00"),
            due_date=date(2027, 6, 30),
        )
        values = {
            "organization": organization,
            "student": student,
            "academic_session": session,
            "fee_structure": structure,
            "original_amount": Decimal("1500.00"),
            "discount_amount": Decimal("100.00"),
            "fine_amount": Decimal("25.00"),
            "payable_amount": Decimal("1425.00"),
            "due_date": date(2027, 6, 30),
        }
        values.update(overrides)
        return StudentFee.objects.create(**values)

    def test_student_fees_authentication_required(self):
        response = self.client.get("/api/fees/student/")

        self.assertEqual(response.status_code, 401)

    def test_student_fees_role_required(self):
        for user in [self.teacher_user, self.parent_user, self.admin]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get("/api/fees/student/")
                self.assertEqual(response.status_code, 403)

    def test_student_can_retrieve_own_fees_with_details_and_totals(self):
        student_fee = self.make_student_fee()
        installment = FeeInstallment.objects.create(
            student_fee=student_fee,
            name="First Term",
            amount=Decimal("500.00"),
            due_date=date(2026, 4, 30),
            sequence=1,
        )
        FeePayment.objects.create(
            organization=self.org,
            student_fee=student_fee,
            installment=installment,
            amount=Decimal("300.00"),
            payment_date=date(2026, 4, 1),
            payment_method=FeePayment.Method.CASH,
            reference_number="R1",
            recorded_by=self.admin,
        )
        self.authenticate(self.student_user)

        response = self.client.get("/api/fees/student/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["student_fees"]), 1)
        fee = response.data["student_fees"][0]
        self.assertEqual(fee["id"], student_fee.id)
        self.assertEqual(fee["original_amount"], Decimal("1500.00"))
        self.assertEqual(fee["discount_amount"], Decimal("100.00"))
        self.assertEqual(fee["fine_amount"], Decimal("25.00"))
        self.assertEqual(fee["payable_amount"], Decimal("1425.00"))
        self.assertEqual(fee["paid_amount"], Decimal("300.00"))
        self.assertEqual(fee["outstanding_amount"], Decimal("1125.00"))
        self.assertEqual(fee["installments"][0]["id"], installment.id)
        self.assertEqual(fee["installments"][0]["paid_amount"], Decimal("300.00"))
        self.assertEqual(fee["installments"][0]["outstanding_amount"], Decimal("200.00"))
        self.assertEqual(fee["payments"][0]["amount"], Decimal("300.00"))
        self.assertEqual(fee["payments"][0]["installment"]["id"], installment.id)
        self.assertEqual(fee["payments"][0]["reference_number"], "R1")

    def test_student_fees_ignore_supplied_student_and_organization_ids(self):
        own_fee = self.make_student_fee()
        other_same_org_user = User.objects.create_user(
            username="same-org-student",
            password="pass",
            role="student",
            organization=self.org,
        )
        other_same_org_student = StudentProfile.objects.create(
            user=other_same_org_user,
            admission_number="S-2",
        )
        other_same_org_fee = self.make_student_fee(
            student=other_same_org_student,
            due_date=date(2027, 7, 30),
        )
        foreign_fee = self.make_student_fee(
            student=self.other_student,
            organization=self.other_org,
        )
        self.authenticate(self.student_user)

        response = self.client.get(
            "/api/fees/student/",
            {
                "student_id": other_same_org_student.id,
                "student_fee_id": other_same_org_fee.id,
                "organization_id": self.other_org.id,
                "user_id": self.other_student_user.id,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [fee["id"] for fee in response.data["student_fees"]],
            [own_fee.id],
        )
        returned = response.data["student_fees"][0]
        self.assertNotEqual(returned["id"], other_same_org_fee.id)
        self.assertNotEqual(returned["id"], foreign_fee.id)

    def test_student_fees_nested_details_are_scoped_to_returned_fee(self):
        own_fee = self.make_student_fee()
        foreign_fee = self.make_student_fee(
            student=self.other_student,
            organization=self.other_org,
        )
        own_installment = FeeInstallment.objects.create(
            student_fee=own_fee,
            name="Own",
            amount=Decimal("500.00"),
            due_date=date(2026, 4, 30),
            sequence=1,
        )
        foreign_installment = FeeInstallment.objects.create(
            student_fee=foreign_fee,
            name="Foreign",
            amount=Decimal("500.00"),
            due_date=date(2026, 4, 30),
            sequence=1,
        )
        own_payment = FeePayment.objects.create(
            organization=self.org,
            student_fee=own_fee,
            installment=own_installment,
            amount=Decimal("100.00"),
            payment_method=FeePayment.Method.CASH,
            reference_number="OWN",
            recorded_by=self.admin,
        )
        foreign_payment = FeePayment.objects.create(
            organization=self.other_org,
            student_fee=foreign_fee,
            installment=foreign_installment,
            amount=Decimal("200.00"),
            payment_method=FeePayment.Method.CASH,
            reference_number="FOREIGN",
            recorded_by=self.other_admin,
        )
        self.authenticate(self.student_user)

        response = self.client.get("/api/fees/student/")

        fee = response.data["student_fees"][0]
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in fee["installments"]], [own_installment.id])
        self.assertEqual([item["id"] for item in fee["payments"]], [own_payment.id])
        self.assertNotIn(
            foreign_payment.id,
            [item["id"] for item in fee["payments"]],
        )
        self.assertNotIn(
            foreign_installment.id,
            [item["id"] for item in fee["installments"]],
        )

    def test_student_fees_endpoint_is_read_only(self):
        self.authenticate(self.student_user)

        response = self.client.post(
            "/api/fees/student/",
            {"payable_amount": "1.00"},
            format="json",
        )

        self.assertEqual(response.status_code, 405)


class ParentFeesAndDocumentsSecurityTests(APITestCase):
    setUp = CollegeAdminFeeStructureAPITests.setUp
    authenticate = CollegeAdminFeeStructureAPITests.authenticate

    def setUp(self):
        CollegeAdminFeeStructureAPITests.setUp(self)
        self.parent = ParentProfile.objects.get(user=self.parent_user)
        self.link = ParentStudent.objects.create(
            parent=self.parent,
            student=self.student,
            relationship=ParentStudent.Relationship.FATHER,
        )
        self.same_org_unlinked_user = User.objects.create_user(
            username="same-org-unlinked",
            password="pass",
            role="student",
            organization=self.org,
        )
        self.same_org_unlinked_student = StudentProfile.objects.create(
            user=self.same_org_unlinked_user,
            admission_number="S-3",
        )
        self.other_parent_user = User.objects.create_user(
            username="other-parent",
            password="pass",
            role="parent",
            organization=self.other_org,
        )
        self.other_parent = ParentProfile.objects.create(user=self.other_parent_user)
        ParentStudent.objects.create(
            parent=self.other_parent,
            student=self.other_student,
            relationship=ParentStudent.Relationship.MOTHER,
        )

    def make_fee(self, student=None, organization=None, **overrides):
        organization = organization or self.org
        student = student or self.student
        if organization == self.org:
            session = self.session
            classroom = self.classroom
        else:
            session = self.other_session
            classroom = self.other_classroom
        structure = FeeStructure.objects.create(
            organization=organization,
            academic_session=session,
            class_room=classroom,
            name=f"{organization.code} Secure Fee {FeeStructure.objects.count() + 1}",
            total_amount=Decimal("1500.00"),
            due_date=date(2027, 6, 30),
        )
        values = {
            "organization": organization,
            "student": student,
            "academic_session": session,
            "fee_structure": structure,
            "original_amount": Decimal("1500.00"),
            "discount_amount": Decimal("0.00"),
            "fine_amount": Decimal("0.00"),
            "payable_amount": Decimal("1500.00"),
            "due_date": date(2027, 6, 30),
        }
        values.update(overrides)
        return StudentFee.objects.create(**values)

    def add_payment(self, fee, organization=None, recorded_by=None, reference="SECURE"):
        organization = organization or fee.organization
        recorded_by = recorded_by or (
            self.admin if organization == self.org else self.other_admin
        )
        installment = FeeInstallment.objects.create(
            student_fee=fee,
            name=f"Installment {fee.id}",
            amount=Decimal("500.00"),
            due_date=date(2027, 4, 30),
            sequence=1,
        )
        payment = FeePayment.objects.create(
            organization=organization,
            student_fee=fee,
            installment=installment,
            amount=Decimal("200.00"),
            payment_date=date(2027, 4, 1),
            payment_method=FeePayment.Method.CASH,
            reference_number=reference,
            recorded_by=recorded_by,
        )
        return installment, payment

    def assert_pdf_response(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertGreater(len(response.content), 0)

    def assert_denied(self, response):
        self.assertIn(response.status_code, [401, 403, 404])
        self.assertNotEqual(response.get("Content-Type"), "application/pdf")

    def test_parent_fees_authentication_and_role_required(self):
        response = self.client.get(f"/api/fees/parent/student/{self.student.id}/")
        self.assertEqual(response.status_code, 401)

        for user in [self.teacher_user, self.student_user, self.admin]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(f"/api/fees/parent/student/{self.student.id}/")
                self.assertEqual(response.status_code, 403)

    def test_linked_parent_can_view_only_child_fees_with_scoped_details(self):
        child_fee = self.make_fee()
        child_installment, child_payment = self.add_payment(child_fee, reference="CHILD")
        unlinked_fee = self.make_fee(student=self.same_org_unlinked_student)
        unlinked_installment, unlinked_payment = self.add_payment(
            unlinked_fee,
            reference="UNLINKED",
        )
        foreign_fee = self.make_fee(
            student=self.other_student,
            organization=self.other_org,
        )
        foreign_installment, foreign_payment = self.add_payment(
            foreign_fee,
            organization=self.other_org,
            reference="FOREIGN",
        )
        self.authenticate(self.parent_user)

        response = self.client.get(f"/api/fees/parent/student/{self.student.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["student"]["id"], self.student.id)
        self.assertEqual([fee["id"] for fee in response.data["student_fees"]], [child_fee.id])
        fee = response.data["student_fees"][0]
        self.assertEqual([item["id"] for item in fee["installments"]], [child_installment.id])
        self.assertEqual([item["id"] for item in fee["payments"]], [child_payment.id])
        self.assertNotIn(unlinked_fee.id, [item["id"] for item in response.data["student_fees"]])
        self.assertNotIn(foreign_fee.id, [item["id"] for item in response.data["student_fees"]])
        self.assertNotIn(unlinked_installment.id, [item["id"] for item in fee["installments"]])
        self.assertNotIn(foreign_installment.id, [item["id"] for item in fee["installments"]])
        self.assertNotIn(unlinked_payment.id, [item["id"] for item in fee["payments"]])
        self.assertNotIn(foreign_payment.id, [item["id"] for item in fee["payments"]])

    def test_parent_cannot_view_unlinked_or_cross_org_student_fees_by_url_id(self):
        self.make_fee(student=self.same_org_unlinked_student)
        self.make_fee(student=self.other_student, organization=self.other_org)
        self.authenticate(self.parent_user)

        same_org_response = self.client.get(
            f"/api/fees/parent/student/{self.same_org_unlinked_student.id}/"
        )
        cross_org_response = self.client.get(
            f"/api/fees/parent/student/{self.other_student.id}/"
        )

        self.assertEqual(same_org_response.status_code, 403)
        self.assertEqual(cross_org_response.status_code, 403)
        self.assertNotIn("student_fees", same_org_response.data)
        self.assertNotIn("student_fees", cross_org_response.data)

    def test_invoice_pdf_authorized_users(self):
        fee = self.make_fee()
        self.add_payment(fee)

        for user in [self.student_user, self.parent_user, self.admin]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(f"/api/fees/documents/invoice/{fee.id}/")
                self.assert_pdf_response(response)

    def test_invoice_pdf_blocks_student_parent_admin_teacher_and_anonymous_misuse(self):
        own_fee = self.make_fee()
        same_org_fee = self.make_fee(student=self.same_org_unlinked_student)
        foreign_fee = self.make_fee(student=self.other_student, organization=self.other_org)

        self.authenticate(self.student_user)
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{same_org_fee.id}/"))
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{foreign_fee.id}/"))

        self.authenticate(self.parent_user)
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{same_org_fee.id}/"))
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{foreign_fee.id}/"))

        self.authenticate(self.admin)
        self.assert_pdf_response(self.client.get(f"/api/fees/documents/invoice/{own_fee.id}/"))
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{foreign_fee.id}/"))

        self.authenticate(self.teacher_user)
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{own_fee.id}/"))

        self.client.force_authenticate(user=None)
        self.assert_denied(self.client.get(f"/api/fees/documents/invoice/{own_fee.id}/"))

    def test_cross_org_parent_cannot_download_invoice_for_other_org_child(self):
        own_org_fee = self.make_fee()
        self.authenticate(self.other_parent_user)

        response = self.client.get(f"/api/fees/documents/invoice/{own_org_fee.id}/")

        self.assert_denied(response)

    def test_receipt_pdf_authorized_users(self):
        fee = self.make_fee()
        _, payment = self.add_payment(fee)

        for user in [self.student_user, self.parent_user, self.admin]:
            with self.subTest(role=user.role):
                self.authenticate(user)
                response = self.client.get(f"/api/fees/documents/receipt/{payment.id}/")
                self.assert_pdf_response(response)

    def test_receipt_pdf_blocks_student_parent_admin_teacher_and_anonymous_misuse(self):
        own_fee = self.make_fee()
        _, own_payment = self.add_payment(own_fee, reference="OWN")
        same_org_fee = self.make_fee(student=self.same_org_unlinked_student)
        _, same_org_payment = self.add_payment(same_org_fee, reference="SAMEORG")
        foreign_fee = self.make_fee(student=self.other_student, organization=self.other_org)
        _, foreign_payment = self.add_payment(
            foreign_fee,
            organization=self.other_org,
            reference="FOREIGN",
        )

        self.authenticate(self.student_user)
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{same_org_payment.id}/"))
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{foreign_payment.id}/"))

        self.authenticate(self.parent_user)
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{same_org_payment.id}/"))
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{foreign_payment.id}/"))

        self.authenticate(self.admin)
        self.assert_pdf_response(self.client.get(f"/api/fees/documents/receipt/{own_payment.id}/"))
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{foreign_payment.id}/"))

        self.authenticate(self.teacher_user)
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{own_payment.id}/"))

        self.client.force_authenticate(user=None)
        self.assert_denied(self.client.get(f"/api/fees/documents/receipt/{own_payment.id}/"))

    def test_cross_org_parent_cannot_download_receipt_for_other_org_child(self):
        fee = self.make_fee()
        _, payment = self.add_payment(fee)
        self.authenticate(self.other_parent_user)

        response = self.client.get(f"/api/fees/documents/receipt/{payment.id}/")

        self.assert_denied(response)
