from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import ParentStudent, StudentEnrollment
from .models import Notice
from .serializers import NoticeSerializer


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active or not user.organization_id:
        return None
    return user.organization


def current_notice_queryset(user):
    now = timezone.now()
    base = Notice.objects.filter(
        organization=user.organization,
        is_active=True,
        publish_at__lte=now,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))

    if user.role == "student":
        section_ids = StudentEnrollment.objects.filter(
            student__user=user,
            is_active=True,
        ).values_list("section_id", flat=True)
        class_ids = StudentEnrollment.objects.filter(
            student__user=user,
            is_active=True,
        ).values_list("section__classroom_id", flat=True)
        return base.filter(
            Q(audience=Notice.Audience.EVERYONE)
            | Q(audience=Notice.Audience.STUDENTS)
            | Q(audience=Notice.Audience.CLASS, classroom_id__in=class_ids)
            | Q(audience=Notice.Audience.SECTION, section_id__in=section_ids)
        ).distinct()

    if user.role == "teacher":
        return base.filter(
            Q(audience=Notice.Audience.EVERYONE)
            | Q(audience=Notice.Audience.TEACHERS)
        )

    if user.role == "parent":
        linked_section_ids = StudentEnrollment.objects.filter(
            student__parent_links__parent__user=user,
            is_active=True,
        ).values_list("section_id", flat=True)
        linked_class_ids = StudentEnrollment.objects.filter(
            student__parent_links__parent__user=user,
            is_active=True,
        ).values_list("section__classroom_id", flat=True)
        return base.filter(
            Q(audience=Notice.Audience.EVERYONE)
            | Q(audience=Notice.Audience.PARENTS)
            | Q(audience=Notice.Audience.CLASS, classroom_id__in=linked_class_ids)
            | Q(audience=Notice.Audience.SECTION, section_id__in=linked_section_ids)
        ).distinct()

    return base.none()


class CollegeAdminNoticeListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "College admin access required."}, status=403)

        notices = Notice.objects.filter(organization=organization).select_related(
            "classroom", "section", "created_by"
        )
        serializer = NoticeSerializer(notices, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "College admin access required."}, status=403)

        serializer = NoticeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        notice = serializer.save()
        return Response(
            NoticeSerializer(notice, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CollegeAdminNoticeDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        organization = college_admin_organization(request.user)
        if not organization:
            return None, Response({"detail": "College admin access required."}, status=403)

        notice = Notice.objects.filter(
            pk=pk,
            organization=organization,
        ).select_related("classroom", "section", "created_by").first()

        if not notice:
            return None, Response({"detail": "Notice not found."}, status=404)

        return notice, None

    def get(self, request, pk):
        notice, error = self.get_object(request, pk)
        if error:
            return error
        return Response(NoticeSerializer(notice, context={"request": request}).data)

    def patch(self, request, pk):
        notice, error = self.get_object(request, pk)
        if error:
            return error

        serializer = NoticeSerializer(
            notice,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(NoticeSerializer(updated, context={"request": request}).data)

    def delete(self, request, pk):
        notice, error = self.get_object(request, pk)
        if error:
            return error
        notice.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CollegeAdminNoticeFilterOptionsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "College admin access required."}, status=403)

        return Response({
            "classes": list(
                organization.classrooms.values("id", "name", "academic_session_id")
            ),
            "sections": list(
                organization.sections.values("id", "name", "classroom_id")
            ),
        })


class RelevantNoticesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in {"student", "teacher", "parent"}:
            return Response({"detail": "Student, teacher, or parent access required."}, status=403)
        if not request.user.organization_id:
            return Response([])

        notices = current_notice_queryset(request.user).select_related(
            "classroom", "section", "created_by"
        )
        return Response(
            NoticeSerializer(notices, many=True, context={"request": request}).data
        )
