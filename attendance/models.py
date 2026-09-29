from django.db import models


class AttendanceSession(models.Model):
    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        related_name='attendance_sessions'
    )

    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.CASCADE,
        related_name='attendance_sessions'
    )

    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='attendance_sessions'
    )

    teacher = models.ForeignKey(
        'accounts.TeacherProfile',
        on_delete=models.CASCADE,
        related_name='attendance_sessions'
    )

    date = models.DateField()

    start_time = models.TimeField(
        null=True,
        blank=True
    )

    end_time = models.TimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.subject} - {self.section} - {self.date}"


class StudentAttendance(models.Model):

    class Status(models.TextChoices):
        PRESENT = 'present', 'Present'
        ABSENT = 'absent', 'Absent'
        LATE = 'late', 'Late'
        EXCUSED = 'excused', 'Excused'

    attendance_session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.CASCADE,
        related_name='student_records'
    )

    student = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PRESENT
    )

    remarks = models.CharField(
        max_length=255,
        blank=True
    )

    marked_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        unique_together = (
            'attendance_session',
            'student'
        )

    def __str__(self):
        return f"{self.student} - {self.status}"