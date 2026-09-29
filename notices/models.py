from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def notice_attachment_upload_path(instance, filename):
    return f"notices/{instance.organization_id}/{filename}"


class Notice(models.Model):
    class Audience(models.TextChoices):
        EVERYONE = "everyone", "Everyone"
        STUDENTS = "students", "All Students"
        TEACHERS = "teachers", "All Teachers"
        PARENTS = "parents", "All Parents"
        CLASS = "class", "Specific Class"
        SECTION = "section", "Specific Section"

    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="notices",
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    audience = models.CharField(
        max_length=20,
        choices=Audience.choices,
        default=Audience.EVERYONE,
    )
    classroom = models.ForeignKey(
        "academics.ClassRoom",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notices",
    )
    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notices",
    )
    publish_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    attachment = models.FileField(
        upload_to=notice_attachment_upload_path,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="created_notices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-publish_at", "-created_at"]

    def clean(self):
        if self.created_by_id and self.created_by.organization_id != self.organization_id:
            raise ValidationError({"created_by": "Creator must belong to the same organization."})

        if self.classroom_id and self.classroom.organization_id != self.organization_id:
            raise ValidationError({"classroom": "Class must belong to the same organization."})

        if self.section_id and self.section.organization_id != self.organization_id:
            raise ValidationError({"section": "Section must belong to the same organization."})

        if self.audience == self.Audience.CLASS and not self.classroom_id:
            raise ValidationError({"classroom": "Class is required for class audience."})

        if self.audience == self.Audience.SECTION and not self.section_id:
            raise ValidationError({"section": "Section is required for section audience."})

        if self.audience != self.Audience.CLASS:
            self.classroom = None

        if self.audience != self.Audience.SECTION:
            self.section = None

        if self.expires_at and self.publish_at and self.expires_at <= self.publish_at:
            raise ValidationError({"expires_at": "Expiry must be after publish date."})

    @property
    def is_current(self):
        now = timezone.now()
        return (
            self.is_active
            and self.publish_at <= now
            and (self.expires_at is None or self.expires_at > now)
        )

    def __str__(self):
        return self.title
