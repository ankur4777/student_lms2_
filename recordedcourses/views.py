from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.http import FileResponse
import mimetypes
from django.db import IntegrityError, transaction
from django.utils import timezone
from academics.feature_access import (
    StudentClassFeaturePermission,
    parent_child_feature_is_enabled,
)

from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ParentProfile, StudentProfile
from academics.models import ParentStudent
from .models import RecordedCourse, RecordedCourseAccess, RecordedCoursePurchase, RecordedLesson


def college_admin_organization(user):
    if user.role != "college_admin" or not user.is_active:
        return None
    if not user.organization or not user.organization.is_active:
        return None
    return user.organization


def serialize_lesson(lesson):
    return {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "position": lesson.position,
        "is_active": lesson.is_active,
        "created_at": lesson.created_at,
        "updated_at": lesson.updated_at,
    }


def serialize_course(course, include_lessons=False):
    data = {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "price": course.price,
        "access_duration_days": course.access_duration_days,
        "is_active": course.is_active,
        "lesson_count": getattr(course, "lesson_count", course.lessons.count()),
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }
    if include_lessons:
        data["lessons"] = [serialize_lesson(lesson) for lesson in course.lessons.all()]
    return data


def parse_price(value):
    try:
        price = Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return price if price >= 0 else None


def parse_positive_int(value):
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def parse_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on"}


class CollegeAdminRecordedCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can access recorded courses."}, status=403)

        courses = RecordedCourse.objects.filter(organization=organization).prefetch_related("lessons")
        search = request.query_params.get("search", "").strip()
        if search:
            courses = courses.filter(title__icontains=search)
        return Response({"courses": [serialize_course(course) for course in courses]})

    def post(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can create recorded courses."}, status=403)

        title = str(request.data.get("title", "")).strip()
        price = parse_price(request.data.get("price"))
        duration = parse_positive_int(request.data.get("access_duration_days", 180))
        errors = {}
        if not title:
            errors["title"] = "Title is required."
        if price is None:
            errors["price"] = "Enter a valid non-negative price."
        if duration is None:
            errors["access_duration_days"] = "Access duration must be greater than zero."
        if errors:
            return Response(errors, status=400)

        try:
            course = RecordedCourse(
                organization=organization,
                title=title,
                description=str(request.data.get("description", "")).strip(),
                price=price,
                access_duration_days=duration,
                is_active=parse_bool(request.data.get("is_active"), True),
            )
            course.full_clean()
            course.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "A recorded course with these details already exists or is invalid."}, status=400)

        return Response({"message": "Recorded course created successfully.", "course": serialize_course(course)}, status=201)


class CollegeAdminRecordedCourseDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_course(self, user, course_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return RecordedCourse.objects.filter(id=course_id, organization=organization).prefetch_related("lessons").first()

    def get(self, request, course_id):
        course = self.get_course(request.user, course_id)
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)
        return Response({"course": serialize_course(course, include_lessons=True)})

    def patch(self, request, course_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can update recorded courses."}, status=403)

        course = RecordedCourse.objects.filter(id=course_id, organization=organization).first()
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)

        if "title" in request.data:
            title = str(request.data.get("title", "")).strip()
            if not title:
                return Response({"title": "Title is required."}, status=400)
            course.title = title
        if "description" in request.data:
            course.description = str(request.data.get("description", "")).strip()
        if "price" in request.data:
            price = parse_price(request.data.get("price"))
            if price is None:
                return Response({"price": "Enter a valid non-negative price."}, status=400)
            course.price = price
        if "access_duration_days" in request.data:
            duration = parse_positive_int(request.data.get("access_duration_days"))
            if duration is None:
                return Response({"access_duration_days": "Access duration must be greater than zero."}, status=400)
            course.access_duration_days = duration
        if "is_active" in request.data:
            course.is_active = parse_bool(request.data.get("is_active"))

        try:
            course.full_clean()
            course.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "Recorded course update is invalid."}, status=400)

        return Response({"message": "Recorded course updated successfully.", "course": serialize_course(course)})


class CollegeAdminRecordedCourseLessonsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_course(self, user, course_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return RecordedCourse.objects.filter(id=course_id, organization=organization).first()

    def get(self, request, course_id):
        course = self.get_course(request.user, course_id)
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)
        return Response({"lessons": [serialize_lesson(lesson) for lesson in course.lessons.all()]})

    def post(self, request, course_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can upload recorded lessons."}, status=403)

        course = RecordedCourse.objects.filter(id=course_id, organization=organization).first()
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)

        title = str(request.data.get("title", "")).strip()
        position = parse_positive_int(request.data.get("position"))
        video = request.FILES.get("video")
        errors = {}
        if not title:
            errors["title"] = "Title is required."
        if position is None:
            errors["position"] = "Position must be greater than zero."
        if not video:
            errors["video"] = "Video file is required."
        if errors:
            return Response(errors, status=400)

        try:
            with transaction.atomic():
                lesson = RecordedLesson(
                    course=course,
                    title=title,
                    description=str(request.data.get("description", "")).strip(),
                    position=position,
                    video=video,
                    is_active=parse_bool(request.data.get("is_active"), True),
                )
                lesson.full_clean()
                lesson.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "Lesson is invalid or that position is already in use."}, status=400)

        return Response({"message": "Recorded lesson uploaded successfully.", "lesson": serialize_lesson(lesson)}, status=201)


class CollegeAdminRecordedLessonDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_lesson(self, user, lesson_id):
        organization = college_admin_organization(user)
        if not organization:
            return None
        return RecordedLesson.objects.select_related("course").filter(
            id=lesson_id, course__organization=organization
        ).first()

    def patch(self, request, lesson_id):
        lesson = self.get_lesson(request.user, lesson_id)
        if not lesson:
            return Response({"detail": "Recorded lesson not found."}, status=404)

        if "title" in request.data:
            title = str(request.data.get("title", "")).strip()
            if not title:
                return Response({"title": "Title is required."}, status=400)
            lesson.title = title
        if "description" in request.data:
            lesson.description = str(request.data.get("description", "")).strip()
        if "position" in request.data:
            position = parse_positive_int(request.data.get("position"))
            if position is None:
                return Response({"position": "Position must be greater than zero."}, status=400)
            lesson.position = position
        if "is_active" in request.data:
            lesson.is_active = parse_bool(request.data.get("is_active"))
        if request.FILES.get("video"):
            lesson.video = request.FILES["video"]

        try:
            lesson.full_clean()
            lesson.save()
        except (ValidationError, IntegrityError):
            return Response({"detail": "Lesson update is invalid or that position is already in use."}, status=400)

        return Response({"message": "Recorded lesson updated successfully.", "lesson": serialize_lesson(lesson)})


def student_profile_for_user(user):
    if user.role != "student" or not user.is_active or not user.organization:
        return None
    return StudentProfile.objects.filter(user=user, user__organization=user.organization).first()


def parent_profile_for_user(user):
    if user.role != "parent" or not user.is_active or not user.organization:
        return None
    return ParentProfile.objects.filter(user=user, user__organization=user.organization).first()


def serialize_catalog_course(course, student=None):
    access = None
    if student:
        access = RecordedCourseAccess.objects.filter(
            organization=student.user.organization, course=course, student=student
        ).first()
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "price": course.price,
        "access_duration_days": course.access_duration_days,
        "lesson_count": course.lessons.filter(is_active=True).count(),
        "has_access": bool(access and access.has_access),
        "access_expires_at": access.expires_at if access and access.has_access else None,
    }


def serialize_purchase(purchase):
    return {
        "id": purchase.id,
        "course": {"id": purchase.course_id, "title": purchase.course.title},
        "student": {
            "id": purchase.student_id,
            "name": str(purchase.student),
            "admission_number": purchase.student.admission_number,
        },
        "buyer_type": purchase.buyer_type,
        "amount": purchase.amount,
        "status": purchase.status,
        "payment_method": purchase.payment_method,
        "payment_reference": purchase.payment_reference,
        "paid_at": purchase.paid_at,
        "created_at": purchase.created_at,
    }


class StudentRecordedCourseCatalogAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_courses"

    def get(self, request):
        student = student_profile_for_user(request.user)
        if not student:
            return Response({"detail": "Only students can access this catalog."}, status=403)
        courses = RecordedCourse.objects.filter(
            organization=request.user.organization, is_active=True
        ).prefetch_related("lessons")
        return Response({"courses": [serialize_catalog_course(course, student) for course in courses]})


class ParentRecordedCourseCatalogAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent = parent_profile_for_user(request.user)
        if not parent:
            return Response({"detail": "Only parents can access this catalog."}, status=403)
        children = ParentStudent.objects.filter(
            parent=parent, student__user__organization=request.user.organization
        ).select_related("student__user")
        courses = RecordedCourse.objects.filter(
            organization=request.user.organization, is_active=True
        ).prefetch_related("lessons")
        return Response({
            "children": [
                {
                    "id": link.student_id,
                    "name": str(link.student),
                    "admission_number": link.student.admission_number,
                    "parent_feature_enabled": (
                        parent_child_feature_is_enabled(
                            request.user,
                            link.student_id,
                            "recorded_courses",
                        )
                        is not False
                    ),
                }
                for link in children
            ],
            "courses": [serialize_catalog_course(course) for course in courses],
        })


class StudentRecordedCoursePurchasesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_courses"

    def get(self, request):
        student = student_profile_for_user(request.user)
        if not student:
            return Response({"detail": "Only students can access purchases."}, status=403)
        purchases = RecordedCoursePurchase.objects.filter(
            organization=request.user.organization, purchased_by_student=student, student=student
        ).select_related("course", "student__user")
        return Response({"purchases": [serialize_purchase(p) for p in purchases]})

    def post(self, request):
        student = student_profile_for_user(request.user)
        if not student:
            return Response({"detail": "Only students can create purchases."}, status=403)
        course = RecordedCourse.objects.filter(
            id=request.data.get("course_id"), organization=request.user.organization, is_active=True
        ).first()
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)
        existing_access = RecordedCourseAccess.objects.filter(
            organization=request.user.organization, course=course, student=student
        ).first()
        if existing_access and existing_access.has_access:
            return Response({"detail": "You already have active access to this course."}, status=400)
        purchase = RecordedCoursePurchase.objects.create(
            organization=request.user.organization,
            course=course,
            student=student,
            buyer_type=RecordedCoursePurchase.BuyerType.STUDENT,
            purchased_by_student=student,
            amount=course.price,
            status=RecordedCoursePurchase.Status.PENDING,
        )
        return Response({"message": "Purchase created. Access will be granted after payment verification.", "purchase": serialize_purchase(purchase)}, status=201)


class ParentRecordedCoursePurchasesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        parent = parent_profile_for_user(request.user)
        if not parent:
            return Response({"detail": "Only parents can access purchases."}, status=403)
        purchases = RecordedCoursePurchase.objects.filter(
            organization=request.user.organization, purchased_by_parent=parent
        ).select_related("course", "student__user")
        return Response({"purchases": [serialize_purchase(p) for p in purchases]})

    def post(self, request):
        parent = parent_profile_for_user(request.user)
        if not parent:
            return Response({"detail": "Only parents can create purchases."}, status=403)
        link = ParentStudent.objects.filter(
            parent=parent,
            student_id=request.data.get("student_id"),
            student__user__organization=request.user.organization,
        ).select_related("student__user").first()
        if not link:
            return Response({"detail": "Selected student is not linked to this parent."}, status=403)

        if parent_child_feature_is_enabled(
            request.user,
            link.student_id,
            "recorded_courses",
        ) is False:
            return Response(
                {
                    "detail": (
                        "This feature has been restricted for parents "
                        "of this class."
                    )
                },
                status=403,
            )

        course = RecordedCourse.objects.filter(
            id=request.data.get("course_id"), organization=request.user.organization, is_active=True
        ).first()
        if not course:
            return Response({"detail": "Recorded course not found."}, status=404)
        existing_access = RecordedCourseAccess.objects.filter(
            organization=request.user.organization, course=course, student=link.student
        ).first()
        if existing_access and existing_access.has_access:
            return Response({"detail": "This student already has active access to this course."}, status=400)
        purchase = RecordedCoursePurchase.objects.create(
            organization=request.user.organization,
            course=course,
            student=link.student,
            buyer_type=RecordedCoursePurchase.BuyerType.PARENT,
            purchased_by_parent=parent,
            amount=course.price,
            status=RecordedCoursePurchase.Status.PENDING,
        )
        return Response({"message": "Purchase created. Access will be granted after payment verification.", "purchase": serialize_purchase(purchase)}, status=201)


class CollegeAdminRecordedCoursePurchasesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can access recorded course purchases."}, status=403)
        purchases = RecordedCoursePurchase.objects.filter(
            organization=organization
        ).select_related("course", "student__user", "purchased_by_parent__user", "purchased_by_student__user")
        return Response({"purchases": [serialize_purchase(p) for p in purchases]})


