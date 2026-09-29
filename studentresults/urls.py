from django.urls import path

from .views import (
    TeacherResultsSetupAPIView,
    TeacherExamCreateAPIView,
    TeacherExamStudentsAPIView,
    TeacherSaveExamMarksAPIView,
    TeacherExamListAPIView,
    TeacherPublishExamAPIView,
    StudentResultsAPIView,
    ParentStudentResultsAPIView,
    CollegeAdminResultsAPIView,
    CollegeAdminResultsSetupAPIView,
    CollegeAdminResultDetailAPIView,
)


urlpatterns = [
    path(
        "teacher/setup/",
        TeacherResultsSetupAPIView.as_view(),
        name="teacher-results-setup",
    ),
    path(
    "teacher/exams/create/",
    TeacherExamCreateAPIView.as_view(),
    name="teacher-exam-create",
),
    path(
    "teacher/exams/<int:exam_id>/students/",
    TeacherExamStudentsAPIView.as_view(),
    name="teacher-exam-students",
),

path(
    "teacher/exams/<int:exam_id>/marks/",
    TeacherSaveExamMarksAPIView.as_view(),
    name="teacher-save-exam-marks",
),
path(
    "teacher/exams/",
    TeacherExamListAPIView.as_view(),
    name="teacher-exam-list",
),
path(
    "teacher/exams/<int:exam_id>/publish/",
    TeacherPublishExamAPIView.as_view(),
    name="teacher-publish-exam",
),
path(
    "student/",
    StudentResultsAPIView.as_view(),
    name="student-results",
),
path(
    "parent/student/<int:student_id>/",
    ParentStudentResultsAPIView.as_view(),
    name="parent-student-results",
),
path(
    "college-admin/",
    CollegeAdminResultsAPIView.as_view(),
    name="college-admin-results",
),
path(
    "college-admin/setup/",
    CollegeAdminResultsSetupAPIView.as_view(),
    name="college-admin-results-setup",
),
path(
    "college-admin/<int:exam_id>/",
    CollegeAdminResultDetailAPIView.as_view(),
    name="college-admin-result-detail",
),
    
]
