from rest_framework import serializers

from .models import StudentAttendance


class StudentAttendanceSerializer(serializers.ModelSerializer):

    date = serializers.DateField(
        source='attendance_session.date',
        read_only=True
    )

    subject_name = serializers.CharField(
        source='attendance_session.subject.name',
        read_only=True
    )

    section_name = serializers.CharField(
        source='attendance_session.section.name',
        read_only=True
    )

    teacher_name = serializers.CharField(
        source='attendance_session.teacher.user.get_full_name',
        read_only=True
    )

    start_time = serializers.TimeField(
        source='attendance_session.start_time',
        read_only=True
    )

    end_time = serializers.TimeField(
        source='attendance_session.end_time',
        read_only=True
    )

    class Meta:
        model = StudentAttendance

        fields = [
            'id',
            'date',
            'subject_name',
            'section_name',
            'teacher_name',
            'start_time',
            'end_time',
            'status',
            'remarks',
            'marked_at',
        ]