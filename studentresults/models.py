from django.db import models


class Exam(models.Model):
    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="exams",
    )

    section = models.ForeignKey(
        "academics.Section",
        on_delete=models.CASCADE,
        related_name="exams",
    )

    name = models.CharField(max_length=150)

    exam_date = models.DateField()

    is_published = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-exam_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "section", "name"],
                name="unique_exam_per_section",
            )
        ]

    def __str__(self):
        return f"{self.name} - {self.section}"


class StudentResult(models.Model):
    exam = models.ForeignKey(
        Exam,
        on_delete=models.CASCADE,
        related_name="results",
    )

    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.CASCADE,
        related_name="results",
    )

    subject = models.ForeignKey(
        "academics.Subject",
        on_delete=models.CASCADE,
        related_name="student_results",
    )

    teacher = models.ForeignKey(
        "accounts.TeacherProfile",
        on_delete=models.CASCADE,
        related_name="graded_results",
    )

    marks_obtained = models.DecimalField(
        max_digits=6,
        decimal_places=2,
    )

    maximum_marks = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=100,
    )

    remarks = models.CharField(
        max_length=255,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = [
            "-exam__exam_date",
            "subject__name",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "exam",
                    "student",
                    "subject",
                ],
                name="unique_student_exam_subject_result",
            )
        ]

    @property
    def percentage(self):
        if not self.maximum_marks:
            return 0

        return round(
            (self.marks_obtained / self.maximum_marks) * 100,
            2,
        )

    def __str__(self):
        return (
            f"{self.student} - "
            f"{self.exam.name} - "
            f"{self.subject.name}"
        )