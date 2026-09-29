from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils.dateparse import parse_date

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .feature_access import (
    FEATURE_DEFINITIONS,
    PARENT_FEATURE_KEYS,
    get_parent_child_feature_map,
    get_student_feature_map,
)
from .models import AcademicSession, ClassFeatureAccess, ClassRoom, Section, Subject


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def serialize_academic_session(session):
    return {
        "id": session.id,
        "name": session.name,
        "start_date": session.start_date,
        "end_date": session.end_date,
        "is_active": session.is_active,
    }


def college_academic_session_queryset(organization):
    return AcademicSession.objects.filter(
        organization=organization
    )


def validate_session_payload(data, organization, session=None):
    name = session.name if session else ""
    start_date = session.start_date if session else None
    end_date = session.end_date if session else None
    is_active = session.is_active if session else False

    if "name" in data or not session:
        name = data.get("name", "").strip()

        if not name:
            return None, {"detail": "Academic session name is required."}, 400

    if "start_date" in data or not session:
        start_date = parse_date(data.get("start_date", ""))

        if not start_date:
            return None, {"detail": "Start date is required."}, 400

    if "end_date" in data or not session:
        end_date = parse_date(data.get("end_date", ""))

        if not end_date:
            return None, {"detail": "End date is required."}, 400

    if end_date < start_date:
        return (
            None,
            {"detail": "End date must not be before start date."},
            400,
        )

    if "is_active" in data:
        value = data.get("is_active")
        is_active = (
            value.lower() in ["true", "1", "yes", "on"]
            if isinstance(value, str)
            else bool(value)
        )

    duplicate = AcademicSession.objects.filter(
        organization=organization,
        name=name,
    )

    if session:
        duplicate = duplicate.exclude(id=session.id)

    if duplicate.exists():
        return (
            None,
            {
                "detail": (
                    "An academic session with this name already exists."
                )
            },
            400,
        )

    return {
        "name": name,
        "start_date": start_date,
        "end_date": end_date,
        "is_active": is_active,
    }, None, None


class CollegeAdminAcademicSessionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view academic sessions."},
                status=403
            )

        sessions = college_academic_session_queryset(
            organization
        ).order_by(
            "-is_active",
            "-start_date",
            "name",
        )

        return Response({
            "academic_sessions": [
                serialize_academic_session(session)
                for session in sessions
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {
                    "detail": (
                        "Only college admins can create academic sessions."
                    )
                },
                status=403
            )

        values, error, status_code = validate_session_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        try:
            session = AcademicSession.objects.create(
                organization=organization,
                **values
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "An academic session with this name already exists."
                    )
                },
                status=400
            )

        return Response(
            {
                "message": "Academic session saved successfully.",
                "academic_session": serialize_academic_session(session),
            },
            status=201
        )


class CollegeAdminAcademicSessionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_session(self, user, session_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_academic_session_queryset(
            organization
        ).filter(
            id=session_id
        ).first()

    def get(self, request, session_id):
        session = self.get_session(request.user, session_id)

        if not session:
            return Response(
                {"detail": "Academic session not found."},
                status=404
            )

        return Response({
            "academic_session": serialize_academic_session(session)
        })

    def patch(self, request, session_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {
                    "detail": (
                        "Only college admins can update academic sessions."
                    )
                },
                status=403
            )

        session = self.get_session(request.user, session_id)

        if not session:
            return Response(
                {"detail": "Academic session not found."},
                status=404
            )

        values, error, status_code = validate_session_payload(
            request.data,
            organization,
            session=session,
        )

        if error:
            return Response(error, status=status_code)

        session.name = values["name"]
        session.start_date = values["start_date"]
        session.end_date = values["end_date"]
        session.is_active = values["is_active"]

        try:
            session.save(
                update_fields=[
                    "name",
                    "start_date",
                    "end_date",
                    "is_active",
                ]
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "An academic session with this name already exists."
                    )
                },
                status=400
            )

        return Response({
            "message": "Academic session updated successfully.",
            "academic_session": serialize_academic_session(session),
        })


def serialize_classroom(classroom):
    return {
        "id": classroom.id,
        "name": classroom.name,
        "academic_session_id": classroom.academic_session_id,
        "academic_session": classroom.academic_session.name,
    }


def college_classroom_queryset(organization):
    return ClassRoom.objects.filter(
        organization=organization,
        academic_session__organization=organization,
    ).select_related(
        "academic_session"
    )


