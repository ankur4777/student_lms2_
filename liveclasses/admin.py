from urllib import request

from django.contrib import admin
from .models import LiveClass
from .models import LiveClass, LiveClassRecording


@admin.register(LiveClass)
class LiveClassAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'organization',
        'teacher_assignment',
        'class_date',
        'start_time',
        'end_time',
        'status',
    )

    list_filter = (
        'organization',
        'status',
        'class_date',
    )

    search_fields = (
        'title',
        'teacher_assignment__teacher__user__username',
        'teacher_assignment__subject__name',
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

@admin.register(LiveClassRecording)
class LiveClassRecordingAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'live_class',
        'uploaded_by',
        'is_available',
        'uploaded_at',
    )

    list_filter = (
        'is_available',
        'uploaded_at',
    )

    search_fields = (
        'title',
        'live_class__title',
        'uploaded_by__user__username',
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser or request.user.role == 'platform_admin':
            return qs

        if request.user.organization:
            return qs.filter(
                live_class__organization=request.user.organization
            )

        return qs.none()