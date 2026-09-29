from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone


private_document_storage = FileSystemStorage(
    location=settings.PRIVATE_MEDIA_ROOT
)


def document_upload_path(instance, filename):
    filename = Path(filename).name

    return (
        f"documents/"
        f"{instance.organization_id}/"
        f"{timezone.now().date().isoformat()}/"
        f"{filename}"
    )


class Document(models.Model):
    class Type(models.TextChoices):
        NOTES = 'notes', 'Notes'
        SYLLABUS = 'syllabus', 'Syllabus'
        TIMETABLE = 'timetable', 'Timetable'
        STUDY_MATERIAL = 'study_material', 'Study Material'
        WORKSHEET = 'worksheet', 'Worksheet'
        NOTICE = 'notice', 'Notice'
        OTHER = 'other', 'Other'

    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        related_name='documents',
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_documents',
    )
    teacher_assignment = models.ForeignKey(
        'academics.TeacherAssignment',
        on_delete=models.CASCADE,
        related_name='documents',
    )
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    document_type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.OTHER,
    )
    file = models.FileField(
        upload_to=document_upload_path,
        storage=private_document_storage,
        validators=[
            FileExtensionValidator(
                allowed_extensions=[
                    'pdf',
                    'doc',
                    'docx',
                    'ppt',
                    'pptx',
                    'xls',
                    'xlsx',
                    'txt',
                ]
            )
        ],
    )
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'uploaded_by']),
            models.Index(fields=['teacher_assignment', 'is_published']),
        ]

    def __str__(self):
        return self.title
