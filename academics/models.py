from django.db import models


class AcademicSession(models.Model):
    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='academic_sessions'
    )

    name = models.CharField(
    max_length=50,
    verbose_name='Session'
)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        unique_together = (
            'organization',
            'name',
        )

    def __str__(self):
        if self.organization:
            return f"{self.organization.name} - {self.name}"

        return self.name


class ClassRoom(models.Model):
    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='classrooms'
    )

    name = models.CharField(max_length=50)

    academic_session = models.ForeignKey(
        AcademicSession,
        on_delete=models.CASCADE,
        related_name='classes'
    )

    class Meta:
        unique_together = (
            'organization',
            'name',
            'academic_session',
        )

    def __str__(self):
        return f"{self.organization.name} - {self.name}"


class Section(models.Model):
    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sections'
    )

    name = models.CharField(max_length=20)

    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
        related_name='sections'
    )

    class Meta:
        unique_together = (
            'organization',
            'name',
            'classroom',
        )

    def __str__(self):
        return f"{self.classroom.name} - {self.name}"


class Subject(models.Model):
    organization = models.ForeignKey(
        'institutions.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subjects'
    )

    name = models.CharField(max_length=100)
    code = models.CharField(
        max_length=30,
        blank=True
    )

    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
        related_name='subjects'
    )

    class Meta:
        unique_together = (
            'organization',
            'name',
            'classroom',
        )

    def __str__(self):
        return f"{self.name} - {self.classroom.name}"


class TeacherAssignment(models.Model):
    teacher = models.ForeignKey(
        'accounts.TeacherProfile',
        on_delete=models.CASCADE,
        related_name='teaching_assignments'
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='teacher_assignments'
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='teacher_assignments'
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = (
            'teacher',
            'subject',
            'section',
        )

    def __str__(self):
        return f"{self.teacher} - {self.subject} - {self.section}"


class StudentEnrollment(models.Model):
    student = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='enrollments'
    )

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='student_enrollments'
    )

    roll_number = models.CharField(
        max_length=30,
        blank=True
    )

    is_active = models.BooleanField(default=True)

    enrolled_at = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = (
            'student',
            'section',
        )

    def __str__(self):
        return f"{self.student} - {self.section}"


class ParentStudent(models.Model):

    class Relationship(models.TextChoices):
        FATHER = 'father', 'Father'
        MOTHER = 'mother', 'Mother'
        GUARDIAN = 'guardian', 'Guardian'
        OTHER = 'other', 'Other'

    parent = models.ForeignKey(
        'accounts.ParentProfile',
        on_delete=models.CASCADE,
        related_name='student_links'
    )

    student = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='parent_links'
    )

    relationship = models.CharField(
        max_length=20,
        choices=Relationship.choices,
        default=Relationship.GUARDIAN
    )

    class Meta:
        unique_together = (
            'parent',
            'student',
        )

    def __str__(self):
        return f"{self.parent} - {self.student}"

class ClassFeatureAccess(models.Model):
    class Feature(models.TextChoices):
        CLASSES = "classes", "My Classes"
        RECORDED_CLASSES = "recorded_classes", "Recorded Classes"
        RECORDED_COURSES = "recorded_courses", "Recorded Courses"
        ATTENDANCE = "attendance", "Attendance"
        ASSIGNMENTS = "assignments", "Assignments"
        RESULTS = "results", "Results"
        DOCUMENTS = "documents", "Documents"
        FEES = "fees", "Fees"
        NOTIFICATIONS = "notifications", "Notifications"

    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="class_feature_access",
    )
    classroom = models.ForeignKey(
        ClassRoom,
        on_delete=models.CASCADE,
        related_name="feature_access",
    )
    feature_key = models.CharField(
        max_length=50,
        choices=Feature.choices,
    )
    is_enabled = models.BooleanField(default=True)
    parent_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "classroom", "feature_key"),
                name="uniq_class_feature_access",
            )
        ]

    def __str__(self):
        student_state = "enabled" if self.is_enabled else "disabled"
        parent_state = "enabled" if self.parent_enabled else "disabled"
        return (
            f"{self.classroom} - {self.get_feature_key_display()} - "
            f"student:{student_state} parent:{parent_state}"
        )

