from django.urls import path

from .views import (
    StudentAttendanceAPIView,
    StudentAttendanceSummaryAPIView,
)
from .views import (
    CollegeAdminAttendanceSessionDetailAPIView,
    CollegeAdminAttendanceSessionsAPIView,
    CollegeAdminAttendanceSetupAPIView,
    CollegeAdminAttendanceSummaryAPIView,
    CollegeAdminStudentAttendanceAPIView,
    TeacherAttendanceSetupAPIView,
    TeacherSaveAttendanceAPIView,
    TeacherAttendanceSessionAPIView,
    ParentStudentAttendanceAPIView,
)


urlpatterns = [
    path(
        'student/',
        StudentAttendanceAPIView.as_view(),
        name='student-attendance'
    ),

    path(
        'student/summary/',
        StudentAttendanceSummaryAPIView.as_view(),
        name='student-attendance-summary'
    ),
    path(
    'teacher/setup/',
    TeacherAttendanceSetupAPIView.as_view(),
    name='teacher-attendance-setup'
),
    path(
    'teacher/save/',
    TeacherSaveAttendanceAPIView.as_view(),
    name='teacher-save-attendance'
),
    path(
    'teacher/session/',
    TeacherAttendanceSessionAPIView.as_view(),
    name='teacher-attendance-session'
),
    path(
        "parent/student/<int:student_id>/",
        ParentStudentAttendanceAPIView.as_view(),
        name="parent-student-attendance",
    ),
    path(
        "college-admin/setup/",
        CollegeAdminAttendanceSetupAPIView.as_view(),
        name="college-admin-attendance-setup",
    ),
    path(
        "college-admin/sessions/",
        CollegeAdminAttendanceSessionsAPIView.as_view(),
        name="college-admin-attendance-sessions",
    ),
    path(
        "college-admin/sessions/<int:session_id>/",
        CollegeAdminAttendanceSessionDetailAPIView.as_view(),
        name="college-admin-attendance-session-detail",
    ),
    path(
        "college-admin/summary/",
        CollegeAdminAttendanceSummaryAPIView.as_view(),
        name="college-admin-attendance-summary",
    ),
    path(
        "college-admin/students/<int:student_id>/",
        CollegeAdminStudentAttendanceAPIView.as_view(),
        name="college-admin-student-attendance",
    ),
]
