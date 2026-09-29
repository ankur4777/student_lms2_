from django.db import models


def assignment_attachment_upload_path(instance, filename):
    due_date = str(instance.due_date)
    due_date_path = due_date.replace("-", "/")

    return (
        f"assignments/"
        f"{instance.organization_id}/"
        f"{due_date_path}/"
        f"{filename}"
    )


class Assignment(models.Model):

    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="assignments"
    )

    teacher_assignment = models.ForeignKey(
        "academics.TeacherAssignment",
        on_delete=models.CASCADE,
        related_name="assignments"
    )

    title = models.CharField(
        max_length=255
    )

    instructions = models.TextField(
        blank=True
    )

    due_date = models.DateField()

    due_time = models.TimeField(
        null=True,
        blank=True
    )

    attachment = models.FileField(
        upload_to=assignment_attachment_upload_path,
        null=True,
        blank=True
    )

    is_published = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = [
            "-created_at"
        ]

    def __str__(self):
        return self.title
    
def assignment_submission_upload_path(instance, filename):
    return (
        f"assignment_submissions/"
        f"{instance.assignment.organization_id}/"
        f"{instance.assignment_id}/"
        f"{instance.student_id}/"
        f"{filename}"
    )


class AssignmentSubmission(models.Model):

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Submitted"
        LATE = "late", "Late"
        GRADED = "graded", "Graded"

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions"
    )

    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="assignment_submissions"
    )

    submission_text = models.TextField(
        blank=True
    )

    attachment = models.FileField(
        upload_to=assignment_submission_upload_path,
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED
    )

    submitted_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    marks_obtained = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )

    feedback = models.TextField(
        blank=True
    )

    graded_at = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        ordering = [
            "-submitted_at"
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "student"],
                name="unique_assignment_submission_per_student"
            )
        ]

    def __str__(self):
        return (
            f"{self.student.user.username} - "
            f"{self.assignment.title}"
        )