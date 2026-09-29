from django.contrib import admin

from .models import (
    FeeComponent,
    FeeInstallment,
    FeePayment,
    FeeStructure,
    StudentFee,
)


class FeeComponentInline(admin.TabularInline):
    model = FeeComponent
    extra = 0


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organization",
        "academic_session",
        "class_room",
        "total_amount",
        "is_active",
    )
    list_filter = ("organization", "academic_session", "is_active")
    search_fields = ("name", "class_room__name")
    inlines = [FeeComponentInline]


@admin.register(FeeComponent)
class FeeComponentAdmin(admin.ModelAdmin):
    list_display = ("name", "fee_structure", "amount")
    search_fields = ("name", "fee_structure__name")


@admin.register(StudentFee)
class StudentFeeAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "organization",
        "fee_structure",
        "payable_amount",
        "due_date",
        "status",
    )
    list_filter = ("organization", "academic_session", "status")
    search_fields = ("student__user__username", "fee_structure__name")


@admin.register(FeeInstallment)
class FeeInstallmentAdmin(admin.ModelAdmin):
    list_display = ("student_fee", "name", "amount", "due_date", "status")
    list_filter = ("status",)


@admin.register(FeePayment)
class FeePaymentAdmin(admin.ModelAdmin):
    list_display = (
        "student_fee",
        "organization",
        "amount",
        "payment_date",
        "payment_method",
        "installment",
        "recorded_by",
    )
    list_filter = ("organization", "payment_method", "payment_date")
    search_fields = (
        "student_fee__student__user__username",
        "reference_number",
    )