class CollegeAdminVerifyRecordedCoursePurchaseAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, purchase_id):
        organization = college_admin_organization(request.user)
        if not organization:
            return Response({"detail": "Only college admins can verify purchases."}, status=403)
        purchase = RecordedCoursePurchase.objects.select_related("course", "student__user").filter(
            id=purchase_id, organization=organization
        ).first()
        if not purchase:
            return Response({"detail": "Purchase not found."}, status=404)
        if purchase.status == RecordedCoursePurchase.Status.PAID:
            return Response({"detail": "Purchase is already verified."}, status=400)

        payment_method = str(request.data.get("payment_method", "")).strip()
        payment_reference = str(request.data.get("payment_reference", "")).strip()
        if not payment_method:
            return Response({"payment_method": "Payment method is required."}, status=400)

        with transaction.atomic():
            purchase.status = RecordedCoursePurchase.Status.PAID
            purchase.payment_method = payment_method
            purchase.payment_reference = payment_reference
            purchase.paid_at = timezone.now()
            purchase.save()

            access, created = RecordedCourseAccess.objects.get_or_create(
                organization=organization,
                course=purchase.course,
                student=purchase.student,
                defaults={"purchase": purchase, "starts_at": timezone.now(), "is_active": True},
            )
            if not created:
                access.purchase = purchase
                access.starts_at = timezone.now()
                access.expires_at = timezone.now() + timedelta(days=purchase.course.access_duration_days)
                access.is_active = True
                access.revoked_at = None
                access.revoke_reason = ""
                access.save()

        return Response({
            "message": "Payment verified and course access granted.",
            "purchase": serialize_purchase(purchase),
            "access": {"id": access.id, "expires_at": access.expires_at, "is_active": access.has_access},
        })



def active_recorded_course_access(user, course_id):
    student = student_profile_for_user(user)
    if not student:
        return None, None
    access = RecordedCourseAccess.objects.select_related("course").filter(
        organization=user.organization,
        course_id=course_id,
        course__organization=user.organization,
        course__is_active=True,
        student=student,
        is_active=True,
        revoked_at__isnull=True,
        starts_at__lte=timezone.now(),
    ).first()
    if not access or not access.has_access:
        return student, None
    return student, access


class StudentPurchasedRecordedCoursesAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_courses"

    def get(self, request):
        student = student_profile_for_user(request.user)
        if not student:
            return Response({"detail": "Only students can access purchased recorded courses."}, status=403)
        accesses = RecordedCourseAccess.objects.select_related("course").filter(
            organization=request.user.organization,
            student=student,
            course__organization=request.user.organization,
            course__is_active=True,
            is_active=True,
            revoked_at__isnull=True,
            starts_at__lte=timezone.now(),
        ).prefetch_related("course__lessons")
        courses = []
        for access in accesses:
            if not access.has_access:
                continue
            courses.append({
                "id": access.course_id,
                "title": access.course.title,
                "description": access.course.description,
                "access_expires_at": access.expires_at,
                "lessons": [
                    serialize_lesson(lesson)
                    for lesson in access.course.lessons.all()
                    if lesson.is_active
                ],
            })
        return Response({"courses": courses})


class StudentPurchasedRecordedCourseDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_courses"

    def get(self, request, course_id):
        student, access = active_recorded_course_access(request.user, course_id)
        if not student:
            return Response({"detail": "Only students can access purchased recorded courses."}, status=403)
        if not access:
            return Response({"detail": "You do not have active access to this recorded course."}, status=403)
        lessons = access.course.lessons.filter(is_active=True)
        return Response({
            "course": {
                "id": access.course_id,
                "title": access.course.title,
                "description": access.course.description,
                "access_expires_at": access.expires_at,
                "lessons": [serialize_lesson(lesson) for lesson in lessons],
            }
        })


class StudentRecordedLessonPlaybackAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "recorded_courses"

    def get(self, request, lesson_id):
        student = student_profile_for_user(request.user)
        if not student:
            return Response({"detail": "Only students can play purchased recorded lessons."}, status=403)
        lesson = RecordedLesson.objects.select_related("course").filter(
            id=lesson_id,
            is_active=True,
            course__organization=request.user.organization,
            course__is_active=True,
        ).first()
        if not lesson:
            return Response({"detail": "Recorded lesson not found."}, status=404)
        access = RecordedCourseAccess.objects.filter(
            organization=request.user.organization,
            course=lesson.course,
            student=student,
            is_active=True,
            revoked_at__isnull=True,
            starts_at__lte=timezone.now(),
        ).first()
        if not access or not access.has_access:
            return Response({"detail": "You do not have active access to this recorded lesson."}, status=403)
        if not lesson.video:
            return Response({"detail": "Recorded lesson video is unavailable."}, status=404)
        try:
            file_handle = lesson.video.open("rb")
        except (FileNotFoundError, OSError):
            return Response({"detail": "Recorded lesson video is unavailable."}, status=404)
        content_type = mimetypes.guess_type(lesson.video.name)[0] or "application/octet-stream"
        response = FileResponse(file_handle, content_type=content_type)
        response["Content-Disposition"] = 'inline; filename="recorded-lesson"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response
