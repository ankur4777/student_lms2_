from rest_framework.permissions import BasePermission

from .models import ClassFeatureAccess, ParentStudent, StudentEnrollment


FEATURE_DEFINITIONS = [
    {"key": key, "label": label}
    for key, label in ClassFeatureAccess.Feature.choices
]

PARENT_FEATURE_KEYS = {
    "attendance",
    "assignments",
    "results",
    "fees",
    "recorded_courses",
}


def get_active_student_enrollment(user):
    if (
        not user
        or not getattr(user, "is_authenticated", False)
        or user.role != "student"
        or not user.is_active
        or not user.organization
        or not user.organization.is_active
    ):
        return None

    return get_student_profile_active_enrollment(
        getattr(user, "student_profile", None),
        user.organization,
    )


def get_student_profile_active_enrollment(student_profile, organization):
    if not student_profile or not organization or not organization.is_active:
        return None

    return (
        StudentEnrollment.objects.filter(
            student=student_profile,
            student__user__organization=organization,
            is_active=True,
            section__organization=organization,
            section__classroom__organization=organization,
            section__classroom__academic_session__organization=organization,
        )
        .select_related(
            "section",
            "section__classroom",
            "section__classroom__academic_session",
        )
        .order_by(
            "-section__classroom__academic_session__is_active",
            "-enrolled_at",
            "-id",
        )
        .first()
    )


def get_student_feature_map(user):
    feature_map = {
        definition["key"]: False
        for definition in FEATURE_DEFINITIONS
    }

    enrollment = get_active_student_enrollment(user)

    if not enrollment:
        return feature_map, None

    classroom = enrollment.section.classroom

    feature_map = {
        definition["key"]: True
        for definition in FEATURE_DEFINITIONS
    }

    overrides = ClassFeatureAccess.objects.filter(
        organization=user.organization,
        classroom=classroom,
        feature_key__in=feature_map.keys(),
    ).values_list("feature_key", "is_enabled")

    for feature_key, is_enabled in overrides:
        feature_map[feature_key] = is_enabled

    return feature_map, classroom


def get_parent_child_feature_map(user, student_id):
    feature_map = {
        definition["key"]: True
        for definition in FEATURE_DEFINITIONS
        if definition["key"] in PARENT_FEATURE_KEYS
    }

    if (
        not user
        or not getattr(user, "is_authenticated", False)
        or user.role != "parent"
        or not user.is_active
        or not user.organization
        or not user.organization.is_active
    ):
        return None, None

    link = (
        ParentStudent.objects.filter(
            parent__user=user,
            parent__user__organization=user.organization,
            student_id=student_id,
            student__user__organization=user.organization,
        )
        .select_related(
            "student",
            "student__user",
        )
        .first()
    )

    if not link:
        return None, None

    enrollment = get_student_profile_active_enrollment(
        link.student,
        user.organization,
    )

    if not enrollment:
        return feature_map, None

    classroom = enrollment.section.classroom

    overrides = ClassFeatureAccess.objects.filter(
        organization=user.organization,
        classroom=classroom,
        feature_key__in=feature_map.keys(),
    ).values_list("feature_key", "parent_enabled")

    for feature_key, parent_enabled in overrides:
        feature_map[feature_key] = parent_enabled

    return feature_map, classroom


def student_feature_is_enabled(user, feature_key):
    valid_keys = {
        definition["key"]
        for definition in FEATURE_DEFINITIONS
    }

    if feature_key not in valid_keys:
        return False

    if getattr(user, "role", None) != "student":
        return True

    feature_map, classroom = get_student_feature_map(user)

    if not classroom:
        return False

    return feature_map.get(feature_key, False)


def parent_child_feature_is_enabled(user, student_id, feature_key):
    if feature_key not in PARENT_FEATURE_KEYS:
        return True

    if getattr(user, "role", None) != "parent":
        return True

    feature_map, classroom = get_parent_child_feature_map(
        user,
        student_id,
    )

    if feature_map is None:
        return None

    if not classroom:
        return None

    return feature_map.get(feature_key, True)


class StudentClassFeaturePermission(BasePermission):
    message = "This feature has been restricted for your class."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if getattr(user, "role", None) != "student":
            return True

        feature_key = getattr(view, "student_feature_key", None)

        if not feature_key:
            return True

        return student_feature_is_enabled(user, feature_key)


class ParentChildFeaturePermission(BasePermission):
    message = "This feature has been restricted for parents of this class."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if getattr(user, "role", None) != "parent":
            return True

        feature_key = getattr(view, "parent_feature_key", None)

        if not feature_key:
            return True

        student_id = view.kwargs.get("student_id")

        if student_id is None:
            field_name = getattr(
                view,
                "parent_student_id_field",
                "student_id",
            )
            student_id = request.data.get(field_name)

        if student_id in (None, ""):
            return True

        allowed = parent_child_feature_is_enabled(
            user,
            student_id,
            feature_key,
        )

        # Let the view handle unlinked/invalid students so it can return
        # its existing authorization error without leaking relationship data.
        if allowed is None:
            return True

        return allowed
