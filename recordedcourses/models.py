import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models
from django.utils import timezone


private_recorded_course_storage = FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)


def recorded_lesson_upload_path(instance, filename):
    filename = Path(filename).name
    return f"purchased_recorded_courses/{instance.course.organization_id}/{instance.course_id}/{uuid.uuid4()}_{filename}"


class RecordedCourse(models.Model):
    organization = models.ForeignKey("institutions.Organization", on_delete=models.CASCADE, related_name="recorded_courses")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    access_duration_days = models.PositiveIntegerField(default=180)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["organization", "title"], name="unique_recorded_course_title_per_org")]

    def __str__(self):
        return self.title


class RecordedLesson(models.Model):
    course = models.ForeignKey(RecordedCourse, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    position = models.PositiveIntegerField(default=1)
    video = models.FileField(
        max_length=500,
        upload_to=recorded_lesson_upload_path,
        storage=private_recorded_course_storage,
        validators=[FileExtensionValidator(allowed_extensions=["mp4", "webm", "mov"])],
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["course", "position"], name="unique_recorded_lesson_position")]

    def __str__(self):
        return f"{self.course.title} - {self.title}"


class RecordedCoursePurchase(models.Model):
    class BuyerType(models.TextChoices):
        STUDENT = "student", "Student"
        PARENT = "parent", "Parent"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"
        CANCELLED = "cancelled", "Cancelled"

    organization = models.ForeignKey("institutions.Organization", on_delete=models.CASCADE, related_name="recorded_course_purchases")
    course = models.ForeignKey(RecordedCourse, on_delete=models.PROTECT, related_name="purchases")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.PROTECT, related_name="recorded_course_purchases")
    buyer_type = models.CharField(max_length=10, choices=BuyerType.choices)
    purchased_by_student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.PROTECT, null=True, blank=True, related_name="self_recorded_course_purchases"
    )
    purchased_by_parent = models.ForeignKey(
        "accounts.ParentProfile", on_delete=models.PROTECT, null=True, blank=True, related_name="recorded_course_purchases"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=40, blank=True)
    payment_reference = models.CharField(max_length=120, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        errors = {}
        if self.course_id and self.organization_id and self.course.organization_id != self.organization_id:
            errors["course"] = "Course must belong to the purchase organization."
        if self.student_id and self.organization_id and self.student.user.organization_id != self.organization_id:
            errors["student"] = "Student must belong to the purchase organization."

        if self.buyer_type == self.BuyerType.STUDENT:
            if self.purchased_by_student_id != self.student_id:
                errors["purchased_by_student"] = "A student purchase must be made by the same student."
            if self.purchased_by_parent_id:
                errors["purchased_by_parent"] = "Parent buyer must be empty for a student purchase."
        elif self.buyer_type == self.BuyerType.PARENT:
            if not self.purchased_by_parent_id:
                errors["purchased_by_parent"] = "Parent is required for a parent purchase."
            elif self.purchased_by_parent.user.organization_id != self.organization_id:
                errors["purchased_by_parent"] = "Parent must belong to the purchase organization."
            elif not self.purchased_by_parent.student_links.filter(student_id=self.student_id).exists():
                errors["student"] = "Parent can purchase only for a linked child."
            if self.purchased_by_student_id:
                errors["purchased_by_student"] = "Student buyer must be empty for a parent purchase."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.course.title} - {self.student}"


class RecordedCourseAccess(models.Model):
    organization = models.ForeignKey("institutions.Organization", on_delete=models.CASCADE, related_name="recorded_course_accesses")
    course = models.ForeignKey(RecordedCourse, on_delete=models.CASCADE, related_name="student_accesses")
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.CASCADE, related_name="recorded_course_accesses")
    purchase = models.OneToOneField(
        RecordedCoursePurchase, on_delete=models.SET_NULL, null=True, blank=True, related_name="granted_access"
    )
    starts_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["course", "student"], name="unique_recorded_course_access")]

    @property
    def has_access(self):
        now = timezone.now()
        return self.is_active and not self.revoked_at and self.starts_at <= now and (self.expires_at is None or self.expires_at > now)

    def clean(self):
        errors = {}
        if self.course_id and self.organization_id and self.course.organization_id != self.organization_id:
            errors["course"] = "Course must belong to the access organization."
        if self.student_id and self.organization_id and self.student.user.organization_id != self.organization_id:
            errors["student"] = "Student must belong to the access organization."
        if self.purchase_id:
            if self.purchase.status != RecordedCoursePurchase.Status.PAID:
                errors["purchase"] = "Purchase must be paid before access is granted."
            elif (
                self.purchase.organization_id != self.organization_id
                or self.purchase.course_id != self.course_id
                or self.purchase.student_id != self.student_id
            ):
                errors["purchase"] = "Purchase does not match this organization, course, and student."
        if self.expires_at and self.expires_at <= self.starts_at:
            errors["expires_at"] = "Expiry must be later than the access start."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.expires_at is None and self.course_id and self.course.access_duration_days:
            self.expires_at = self.starts_at + timedelta(days=self.course.access_duration_days)
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student} - {self.course.title}"
