import mimetypes
from datetime import datetime

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils.dateparse import parse_date, parse_time

from academics.feature_access import StudentClassFeaturePermission

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework import status

from accounts.models import StudentProfile, TeacherProfile
from academics.models import TeacherAssignment

from .models import LiveClass, LiveClassRecording
from .serializers import (
    LiveClassSerializer,
    TeacherRecordingUploadSerializer,
    TeacherRecordingUpdateSerializer,
)
from notifications.services import notify_recording_available


def college_admin_organization(user):
    if user.role != 'college_admin' or not user.is_active:
        return None

    if not user.organization or not user.organization.is_active:
        return None

    return user.organization


def college_admin_assignment_queryset(organization):
    return TeacherAssignment.objects.filter(
        is_active=True,
        teacher__user__organization=organization,
        teacher__user__role='teacher',
        subject__organization=organization,
        subject__classroom__organization=organization,
        subject__classroom__academic_session__organization=organization,
        section__organization=organization,
        section__classroom__organization=organization,
        section__classroom__academic_session__organization=organization,
    ).select_related(
        'teacher',
        'teacher__user',
        'subject',
        'section',
        'section__classroom',
        'section__classroom__academic_session',
    )


def serialize_college_admin_assignment(assignment):
    section = assignment.section
    classroom = section.classroom
    session = classroom.academic_session

    return {
        'assignment_id': assignment.id,
        'teacher_id': assignment.teacher.user_id,
        'teacher_profile_id': assignment.teacher_id,
        'teacher_name': (
            assignment.teacher.user.get_full_name().strip()
            or assignment.teacher.user.username
        ),
        'subject_id': assignment.subject_id,
        'subject_name': assignment.subject.name,
        'subject_code': assignment.subject.code,
        'class_id': classroom.id,
        'class_name': classroom.name,
        'section_id': section.id,
        'section_name': section.name,
        'academic_session_id': session.id,
        'academic_session': session.name,
    }


def college_admin_live_class_queryset(organization):
    return LiveClass.objects.filter(
        organization=organization,
        teacher_assignment__teacher__user__organization=organization,
        teacher_assignment__subject__organization=organization,
        teacher_assignment__section__organization=organization,
    ).select_related(
        'organization',
        'teacher_assignment',
        'teacher_assignment__teacher',
        'teacher_assignment__teacher__user',
        'teacher_assignment__subject',
        'teacher_assignment__section',
        'teacher_assignment__section__classroom',
        'teacher_assignment__section__classroom__academic_session',
        'recording',
    )


def serialize_college_admin_live_class(live_class):
    assignment = live_class.teacher_assignment
    assignment_data = serialize_college_admin_assignment(assignment)

    try:
        recording = live_class.recording
    except LiveClassRecording.DoesNotExist:
        recording = None

    return {
        'id': live_class.id,
        'teacher_assignment_id': assignment.id,
        'title': live_class.title,
        'description': live_class.description,
        'class_date': live_class.class_date,
        'start_time': live_class.start_time,
        'end_time': live_class.end_time,
        'meeting_link': live_class.meeting_link,
        'status': live_class.status,
        'can_edit': live_class.status != LiveClass.Status.CANCELLED,
        'can_cancel': live_class.status not in [
            LiveClass.Status.COMPLETED,
            LiveClass.Status.CANCELLED,
        ],
        'created_at': live_class.created_at,
        'updated_at': live_class.updated_at,
        **assignment_data,
        'recording': (
            {
                'exists': True,
                'title': recording.title,
                'is_available': recording.is_available,
                'uploaded_at': recording.uploaded_at,
            }
            if recording
            else {
                'exists': False,
                'title': '',
                'is_available': False,
                'uploaded_at': None,
            }
        ),
    }


def student_live_class_queryset(user, student_profile):
    return LiveClass.objects.filter(
        organization=user.organization,
        teacher_assignment__section__student_enrollments__student=student_profile,
        teacher_assignment__section__student_enrollments__is_active=True,
    ).select_related(
        'teacher_assignment__teacher__user',
        'teacher_assignment__subject',
        'teacher_assignment__section'
    ).distinct()


def live_class_has_ended(live_class):
    current_timezone = timezone.get_current_timezone()
    class_end = timezone.make_aware(
        datetime.combine(
            live_class.class_date,
            live_class.end_time,
        ),
        current_timezone,
    )

    return timezone.localtime(
        timezone.now(),
        current_timezone,
    ) >= class_end


def live_class_can_start(live_class):
    return (
        live_class.status == LiveClass.Status.SCHEDULED
        and live_class.class_date <= timezone.localdate()
    )


