from django.urls import path

from .views import (
    CollegeAdminRecordedCourseDetailAPIView,
    CollegeAdminRecordedCourseLessonsAPIView,
    CollegeAdminRecordedCoursesAPIView,
    CollegeAdminRecordedLessonDetailAPIView,
    CollegeAdminRecordedCoursePurchasesAPIView,
    CollegeAdminVerifyRecordedCoursePurchaseAPIView,
    ParentRecordedCourseCatalogAPIView,
    ParentRecordedCoursePurchasesAPIView,
    StudentRecordedCourseCatalogAPIView,
    StudentRecordedCoursePurchasesAPIView,
    StudentPurchasedRecordedCoursesAPIView,
    StudentPurchasedRecordedCourseDetailAPIView,
    StudentRecordedLessonPlaybackAPIView,
)

urlpatterns = [
    path("college-admin/courses/", CollegeAdminRecordedCoursesAPIView.as_view(), name="college-admin-recorded-courses"),
    path("college-admin/courses/<int:course_id>/", CollegeAdminRecordedCourseDetailAPIView.as_view(), name="college-admin-recorded-course-detail"),
    path("college-admin/courses/<int:course_id>/lessons/", CollegeAdminRecordedCourseLessonsAPIView.as_view(), name="college-admin-recorded-course-lessons"),
    path("college-admin/lessons/<int:lesson_id>/", CollegeAdminRecordedLessonDetailAPIView.as_view(), name="college-admin-recorded-lesson-detail"),
    path("college-admin/purchases/", CollegeAdminRecordedCoursePurchasesAPIView.as_view(), name="college-admin-recorded-purchases"),
    path("college-admin/purchases/<int:purchase_id>/verify/", CollegeAdminVerifyRecordedCoursePurchaseAPIView.as_view(), name="college-admin-verify-recorded-purchase"),
    path("student/catalog/", StudentRecordedCourseCatalogAPIView.as_view(), name="student-recorded-course-catalog"),
    path("student/purchases/", StudentRecordedCoursePurchasesAPIView.as_view(), name="student-recorded-course-purchases"),
    path("student/my-courses/", StudentPurchasedRecordedCoursesAPIView.as_view(), name="student-purchased-recorded-courses"),
    path("student/my-courses/<int:course_id>/", StudentPurchasedRecordedCourseDetailAPIView.as_view(), name="student-purchased-recorded-course-detail"),
    path("student/lessons/<int:lesson_id>/play/", StudentRecordedLessonPlaybackAPIView.as_view(), name="student-recorded-lesson-playback"),
    path("parent/catalog/", ParentRecordedCourseCatalogAPIView.as_view(), name="parent-recorded-course-catalog"),
    path("parent/purchases/", ParentRecordedCoursePurchasesAPIView.as_view(), name="parent-recorded-course-purchases"),
]
