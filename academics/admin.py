from django.contrib import admin
from .models import (
    AcademicSession,
    ClassRoom,
    Section,
    Subject,
    TeacherAssignment,
    StudentEnrollment,
    ParentStudent,
)


class OrganizationFilteredAdmin(admin.ModelAdmin):

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
            if hasattr(obj, 'organization'):
                obj.organization = request.user.organization

        super().save_model(request, obj, form, change)


@admin.register(AcademicSession)
class AcademicSessionAdmin(OrganizationFilteredAdmin):
    list_display = (
        'name',
        'organization',
        'start_date',
        'end_date',
        'is_active',
    )


@admin.register(ClassRoom)
class ClassRoomAdmin(OrganizationFilteredAdmin):
    list_display = (
        'name',
        'organization',
        'academic_session',
    )


@admin.register(Section)
class SectionAdmin(OrganizationFilteredAdmin):
    list_display = (
        'name',
        'organization',
        'classroom',
    )


@admin.register(Subject)
class SubjectAdmin(OrganizationFilteredAdmin):
    list_display = (
        'name',
        'code',
        'organization',
        'classroom',
    )


@admin.register(TeacherAssignment)
class TeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'teacher',
        'subject',
        'section',
        'is_active',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                section__organization=request.user.organization
            )

        return qs.none()


@admin.register(StudentEnrollment)
class StudentEnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        'student',
        'section',
        'roll_number',
        'is_active',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                section__organization=request.user.organization
            )

        return qs.none()


@admin.register(ParentStudent)
class ParentStudentAdmin(admin.ModelAdmin):
    list_display = (
        'parent',
        'student',
        'relationship',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                student__user__organization=request.user.organization
            )

        return qs.none()