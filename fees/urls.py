from django.urls import path

from .views import (
    CollegeAdminFeeSetupAPIView,
    CollegeAdminFeeStructureDetailAPIView,
    CollegeAdminFeeStructuresAPIView,
    CollegeAdminAssignClassFeesAPIView,
    CollegeAdminClassStudentsAPIView,
    CollegeAdminStudentFeeDetailAPIView,
    CollegeAdminStudentFeeInstallmentsAPIView,
    CollegeAdminStudentFeePaymentsAPIView,
    CollegeAdminStudentFeesAPIView,
    StudentFeesAPIView,
    ParentStudentFeesAPIView,
    FeeInvoicePDFAPIView,
    FeeReceiptPDFAPIView,
)


urlpatterns = [
    path("documents/invoice/<int:student_fee_id>/", FeeInvoicePDFAPIView.as_view(), name="fee-invoice-pdf"),
    path("documents/receipt/<int:payment_id>/", FeeReceiptPDFAPIView.as_view(), name="fee-receipt-pdf"),
    path("student/", StudentFeesAPIView.as_view(), name="student-fees"),
    path("parent/student/<int:student_id>/", ParentStudentFeesAPIView.as_view(), name="parent-student-fees"),
    path(
        "college-admin/setup/",
        CollegeAdminFeeSetupAPIView.as_view(),
        name="college-admin-fee-setup",
    ),
    path(
        "college-admin/structures/",
        CollegeAdminFeeStructuresAPIView.as_view(),
        name="college-admin-fee-structures",
    ),
    path(
        "college-admin/structures/<int:structure_id>/",
        CollegeAdminFeeStructureDetailAPIView.as_view(),
        name="college-admin-fee-structure-detail",
    ),
    path(
        "college-admin/student-fees/",
        CollegeAdminStudentFeesAPIView.as_view(),
        name="college-admin-student-fees",
    ),
    path(
        "college-admin/class-students/",
        CollegeAdminClassStudentsAPIView.as_view(),
        name="college-admin-class-students",
    ),
    path(
        "college-admin/assign-class/",
        CollegeAdminAssignClassFeesAPIView.as_view(),
        name="college-admin-assign-class-fees",
    ),
    path(
        "college-admin/student-fees/<int:student_fee_id>/",
        CollegeAdminStudentFeeDetailAPIView.as_view(),
        name="college-admin-student-fee-detail",
    ),
    path(
        "college-admin/student-fees/<int:student_fee_id>/installments/",
        CollegeAdminStudentFeeInstallmentsAPIView.as_view(),
        name="college-admin-student-fee-installments",
    ),
    path(
        "college-admin/student-fees/<int:student_fee_id>/payments/",
        CollegeAdminStudentFeePaymentsAPIView.as_view(),
        name="college-admin-student-fee-payments",
    ),
]
