from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User,
    TeacherProfile,
    StudentProfile,
    ParentProfile,
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('LMS Details', {
            'fields': ('role', 'organization'),
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('LMS Details', {
            'fields': ('role', 'organization'),
        }),
    )

    list_display = (
        'username',
        'email',
        'first_name',
        'last_name',
        'role',
        'organization',
        'is_active',
        'is_staff',
    )

    list_filter = (
        'role',
        'organization',
        'is_active',
        'is_staff',
        'is_superuser',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        # Django superuser / platform admin can see everyone
        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        # College admin can see only users from own college
        if request.user.organization:
            return qs.filter(
                organization=request.user.organization
            )

        return qs.none()


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'employee_id',
        'phone',
        'qualification',
        'joining_date',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                user__organization=request.user.organization
            )

        return qs.none()


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'admission_number',
        'phone',
        'date_of_birth',
        'admission_date',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                user__organization=request.user.organization
            )

        return qs.none()


@admin.register(ParentProfile)
class ParentProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'phone',
        'occupation',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                user__organization=request.user.organization
            )

        return qs.none()