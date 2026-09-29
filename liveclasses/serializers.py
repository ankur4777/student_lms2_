from rest_framework import serializers
from .models import LiveClass, LiveClassRecording


class LiveClassSerializer(serializers.ModelSerializer):

    teacher_name = serializers.CharField(
        source='teacher_assignment.teacher.user.get_full_name',
        read_only=True
    )

    subject_name = serializers.CharField(
        source='teacher_assignment.subject.name',
        read_only=True
    )

    section_name = serializers.CharField(
        source='teacher_assignment.section.name',
        read_only=True
    )

    # Unique ID of uploaded recording
    recording_public_id = serializers.UUIDField(
        source='recording.public_id',
        read_only=True
    )

    # Secure playback endpoint
    recording_playback_url = serializers.SerializerMethodField()

    def get_recording_playback_url(self, obj):
        try:
            recording = obj.recording
        except Exception:
            return None

        return (
            f'/api/live-classes/student/recordings/'
            f'{recording.public_id}/play/'
        )

    class Meta:
        model = LiveClass

        fields = [
            'id',
            'title',
            'description',
            'class_date',
            'start_time',
            'end_time',
            'meeting_link',
            'status',

            'teacher_name',
            'subject_name',
            'section_name',

            'recording_public_id',
            'recording_playback_url',

            'created_at',
            'updated_at',
        ]
        
class TeacherRecordingUploadSerializer(serializers.ModelSerializer):

    class Meta:
        model = LiveClassRecording

        fields = [
            'live_class',
            'title',
            'video',
        ]
        
class TeacherRecordingUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = LiveClassRecording

        fields = [
            'title',
            'is_available',
            'video',
        ]