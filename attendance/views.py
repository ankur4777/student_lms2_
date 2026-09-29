from academics.feature_access import ParentChildFeaturePermission, StudentClassFeaturePermission

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils.dateparse import parse_date

from accounts.models import (
    StudentProfile,
    TeacherProfile,
    ParentProfile,
)

from academics.models import (
    AcademicSession,
    ClassRoom,
    Section,
    Subject,
    TeacherAssignment,
    StudentEnrollment,
    ParentStudent,
)

from .models import (
    AttendanceSession,
    StudentAttendance,
)

from .serializers import StudentAttendanceSerializer


def college_admin_organization(user):
    if user.role != 'college_admin' or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def attendance_counts(records):
    total = records.count()
    present = records.filter(
        status=StudentAttendance.Status.PRESENT
    ).count()
    absent = records.filter(
        status=StudentAttendance.Status.ABSENT
    ).count()
    late = records.filter(
        status=StudentAttendance.Status.LATE
    ).count()
    excused = records.filter(
        status=StudentAttendance.Status.EXCUSED
    ).count()
    attended = present + late
    counted = present + late + absent
    percentage = 0

    if counted > 0:
        percentage = round((attended / counted) * 100, 2)

    return {
        'total': total,
        'present': present,
        'absent': absent,
        'late': late,
        'excused': excused,
        'attended': attended,
        'counted': counted,
        'attendance_percentage': percentage,
    }


def serialize_attendance_session(session):
    records = session.student_records.all()
    counts = attendance_counts(records)
    teacher_user = session.teacher.user
    classroom = session.section.classroom

    return {
        'id': session.id,
        'date': session.date,
        'start_time': session.start_time,
        'end_time': session.end_time,
        'topic': '',
        'teacher_id': session.teacher_id,
        'teacher_name': (
            teacher_user.get_full_name().strip()
            or teacher_user.username
        ),
        'subject_id': session.subject_id,
        'subject_name': session.subject.name,
        'class_id': classroom.id,
        'class_name': classroom.name,
        'section_id': session.section_id,
        'section_name': session.section.name,
        'academic_session_id': classroom.academic_session_id,
        'academic_session_name': classroom.academic_session.name,
        'total_students': counts['total'],
        'present': counts['present'],
        'absent': counts['absent'],
        'late': counts['late'],
        'excused': counts['excused'],
        'attendance_percentage': counts['attendance_percentage'],
    }


def college_admin_session_queryset(organization):
    return AttendanceSession.objects.filter(
        organization=organization,
        section__organization=organization,
        subject__organization=organization,
        teacher__user__organization=organization,
    ).select_related(
        'teacher',
        'teacher__user',
        'subject',
        'section',
        'section__classroom',
        'section__classroom__academic_session',
    ).prefetch_related(
        'student_records',
    )


def apply_college_admin_session_filters(queryset, request):
    date = parse_date(request.query_params.get('date', ''))
    date_from = parse_date(request.query_params.get('date_from', ''))
    date_to = parse_date(request.query_params.get('date_to', ''))
    academic_session = request.query_params.get('academic_session', '').strip()
    classroom = request.query_params.get('class', '').strip()
    section = request.query_params.get('section', '').strip()
    subject = request.query_params.get('subject', '').strip()
    teacher = request.query_params.get('teacher', '').strip()
    search = request.query_params.get('search', '').strip()

    if date:
        queryset = queryset.filter(date=date)

    if date_from:
        queryset = queryset.filter(date__gte=date_from)

    if date_to:
        queryset = queryset.filter(date__lte=date_to)

    if academic_session:
        queryset = queryset.filter(
            section__classroom__academic_session_id=academic_session
        )

    if classroom:
        queryset = queryset.filter(section__classroom_id=classroom)

    if section:
        queryset = queryset.filter(section_id=section)

    if subject:
        queryset = queryset.filter(subject_id=subject)

    if teacher:
        queryset = queryset.filter(teacher__user_id=teacher)

    if search:
        queryset = queryset.filter(subject__name__icontains=search)

    return queryset


class CollegeAdminAttendanceSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can view attendance setup.'},
                status=403
            )

        sessions = AcademicSession.objects.filter(
            organization=organization
        ).order_by('-is_active', 'name')
        classrooms = ClassRoom.objects.filter(
            organization=organization,
            academic_session__organization=organization,
        ).select_related('academic_session').order_by('name')
        sections = Section.objects.filter(
            organization=organization,
            classroom__organization=organization,
            classroom__academic_session__organization=organization,
        ).select_related(
            'classroom',
            'classroom__academic_session',
        ).order_by('classroom__name', 'name')
        subjects = Subject.objects.filter(
            organization=organization,
            classroom__organization=organization,
            classroom__academic_session__organization=organization,
        ).select_related(
            'classroom',
            'classroom__academic_session',
        ).order_by('name')
        teachers = TeacherProfile.objects.filter(
            user__organization=organization,
            user__role='teacher',
            user__is_active=True,
        ).select_related('user').order_by(
            'user__first_name',
            'user__last_name',
            'user__username',
        )

        return Response({
            'academic_sessions': [
                {
                    'id': item.id,
                    'name': item.name,
                    'is_active': item.is_active,
                }
                for item in sessions
            ],
            'classes': [
                {
                    'id': item.id,
                    'name': item.name,
                    'academic_session_id': item.academic_session_id,
                }
                for item in classrooms
            ],
            'sections': [
                {
                    'id': item.id,
                    'name': item.name,
                    'class_id': item.classroom_id,
                    'academic_session_id': (
                        item.classroom.academic_session_id
                    ),
                }
                for item in sections
            ],
            'subjects': [
                {
                    'id': item.id,
                    'name': item.name,
                    'class_id': item.classroom_id,
                    'academic_session_id': (
                        item.classroom.academic_session_id
                    ),
                }
                for item in subjects
            ],
            'teachers': [
                {
                    'id': item.user_id,
                    'name': (
                        item.user.get_full_name().strip()
                        or item.user.username
                    ),
                    'username': item.user.username,
                }
                for item in teachers
            ],
            'statuses': [
                {'value': value, 'label': label}
                for value, label in StudentAttendance.Status.choices
            ],
        })


class CollegeAdminAttendanceSessionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can view attendance.'},
                status=403
            )

        sessions = apply_college_admin_session_filters(
            college_admin_session_queryset(organization),
            request,
        ).order_by('-date', '-start_time', '-id')

        return Response({
            'sessions': [
                serialize_attendance_session(session)
                for session in sessions
            ]
        })

    def post(self, request):
        return Response(
            {'detail': 'College admin attendance is read-only.'},
            status=405
        )


class CollegeAdminAttendanceSessionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can view attendance.'},
                status=403
            )

        session = college_admin_session_queryset(
            organization
        ).filter(id=session_id).first()

        if not session:
            return Response(
                {'detail': 'Attendance session not found.'},
                status=404
            )

        records = StudentAttendance.objects.filter(
            attendance_session=session,
            student__user__organization=organization,
        ).select_related(
            'student',
            'student__user',
        ).order_by(
            'student__enrollments__roll_number',
            'student__user__first_name',
            'student__user__last_name',
            'student__user__username',
        ).distinct()

        enrollments = {
            enrollment.student_id: enrollment
            for enrollment in StudentEnrollment.objects.filter(
                section=session.section,
                student__in=[record.student_id for record in records],
            ).select_related('student')
        }

        return Response({
            'session': serialize_attendance_session(session),
            'students': [
                {
                    'attendance_id': record.id,
                    'student_id': record.student.user_id,
                    'student_profile_id': record.student_id,
                    'student_name': (
                        record.student.user.get_full_name().strip()
                        or record.student.user.username
                    ),
                    'username': record.student.user.username,
                    'roll_number': (
                        enrollments.get(record.student_id).roll_number
                        if enrollments.get(record.student_id)
                        else ''
                    ),
                    'status': record.status,
                    'remarks': record.remarks,
                }
                for record in records
            ],
        })

    def patch(self, request, session_id):
        return Response(
            {'detail': 'College admin attendance is read-only.'},
            status=405
        )

    def put(self, request, session_id):
        return Response(
            {'detail': 'College admin attendance is read-only.'},
            status=405
        )

    def delete(self, request, session_id):
        return Response(
            {'detail': 'College admin attendance is read-only.'},
            status=405
        )


class CollegeAdminAttendanceSummaryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can view attendance.'},
                status=403
            )

        sessions = apply_college_admin_session_filters(
            college_admin_session_queryset(organization),
            request,
        )
        records = StudentAttendance.objects.filter(
            attendance_session__in=sessions,
            student__user__organization=organization,
        )
        counts = attendance_counts(records)

        return Response({
            'total_sessions': sessions.count(),
            'total_records': counts['total'],
            'present': counts['present'],
            'absent': counts['absent'],
            'late': counts['late'],
            'excused': counts['excused'],
            'attended_records': counts['attended'],
            'counted_records': counts['counted'],
            'attendance_percentage': counts['attendance_percentage'],
        })


class CollegeAdminStudentAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can view student attendance.'},
                status=403
            )

        student = StudentProfile.objects.filter(
            user_id=student_id,
            user__organization=organization,
        ).select_related('user').first()

        if not student:
            return Response(
                {'detail': 'Student not found.'},
                status=404
            )

        enrollment = StudentEnrollment.objects.filter(
            student=student,
            is_active=True,
            section__organization=organization,
        ).select_related(
            'section',
            'section__classroom',
            'section__classroom__academic_session',
        ).first()

        records = StudentAttendance.objects.filter(
            student=student,
            attendance_session__organization=organization,
            attendance_session__section__organization=organization,
            attendance_session__subject__organization=organization,
            attendance_session__teacher__user__organization=organization,
        ).select_related(
            'attendance_session',
            'attendance_session__subject',
            'attendance_session__teacher',
            'attendance_session__teacher__user',
            'attendance_session__section',
        ).order_by(
            '-attendance_session__date',
            '-attendance_session__start_time',
        )
        counts = attendance_counts(records)

        return Response({
            'student': {
                'id': student.id,
                'name': (
                    student.user.get_full_name().strip()
                    or student.user.username
                ),
                'username': student.user.username,
                'roll_number': enrollment.roll_number if enrollment else '',
                'classroom_name': (
                    enrollment.section.classroom.name
                    if enrollment
                    else ''
                ),
                'section_name': (
                    enrollment.section.name
                    if enrollment
                    else ''
                ),
                'academic_session_name': (
                    enrollment.section.classroom.academic_session.name
                    if enrollment
                    else ''
                ),
            },
            'summary': {
                'total_records': counts['total'],
                'present': counts['present'],
                'absent': counts['absent'],
                'late': counts['late'],
                'excused': counts['excused'],
                'attended_records': counts['attended'],
                'counted_records': counts['counted'],
                'attendance_percentage': counts['attendance_percentage'],
            },
            'records': [
                {
                    'id': record.id,
                    'date': record.attendance_session.date,
                    'start_time': record.attendance_session.start_time,
                    'end_time': record.attendance_session.end_time,
                    'topic': '',
                    'subject_name': record.attendance_session.subject.name,
                    'teacher_name': (
                        record.attendance_session.teacher.user
                        .get_full_name()
                        .strip()
                        or record.attendance_session.teacher.user.username
                    ),
                    'section_name': record.attendance_session.section.name,
                    'status': record.status,
                    'remarks': record.remarks,
                }
                for record in records
            ],
        })


class StudentAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "attendance"

    def get(self, request):
        user = request.user

        # Only students can access this endpoint
        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
                status=403
            )

        student_profile = StudentProfile.objects.filter(
            user=user
        ).first()

        if not student_profile:
            return Response(
                {'detail': 'Student profile not found.'},
                status=404
            )

        attendance_records = StudentAttendance.objects.filter(
            student=student_profile,
            attendance_session__organization=user.organization
        ).select_related(
            'attendance_session',
            'attendance_session__subject',
            'attendance_session__section',
            'attendance_session__teacher__user'
        ).order_by(
            '-attendance_session__date',
            '-attendance_session__start_time'
        )

        serializer = StudentAttendanceSerializer(
            attendance_records,
            many=True
        )

        return Response(serializer.data)
    
class StudentAttendanceSummaryAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "attendance"

    def get(self, request):
        user = request.user

        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this endpoint.'},
                status=403
            )

        student_profile = StudentProfile.objects.filter(
            user=user
        ).first()

        if not student_profile:
            return Response(
                {'detail': 'Student profile not found.'},
                status=404
            )

        records = StudentAttendance.objects.filter(
            student=student_profile,
            attendance_session__organization=user.organization
        )

        total_classes = records.count()

        present = records.filter(
            status=StudentAttendance.Status.PRESENT
        ).count()

        absent = records.filter(
            status=StudentAttendance.Status.ABSENT
        ).count()

        late = records.filter(
            status=StudentAttendance.Status.LATE
        ).count()

        excused = records.filter(
            status=StudentAttendance.Status.EXCUSED
        ).count()

        attended_classes = present + late

        counted_classes = present + late + absent

        attendance_percentage = 0

        if counted_classes > 0:
            attendance_percentage = round(
                (attended_classes / counted_classes) * 100,
                2
        )

        return Response({
            'total_classes': total_classes,
            'present': present,
            'absent': absent,
            'late': late,
            'excused': excused,
            'attendance_percentage': attendance_percentage,
        })
        
class TeacherAttendanceSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {
                    'detail': 'Only teachers can access this endpoint.'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {
                    'detail': 'Teacher profile not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        assignments = TeacherAssignment.objects.filter(
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            'subject',
            'section',
            'section__classroom'
        ).order_by(
            'section__classroom__name',
            'section__name',
            'subject__name'
        )

        data = []

        for assignment in assignments:
            students = StudentEnrollment.objects.filter(
                section=assignment.section,
                is_active=True,
                student__user__organization=user.organization
            ).select_related(
                'student__user'
            ).order_by(
                'roll_number',
                'student__user__first_name',
                'student__user__last_name'
            )

            student_data = []

            for enrollment in students:
                student_user = enrollment.student.user

                student_name = (
                    student_user.get_full_name().strip()
                    or student_user.username
                )

                student_data.append({
                    'student_profile_id': enrollment.student.id,
                    'username': student_user.username,
                    'name': student_name,
                    'roll_number': enrollment.roll_number,
                })

            data.append({
                'assignment_id': assignment.id,
                'subject_id': assignment.subject.id,
                'subject_name': assignment.subject.name,
                'section_id': assignment.section.id,
                'section_name': assignment.section.name,
                'classroom_name': assignment.section.classroom.name,
                'students': student_data,
            })

