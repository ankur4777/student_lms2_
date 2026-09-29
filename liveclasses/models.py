import uuid
from pathlib import Path

from django.db import models
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.validators import FileExtensionValidator


private_recording_storage = FileSystemStorage(
    location=settings.PRIVATE_MEDIA_ROOT
)


def live_class_recording_upload_path(instance, filename):
    filename = Path(filename).name

    class_date = instance.live_class.class_date

    return (
        f"recorded_classes/"
        f"{class_date.year}/"
        f"{class_date.month:02d}/"
        f"{class_date.day:02d}/"
        f"{filename}"
    )


class LiveClass(models.Model):

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'
        LIVE = 'live', 'Live'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        related_name='live_classes'
    )

    teacher_assignment = models.ForeignKey(
        'academics.TeacherAssignment',
        on_delete=models.CASCADE,
        related_name='live_classes'
    )

    title = models.CharField(
        max_length=150
    )

    description = models.TextField(
        blank=True
    )

    class_date = models.DateField()

    start_time = models.TimeField()

    end_time = models.TimeField()

    meeting_link = models.URLField(
        blank=True
    )

    recording_link = models.URLField(
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"{self.title} - {self.class_date}"


class LiveClassRecording(models.Model):

    public_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True
    )

    live_class = models.OneToOneField(
        LiveClass,
        on_delete=models.CASCADE,
        related_name='recording'
    )

    video = models.FileField(
        upload_to=live_class_recording_upload_path,
        storage=private_recording_storage,
        validators=[
            FileExtensionValidator(
                allowed_extensions=['mp4', 'webm', 'mov']
            )
        ]
    )

    uploaded_by = models.ForeignKey(
        'accounts.TeacherProfile',
        on_delete=models.CASCADE,
        related_name='uploaded_recordings'
    )

    title = models.CharField(
        max_length=150,
        blank=True
    )

    is_available = models.BooleanField(
        default=True
    )

    uploaded_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"Recording - {self.live_class.title}"