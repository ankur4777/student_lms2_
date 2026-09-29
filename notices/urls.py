from django.urls import path

from .views import (
    CollegeAdminNoticeDetailAPIView,
    CollegeAdminNoticeFilterOptionsAPIView,
    CollegeAdminNoticeListCreateAPIView,
    RelevantNoticesAPIView,
)

urlpatterns = [
    path(
        "college-admin/",
        CollegeAdminNoticeListCreateAPIView.as_view(),
        name="college-admin-notice-list-create",
    ),
    path(
        "college-admin/filters/",
        CollegeAdminNoticeFilterOptionsAPIView.as_view(),
        name="college-admin-notice-filter-options",
    ),
    path(
        "college-admin/<int:pk>/",
        CollegeAdminNoticeDetailAPIView.as_view(),
        name="college-admin-notice-detail",
    ),
    path(
        "feed/",
        RelevantNoticesAPIView.as_view(),
        name="relevant-notices",
    ),
]