        return Response({
            'count': len(data),
            'assignments': data,
        })
        
class TeacherSaveAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {
                    'detail': 'Only teachers can mark attendance.'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {
                    'detail': 'Teacher profile not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        assignment_id = request.data.get('assignment_id')
        attendance_date = request.data.get('date')
        attendance_records = request.data.get('attendance', [])

        if not assignment_id:
            return Response(
                {
                    'detail': 'assignment_id is required.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not attendance_date:
            return Response(
                {
                    'detail': 'date is required.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(attendance_records, list):
            return Response(
                {
                    'detail': 'attendance must be a list.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment = TeacherAssignment.objects.filter(
            id=assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            'subject',
            'section'
        ).first()

        if not assignment:
            return Response(
                {
                    'detail': 'Teaching assignment not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        valid_statuses = {
            StudentAttendance.Status.PRESENT,
            StudentAttendance.Status.ABSENT,
            StudentAttendance.Status.LATE,
            StudentAttendance.Status.EXCUSED,
        }

        attendance_session, created = AttendanceSession.objects.get_or_create(
    organization=user.organization,
    section=assignment.section,
    subject=assignment.subject,
    teacher=teacher_profile,
    date=attendance_date,
)

        # if attendance_session.is_locked:
        #     return Response(
        #         {
        #             'detail': 'Attendance for this session is locked.'
        #         },
        #         status=status.HTTP_400_BAD_REQUEST
        #     )

        saved_records = []

        for item in attendance_records:
            student_profile_id = item.get('student_profile_id')
            attendance_status = item.get('status')
            remarks = item.get('remarks', '')

            if not student_profile_id:
                return Response(
                    {
                        'detail': 'student_profile_id is required for every attendance record.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if attendance_status not in valid_statuses:
                return Response(
                    {
                        'detail': f'Invalid attendance status for student {student_profile_id}.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            enrollment = StudentEnrollment.objects.filter(
                student_id=student_profile_id,
                section=assignment.section,
                is_active=True,
                student__user__organization=user.organization
            ).select_related(
                'student__user'
            ).first()

            if not enrollment:
                return Response(
                    {
                        'detail': f'Student {student_profile_id} is not enrolled in this section.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            student_attendance, _ = StudentAttendance.objects.update_or_create(
                attendance_session=attendance_session,
                student=enrollment.student,
                defaults={
                    'status': attendance_status,
                    'remarks': remarks,
                }
            )

            saved_records.append({
                'student_profile_id': enrollment.student.id,
                'status': student_attendance.status,
                'remarks': student_attendance.remarks,
            })

        return Response({
            'message': 'Attendance saved successfully.',
            'session_id': attendance_session.id,
            'created': created,
            'date': attendance_session.date,
            'subject': assignment.subject.name,
            'section': assignment.section.name,
            'records_saved': len(saved_records),
            'attendance': saved_records,
        })
        
class TeacherAttendanceSessionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can access attendance.'},
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        assignment_id = request.query_params.get('assignment_id')
        attendance_date = request.query_params.get('date')

        if not assignment_id:
            return Response(
                {'detail': 'assignment_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not attendance_date:
            return Response(
                {'detail': 'date is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment = TeacherAssignment.objects.filter(
            id=assignment_id,
            teacher=teacher_profile,
            is_active=True,
            section__organization=user.organization
        ).select_related(
            'subject',
            'section'
        ).first()

        if not assignment:
            return Response(
                {'detail': 'Teaching assignment not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        attendance_session = AttendanceSession.objects.filter(
            organization=user.organization,
            section=assignment.section,
            subject=assignment.subject,
            teacher=teacher_profile,
            date=attendance_date
        ).first()

        if not attendance_session:
            return Response({
                'exists': False,
                'session_id': None,
                'attendance': [],
            })

        records = StudentAttendance.objects.filter(
            attendance_session=attendance_session
        ).select_related(
            'student__user'
        )

        attendance_data = []

        for record in records:
            student_user = record.student.user

            attendance_data.append({
                'student_profile_id': record.student.id,
                'name': (
                    student_user.get_full_name().strip()
                    or student_user.username
                ),
                'status': record.status,
                'remarks': record.remarks,
            })

        return Response({
            'exists': True,
            'session_id': attendance_session.id,
            'date': attendance_session.date,
            'attendance': attendance_data,
        })

class ParentStudentAttendanceAPIView(APIView):
    permission_classes = [IsAuthenticated, ParentChildFeaturePermission]
    parent_feature_key = "attendance"

    def get(self, request, student_id):
        user = request.user

        if user.role != "parent":
            return Response(
                {"detail": "Only parents can access student attendance."},
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
                {"detail": "Student is not linked to this parent."},
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

        records = StudentAttendance.objects.filter(
            student=student_profile,
            attendance_session__organization=user.organization,
            attendance_session__section=enrollment.section,
        ).select_related(
            "attendance_session",
            "attendance_session__subject",
            "attendance_session__teacher",
            "attendance_session__teacher__user",
        ).order_by(
            "-attendance_session__date",
            "-attendance_session__start_time",
        )

        total_classes = records.count()

        present = records.filter(
            status=StudentAttendance.Status.PRESENT
        ).count()

        absent = records.filter(
            status=StudentAttendance.Status.ABSENT
        ).count()

        late = records.filter(
            status=StudentAttendance.Status.LATE
        ).count()

        excused = records.filter(
            status=StudentAttendance.Status.EXCUSED
        ).count()

        attended_classes = present + late
        counted_classes = present + late + absent

        attendance_percentage = 0

        if counted_classes > 0:
            attendance_percentage = round(
                (attended_classes / counted_classes) * 100,
                2,
            )

        attendance_data = []

        for record in records:
            session = record.attendance_session
            teacher_user = session.teacher.user if session.teacher else None

            attendance_data.append({
                "id": record.id,
                "date": session.date,
                "start_time": session.start_time,
                "subject_name": (
                    session.subject.name
                    if session.subject
                    else ""
                ),
                "teacher_name": (
                    (
                        teacher_user.get_full_name().strip()
                        if teacher_user
                        else ""
                    )
                    or (
                        teacher_user.username
                        if teacher_user
                        else ""
                    )
                ),
                "status": record.status,
                "remarks": record.remarks,
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
                "classroom_name": enrollment.section.classroom.name,
                "section_name": enrollment.section.name,
            },
            "summary": {
                "total_classes": total_classes,
                "present": present,
                "absent": absent,
                "late": late,
                "excused": excused,
                "attended_classes": attended_classes,
                "attendance_percentage": attendance_percentage,
            },
            "records": attendance_data,
        })
