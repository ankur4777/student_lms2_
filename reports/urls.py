from django.urls import path
from .views import (
    CollegeAdminCSVExportAPIView,
    CollegeAdminDetailedAnalyticsAPIView,
    CollegeAdminExcelExportAPIView,
    CollegeAdminPDFExportAPIView,
    CollegeAdminFilterOptionsAPIView,
    CollegeAdminOverviewAPIView,
)

urlpatterns = [
    path("college-admin/overview/", CollegeAdminOverviewAPIView.as_view(), name="college-admin-reports-overview"),
    path("college-admin/filters/", CollegeAdminFilterOptionsAPIView.as_view(), name="college-admin-reports-filters"),
    path("college-admin/details/", CollegeAdminDetailedAnalyticsAPIView.as_view(), name="college-admin-reports-details"),
    path("college-admin/export/csv/", CollegeAdminCSVExportAPIView.as_view(), name="college-admin-reports-export-csv"),
    path("college-admin/export/excel/", CollegeAdminExcelExportAPIView.as_view(), name="college-admin-reports-export-excel"),
    path("college-admin/export/pdf/", CollegeAdminPDFExportAPIView.as_view(), name="college-admin-reports-export-pdf"),
]
