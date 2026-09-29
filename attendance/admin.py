from django.contrib import admin
from .models import AttendanceSession, StudentAttendance


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = (
        'subject',
        'section',
        'teacher',
        'date',
        'start_time',
        'end_time',
        'organization',
    )

    list_filter = (
        'organization',
        'date',
        'section',
        'subject',
    )

    search_fields = (
        'subject__name',
        'section__name',
        'teacher__user__username',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                organization=request.user.organization
            )

        return qs.none()

    def save_model(self, request, obj, form, change):
        if not request.user.is_superuser and request.user.role != 'platform_admin':
            obj.organization = request.user.organization

        super().save_model(request, obj, form, change)


@admin.register(StudentAttendance)
class StudentAttendanceAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'attendance_session',
        'status',
        'marked_at',
    )

    list_filter = (
        'status',
        'attendance_session__date',
    )

    search_fields = (
        'student__user__username',
        'student__admission_number',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                attendance_session__organization=request.user.organization
            )

        return qs.none()