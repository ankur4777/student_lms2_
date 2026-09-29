from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        GENERAL = 'general', 'General'
        ASSIGNMENT = 'assignment', 'Assignment'
        ATTENDANCE = 'attendance', 'Attendance'
        RESULT = 'result', 'Result'
        LIVE_CLASS = 'live_class', 'Live Class'
        SYSTEM = 'system', 'System'

    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.GENERAL,
    )
    related_url = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['organization', 'user']),
        ]

    def __str__(self):
        return self.title