def get_college_academic_session(session_id, organization):
    return AcademicSession.objects.filter(
        id=session_id,
        organization=organization,
    ).first()


def validate_classroom_payload(data, organization, classroom=None):
    name = classroom.name if classroom else ""
    academic_session = classroom.academic_session if classroom else None

    if "name" in data or not classroom:
        name = data.get("name", "").strip()

        if not name:
            return None, {"detail": "Class name is required."}, 400

    if "academic_session_id" in data or not classroom:
        academic_session = get_college_academic_session(
            data.get("academic_session_id"),
            organization,
        )

        if not academic_session:
            return None, {"detail": "Academic session not found."}, 404

    duplicate = ClassRoom.objects.filter(
        organization=organization,
        name=name,
        academic_session=academic_session,
    )

    if classroom:
        duplicate = duplicate.exclude(id=classroom.id)

    if duplicate.exists():
        return (
            None,
            {
                "detail": (
                    "A class with this name already exists for this "
                    "academic session."
                )
            },
            400,
        )

    return {
        "name": name,
        "academic_session": academic_session,
    }, None, None


class CollegeAdminClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view classes."},
                status=403
            )

        classrooms = college_classroom_queryset(
            organization
        ).order_by(
            "-academic_session__is_active",
            "academic_session__name",
            "name",
        )

        search = request.query_params.get("search", "").strip()

        if search:
            classrooms = classrooms.filter(
                Q(name__icontains=search)
                | Q(academic_session__name__icontains=search)
            )

        return Response({
            "classes": [
                serialize_classroom(classroom)
                for classroom in classrooms
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create classes."},
                status=403
            )

        values, error, status_code = validate_classroom_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        try:
            classroom = ClassRoom.objects.create(
                organization=organization,
                **values
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "A class with this name already exists for this "
                        "academic session."
                    )
                },
                status=400
            )

        return Response(
            {
                "message": "Class saved successfully.",
                "class": serialize_classroom(classroom),
            },
            status=201
        )


class CollegeAdminClassDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_classroom(self, user, classroom_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_classroom_queryset(
            organization
        ).filter(
            id=classroom_id
        ).first()

    def get(self, request, classroom_id):
        classroom = self.get_classroom(request.user, classroom_id)

        if not classroom:
            return Response(
                {"detail": "Class not found."},
                status=404
            )

        return Response({
            "class": serialize_classroom(classroom)
        })

    def patch(self, request, classroom_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update classes."},
                status=403
            )

        classroom = self.get_classroom(request.user, classroom_id)

        if not classroom:
            return Response(
                {"detail": "Class not found."},
                status=404
            )

        values, error, status_code = validate_classroom_payload(
            request.data,
            organization,
            classroom=classroom,
        )

        if error:
            return Response(error, status=status_code)

        classroom.name = values["name"]
        classroom.academic_session = values["academic_session"]

        try:
            classroom.save(
                update_fields=[
                    "name",
                    "academic_session",
                ]
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "A class with this name already exists for this "
                        "academic session."
                    )
                },
                status=400
            )

        return Response({
            "message": "Class updated successfully.",
            "class": serialize_classroom(classroom),
        })


def serialize_section(section):
    classroom = section.classroom

    return {
        "id": section.id,
        "name": section.name,
        "class_id": classroom.id,
        "class_name": classroom.name,
        "academic_session_id": classroom.academic_session_id,
        "academic_session": classroom.academic_session.name,
    }


def college_section_queryset(organization):
    return Section.objects.filter(
        organization=organization,
        classroom__organization=organization,
        classroom__academic_session__organization=organization,
    ).select_related(
        "classroom",
        "classroom__academic_session",
    )


def get_college_classroom(classroom_id, organization):
    return ClassRoom.objects.filter(
        id=classroom_id,
        organization=organization,
        academic_session__organization=organization,
    ).select_related(
        "academic_session"
    ).first()


