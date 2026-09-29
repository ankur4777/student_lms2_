from academics.feature_access import ParentChildFeaturePermission, StudentClassFeaturePermission

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from accounts.models import (
    StudentProfile,
    TeacherProfile,
    ParentProfile,
)
from .models import Assignment
from academics.models import (
    TeacherAssignment,
    StudentEnrollment,
    ParentStudent,
    ClassRoom,
    Section,
    Subject,
)
from django.utils import timezone
from .models import AssignmentSubmission

import mimetypes
from decimal import Decimal, InvalidOperation

from django.http import FileResponse
from notifications.services import (
    notify_assignment_graded,
    notify_assignment_published,
    notify_assignment_submitted,
)


def _display_name(user):
    return user.get_full_name().strip() or user.username


def _college_admin_required(user):
    return user.role == "college_admin" and user.organization_id


def _college_assignment_queryset(user):
    return Assignment.objects.filter(
        organization=user.organization
    ).select_related(
        "teacher_assignment",
        "teacher_assignment__teacher",
        "teacher_assignment__teacher__user",
        "teacher_assignment__subject",
        "teacher_assignment__section",
        "teacher_assignment__section__classroom",
        "teacher_assignment__section__classroom__academic_session",
    )


def _assignment_summary(assignment):
    teacher_assignment = assignment.teacher_assignment
    teacher_user = teacher_assignment.teacher.user
    subject = teacher_assignment.subject
    section = teacher_assignment.section
    classroom = section.classroom
    academic_session = classroom.academic_session

    eligible_students = StudentEnrollment.objects.filter(
        section=section,
        is_active=True,
        student__user__organization=assignment.organization,
    ).count()

    submission_count = assignment.submissions.filter(
        student__user__organization=assignment.organization,
        student__enrollments__section=section,
        student__enrollments__is_active=True,
    ).distinct().count()

    graded_count = assignment.submissions.filter(
        student__user__organization=assignment.organization,
        student__enrollments__section=section,
        student__enrollments__is_active=True,
        status=AssignmentSubmission.Status.GRADED,
    ).distinct().count()

    return {
        "id": assignment.id,
        "title": assignment.title,
        "instructions": assignment.instructions,
        "teacher_id": teacher_assignment.teacher_id,
        "teacher_name": _display_name(teacher_user),
        "subject_id": subject.id,
        "subject_name": subject.name,
        "class_id": classroom.id,
        "classroom_name": classroom.name,
        "section_id": section.id,
        "section_name": section.name,
        "academic_session_id": academic_session.id,
        "academic_session_name": academic_session.name,
        "due_date": assignment.due_date,
        "due_time": assignment.due_time,
        "is_published": assignment.is_published,
        "status": "published" if assignment.is_published else "draft",
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
        "has_attachment": bool(assignment.attachment),
        "total_eligible_students": eligible_students,
        "submission_count": submission_count,
        "graded_count": graded_count,
    }


class CollegeAdminAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not _college_admin_required(user):
            return Response(
                {"detail": "Only college admins can access assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        assignments = _college_assignment_queryset(user)

        teacher = request.query_params.get("teacher")
        subject = request.query_params.get("subject")
        classroom = request.query_params.get("class")
        section = request.query_params.get("section")
        published = request.query_params.get("is_published")
        status_filter = request.query_params.get("status")
        search = request.query_params.get("search", "").strip()

        if teacher:
            assignments = assignments.filter(
                teacher_assignment__teacher_id=teacher,
                teacher_assignment__teacher__user__organization=user.organization,
            )
        if subject:
            assignments = assignments.filter(
                teacher_assignment__subject_id=subject,
                teacher_assignment__subject__organization=user.organization,
            )
        if classroom:
            assignments = assignments.filter(
                teacher_assignment__section__classroom_id=classroom,
                teacher_assignment__section__classroom__organization=user.organization,
            )
        if section:
            assignments = assignments.filter(
                teacher_assignment__section_id=section,
                teacher_assignment__section__organization=user.organization,
            )
        if published is not None:
            assignments = assignments.filter(
                is_published=str(published).lower() in ["true", "1", "yes"]
            )
        if status_filter in ["published", "draft"]:
            assignments = assignments.filter(
                is_published=status_filter == "published"
            )
        if search:
            assignments = assignments.filter(title__icontains=search)

        data = [
            _assignment_summary(assignment)
            for assignment in assignments.order_by("-created_at")
        ]

        return Response({
            "count": len(data),
            "assignments": data,
        })


class CollegeAdminAssignmentSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not _college_admin_required(user):
            return Response(
                {"detail": "Only college admins can access assignment setup."},
                status=status.HTTP_403_FORBIDDEN
            )

        teachers = TeacherProfile.objects.filter(
            user__organization=user.organization,
            user__role="teacher",
        ).select_related("user").order_by("user__first_name", "user__username")

        subjects = Subject.objects.filter(
            organization=user.organization
        ).select_related("classroom").order_by("name")

        classrooms = ClassRoom.objects.filter(
            organization=user.organization
        ).select_related("academic_session").order_by("name")

        sections = Section.objects.filter(
            organization=user.organization
        ).select_related("classroom").order_by("classroom__name", "name")

        return Response({
            "teachers": [
                {
                    "id": teacher.id,
                    "name": _display_name(teacher.user),
                }
                for teacher in teachers
            ],
            "subjects": [
                {
                    "id": subject.id,
                    "name": subject.name,
                    "class_id": subject.classroom_id,
                }
                for subject in subjects
            ],
            "classes": [
                {
                    "id": classroom.id,
                    "name": classroom.name,
                    "academic_session_id": classroom.academic_session_id,
                }
                for classroom in classrooms
            ],
            "sections": [
                {
                    "id": section.id,
                    "name": section.name,
                    "class_id": section.classroom_id,
                    "classroom_name": section.classroom.name,
                }
                for section in sections
            ],
        })


class CollegeAdminAssignmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, assignment_id):
        user = request.user

        if not _college_admin_required(user):
            return Response(
                {"detail": "Only college admins can access assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        assignment = _college_assignment_queryset(user).filter(
            id=assignment_id
        ).first()

        if not assignment:
            return Response(
                {"detail": "Assignment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        section = assignment.teacher_assignment.section

        enrollments = StudentEnrollment.objects.filter(
            section=section,
            is_active=True,
            student__user__organization=user.organization,
        ).select_related(
            "student",
            "student__user",
        ).order_by("roll_number", "student__user__username")

        submissions = {
            submission.student_id: submission
            for submission in AssignmentSubmission.objects.filter(
                assignment=assignment,
                student__user__organization=user.organization,
                student__enrollments__section=section,
                student__enrollments__is_active=True,
            ).distinct()
        }

        students = []

        for enrollment in enrollments:
            student = enrollment.student
            student_user = student.user
            submission = submissions.get(student.id)

            students.append({
                "student_profile_id": student.id,
                "student_name": _display_name(student_user),
                "username": student_user.username,
                "roll_number": enrollment.roll_number,
                "submitted": submission is not None,
                "status": submission.status if submission else "pending",
                "submitted_at": submission.submitted_at if submission else None,
                "marks_obtained": (
                    submission.marks_obtained if submission else None
                ),
                "feedback": submission.feedback if submission else "",
                "graded_at": submission.graded_at if submission else None,
                "has_attachment": bool(submission and submission.attachment),
            })

        submitted_count = sum(1 for item in students if item["submitted"])
        graded_count = sum(
            1
            for item in students
            if item["status"] == AssignmentSubmission.Status.GRADED
        )

        return Response({
            "assignment": _assignment_summary(assignment),
            "summary": {
                "total_students": len(students),
                "submitted": submitted_count,
                "not_submitted": len(students) - submitted_count,
                "graded": graded_count,
            },
            "students": students,
        })


class TeacherAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        assignments = Assignment.objects.filter(
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            teacher_assignment__is_active=True
        ).select_related(
            "teacher_assignment__subject",
            "teacher_assignment__section",
            "teacher_assignment__section__classroom"
        ).order_by("-created_at")

        data = []

        for assignment in assignments:
            teacher_assignment = assignment.teacher_assignment

            data.append({
                "id": assignment.id,
                "title": assignment.title,
                "instructions": assignment.instructions,
                "due_date": assignment.due_date,
                "due_time": assignment.due_time,
                "is_published": assignment.is_published,
                "created_at": assignment.created_at,

                "assignment_id": teacher_assignment.id,

                "subject_name": teacher_assignment.subject.name,
                "section_name": teacher_assignment.section.name,
                "classroom_name": teacher_assignment.section.classroom.name,

                "has_attachment": bool(assignment.attachment),

                "submission_count": assignment.submissions.count(),
            })

        return Response({
            "count": len(data),
            "assignments": data,
        })


class TeacherAssignmentCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def post(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can create assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        teacher_assignment_id = request.data.get(
            "teacher_assignment_id"
        )

        title = request.data.get("title", "").strip()
        instructions = request.data.get("instructions", "").strip()
        due_date = request.data.get("due_date")
        due_time = request.data.get("due_time") or None

        is_published_value = request.data.get(
            "is_published",
            True
        )

        if not teacher_assignment_id:
            return Response(
                {"detail": "teacher_assignment_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not title:
            return Response(
                {"detail": "Title is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not due_date:
            return Response(
                {"detail": "Due date is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        teacher_assignment = TeacherAssignment.objects.filter(
            id=teacher_assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            "subject",
            "section",
            "section__classroom"
        ).first()

        if not teacher_assignment:
            return Response(
                {
                    "detail":
                    "Teaching assignment not found or access denied."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if isinstance(is_published_value, str):
            is_published = (
                is_published_value.lower()
                in ["true", "1", "yes", "on"]
            )
        else:
            is_published = bool(is_published_value)

        assignment = Assignment.objects.create(
            organization=user.organization,
            teacher_assignment=teacher_assignment,
            title=title,
            instructions=instructions,
            due_date=due_date,
            due_time=due_time,
            attachment=request.FILES.get("attachment"),
            is_published=is_published,
        )

        if assignment.is_published:
            notify_assignment_published(assignment)

        return Response(
            {
                "message": "Assignment created successfully.",

                "assignment": {
                    "id": assignment.id,
                    "title": assignment.title,
                    "instructions": assignment.instructions,
                    "due_date": assignment.due_date,
                    "due_time": assignment.due_time,
                    "is_published": assignment.is_published,

                    "subject_name":
                        teacher_assignment.subject.name,

                    "section_name":
                        teacher_assignment.section.name,

                    "classroom_name":
                        teacher_assignment.section.classroom.name,

                    "has_attachment":
                        bool(assignment.attachment),
                },
            },
            status=status.HTTP_201_CREATED
        )
        
class TeacherAssignmentSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access assignment setup."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        teacher_assignments = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            "subject",
            "section",
            "section__classroom"
        ).order_by(
            "section__classroom__name",
            "section__name",
            "subject__name"
        )

        data = []

        for assignment in teacher_assignments:
            data.append({
                "teacher_assignment_id": assignment.id,
                "subject_id": assignment.subject.id,
                "subject_name": assignment.subject.name,
                "section_id": assignment.section.id,
                "section_name": assignment.section.name,
                "classroom_name": assignment.section.classroom.name,
            })

        return Response({
            "count": len(data),
            "assignments": data,
        })
        
class TeacherAssignmentDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def get_assignment(self, user, teacher_profile, assignment_id):
        return Assignment.objects.filter(
            id=assignment_id,
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile
        ).select_related(
            "teacher_assignment__subject",
            "teacher_assignment__section",
            "teacher_assignment__section__classroom"
        ).first()

    def patch(self, request, assignment_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can update assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        assignment = self.get_assignment(
            user,
            teacher_profile,
            assignment_id
        )

        if not assignment:
            return Response(
                {"detail": "Assignment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        was_published = assignment.is_published

        if "title" in request.data:
            title = request.data.get("title", "").strip()

            if not title:
                return Response(
                    {"detail": "Title cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            assignment.title = title

        if "instructions" in request.data:
            assignment.instructions = request.data.get(
                "instructions",
                ""
            ).strip()

        if "due_date" in request.data:
            due_date = request.data.get("due_date")

            if not due_date:
                return Response(
                    {"detail": "Due date cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            assignment.due_date = due_date

        if "due_time" in request.data:
            assignment.due_time = (
                request.data.get("due_time") or None
            )

        if "is_published" in request.data:
            value = request.data.get("is_published")

            if isinstance(value, str):
                assignment.is_published = (
                    value.lower()
                    in ["true", "1", "yes", "on"]
                )
            else:
                assignment.is_published = bool(value)

        # Optional replacement attachment
        if "attachment" in request.FILES:
            if assignment.attachment:
                assignment.attachment.delete(
                    save=False
                )

            assignment.attachment = request.FILES[
                "attachment"
            ]

        assignment.save()

        if not was_published and assignment.is_published:
            notify_assignment_published(assignment)

        teacher_assignment = assignment.teacher_assignment

        return Response({
            "message": "Assignment updated successfully.",

            "assignment": {
                "id": assignment.id,
                "title": assignment.title,
                "instructions": assignment.instructions,
                "due_date": assignment.due_date,
                "due_time": assignment.due_time,
                "is_published": assignment.is_published,

                "subject_name":
                    teacher_assignment.subject.name,

                "section_name":
                    teacher_assignment.section.name,

                "classroom_name":
                    teacher_assignment.section.classroom.name,

                "has_attachment":
                    bool(assignment.attachment),
            }
        })

    def delete(self, request, assignment_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can delete assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        assignment = self.get_assignment(
            user,
            teacher_profile,
            assignment_id
        )

        if not assignment:
            return Response(
                {"detail": "Assignment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Delete attachment file too
        if assignment.attachment:
            assignment.attachment.delete(
                save=False
            )

        assignment.delete()

        return Response({
            "message": "Assignment deleted successfully."
        })
        
class StudentAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "assignments"

    def get(self, request):
        user = request.user

        if user.role != "student":
            return Response(
                {"detail": "Only students can access assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        student_profile = StudentProfile.objects.filter(
            user=user
        ).first()

        if not student_profile:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        enrollment = StudentEnrollment.objects.filter(
            student=student_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            "section",
            "section__classroom"
        ).first()

        if not enrollment:
            return Response(
                {"detail": "No active enrollment found."},
                status=status.HTTP_404_NOT_FOUND
            )

        assignments = Assignment.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            teacher_assignment__is_active=True,
            is_published=True
        ).select_related(
            "teacher_assignment__subject",
            "teacher_assignment__section",
            "teacher_assignment__section__classroom",
            "teacher_assignment__teacher__user"
        ).order_by(
            "due_date",
            "due_time",
            "-created_at"
        )

        data = []

        for assignment in assignments:
            teacher_assignment = assignment.teacher_assignment
            teacher_user = teacher_assignment.teacher.user

            submission = assignment.submissions.filter(
                student=student_profile
            ).first()

            data.append({
                "id": assignment.id,
                "title": assignment.title,
                "instructions": assignment.instructions,
                "due_date": assignment.due_date,
                "due_time": assignment.due_time,
                "created_at": assignment.created_at,

                "subject_name":
                    teacher_assignment.subject.name,

                "section_name":
                    teacher_assignment.section.name,

                "classroom_name":
                    teacher_assignment.section.classroom.name,

                "teacher_name": (
                    teacher_user.get_full_name().strip()
                    or teacher_user.username
                ),

                "has_attachment":
                    bool(assignment.attachment),

                "submitted":
                    submission is not None,

                "submission": (
                    {
                        "id": submission.id,
                        "status": submission.status,
                        "submitted_at": submission.submitted_at,
                        "marks_obtained":
                            submission.marks_obtained,
                        "feedback":
                            submission.feedback,
                    }
                    if submission
                    else None
                ),
            })

        return Response({
            "count": len(data),
            "assignments": data,
        })
class StudentAssignmentSubmitAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "assignments"

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def post(self, request, assignment_id):
        user = request.user

        # Only students
        if user.role != "student":
            return Response(
                {"detail": "Only students can submit assignments."},
                status=status.HTTP_403_FORBIDDEN
            )

        student_profile = StudentProfile.objects.filter(
            user=user
        ).first()

        if not student_profile:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Student's active enrollment
        enrollment = StudentEnrollment.objects.filter(
            student=student_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            "section"
        ).first()

        if not enrollment:
            return Response(
                {"detail": "No active enrollment found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Assignment must belong to:
        # - same organization
        # - student's section
        # - active teacher assignment
        # - published assignment
        assignment = Assignment.objects.filter(
            id=assignment_id,
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            teacher_assignment__is_active=True,
            is_published=True
        ).select_related(
            "teacher_assignment__section",
            "teacher_assignment__subject",
            "teacher_assignment__teacher__user",
        ).first()

        if not assignment:
            return Response(
                {"detail": "Assignment not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent duplicate submission
        existing_submission = AssignmentSubmission.objects.filter(
            assignment=assignment,
            student=student_profile
        ).first()

        if existing_submission:
            return Response(
                {
                    "detail":
                        "You have already submitted this assignment."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        submission_text = request.data.get(
            "submission_text",
            ""
        ).strip()

        attachment = request.FILES.get("attachment")

        # At least text or file required
        if not submission_text and not attachment:
            return Response(
                {
                    "detail":
                        "Please enter an answer or upload a file."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        now = timezone.localtime()

        # Build assignment deadline
        if assignment.due_time:
            deadline = timezone.make_aware(
                timezone.datetime.combine(
                    assignment.due_date,
                    assignment.due_time
                ),
                timezone.get_current_timezone()
            )

            is_late = now > deadline

        else:
            # If no time is provided, allow submission
            # until the end of the due date.
            is_late = now.date() > assignment.due_date

        submission_status = (
            AssignmentSubmission.Status.LATE
            if is_late
            else AssignmentSubmission.Status.SUBMITTED
        )

        submission = AssignmentSubmission.objects.create(
            assignment=assignment,
            student=student_profile,
            submission_text=submission_text,
            attachment=attachment,
            status=submission_status
        )

        notify_assignment_submitted(submission)

        return Response(
            {
                "message":
                    "Assignment submitted successfully.",

                "submission": {
                    "id": submission.id,
                    "assignment_id": assignment.id,
                    "assignment_title":
                        assignment.title,

                    "status":
                        submission.status,

                    "submitted_at":
                        submission.submitted_at,

                    "has_attachment":
                        bool(submission.attachment),
                }
            },
            status=status.HTTP_201_CREATED
        )
        
class TeacherAssignmentSubmissionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, assignment_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can view assignment submissions."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        assignment = Assignment.objects.filter(
            id=assignment_id,
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            teacher_assignment__is_active=True
        ).select_related(
            "teacher_assignment__subject",
            "teacher_assignment__section",
            "teacher_assignment__section__classroom"
        ).first()

        if not assignment:
            return Response(
                {"detail": "Assignment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        section = assignment.teacher_assignment.section

        enrollments = StudentEnrollment.objects.filter(
            section=section,
            is_active=True,
            student__user__organization=user.organization
        ).select_related(
            "student",
            "student__user"
        ).order_by(
            "roll_number",
            "student__user__username"
        )

        submissions = {
            submission.student_id: submission
            for submission in AssignmentSubmission.objects.filter(
                assignment=assignment
            )
        }

        students = []

        for enrollment in enrollments:
            student = enrollment.student
            student_user = student.user

            submission = submissions.get(student.id)

            students.append({
                "student_profile_id": student.id,

                "student_name": (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),

                "username": student_user.username,

                "roll_number": enrollment.roll_number,

                "submitted": submission is not None,

                "submission": (
                    {
                        "id": submission.id,
                        "submission_text":
                            submission.submission_text,

                        "status":
                            submission.status,

                        "submitted_at":
                            submission.submitted_at,

                        "has_attachment":
                            bool(submission.attachment),

                        "marks_obtained":
                            submission.marks_obtained,

                        "feedback":
                            submission.feedback,

                        "graded_at":
                            submission.graded_at,
                    }
                    if submission
                    else None
                ),
            })

        submitted_count = sum(
            1
            for item in students
            if item["submitted"]
        )

        return Response({
            "assignment": {
                "id": assignment.id,
                "title": assignment.title,
                "instructions": assignment.instructions,

                "subject_name":
                    assignment.teacher_assignment.subject.name,

                "section_name":
                    assignment.teacher_assignment.section.name,

                "classroom_name":
                    assignment.teacher_assignment.section.classroom.name,

                "due_date": assignment.due_date,
                "due_time": assignment.due_time,
            },

            "summary": {
                "total_students": len(students),
                "submitted": submitted_count,
                "not_submitted":
                    len(students) - submitted_count,
            },

            "students": students,
        })
        
class TeacherSubmissionAttachmentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can access submission files."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        submission = AssignmentSubmission.objects.filter(
            id=submission_id,
            assignment__organization=user.organization,
            assignment__teacher_assignment__teacher=teacher_profile,
            assignment__teacher_assignment__is_active=True
        ).select_related(
            "assignment",
            "assignment__teacher_assignment"
        ).first()

        if not submission:
            return Response(
                {"detail": "Submission not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not submission.attachment:
            return Response(
                {"detail": "No attachment found."},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            file_handle = submission.attachment.open("rb")
        except FileNotFoundError:
            return Response(
                {"detail": "Attachment file not found on server."},
                status=status.HTTP_404_NOT_FOUND
            )

        filename = submission.attachment.name.split("/")[-1]

        content_type, _ = mimetypes.guess_type(filename)

        response = FileResponse(
            file_handle,
            content_type=content_type or "application/octet-stream"
        )

        response["Content-Disposition"] = (
            f'inline; filename="{filename}"'
        )

        return response
    
class TeacherGradeSubmissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, submission_id):
        user = request.user

        if user.role != "teacher":
            return Response(
                {"detail": "Only teachers can grade submissions."},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {"detail": "Teacher profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        submission = AssignmentSubmission.objects.filter(
            id=submission_id,
            assignment__organization=user.organization,
            assignment__teacher_assignment__teacher=teacher_profile,
            assignment__teacher_assignment__is_active=True
        ).select_related(
            "assignment",
            "student",
            "student__user"
        ).first()

        if not submission:
            return Response(
                {"detail": "Submission not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        marks = request.data.get("marks_obtained")
        feedback = request.data.get("feedback", "").strip()

        if marks in [None, ""]:
            return Response(
                {"marks_obtained": ["Marks are required."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            marks_value = Decimal(str(marks).strip())
        except (InvalidOperation, AttributeError):
            return Response(
                {"marks_obtained": ["Enter valid marks."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not marks_value.is_finite():
            return Response(
                {"marks_obtained": ["Enter valid marks."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        if marks_value < 0:
            return Response(
                {"marks_obtained": ["Marks cannot be negative."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        marks_field = AssignmentSubmission._meta.get_field(
            "marks_obtained"
        )
        max_whole_digits = (
            marks_field.max_digits - marks_field.decimal_places
        )
        max_marks_value = (
            Decimal("9" * max_whole_digits)
            + (Decimal(1) - (Decimal(10) ** -marks_field.decimal_places))
        )

        if marks_value > max_marks_value:
            return Response(
                {
                    "marks_obtained": [
                        f"Marks cannot exceed {max_marks_value}."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        submission.marks_obtained = marks_value
        submission.feedback = feedback
        submission.status = AssignmentSubmission.Status.GRADED
        submission.graded_at = timezone.now()

        submission.save(
            update_fields=[
                "marks_obtained",
                "feedback",
                "status",
                "graded_at",
                "updated_at",
            ]
        )

        notify_assignment_graded(submission)

        return Response({
            "message": "Submission graded successfully.",
            "submission": {
                "id": submission.id,
                "student_name": (
                    submission.student.user.get_full_name().strip()
                    or submission.student.user.username
                ),
                "marks_obtained": submission.marks_obtained,
                "feedback": submission.feedback,
                "status": submission.status,
                "graded_at": submission.graded_at,
            }
        })
        
class ParentStudentAssignmentsAPIView(APIView):
    permission_classes = [IsAuthenticated, ParentChildFeaturePermission]
    parent_feature_key = "assignments"

    def get(self, request, student_id):
        user = request.user

        if user.role != "parent":
            return Response(
                {
                    "detail": (
                        "Only parents can access "
                        "student assignments."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        parent_profile = ParentProfile.objects.filter(
            user=user
        ).first()

        if not parent_profile:
            return Response(
                {"detail": "Parent profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        parent_student = ParentStudent.objects.filter(
            parent=parent_profile,
            student_id=student_id,
            student__user__organization=user.organization,
        ).select_related(
            "student",
            "student__user",
        ).first()

        if not parent_student:
            return Response(
                {
                    "detail": (
                        "Student is not linked "
                        "to this parent."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        student_profile = parent_student.student

        enrollment = StudentEnrollment.objects.filter(
            student=student_profile,
            is_active=True,
            section__organization=user.organization,
        ).select_related(
            "section",
            "section__classroom",
        ).first()

        if not enrollment:
            return Response(
                {"detail": "Active enrollment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        assignments = Assignment.objects.filter(
            organization=user.organization,
            teacher_assignment__section=enrollment.section,
            is_published=True,
        ).select_related(
            "teacher_assignment",
            "teacher_assignment__subject",
            "teacher_assignment__teacher",
            "teacher_assignment__teacher__user",
        ).order_by(
            "-created_at"
        )

        submissions = AssignmentSubmission.objects.filter(
            student=student_profile,
            assignment__in=assignments,
        ).select_related(
            "assignment"
        )

        submission_map = {
            item.assignment_id: item
            for item in submissions
        }

        assignment_data = []

        for assignment in assignments:
            submission = submission_map.get(
                assignment.id
            )

            teacher_user = (
                assignment
                .teacher_assignment
                .teacher
                .user
            )

            submission_data = None

            if submission:
                submission_data = {
                    "id": submission.id,
                    "status": submission.status,
                    "submitted_at": submission.submitted_at,
                    "marks_obtained": (
                        str(submission.marks_obtained)
                        if submission.marks_obtained
                        is not None
                        else None
                    ),
                    "feedback": submission.feedback,
                    "graded_at": submission.graded_at,
                }

            assignment_data.append({
                "id": assignment.id,
                "title": assignment.title,
                "instructions": assignment.instructions,
                "due_date": assignment.due_date,
                "due_time": assignment.due_time,
                "subject_name": (
                    assignment
                    .teacher_assignment
                    .subject
                    .name
                ),
                "teacher_name": (
                    teacher_user.get_full_name().strip()
                    or teacher_user.username
                ),
                "classroom_name": (
                    enrollment.section.classroom.name
                ),
                "section_name": (
                    enrollment.section.name
                ),
                "submission": submission_data,
                "status": (
                    submission.status
                    if submission
                    else "pending"
                ),
                "marks_obtained": (
                    str(submission.marks_obtained)
                    if submission
                    and submission.marks_obtained
                    is not None
                    else None
                ),
                "feedback": (
                    submission.feedback
                    if submission
                    else ""
                ),
                "graded_at": (
                    submission.graded_at
                    if submission
                    else None
                ),
            })

        student_user = student_profile.user

        return Response({
            "student": {
                "id": student_profile.id,
                "name": (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),
                "username": student_user.username,
                "roll_number": enrollment.roll_number,
                "classroom_name": (
                    enrollment.section.classroom.name
                ),
                "section_name": (
                    enrollment.section.name
                ),
            },

            "assignments": assignment_data,
        })