def live_class_can_complete(live_class):
    return (
        live_class.status in [
            LiveClass.Status.SCHEDULED,
            LiveClass.Status.LIVE,
        ]
        and live_class_has_ended(live_class)
    )


def validate_live_class_status_transition(live_class, next_status):
    if next_status not in [
        LiveClass.Status.LIVE,
        LiveClass.Status.COMPLETED,
    ]:
        return {'detail': 'Invalid status transition.'}, 400

    if live_class.status == LiveClass.Status.CANCELLED:
        return {'detail': 'Cancelled live classes cannot be changed.'}, 400

    if live_class.status == LiveClass.Status.COMPLETED:
        return {'detail': 'Completed live classes cannot be changed.'}, 400

    if next_status == LiveClass.Status.LIVE:
        if live_class.status != LiveClass.Status.SCHEDULED:
            return {'detail': 'Only scheduled classes can be started.'}, 400

        if not live_class_can_start(live_class):
            return {'detail': 'Future classes cannot be started.'}, 400

    if next_status == LiveClass.Status.COMPLETED:
        if live_class.status not in [
            LiveClass.Status.SCHEDULED,
            LiveClass.Status.LIVE,
        ]:
            return {'detail': 'This class cannot be completed.'}, 400

        if not live_class_has_ended(live_class):
            return {'detail': 'Live class cannot be completed before it ends.'}, 400

    return None, None


def validate_college_admin_live_class_payload(data, organization, instance=None):
    values = {}
    is_create = instance is None

    if is_create or 'teacher_assignment' in data or 'teacher_assignment_id' in data:
        assignment_id = (
            data.get('teacher_assignment')
            or data.get('teacher_assignment_id')
        )

        if not assignment_id:
            return None, {'detail': 'Teacher assignment is required.'}, 400

        assignment = college_admin_assignment_queryset(
            organization
        ).filter(id=assignment_id).first()

        if not assignment:
            return None, {'detail': 'Teacher assignment not found.'}, 404

        values['teacher_assignment'] = assignment

    if is_create or 'title' in data:
        title = data.get('title', '').strip()

        if not title:
            return None, {'detail': 'Title is required.'}, 400

        values['title'] = title

    if 'description' in data:
        values['description'] = data.get('description', '').strip()

    if is_create or 'class_date' in data:
        raw_date = data.get('class_date')
        class_date = parse_date(raw_date) if raw_date else None

        if not class_date:
            return None, {'detail': 'Valid class date is required.'}, 400

        values['class_date'] = class_date

    if is_create or 'start_time' in data:
        raw_start = data.get('start_time')
        start_time = parse_time(raw_start) if raw_start else None

        if not start_time:
            return None, {'detail': 'Valid start time is required.'}, 400

        values['start_time'] = start_time

    if is_create or 'end_time' in data:
        raw_end = data.get('end_time')
        end_time = parse_time(raw_end) if raw_end else None

        if not end_time:
            return None, {'detail': 'Valid end time is required.'}, 400

        values['end_time'] = end_time

    start_time = values.get(
        'start_time',
        instance.start_time if instance else None,
    )
    end_time = values.get(
        'end_time',
        instance.end_time if instance else None,
    )

    if start_time and end_time and start_time >= end_time:
        return None, {'detail': 'Start time must be before end time.'}, 400

    if 'meeting_link' in data:
        values['meeting_link'] = data.get('meeting_link', '').strip()

    return values, None, None


class CollegeAdminLiveClassSetupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can access live class setup.'},
                status=403
            )

        assignments = college_admin_assignment_queryset(
            organization
        ).order_by(
            'teacher__user__first_name',
            'teacher__user__last_name',
            'subject__name',
        )

        return Response({
            'teacher_assignments': [
                serialize_college_admin_assignment(assignment)
                for assignment in assignments
            ],
            'statuses': [
                {'value': value, 'label': label}
                for value, label in LiveClass.Status.choices
            ],
        })


class CollegeAdminLiveClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can view live classes.'},
                status=403
            )

        live_classes = college_admin_live_class_queryset(
            organization
        ).order_by(
            '-class_date',
            '-start_time',
        )

        status_filter = request.query_params.get('status', '').strip()
        date_filter = request.query_params.get('date', '').strip()
        teacher_filter = request.query_params.get('teacher', '').strip()
        subject_filter = request.query_params.get('subject', '').strip()
        search = request.query_params.get('search', '').strip()

        valid_statuses = [
            choice[0]
            for choice in LiveClass.Status.choices
        ]

        if status_filter in valid_statuses:
            live_classes = live_classes.filter(status=status_filter)

        if date_filter:
            class_date = parse_date(date_filter)

            if class_date:
                live_classes = live_classes.filter(class_date=class_date)

        if teacher_filter:
            live_classes = live_classes.filter(
                teacher_assignment__teacher__user_id=teacher_filter
            )

        if subject_filter:
            live_classes = live_classes.filter(
                teacher_assignment__subject_id=subject_filter
            )

        if search:
            live_classes = live_classes.filter(
                Q(title__icontains=search)
            )

        return Response({
            'classes': [
                serialize_college_admin_live_class(live_class)
                for live_class in live_classes
            ]
        })

    def post(self, request):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can schedule live classes.'},
                status=403
            )

        values, error, status_code = validate_college_admin_live_class_payload(
            request.data,
            organization,
        )

        if error:
            return Response(error, status=status_code)

        live_class = LiveClass.objects.create(
            organization=organization,
            **values,
        )

        return Response(
            {
                'message': 'Live class scheduled successfully.',
                'class': serialize_college_admin_live_class(live_class),
            },
            status=201
        )


class CollegeAdminLiveClassDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_live_class(self, user, class_id):
        organization = college_admin_organization(user)

        if not organization:
            return None

        return college_admin_live_class_queryset(
            organization
        ).filter(id=class_id).first()

    def get(self, request, class_id):
        live_class = self.get_live_class(request.user, class_id)

        if not live_class:
            return Response(
                {'detail': 'Live class not found.'},
                status=404
            )

        return Response({
            'class': serialize_college_admin_live_class(live_class)
        })

    def patch(self, request, class_id):
        live_class = self.get_live_class(request.user, class_id)

        if not live_class:
            return Response(
                {'detail': 'Live class not found.'},
                status=404
            )

        if live_class.status == LiveClass.Status.CANCELLED:
            return Response(
                {'detail': 'Cancelled live classes cannot be edited.'},
                status=400
            )

        protected_completed_fields = [
            'teacher_assignment',
            'teacher_assignment_id',
            'class_date',
            'start_time',
            'end_time',
        ]

        if (
            live_class.status == LiveClass.Status.COMPLETED
            and any(field in request.data for field in protected_completed_fields)
        ):
            return Response(
                {
                    'detail': (
                        'Completed live class assignment and schedule '
                        'cannot be changed.'
                    )
                },
                status=400
            )

        organization = request.user.organization
        values, error, status_code = validate_college_admin_live_class_payload(
            request.data,
            organization,
            instance=live_class,
        )

        if error:
            return Response(error, status=status_code)

        for field, value in values.items():
            setattr(live_class, field, value)

        live_class.save(
            update_fields=[
                *values.keys(),
                'updated_at',
            ]
        )

        return Response({
            'message': 'Live class updated successfully.',
            'class': serialize_college_admin_live_class(live_class),
        })


class CollegeAdminLiveClassCancelAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, class_id):
        organization = college_admin_organization(request.user)

        if not organization:
            return Response(
                {'detail': 'Only college admins can cancel live classes.'},
                status=403
            )

        live_class = college_admin_live_class_queryset(
            organization
        ).filter(id=class_id).first()

        if not live_class:
            return Response(
                {'detail': 'Live class not found.'},
                status=404
            )

        if live_class.status == LiveClass.Status.CANCELLED:
            return Response(
                {'detail': 'Live class is already cancelled.'},
                status=400
            )

        if live_class.status == LiveClass.Status.COMPLETED:
            return Response(
                {'detail': 'Completed live classes cannot be cancelled.'},
                status=400
            )

        live_class.status = LiveClass.Status.CANCELLED
        live_class.save(update_fields=['status', 'updated_at'])

        return Response({
            'message': 'Live class cancelled successfully.',
            'class': serialize_college_admin_live_class(live_class),
        })




class StudentLiveClassesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "classes"

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

        if not student_profile.enrollments.filter(is_active=True).exists():
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        live_classes = student_live_class_queryset(
            user,
            student_profile
        ).order_by(
            'class_date',
            'start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)    

class StudentTodayClassesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "classes"

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

        if not student_profile.enrollments.filter(is_active=True).exists():
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        today = timezone.localdate()

        live_classes = student_live_class_queryset(
            user,
            student_profile
        ).filter(
            class_date=today
        ).order_by('start_time')

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class StudentUpcomingClassesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "classes"

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

        if not student_profile.enrollments.filter(is_active=True).exists():
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        today = timezone.localdate()

        live_classes = student_live_class_queryset(
            user,
            student_profile
        ).filter(
            class_date__gt=today,
            status=LiveClass.Status.SCHEDULED
        ).order_by(
            'class_date',
            'start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class StudentCompletedClassesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "classes"

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

        if not student_profile.enrollments.filter(is_active=True).exists():
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        live_classes = student_live_class_queryset(
            user,
            student_profile
        ).filter(
            status=LiveClass.Status.COMPLETED
        ).order_by(
            '-class_date',
            '-start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class StudentRecordedClassesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_classes"

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

        if not student_profile.enrollments.filter(is_active=True).exists():
            return Response(
                {'detail': 'No active student enrollment found.'},
                status=404
            )

        live_classes = student_live_class_queryset(
            user,
            student_profile
        ).filter(
            status=LiveClass.Status.COMPLETED,
            recording__is_available=True
        ).exclude(
            recording__video=''
        ).select_related(
            'recording'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True,
            context={'request': request}
        )

        return Response(serializer.data)
    
class StudentRecordingPlaybackAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_classes"

    def get(self, request, public_id):
        user = request.user

        # Only students can watch through this endpoint
        if user.role != 'student':
            return Response(
                {'detail': 'Only students can access this recording.'},
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

        recording = get_object_or_404(
            LiveClassRecording.objects.select_related(
                'live_class',
                'live_class__teacher_assignment__section'
            ),
            public_id=public_id,
            is_available=True
        )

        live_class = recording.live_class

        # College / tenant protection
        if live_class.organization_id != user.organization_id:
            return Response(
                {'detail': 'You are not authorized to access this recording.'},
                status=403
            )

        # Recording should be available only for completed classes
        if live_class.status != LiveClass.Status.COMPLETED:
            return Response(
                {'detail': 'This recording is not available yet.'},
                status=403
            )

        section = live_class.teacher_assignment.section

        # Student must currently belong to this section
        is_enrolled = student_profile.enrollments.filter(
            section=section,
            is_active=True
        ).exists()

        if not is_enrolled:
            return Response(
                {'detail': 'You are not enrolled in this class.'},
                status=403
            )

        if not recording.video:
            return Response(
                {'detail': 'Recording file not found.'},
                status=404
            )

        content_type, _ = mimetypes.guess_type(
            recording.video.name
        )

        response = FileResponse(
            recording.video.open('rb'),
            content_type=content_type or 'application/octet-stream'
        )

        response['Content-Disposition'] = (
            f'inline; filename="{recording.video.name.split("/")[-1]}"'
        )

        response['X-Content-Type-Options'] = 'nosniff'

        return response
    
class TeacherRecordingUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        user = request.user

        # Only teachers can upload recordings
        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can upload recordings.'},
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

        serializer = TeacherRecordingUploadSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        live_class = serializer.validated_data['live_class']

        # Teacher and live class must belong to same college
        if live_class.organization_id != user.organization_id:
            return Response(
                {'detail': 'You cannot upload recordings for another college.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Teacher can upload only for their own assigned live class
        if live_class.teacher_assignment.teacher_id != teacher_profile.id:
            return Response(
                {'detail': 'You are not assigned to this live class.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Recording allowed only after class is completed
        if live_class.status != LiveClass.Status.COMPLETED:
            return Response(
                {'detail': 'Recording can be uploaded only for a completed class.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # One recording per live class for now
        if LiveClassRecording.objects.filter(
            live_class=live_class
        ).exists():
            return Response(
                {'detail': 'A recording already exists for this live class.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        recording = serializer.save(
            uploaded_by=teacher_profile
        )

        notify_recording_available(recording)

        return Response(
            {
                'message': 'Recording uploaded successfully.',
                'recording_id': recording.id,
                'public_id': recording.public_id,
                'title': recording.title,
                'live_class': recording.live_class.title,
            },
            status=status.HTTP_201_CREATED
        )
        
class TeacherRecordingEligibleClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can access this endpoint.'},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=404
            )

        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            status=LiveClass.Status.COMPLETED,
            recording__isnull=True
        ).select_related(
            'teacher_assignment__subject',
            'teacher_assignment__section'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        serializer = LiveClassSerializer(
            live_classes,
            many=True
        )

        return Response(serializer.data)
    
class TeacherRecordingsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Only teachers can access this endpoint
        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can access this endpoint.'},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=404
            )

        recordings = LiveClassRecording.objects.filter(
            uploaded_by=teacher_profile,
            live_class__organization=user.organization
        ).select_related(
            'live_class',
            'live_class__teacher_assignment__subject',
            'live_class__teacher_assignment__section'
        ).order_by('-uploaded_at')

        data = []

        for recording in recordings:
            data.append({
                'id': recording.id,
                'public_id': recording.public_id,
                'title': recording.title,
                'live_class': recording.live_class.title,
                'subject': recording.live_class.teacher_assignment.subject.name,
                'section': recording.live_class.teacher_assignment.section.name,
                'class_date': recording.live_class.class_date,
                'is_available': recording.is_available,
                'uploaded_at': recording.uploaded_at,
            })

        return Response(data)
    
class TeacherRecordingDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def patch(self, request, public_id):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can manage recordings.'},
                status=403
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {'detail': 'Teacher profile not found.'},
                status=404
            )

        recording = get_object_or_404(
            LiveClassRecording,
            public_id=public_id,
            uploaded_by=teacher_profile,
            live_class__organization=user.organization
        )

        old_video_name = (
            recording.video.name
            if recording.video
            else None
        )

        serializer = TeacherRecordingUpdateSerializer(
            recording,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)

        updated_recording = serializer.save()

        if (
            old_video_name
            and 'video' in request.FILES
            and old_video_name != updated_recording.video.name
        ):
            updated_recording.video.storage.delete(
                old_video_name
            )

        return Response({
            'message': 'Recording updated successfully.',
            'public_id': updated_recording.public_id,
            'title': updated_recording.title,
            'is_available': updated_recording.is_available,
        })


class TeacherLiveClassStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, class_id):
        user = request.user

        if user.role != 'teacher':
            return Response(
                {'detail': 'Only teachers can update live class status.'},
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

        live_class = LiveClass.objects.filter(
            id=class_id,
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
        ).select_related(
            'teacher_assignment__subject',
            'teacher_assignment__section',
            'teacher_assignment__section__classroom'
        ).first()

        if not live_class:
            return Response(
                {'detail': 'Live class not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        next_status = request.data.get('status')
        error, status_code = validate_live_class_status_transition(
            live_class,
            next_status,
        )

        if error:
            return Response(error, status=status_code)

        live_class.status = next_status
        live_class.save(update_fields=['status', 'updated_at'])

        return Response({
            'message': 'Live class status updated successfully.',
            'class': {
                'id': live_class.id,
                'status': live_class.status,
                'can_start': live_class_can_start(live_class),
                'can_complete': live_class_can_complete(live_class),
            },
        })


class TeacherLiveClassesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Only teachers
        if user.role != 'teacher':
            return Response(
                {
                    'detail':
                    'Only teachers can access this endpoint.'
                },
                status=status.HTTP_403_FORBIDDEN
            )

        teacher_profile = TeacherProfile.objects.filter(
            user=user
        ).first()

        if not teacher_profile:
            return Response(
                {
                    'detail':
                    'Teacher profile not found.'
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Tenant + teacher protection
        live_classes = LiveClass.objects.filter(
            organization=user.organization,
            teacher_assignment__teacher=teacher_profile,
            teacher_assignment__is_active=True
        ).select_related(
            'teacher_assignment__subject',
            'teacher_assignment__section',
            'teacher_assignment__section__classroom'
        ).order_by(
            '-class_date',
            '-start_time'
        )

        today = timezone.localdate()

        data = []

        for live_class in live_classes:

            # Useful UI category
            if (
                live_class.status
                == LiveClass.Status.COMPLETED
            ):
                category = 'completed'

            elif live_class.class_date == today:
                category = 'today'

            elif live_class.class_date > today:
                category = 'upcoming'

            else:
                category = 'past'

            data.append({
                'id': live_class.id,
                'title': live_class.title,
                'description': live_class.description,

                'class_date': live_class.class_date,
                'start_time': live_class.start_time,
                'end_time': live_class.end_time,

                'meeting_link':
                    live_class.meeting_link,

                'status':
                    live_class.status,

                'category':
                    category,

                'subject_name':
                    live_class
                    .teacher_assignment
                    .subject
                    .name,

                'section_name':
                    live_class
                    .teacher_assignment
                    .section
                    .name,

                'classroom_name':
                    live_class
                    .teacher_assignment
                    .section
                    .classroom
                    .name,

                'has_recording':
                    hasattr(
                        live_class,
                        'recording'
                    ),

                'can_start':
                    live_class_can_start(live_class),

                'can_complete':
                    live_class_can_complete(live_class),
            })

        return Response({
            'count': len(data),
            'classes': data,
        })