def validate_section_payload(data, organization, section=None):
    name = section.name if section else ""
    classroom = section.classroom if section else None

    if "name" in data or not section:
        name = data.get("name", "").strip()

        if not name:
            return None, {"detail": "Section name is required."}, 400

    if "class_id" in data or not section:
        classroom = get_college_classroom(
            data.get("class_id"),
            organization,
        )

        if not classroom:
            return None, {"detail": "Class not found."}, 404

    if (
        section
        and section.classroom_id != classroom.id
        and section.teacher_assignments.exclude(
            subject__classroom=classroom
        ).exists()
    ):
        return (
            None,
            {
                "detail": (
                    "This section has teacher assignments that do not "
                    "belong to the selected class."
                )
            },
            400,
        )

    duplicate = Section.objects.filter(
        organization=organization,
        name=name,
        classroom=classroom,
    )

    if section:
        duplicate = duplicate.exclude(id=section.id)

    if duplicate.exists():
        return (
            None,
            {
                "detail": (
                    "A section with this name already exists for this class."
                )
            },
            400,
        )

    return {
        "name": name,
        "classroom": classroom,
    }, None, None


class CollegeAdminSectionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view sections."},
                status=403
            )

        sections = college_section_queryset(
            organization
        ).order_by(
            "-classroom__academic_session__is_active",
            "classroom__academic_session__name",
            "classroom__name",
            "name",
        )

        search = request.query_params.get("search", "").strip()

        if search:
            sections = sections.filter(
                Q(name__icontains=search)
                | Q(classroom__name__icontains=search)
                | Q(classroom__academic_session__name__icontains=search)
            )

        return Response({
            "sections": [
                serialize_section(section)
                for section in sections
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create sections."},
                status=403
            )

        values, error, status_code = validate_section_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        try:
            section = Section.objects.create(
                organization=organization,
                **values
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "A section with this name already exists for "
                        "this class."
                    )
                },
                status=400
            )

        return Response(
            {
                "message": "Section saved successfully.",
                "section": serialize_section(section),
            },
            status=201
        )


class CollegeAdminSectionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_section(self, user, section_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_section_queryset(
            organization
        ).filter(
            id=section_id
        ).first()

    def get(self, request, section_id):
        section = self.get_section(request.user, section_id)

        if not section:
            return Response(
                {"detail": "Section not found."},
                status=404
            )

        return Response({
            "section": serialize_section(section)
        })

    def patch(self, request, section_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update sections."},
                status=403
            )

        section = self.get_section(request.user, section_id)

        if not section:
            return Response(
                {"detail": "Section not found."},
                status=404
            )

        values, error, status_code = validate_section_payload(
            request.data,
            organization,
            section=section,
        )

        if error:
            return Response(error, status=status_code)

        section.name = values["name"]
        section.classroom = values["classroom"]

        try:
            section.save(
                update_fields=[
                    "name",
                    "classroom",
                ]
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "A section with this name already exists for "
                        "this class."
                    )
                },
                status=400
            )

        return Response({
            "message": "Section updated successfully.",
            "section": serialize_section(section),
        })


def serialize_subject(subject):
    classroom = subject.classroom

    return {
        "id": subject.id,
        "name": subject.name,
        "code": subject.code,
        "class_id": classroom.id,
        "class_name": classroom.name,
        "academic_session_id": classroom.academic_session_id,
        "academic_session": classroom.academic_session.name,
    }


def college_subject_queryset(organization):
    return Subject.objects.filter(
        organization=organization,
        classroom__organization=organization,
        classroom__academic_session__organization=organization,
    ).select_related(
        "classroom",
        "classroom__academic_session",
    )


def validate_subject_payload(data, organization, subject=None):
    name = subject.name if subject else ""
    code = subject.code if subject else ""
    classroom = subject.classroom if subject else None

    if "name" in data or not subject:
        name = data.get("name", "").strip()

        if not name:
            return None, {"detail": "Subject name is required."}, 400

    if "code" in data or not subject:
        code = data.get("code", "").strip()

    if "class_id" in data or not subject:
        classroom = get_college_classroom(
            data.get("class_id"),
            organization,
        )

        if not classroom:
            return None, {"detail": "Class not found."}, 404

    if (
        subject
        and subject.classroom_id != classroom.id
        and subject.teacher_assignments.exclude(
            section__classroom=classroom
        ).exists()
    ):
        return (
            None,
            {
                "detail": (
                    "This subject has teacher assignments that do not "
                    "belong to the selected class."
                )
            },
            400,
        )

    duplicate = Subject.objects.filter(
        organization=organization,
        name=name,
        classroom=classroom,
    )

    if subject:
        duplicate = duplicate.exclude(id=subject.id)

    if duplicate.exists():
        return (
            None,
            {
                "detail": (
                    "A subject with this name already exists for this class."
                )
            },
            400,
        )

    return {
        "name": name,
        "code": code,
        "classroom": classroom,
    }, None, None


class CollegeAdminSubjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can view subjects."},
                status=403
            )

        subjects = college_subject_queryset(
            organization
        ).order_by(
            "-classroom__academic_session__is_active",
            "classroom__academic_session__name",
            "classroom__name",
            "name",
        )

        search = request.query_params.get("search", "").strip()

        if search:
            subjects = subjects.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(classroom__name__icontains=search)
                | Q(classroom__academic_session__name__icontains=search)
            )

        return Response({
            "subjects": [
                serialize_subject(subject)
                for subject in subjects
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can create subjects."},
                status=403
            )

        values, error, status_code = validate_subject_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        try:
            subject = Subject.objects.create(
                organization=organization,
                **values
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "A subject with this name already exists for "
                        "this class."
                    )
                },
                status=400
            )

        return Response(
            {
                "message": "Subject saved successfully.",
                "subject": serialize_subject(subject),
            },
            status=201
        )


class CollegeAdminSubjectDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_subject(self, user, subject_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_subject_queryset(
            organization
        ).filter(
            id=subject_id
        ).first()

    def get(self, request, subject_id):
        subject = self.get_subject(request.user, subject_id)

        if not subject:
            return Response(
                {"detail": "Subject not found."},
                status=404
            )

        return Response({
            "subject": serialize_subject(subject)
        })

    def patch(self, request, subject_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {"detail": "Only college admins can update subjects."},
                status=403
            )

        subject = self.get_subject(request.user, subject_id)

        if not subject:
            return Response(
                {"detail": "Subject not found."},
                status=404
            )

        values, error, status_code = validate_subject_payload(
            request.data,
            organization,
            subject=subject,
        )

        if error:
            return Response(error, status=status_code)

        subject.name = values["name"]
        subject.code = values["code"]
        subject.classroom = values["classroom"]

        try:
            subject.save(
                update_fields=[
                    "name",
                    "code",
                    "classroom",
                ]
            )
        except IntegrityError:
            return Response(
                {
                    "detail": (
                        "A subject with this name already exists for "
                        "this class."
                    )
                },
                status=400
            )

        return Response({
            "message": "Subject updated successfully.",
            "subject": serialize_subject(subject),
        })

def serialize_class_feature_access(classroom, organization):
    access_by_key = {
        item.feature_key: item
        for item in ClassFeatureAccess.objects.filter(
            organization=organization,
            classroom=classroom,
        )
    }

    features = []

    for definition in FEATURE_DEFINITIONS:
        access = access_by_key.get(definition["key"])
        student_enabled = (
            access.is_enabled
            if access
            else True
        )
        parent_enabled = (
            access.parent_enabled
            if access
            else True
        )

        features.append({
            **definition,
            "enabled": student_enabled,
            "student_enabled": student_enabled,
            "parent_enabled": parent_enabled,
            "parent_supported": (
                definition["key"] in PARENT_FEATURE_KEYS
            ),
        })

    return {
        "class": serialize_classroom(classroom),
        "features": features,
    }


class CollegeAdminClassFeatureAccessAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_classroom(self, user, classroom_id):
        organization = college_admin_organization(user)

        if not organization:
            return None, None

        classroom = college_classroom_queryset(organization).filter(
            id=classroom_id
        ).first()

        return organization, classroom

    def get(self, request):
        classroom_id = request.query_params.get("class_id")

        if not classroom_id:
            return Response(
                {"detail": "class_id is required."},
                status=400,
            )

        organization, classroom = self.get_classroom(
            request.user,
            classroom_id,
        )

        if not organization:
            return Response(
                {
                    "detail": (
                        "Only college admins can manage class feature access."
                    )
                },
                status=403,
            )

        if not classroom:
            return Response(
                {"detail": "Class not found."},
                status=404,
            )

        return Response(
            serialize_class_feature_access(classroom, organization)
        )

    def patch(self, request):
        classroom_id = request.data.get("class_id")
        features = request.data.get("features")

        if not classroom_id:
            return Response(
                {"detail": "class_id is required."},
                status=400,
            )

        if not isinstance(features, dict):
            return Response(
                {
                    "detail": (
                        "features must be an object keyed by feature name."
                    )
                },
                status=400,
            )

        valid_keys = {
            definition["key"]
            for definition in FEATURE_DEFINITIONS
        }
        unknown_keys = sorted(set(features.keys()) - valid_keys)

        if unknown_keys:
            return Response(
                {
                    "detail": (
                        "Unknown feature key(s): "
                        + ", ".join(unknown_keys)
                    )
                },
                status=400,
            )

        normalized = {}

        for feature_key, value in features.items():
            if isinstance(value, bool):
                normalized[feature_key] = {
                    "student_enabled": value,
                }
                continue

            if not isinstance(value, dict):
                return Response(
                    {
                        "detail": (
                            f"{feature_key} must be a boolean or an "
                            "object containing access booleans."
                        )
                    },
                    status=400,
                )

            feature_values = {}

            if "student_enabled" in value:
                if not isinstance(value["student_enabled"], bool):
                    return Response(
                        {
                            "detail": (
                                f"{feature_key}.student_enabled must "
                                "be true or false."
                            )
                        },
                        status=400,
                    )
                feature_values["student_enabled"] = value[
                    "student_enabled"
                ]

            if "parent_enabled" in value:
                if feature_key not in PARENT_FEATURE_KEYS:
                    return Response(
                        {
                            "detail": (
                                f"Parent access is not available for "
                                f"{feature_key}."
                            )
                        },
                        status=400,
                    )

                if not isinstance(value["parent_enabled"], bool):
                    return Response(
                        {
                            "detail": (
                                f"{feature_key}.parent_enabled must "
                                "be true or false."
                            )
                        },
                        status=400,
                    )

                feature_values["parent_enabled"] = value[
                    "parent_enabled"
                ]

            if not feature_values:
                return Response(
                    {
                        "detail": (
                            f"{feature_key} must include "
                            "student_enabled or parent_enabled."
                        )
                    },
                    status=400,
                )

            normalized[feature_key] = feature_values

        organization, classroom = self.get_classroom(
            request.user,
            classroom_id,
        )

        if not organization:
            return Response(
                {
                    "detail": (
                        "Only college admins can manage class feature access."
                    )
                },
                status=403,
            )

        if not classroom:
            return Response(
                {"detail": "Class not found."},
                status=404,
            )

        with transaction.atomic():
            for feature_key, values in normalized.items():
                access, _ = ClassFeatureAccess.objects.get_or_create(
                    organization=organization,
                    classroom=classroom,
                    feature_key=feature_key,
                )

                update_fields = []

                if "student_enabled" in values:
                    access.is_enabled = values["student_enabled"]
                    update_fields.append("is_enabled")

                if "parent_enabled" in values:
                    access.parent_enabled = values["parent_enabled"]
                    update_fields.append("parent_enabled")

                if update_fields:
                    update_fields.append("updated_at")
                    access.save(update_fields=update_fields)

        response_data = serialize_class_feature_access(
            classroom,
            organization,
        )
        response_data["message"] = (
            "Class feature access updated successfully."
        )

        return Response(response_data)

    put = patch


class StudentFeatureAccessAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if (
            user.role != "student"
            or not user.is_active
            or not user.organization
            or not user.organization.is_active
        ):
            return Response(
                {"detail": "Only active students can view feature access."},
                status=403,
            )

        features, classroom = get_student_feature_map(user)

        return Response(
            {
                "class": (
                    {
                        "id": classroom.id,
                        "name": classroom.name,
                        "academic_session": classroom.academic_session.name,
                    }
                    if classroom
                    else None
                ),
                "features": features,
            }
        )

class ParentStudentFeatureAccessAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        user = request.user

        if (
            user.role != "parent"
            or not user.is_active
            or not user.organization
            or not user.organization.is_active
        ):
            return Response(
                {
                    "detail": (
                        "Only active parents can view child feature access."
                    )
                },
                status=403,
            )

        features, classroom = get_parent_child_feature_map(
            user,
            student_id,
        )

        if features is None:
            return Response(
                {"detail": "Student is not linked to this parent."},
                status=403,
            )

        return Response(
            {
                "class": (
                    {
                        "id": classroom.id,
                        "name": classroom.name,
                        "academic_session": (
                            classroom.academic_session.name
                        ),
                    }
                    if classroom
                    else None
                ),
                "features": features,
            }
        )

