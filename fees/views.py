from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.db.models import Prefetch, Sum
from django.db import IntegrityError, transaction
from django.utils import timezone
from academics.feature_access import (
    ParentChildFeaturePermission,
    StudentClassFeaturePermission,
    parent_child_feature_is_enabled,
)

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from academics.models import AcademicSession, ClassRoom, ParentStudent, Section, StudentEnrollment
from accounts.models import ParentProfile, StudentProfile

from .models import (
    FeeComponent,
    FeeInstallment,
    FeePayment,
    FeeStructure,
    StudentFee,
)


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def parse_money(value, field_name):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, {field_name: "Enter a valid amount."}

    amount = amount.quantize(Decimal("0.01"))

    if amount < Decimal("0.00"):
        return None, {field_name: "Amount cannot be negative."}

    return amount, None


def validation_error_response(error):
    if hasattr(error, "message_dict"):
        return Response(error.message_dict, status=400)

    return Response({"detail": str(error)}, status=400)


def serialize_fee_component(component):
    return {
        "id": component.id,
        "name": component.name,
        "amount": component.amount,
        "description": component.description,
    }


def serialize_fee_structure(fee_structure, include_components=False):
    classroom = fee_structure.class_room
    data = {
        "id": fee_structure.id,
        "name": fee_structure.name,
        "description": fee_structure.description,
        "total_amount": fee_structure.total_amount,
        "due_date": fee_structure.due_date,
        "is_active": fee_structure.is_active,
        "academic_session": {
            "id": fee_structure.academic_session_id,
            "name": fee_structure.academic_session.name,
        },
        "class_room": {
            "id": classroom.id,
            "name": classroom.name,
        },
        "created_at": fee_structure.created_at,
        "updated_at": fee_structure.updated_at,
    }

    if include_components:
        data["components"] = [
            serialize_fee_component(component)
            for component in fee_structure.components.all()
        ]

    return data


def fee_structure_queryset(organization):
    return FeeStructure.objects.filter(
        organization=organization,
        academic_session__organization=organization,
        class_room__organization=organization,
    ).select_related(
        "academic_session",
        "class_room",
    ).prefetch_related(
        "components",
    )


def validate_components(component_data, total_amount):
    if not isinstance(component_data, list) or len(component_data) == 0:
        return None, {"components": "At least one fee component is required."}

    components = []
    component_total = Decimal("0.00")

    for index, item in enumerate(component_data):
        name = str(item.get("name", "")).strip()
        description = str(item.get("description", "") or "").strip()

        if not name:
            return None, {
                "components": f"Component {index + 1} name is required."
            }

        amount, error = parse_money(
            item.get("amount"),
            "amount",
        )

        if error:
            return None, {
                "components": f"Component {index + 1}: {error['amount']}"
            }

        components.append({
            "name": name,
            "amount": amount,
            "description": description,
        })
        component_total += amount

    if component_total != total_amount:
        return None, {
            "components": "Component total must match fee structure total."
        }

    return components, None


def validate_fee_structure_payload(data, organization, instance=None):
    is_create = instance is None
    values = {}

    if is_create or "academic_session_id" in data:
        academic_session = AcademicSession.objects.filter(
            id=data.get("academic_session_id"),
            organization=organization,
        ).first()

        if not academic_session:
            return None, {"detail": "Academic session not found."}, 404

        values["academic_session"] = academic_session

    if is_create or "class_room_id" in data:
        class_room = ClassRoom.objects.filter(
            id=data.get("class_room_id"),
            organization=organization,
        ).select_related(
            "academic_session"
        ).first()

        if not class_room:
            return None, {"detail": "Class not found."}, 404

        values["class_room"] = class_room

    academic_session = values.get(
        "academic_session",
        instance.academic_session if instance else None,
    )
    class_room = values.get(
        "class_room",
        instance.class_room if instance else None,
    )

    if (
        academic_session
        and class_room
        and class_room.academic_session_id != academic_session.id
    ):
        return (
            None,
            {"detail": "Class must belong to the academic session."},
            400,
        )

    if is_create or "name" in data:
        name = str(data.get("name", "")).strip()

        if not name:
            return None, {"detail": "Name is required."}, 400

        values["name"] = name

    if "description" in data:
        values["description"] = str(data.get("description") or "").strip()
    elif is_create:
        values["description"] = ""

    if is_create or "total_amount" in data:
        total_amount, error = parse_money(
            data.get("total_amount"),
            "total_amount",
        )

        if error:
            return None, error, 400

        values["total_amount"] = total_amount

    if "due_date" in data or is_create:
        values["due_date"] = data.get("due_date") or None

    if "is_active" in data:
        value = data.get("is_active")
        values["is_active"] = (
            value.lower() in ["true", "1", "yes", "on"]
            if isinstance(value, str)
            else bool(value)
        )
    elif is_create:
        values["is_active"] = True

    total_amount = values.get(
        "total_amount",
        instance.total_amount if instance else Decimal("0.00"),
    )

    if is_create or "components" in data:
        components, error = validate_components(
            data.get("components", []),
            total_amount,
        )

        if error:
            return None, error, 400

        values["components"] = components

    return values, None, None


class CollegeAdminFeeSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can access fee setup."},
                status=403,
            )

        sessions = AcademicSession.objects.filter(
            organization=organization
        ).order_by("-is_active", "name")
        classes = ClassRoom.objects.filter(
            organization=organization,
            academic_session__organization=organization,
        ).select_related("academic_session").order_by("name")
        sections = Section.objects.filter(
            organization=organization,
            classroom__organization=organization,
        ).select_related("classroom").order_by("classroom__name", "name")
        enrollments = StudentEnrollment.objects.filter(
            is_active=True,
            student__user__organization=organization,
            section__organization=organization,
            section__classroom__organization=organization,
        ).select_related(
            "student",
            "student__user",
            "section",
            "section__classroom",
        ).order_by("student__user__first_name", "student__user__username")
        structures = fee_structure_queryset(organization).filter(
            is_active=True
        ).order_by("name")

        return Response({
            "academic_sessions": [
                {
                    "id": session.id,
                    "name": session.name,
                    "is_active": session.is_active,
                }
                for session in sessions
            ],
            "classes": [
                {
                    "id": classroom.id,
                    "name": classroom.name,
                    "academic_session_id": classroom.academic_session_id,
                }
                for classroom in classes
            ],
            "sections": [
                {
                    "id": section.id,
                    "name": section.name,
                    "class_room_id": section.classroom_id,
                }
                for section in sections
            ],
            "students": [
                {
                    "student_profile_id": enrollment.student_id,
                    "student_id": enrollment.student.user_id,
                    "name": (
                        enrollment.student.user.get_full_name().strip()
                        or enrollment.student.user.username
                    ),
                    "username": enrollment.student.user.username,
                    "admission_number": enrollment.student.admission_number,
                    "enrollment_id": enrollment.id,
                    "section_id": enrollment.section_id,
                    "class_room_id": enrollment.section.classroom_id,
                }
                for enrollment in enrollments
            ],
            "enrollments": [
                {
                    "id": enrollment.id,
                    "student_profile_id": enrollment.student_id,
                    "section_id": enrollment.section_id,
                    "class_room_id": enrollment.section.classroom_id,
                    "roll_number": enrollment.roll_number,
                }
                for enrollment in enrollments
            ],
            "fee_structures": [
                serialize_fee_structure(structure)
                for structure in structures
            ],
        })


class CollegeAdminFeeStructuresAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can access fee structures."},
                status=403,
            )

        structures = fee_structure_queryset(organization).order_by(
            "-is_active",
            "name",
        )
        search = request.query_params.get("search", "").strip()

        if search:
            structures = structures.filter(name__icontains=search)

        return Response({
            "structures": [
                serialize_fee_structure(structure)
                for structure in structures
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create fee structures."},
                status=403,
            )

        values, error, status_code = validate_fee_structure_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        components = values.pop("components")

        try:
            with transaction.atomic():
                fee_structure = FeeStructure(
                    organization=organization,
                    **values,
                )
                fee_structure.full_clean()
                fee_structure.save()

                for component_data in components:
                    component = FeeComponent(
                        fee_structure=fee_structure,
                        **component_data,
                    )
                    component.full_clean()
                    component.save()
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response(
                {"detail": "A fee structure with these details already exists."},
                status=400,
            )

        return Response(
            {
                "message": "Fee structure created successfully.",
                "structure": serialize_fee_structure(
                    fee_structure,
                    include_components=True,
                ),
            },
            status=201,
        )


class CollegeAdminFeeStructureDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_structure(self, user, structure_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return fee_structure_queryset(organization).filter(
            id=structure_id
        ).first()

    def get(self, request, structure_id):
        structure = self.get_structure(request.user, structure_id)

        if not structure:
            return Response(
                {"detail": "Fee structure not found."},
                status=404,
            )

        return Response({
            "structure": serialize_fee_structure(
                structure,
                include_components=True,
            )
        })

    def patch(self, request, structure_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update fee structures."},
                status=403,
            )

        structure = self.get_structure(request.user, structure_id)

        if not structure:
            return Response(
                {"detail": "Fee structure not found."},
                status=404,
            )

        values, error, status_code = validate_fee_structure_payload(
            request.data,
            organization,
            instance=structure,
        )

        if error:
            return Response(error, status=status_code)

        components = values.pop("components", None)

        try:
            with transaction.atomic():
                for field, value in values.items():
                    setattr(structure, field, value)

                structure.full_clean()
                structure.save()

                if components is not None:
                    structure.components.all().delete()
                    for component_data in components:
                        component = FeeComponent(
                            fee_structure=structure,
                            **component_data,
                        )
                        component.full_clean()
                        component.save()
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response(
                {"detail": "A fee structure with these details already exists."},
                status=400,
            )

        return Response({
            "message": "Fee structure updated successfully.",
            "structure": serialize_fee_structure(
                structure,
                include_components=True,
            ),
        })


def paid_amount_for(obj):
    return obj.payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


def calculated_installment_status(installment):
    outstanding = installment.amount - paid_amount_for(installment)
    if outstanding <= Decimal("0.00"):
        return FeeInstallment.Status.PAID
    if timezone.localdate() > installment.due_date:
        return FeeInstallment.Status.OVERDUE
    return FeeInstallment.Status.PENDING


def sync_student_fee_status(student_fee):
    status = student_fee.calculated_status()
    if student_fee.status != status:
        student_fee.status = status
        student_fee.save(update_fields=["status", "updated_at"])
    return status


def student_fee_queryset(organization):
    return StudentFee.objects.filter(
        organization=organization,
        student__user__organization=organization,
        academic_session__organization=organization,
        fee_structure__organization=organization,
    ).select_related(
        "student",
        "student__user",
        "academic_session",
        "fee_structure",
        "fee_structure__class_room",
    ).prefetch_related(
        "installments",
        "payments",
        "payments__recorded_by",
        "payments__installment",
    )


def serialize_installment(installment):
    paid_amount = paid_amount_for(installment)
    outstanding = installment.amount - paid_amount

    return {
        "id": installment.id,
        "name": installment.name,
        "amount": installment.amount,
        "due_date": installment.due_date,
        "sequence": installment.sequence,
        "paid_amount": paid_amount,
        "outstanding_amount": outstanding,
        "status": calculated_installment_status(installment),
    }


def serialize_payment(payment):
    recorded_by = payment.recorded_by
    return {
        "id": payment.id,
        "amount": payment.amount,
        "payment_date": payment.payment_date,
        "payment_method": payment.payment_method,
        "reference_number": payment.reference_number,
        "notes": payment.notes,
        "installment": (
            {
                "id": payment.installment_id,
                "name": payment.installment.name,
            }
            if payment.installment_id
            else None
        ),
        "recorded_by": (
            recorded_by.get_full_name().strip()
            or recorded_by.username
        ),
        "created_at": payment.created_at,
    }


def active_enrollment_for(student, academic_session, organization):
    return StudentEnrollment.objects.filter(
        student=student,
        is_active=True,
        section__organization=organization,
        section__classroom__organization=organization,
        section__classroom__academic_session=academic_session,
    ).select_related(
        "section",
        "section__classroom",
    ).first()


def serialize_student_fee(student_fee, include_details=False):
    sync_student_fee_status(student_fee)
    student_user = student_fee.student.user
    enrollment = active_enrollment_for(
        student_fee.student,
        student_fee.academic_session,
        student_fee.organization,
    )
    paid_amount = student_fee.paid_amount
    data = {
        "id": student_fee.id,
        "student": {
            "id": student_user.id,
            "student_profile_id": student_fee.student_id,
            "name": student_user.get_full_name().strip() or student_user.username,
            "username": student_user.username,
            "admission_number": student_fee.student.admission_number,
        },
        "academic_session": {
            "id": student_fee.academic_session_id,
            "name": student_fee.academic_session.name,
        },
        "fee_structure": {
            "id": student_fee.fee_structure_id,
            "name": student_fee.fee_structure.name,
        },
        "enrollment": (
            {
                "id": enrollment.id,
                "roll_number": enrollment.roll_number,
                "class_room": enrollment.section.classroom.name,
                "section": enrollment.section.name,
            }
            if enrollment
            else None
        ),
        "original_amount": student_fee.original_amount,
        "discount_amount": student_fee.discount_amount,
        "fine_amount": student_fee.fine_amount,
        "payable_amount": student_fee.payable_amount,
        "paid_amount": paid_amount,
        "outstanding_amount": student_fee.payable_amount - paid_amount,
        "due_date": student_fee.due_date,
        "status": student_fee.status,
        "created_at": student_fee.created_at,
        "updated_at": student_fee.updated_at,
    }

    if include_details:
        data["installments"] = [
            serialize_installment(installment)
            for installment in student_fee.installments.all()
        ]
        data["payments"] = [
            serialize_payment(payment)
            for payment in student_fee.payments.all()
        ]

    return data


def validate_student_fee_payload(data, organization, instance=None):
    is_create = instance is None
    values = {}

    if is_create:
        student = StudentProfile.objects.filter(
            id=data.get("student_profile_id"),
            user__organization=organization,
            user__role="student",
        ).select_related("user").first()
        if not student:
            return None, {"detail": "Student not found."}, 404
        values["student"] = student

        academic_session = AcademicSession.objects.filter(
            id=data.get("academic_session_id"),
            organization=organization,
        ).first()
        if not academic_session:
            return None, {"detail": "Academic session not found."}, 404
        values["academic_session"] = academic_session

        fee_structure = fee_structure_queryset(organization).filter(
            id=data.get("fee_structure_id"),
            is_active=True,
        ).first()
        if not fee_structure:
            return None, {"detail": "Fee structure not found."}, 404
        values["fee_structure"] = fee_structure

        enrollment_id = data.get("enrollment_id")
        enrollment = StudentEnrollment.objects.filter(
            id=enrollment_id,
            student=student,
            is_active=True,
            section__organization=organization,
            section__classroom__academic_session=academic_session,
        ).first()
        if not enrollment:
            return None, {"detail": "Enrollment not found."}, 404

        if fee_structure.academic_session_id != academic_session.id:
            return None, {"detail": "Fee structure session mismatch."}, 400

        if enrollment.section.classroom_id != fee_structure.class_room_id:
            return None, {"detail": "Fee structure class mismatch."}, 400

    original_amount = (
        instance.original_amount
        if instance
        else values["fee_structure"].total_amount
    )
    if "original_amount" in data:
        original_amount, error = parse_money(data.get("original_amount"), "original_amount")
        if error:
            return None, error, 400

    discount_amount = instance.discount_amount if instance else Decimal("0.00")
    if "discount_amount" in data or is_create:
        discount_amount, error = parse_money(
            data.get("discount_amount", discount_amount),
            "discount_amount",
        )
        if error:
            return None, error, 400

    fine_amount = instance.fine_amount if instance else Decimal("0.00")
    if "fine_amount" in data or is_create:
        fine_amount, error = parse_money(
            data.get("fine_amount", fine_amount),
            "fine_amount",
        )
        if error:
            return None, error, 400

    payable_amount = original_amount - discount_amount + fine_amount
    if payable_amount < Decimal("0.00"):
        return None, {"discount_amount": "Discount cannot exceed fee plus fine."}, 400

    if instance and instance.paid_amount > payable_amount:
        return None, {"detail": "Existing payments exceed new payable amount."}, 400

    if "due_date" in data or is_create:
        values["due_date"] = data.get("due_date") or (
            values["fee_structure"].due_date if is_create else instance.due_date
        )
        if not values["due_date"]:
            return None, {"detail": "Due date is required."}, 400

    values.update({
        "original_amount": original_amount,
        "discount_amount": discount_amount,
        "fine_amount": fine_amount,
        "payable_amount": payable_amount,
    })
    return values, None, None


def validate_class_fee_payload(data, organization, require_fee=False):
    academic_session = AcademicSession.objects.filter(
        id=data.get("academic_session_id"),
        organization=organization,
    ).first()
    if not academic_session:
        return None, {"detail": "Academic session not found."}, 404

    classroom = ClassRoom.objects.filter(
        id=data.get("classroom_id"),
        organization=organization,
        academic_session=academic_session,
    ).first()
    if not classroom:
        return None, {"detail": "Class not found."}, 404

    section = None
    section_id = data.get("section_id")
    if section_id not in [None, "", "all"]:
        section = Section.objects.filter(
            id=section_id,
            organization=organization,
            classroom=classroom,
        ).first()
        if not section:
            return None, {"detail": "Section not found."}, 404

    values = {
        "academic_session": academic_session,
        "classroom": classroom,
        "section": section,
    }

    if not require_fee:
        return values, None, None

    fee_structure = fee_structure_queryset(organization).filter(
        id=data.get("fee_structure_id"),
        is_active=True,
    ).first()
    if not fee_structure:
        return None, {"detail": "Fee structure not found."}, 404

    if fee_structure.academic_session_id != academic_session.id:
        return None, {"detail": "Fee structure session mismatch."}, 400

    if fee_structure.class_room_id != classroom.id:
        return None, {"detail": "Fee structure class mismatch."}, 400

    original_amount = fee_structure.total_amount
    if "original_amount" in data:
        original_amount, error = parse_money(
            data.get("original_amount"),
            "original_amount",
        )
        if error:
            return None, error, 400

    discount_amount, error = parse_money(
        data.get("discount_amount", Decimal("0.00")),
        "discount_amount",
    )
    if error:
        return None, error, 400

    fine_amount, error = parse_money(
        data.get("fine_amount", Decimal("0.00")),
        "fine_amount",
    )
    if error:
        return None, error, 400

    payable_amount = original_amount - discount_amount + fine_amount
    if payable_amount < Decimal("0.00"):
        return None, {"discount_amount": "Discount cannot exceed fee plus fine."}, 400

    due_date = data.get("due_date") or fee_structure.due_date
    if not due_date:
        return None, {"detail": "Due date is required."}, 400

    values.update({
        "fee_structure": fee_structure,
        "original_amount": original_amount,
        "discount_amount": discount_amount,
        "fine_amount": fine_amount,
        "payable_amount": payable_amount,
        "due_date": due_date,
    })
    return values, None, None


def eligible_class_enrollments(organization, academic_session, classroom, section=None):
    enrollments = StudentEnrollment.objects.filter(
        is_active=True,
        student__user__organization=organization,
        student__user__role="student",
        section__organization=organization,
        section__classroom=classroom,
        section__classroom__organization=organization,
        section__classroom__academic_session=academic_session,
    ).select_related(
        "student",
        "student__user",
        "section",
        "section__classroom",
    ).order_by(
        "section__name",
        "roll_number",
        "student__user__first_name",
        "student__user__username",
    )

    if section:
        enrollments = enrollments.filter(section=section)

    return enrollments


def serialize_class_fee_student(enrollment):
    user = enrollment.student.user
    return {
        "student_profile_id": enrollment.student_id,
        "student_id": user.id,
        "name": user.get_full_name().strip() or user.username,
        "username": user.username,
        "admission_number": enrollment.student.admission_number,
        "enrollment_id": enrollment.id,
        "roll_number": enrollment.roll_number,
        "section_id": enrollment.section_id,
        "section_name": enrollment.section.name,
        "class_room_id": enrollment.section.classroom_id,
        "class_room_name": enrollment.section.classroom.name,
        "status": "Eligible",
    }


class CollegeAdminStudentFeesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can access student fees."}, status=403)

        fees = student_fee_queryset(organization).order_by("-created_at")
        return Response({"student_fees": [serialize_student_fee(fee) for fee in fees]})

    def post(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can assign fees."}, status=403)

        values, error, status_code = validate_student_fee_payload(request.data, organization)
        if error:
            return Response(error, status=status_code)

        try:
            student_fee = StudentFee(organization=organization, **values)
            student_fee.full_clean()
            student_fee.save()
            sync_student_fee_status(student_fee)
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response({"detail": "Fee already assigned to this student."}, status=400)

        return Response({"student_fee": serialize_student_fee(student_fee, True)}, status=201)


class CollegeAdminClassStudentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can preview class fees."}, status=403)

        values, error, status_code = validate_class_fee_payload(
            request.query_params,
            organization,
        )
        if error:
            return Response(error, status=status_code)

        enrollments = eligible_class_enrollments(
            organization,
            values["academic_session"],
            values["classroom"],
            values["section"],
        )
        students = [
            serialize_class_fee_student(enrollment)
            for enrollment in enrollments
        ]

        return Response({
            "academic_session": {
                "id": values["academic_session"].id,
                "name": values["academic_session"].name,
            },
            "class_room": {
                "id": values["classroom"].id,
                "name": values["classroom"].name,
            },
            "section": (
                {
                    "id": values["section"].id,
                    "name": values["section"].name,
                }
                if values["section"]
                else None
            ),
            "eligible_students": len(students),
            "students": students,
        })


class CollegeAdminAssignClassFeesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can assign class fees."}, status=403)

        values, error, status_code = validate_class_fee_payload(
            request.data,
            organization,
            require_fee=True,
        )
        if error:
            return Response(error, status=status_code)

        enrollments = list(eligible_class_enrollments(
            organization,
            values["academic_session"],
            values["classroom"],
            values["section"],
        ))
        eligible_student_ids = [enrollment.student_id for enrollment in enrollments]

        existing_student_ids = set(StudentFee.objects.filter(
            organization=organization,
            academic_session=values["academic_session"],
            fee_structure=values["fee_structure"],
            student_id__in=eligible_student_ids,
        ).values_list("student_id", flat=True))

        assigned = 0
        skipped = len(existing_student_ids)

        try:
            with transaction.atomic():
                for enrollment in enrollments:
                    if enrollment.student_id in existing_student_ids:
                        continue

                    student_fee = StudentFee(
                        organization=organization,
                        student=enrollment.student,
                        academic_session=values["academic_session"],
                        fee_structure=values["fee_structure"],
                        original_amount=values["original_amount"],
                        discount_amount=values["discount_amount"],
                        fine_amount=values["fine_amount"],
                        payable_amount=values["payable_amount"],
                        due_date=values["due_date"],
                    )
                    student_fee.full_clean()
                    student_fee.save()
                    sync_student_fee_status(student_fee)
                    assigned += 1
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response(
                {"detail": "Duplicate fee assignment detected. No class fees were assigned."},
                status=400,
            )

        return Response({
            "eligible_students": len(enrollments),
            "assigned": assigned,
            "skipped_existing": skipped,
            "failed": 0,
            "message": (
                f"Fees successfully assigned to {assigned} students. "
                f"{skipped} students already had this fee and were skipped."
            ),
        }, status=201)


class CollegeAdminStudentFeeDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_student_fee(self, user, student_fee_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return student_fee_queryset(organization).filter(id=student_fee_id).first()

    def get(self, request, student_fee_id):
        student_fee = self.get_student_fee(request.user, student_fee_id)
        if not student_fee:
            return Response({"detail": "Student fee not found."}, status=404)
        return Response({"student_fee": serialize_student_fee(student_fee, True)})

    def patch(self, request, student_fee_id):
        student_fee = self.get_student_fee(request.user, student_fee_id)
        if not student_fee:
            return Response({"detail": "Student fee not found."}, status=404)

        values, error, status_code = validate_student_fee_payload(
            request.data,
            student_fee.organization,
            instance=student_fee,
        )
        if error:
            return Response(error, status=status_code)

        try:
            for field, value in values.items():
                setattr(student_fee, field, value)
            student_fee.full_clean()
            student_fee.save()
            sync_student_fee_status(student_fee)
        except ValidationError as exc:
            return validation_error_response(exc)

        return Response({"student_fee": serialize_student_fee(student_fee, True)})


class CollegeAdminStudentFeeInstallmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_fee_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can manage installments."}, status=403)

        student_fee = student_fee_queryset(organization).filter(id=student_fee_id).first()
        if not student_fee:
            return Response({"detail": "Student fee not found."}, status=404)

        amount, error = parse_money(request.data.get("amount"), "amount")
        if error:
            return Response(error, status=400)
        if amount <= Decimal("0.00"):
            return Response({"amount": "Installment amount must be greater than zero."}, status=400)

        current_total = student_fee.installments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        if current_total + amount > student_fee.payable_amount:
            return Response({"detail": "Installment total cannot exceed payable amount."}, status=400)

        installment = FeeInstallment(
            student_fee=student_fee,
            name=str(request.data.get("name", "")).strip(),
            amount=amount,
            due_date=request.data.get("due_date"),
            sequence=request.data.get("sequence") or 1,
        )
        if not installment.name:
            return Response({"detail": "Installment name is required."}, status=400)

        try:
            installment.full_clean()
            installment.save()
        except ValidationError as exc:
            return validation_error_response(exc)
        except IntegrityError:
            return Response({"detail": "Installment sequence already exists."}, status=400)

        return Response({"installment": serialize_installment(installment)}, status=201)


class CollegeAdminStudentFeePaymentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, student_fee_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can record payments."}, status=403)

        amount, error = parse_money(request.data.get("amount"), "amount")
        if error:
            return Response(error, status=400)
        if amount <= Decimal("0.00"):
            return Response({"amount": "Payment amount must be greater than zero."}, status=400)

        try:
            with transaction.atomic():
                student_fee = student_fee_queryset(organization).select_for_update().filter(
                    id=student_fee_id
                ).first()
                if not student_fee:
                    return Response({"detail": "Student fee not found."}, status=404)

                installment = None
                installment_id = request.data.get("installment_id")
                if installment_id:
                    installment = FeeInstallment.objects.select_for_update().filter(
                        id=installment_id,
                        student_fee=student_fee,
                    ).first()
                    if not installment:
                        return Response({"detail": "Installment not found."}, status=404)

                payment = FeePayment(
                    organization=organization,
                    student_fee=student_fee,
                    installment=installment,
                    amount=amount,
                    payment_date=request.data.get("payment_date") or timezone.localdate(),
                    payment_method=request.data.get("payment_method", FeePayment.Method.CASH),
                    reference_number=str(request.data.get("reference_number", "") or "").strip(),
                    notes=str(request.data.get("notes", "") or "").strip(),
                    recorded_by=request.user,
                )
                payment.full_clean()
                payment.save()
                sync_student_fee_status(student_fee)

                if installment:
                    installment.status = calculated_installment_status(installment)
                    installment.save(update_fields=["status"])
        except ValidationError as exc:
            return validation_error_response(exc)

        return Response({"payment": serialize_payment(payment)}, status=201)


class StudentFeesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "fees"

    def get(self, request):
        if request.user.role != "student" or not request.user.is_active or not request.user.organization:
            return Response({"detail": "Only students can access student fees."}, status=403)
        student = StudentProfile.objects.filter(user=request.user, user__organization=request.user.organization).first()
        if not student:
            return Response({"detail": "Student profile not found."}, status=404)
        fees = student_fee_queryset(request.user.organization).filter(student=student).order_by("-created_at")
        return Response({"student_fees": [serialize_student_fee(fee, True) for fee in fees]})


class ParentStudentFeesAPIView(APIView):
    permission_classes = [IsAuthenticated, ParentChildFeaturePermission]
    parent_feature_key = "fees"

    def get(self, request, student_id):
        user = request.user
        if user.role != "parent" or not user.is_active or not user.organization:
            return Response({"detail": "Only parents can access student fees."}, status=403)

        parent = ParentProfile.objects.filter(
            user=user,
            user__organization=user.organization,
        ).first()
        if not parent:
            return Response({"detail": "Parent profile not found."}, status=404)

        link = ParentStudent.objects.filter(
            parent=parent,
            student_id=student_id,
            student__user__organization=user.organization,
        ).select_related("student", "student__user").first()
        if not link:
            return Response({"detail": "Student is not linked to this parent."}, status=403)

        fees = student_fee_queryset(user.organization).filter(
            student=link.student
        ).order_by("-created_at")
        return Response({
            "student": {
                "id": link.student_id,
                "name": link.student.user.get_full_name().strip() or link.student.user.username,
                "username": link.student.user.username,
            },
            "student_fees": [serialize_student_fee(fee, True) for fee in fees],
        })


def fee_document_access(user, student_fee_id):
    if not user.is_authenticated or not user.is_active or not user.organization:
        return None
    qs = student_fee_queryset(user.organization).filter(id=student_fee_id)
    if user.role == "college_admin":
        return qs.first()
    if user.role == "student":
        student = StudentProfile.objects.filter(user=user, user__organization=user.organization).first()
        return qs.filter(student=student).first() if student else None
    if user.role == "parent":
        parent = ParentProfile.objects.filter(
            user=user,
            user__organization=user.organization,
        ).first()
        if not parent:
            return None

        fee = qs.filter(
            student__parent_links__parent=parent,
            student__user__organization=user.organization,
        ).first()

        if not fee:
            return None

        allowed = parent_child_feature_is_enabled(
            user,
            fee.student_id,
            "fees",
        )

        return fee if allowed is not False else None
    return None


def pdf_response(filename, title, organization, rows, payments=None):
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(organization.name, styles["Title"]),
        Paragraph(title, styles["Heading2"]),
        Paragraph(" | ".join(filter(None, [organization.address, organization.phone, organization.email])), styles["Normal"]),
        Spacer(1, 8*mm),
    ]
    table = Table(rows, colWidths=[55*mm, 100*mm])
    table.setStyle(TableStyle([
        ("GRID",(0,0),(-1,-1),0.5,colors.grey),
        ("BACKGROUND",(0,0),(0,-1),colors.whitesmoke),
        ("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("PADDING",(0,0),(-1,-1),6),
    ]))
    story += [table]
    if payments:
        story += [Spacer(1, 8*mm), Paragraph("Payment History", styles["Heading3"])]
        pdata = [["Date","Amount","Method","Reference"]]
        for p in payments:
            pdata.append([str(p.payment_date), str(p.amount), p.get_payment_method_display(), p.reference_number or "-"])
        pt = Table(pdata, repeatRows=1)
        pt.setStyle(TableStyle([("GRID",(0,0),(-1,-1),0.5,colors.grey),("BACKGROUND",(0,0),(-1,0),colors.whitesmoke),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("PADDING",(0,0),(-1,-1),5)]))
        story.append(pt)
    doc.build(story)
    return response


class FeeInvoicePDFAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "fees"

    def get(self, request, student_fee_id):
        fee = fee_document_access(request.user, student_fee_id)
        if not fee:
            return Response({"detail": "Fee not found or access denied."}, status=404)
        user = fee.student.user
        enrollment = active_enrollment_for(fee.student, fee.academic_session, fee.organization)
        rows = [
            ["Invoice Number", f"FEE-{fee.id:06d}"],
            ["Student", user.get_full_name().strip() or user.username],
            ["Admission Number", fee.student.admission_number or "-"],
            ["Class / Section", f"{enrollment.section.classroom.name} / {enrollment.section.name}" if enrollment else "-"],
            ["Academic Session", fee.academic_session.name],
            ["Fee Structure", fee.fee_structure.name],
            ["Original Amount", str(fee.original_amount)],
            ["Discount", str(fee.discount_amount)],
            ["Fine", str(fee.fine_amount)],
            ["Payable", str(fee.payable_amount)],
            ["Paid", str(fee.paid_amount)],
            ["Outstanding", str(fee.outstanding_amount)],
            ["Due Date", str(fee.due_date)],
            ["Status", fee.get_status_display()],
        ]
        return pdf_response(f"fee-invoice-{fee.id}.pdf", "Fee Invoice", fee.organization, rows, fee.payments.all())


class FeeReceiptPDFAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "fees"

    def get(self, request, payment_id):
        payment = FeePayment.objects.filter(
            id=payment_id,
            organization=request.user.organization,
        ).select_related("student_fee", "student_fee__student__user", "organization", "installment").first()
        if not payment or not fee_document_access(request.user, payment.student_fee_id):
            return Response({"detail": "Payment not found or access denied."}, status=404)
        fee = payment.student_fee
        user = fee.student.user
        rows = [
            ["Receipt Number", f"PAY-{payment.id:06d}"],
            ["Student", user.get_full_name().strip() or user.username],
            ["Fee Structure", fee.fee_structure.name],
            ["Payment Date", str(payment.payment_date)],
            ["Amount Paid", str(payment.amount)],
            ["Payment Method", payment.get_payment_method_display()],
            ["Installment", payment.installment.name if payment.installment else "General"],
            ["Reference", payment.reference_number or "-"],
        ]
        return pdf_response(f"fee-receipt-{payment.id}.pdf", "Payment Receipt", fee.organization, rows)
