from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum
from django.utils import timezone


ZERO = Decimal("0.00")


class FeeStructure(models.Model):
    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="fee_structures",
    )
    academic_session = models.ForeignKey(
        "academics.AcademicSession",
        on_delete=models.PROTECT,
        related_name="fee_structures",
    )
    class_room = models.ForeignKey(
        "academics.ClassRoom",
        on_delete=models.PROTECT,
        related_name="fee_structures",
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(ZERO)],
    )
    due_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "academic_session",
                    "class_room",
                    "name",
                ],
                name="unique_fee_structure_per_class_session_name",
            )
        ]

    def clean(self):
        if self.academic_session_id and (
            self.academic_session.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"academic_session": "Academic session must belong to organization."}
            )

        if self.class_room_id and (
            self.class_room.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"class_room": "Class must belong to organization."}
            )

        if (
            self.class_room_id
            and self.academic_session_id
            and self.class_room.academic_session_id != self.academic_session_id
        ):
            raise ValidationError(
                {"class_room": "Class must belong to academic session."}
            )

        if self.total_amount < ZERO:
            raise ValidationError(
                {"total_amount": "Total amount cannot be negative."}
            )

    def __str__(self):
        return self.name


class FeeComponent(models.Model):
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name="components",
    )
    name = models.CharField(max_length=100)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(ZERO)],
    )
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["id"]

    def clean(self):
        if self.amount < ZERO:
            raise ValidationError(
                {"amount": "Component amount cannot be negative."}
            )

    def __str__(self):
        return f"{self.fee_structure} - {self.name}"


class StudentFee(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIALLY_PAID = "partially_paid", "Partially Paid"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="student_fees",
    )
    student = models.ForeignKey(
        "accounts.StudentProfile",
        on_delete=models.PROTECT,
        related_name="student_fees",
    )
    academic_session = models.ForeignKey(
        "academics.AcademicSession",
        on_delete=models.PROTECT,
        related_name="student_fees",
    )
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.PROTECT,
        related_name="student_fees",
    )
    original_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(ZERO)],
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=ZERO,
        validators=[MinValueValidator(ZERO)],
    )
    fine_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=ZERO,
        validators=[MinValueValidator(ZERO)],
    )
    payable_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(ZERO)],
    )
    due_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "academic_session", "fee_structure"],
                name="unique_student_fee_assignment",
            )
        ]

    @property
    def paid_amount(self):
        return self.payments.aggregate(total=Sum("amount"))["total"] or ZERO

    @property
    def outstanding_amount(self):
        return self.payable_amount - self.paid_amount

    def calculated_status(self):
        if self.paid_amount >= self.payable_amount:
            return self.Status.PAID
        if timezone.localdate() > self.due_date:
            return self.Status.OVERDUE
        if self.paid_amount > ZERO:
            return self.Status.PARTIALLY_PAID
        return self.Status.PENDING

    def clean(self):
        if self.student_id and self.student.user.organization_id != self.organization_id:
            raise ValidationError({"student": "Student must belong to organization."})

        if self.academic_session_id and (
            self.academic_session.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"academic_session": "Academic session must belong to organization."}
            )

        if self.fee_structure_id and (
            self.fee_structure.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"fee_structure": "Fee structure must belong to organization."}
            )

        for field in [
            "original_amount",
            "discount_amount",
            "fine_amount",
            "payable_amount",
        ]:
            if getattr(self, field) < ZERO:
                raise ValidationError({field: "Amount cannot be negative."})

        if self.discount_amount > self.original_amount + self.fine_amount:
            raise ValidationError(
                {"discount_amount": "Discount cannot exceed fee plus fine."}
            )

        expected_payable = (
            self.original_amount + self.fine_amount - self.discount_amount
        )
        if self.payable_amount != expected_payable:
            raise ValidationError(
                {"payable_amount": "Payable amount must match fee minus discount plus fine."}
            )

    def __str__(self):
        return f"{self.student} - {self.fee_structure}"


class FeeInstallment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    student_fee = models.ForeignKey(
        StudentFee,
        on_delete=models.CASCADE,
        related_name="installments",
    )
    name = models.CharField(max_length=100)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(ZERO)],
    )
    due_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    sequence = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["sequence", "due_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["student_fee", "sequence"],
                name="unique_fee_installment_sequence",
            )
        ]

    def clean(self):
        if self.amount < ZERO:
            raise ValidationError(
                {"amount": "Installment amount cannot be negative."}
            )

    def __str__(self):
        return f"{self.student_fee} - {self.name}"


class FeePayment(models.Model):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer"
        CHEQUE = "cheque", "Cheque"
        UPI = "upi", "UPI"
        OTHER = "other", "Other"

    organization = models.ForeignKey(
        "institutions.Organization",
        on_delete=models.CASCADE,
        related_name="fee_payments",
    )
    student_fee = models.ForeignKey(
        StudentFee,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    installment = models.ForeignKey(
        "FeeInstallment",
        on_delete=models.PROTECT,
        related_name="payments",
        null=True,
        blank=True,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    payment_date = models.DateField(default=timezone.localdate)
    payment_method = models.CharField(
        max_length=30,
        choices=Method.choices,
        default=Method.CASH,
    )
    reference_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_fee_payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-payment_date", "-created_at"]

    def clean(self):
        if self.student_fee_id and (
            self.student_fee.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"student_fee": "Student fee must belong to organization."}
            )

        if self.installment_id and (
            self.installment.student_fee_id != self.student_fee_id
        ):
            raise ValidationError(
                {"installment": "Installment must belong to student fee."}
            )

        if self.recorded_by_id and (
            self.recorded_by.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"recorded_by": "Recorder must belong to organization."}
            )

        if self.amount <= ZERO:
            raise ValidationError(
                {"amount": "Payment amount must be greater than zero."}
            )

        if self.student_fee_id:
            outstanding = self.student_fee.outstanding_amount
            if self.pk:
                existing = FeePayment.objects.filter(pk=self.pk).first()
                if existing:
                    outstanding += existing.amount

            if self.amount > outstanding:
                raise ValidationError(
                    {"amount": "Payment cannot exceed outstanding balance."}
                )

        if self.installment_id:
            installment_outstanding = (
                self.installment.amount
                - (
                    self.installment.payments.exclude(
                        pk=self.pk
                    ).aggregate(total=Sum("amount"))["total"]
                    or ZERO
                )
            )

            if self.amount > installment_outstanding:
                raise ValidationError(
                    {"amount": "Payment cannot exceed installment balance."}
                )

    def __str__(self):
        return f"{self.student_fee} - {self.amount}"
