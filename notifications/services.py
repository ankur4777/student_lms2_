from academics.models import ParentStudent, StudentEnrollment
from accounts.models import User
from studentresults.models import StudentResult

from .models import Notification


def create_notification(
    *,
    organization,
    user,
    title,
    message,
    notification_type,
    related_url=None,
):
    if not organization or not user:
        return None

    notification, _created = Notification.objects.get_or_create(
        organization=organization,
        user=user,
        title=title,
        message=message,
        notification_type=notification_type,
        related_url=related_url,
        defaults={
            "is_read": False,
        },
    )

    return notification


def notify_assignment_published(assignment):
    teacher_assignment = assignment.teacher_assignment
    organization = assignment.organization

    enrollments = StudentEnrollment.objects.filter(
        section=teacher_assignment.section,
        is_active=True,
        section__organization=organization,
        student__user__organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students = [enrollment.student for enrollment in enrollments]

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="New Assignment",
            message=(
                f'A new assignment "{assignment.title}" has been '
                f"published for {teacher_assignment.subject.name}."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/student/assignments",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="New Assignment",
            message=(
                f'A new assignment "{assignment.title}" has been '
                "published for your child."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/parent/assignments",
        )


def notify_assignment_submitted(submission):
    assignment = submission.assignment
    teacher_assignment = assignment.teacher_assignment
    organization = assignment.organization
    teacher_user = teacher_assignment.teacher.user
    student_user = submission.student.user

    if teacher_user.organization_id != organization.id:
        return None

    if student_user.organization_id != organization.id:
        return None

    student_name = (
        student_user.get_full_name().strip()
        or student_user.username
    )


def notify_assignment_graded(submission):
    assignment = submission.assignment
    teacher_assignment = assignment.teacher_assignment
    organization = assignment.organization
    student_user = submission.student.user

    if student_user.organization_id != organization.id:
        return None

    create_notification(
        organization=organization,
        user=student_user,
        title="Assignment Graded",
        message=(
            f'Your assignment "{assignment.title}" has been graded.'
        ),
        notification_type=Notification.Type.ASSIGNMENT,
        related_url="/student/assignments",
    )

    parent_links = ParentStudent.objects.filter(
        student=submission.student,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="Assignment Graded",
            message=(
                f'Your child\'s assignment "{assignment.title}" '
                "has been graded."
            ),
            notification_type=Notification.Type.ASSIGNMENT,
            related_url="/parent/assignments",
        )

    return None


def notify_document_published(document):
    teacher_assignment = document.teacher_assignment
    organization = document.organization

    enrollments = StudentEnrollment.objects.filter(
        section=teacher_assignment.section,
        is_active=True,
        section__organization=organization,
        student__user__organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students = [enrollment.student for enrollment in enrollments]

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="New Document",
            message=(
                f'A new document "{document.title}" has been '
                f"published for {teacher_assignment.subject.name}."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url="/student/documents",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="New Document",
            message=(
                f'A new document "{document.title}" has been '
                "published for your child."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url=None,
        )

    college_admins = User.objects.filter(
        role="college_admin",
        organization=organization,
    )

    for admin in college_admins:
        create_notification(
            organization=organization,
            user=admin,
            title="Document Published",
            message=(
                f'"{document.title}" was published by '
                f"{teacher_assignment.teacher}."
            ),
            notification_type=Notification.Type.GENERAL,
            related_url=f"/college-admin/documents/{document.id}",
        )

    return create_notification(
        organization=organization,
        user=teacher_user,
        title="Assignment Submitted",
        message=(
            f'{student_name} submitted "{assignment.title}" '
            f"for {teacher_assignment.subject.name}."
        ),
        notification_type=Notification.Type.ASSIGNMENT,
        related_url=(
            f"/teacher/assignments/{assignment.id}/submissions"
        ),
    )


def notify_exam_published(exam):
    organization = exam.organization

    results = StudentResult.objects.filter(
        exam=exam,
        exam__organization=organization,
        student__user__organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    students_by_id = {
        result.student_id: result.student
        for result in results
    }

    students = list(students_by_id.values())

    for student in students:
        create_notification(
            organization=organization,
            user=student.user,
            title="Result Published",
            message=(
                f'Your result for "{exam.name}" has been published.'
            ),
            notification_type=Notification.Type.RESULT,
            related_url="/student/results",
        )

    parent_links = ParentStudent.objects.filter(
        student__in=students,
        student__user__organization=organization,
        parent__user__organization=organization,
    ).select_related(
        "parent",
        "parent__user",
    )

    for link in parent_links:
        create_notification(
            organization=organization,
            user=link.parent.user,
            title="Result Published",
            message=(
                f'Your child\'s result for "{exam.name}" '
                "has been published."
            ),
            notification_type=Notification.Type.RESULT,
            related_url="/parent/results",
        )


def notify_live_class_scheduled(live_class):
    teacher_assignment = live_class.teacher_assignment
    organization = live_class.organization

    enrollments = StudentEnrollment.objects.filter(
        section=teacher_assignment.section,
        is_active=True,
        section__organization=organization,
        student__user__organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    for enrollment in enrollments:
        create_notification(
            organization=organization,
            user=enrollment.student.user,
            title="Live Class Scheduled",
            message=(
                f'A live class "{live_class.title}" has been '
                f"scheduled for {teacher_assignment.subject.name} "
                f"on {live_class.class_date} at "
                f"{live_class.start_time}."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url="/student/dashboard",
        )


def notify_recording_available(recording):
    live_class = recording.live_class
    teacher_assignment = live_class.teacher_assignment
    organization = live_class.organization

    enrollments = StudentEnrollment.objects.filter(
        section=teacher_assignment.section,
        is_active=True,
        section__organization=organization,
        student__user__organization=organization,
    ).select_related(
        "student",
        "student__user",
    )

    for enrollment in enrollments:
        create_notification(
            organization=organization,
            user=enrollment.student.user,
            title="Class Recording Available",
            message=(
                f'The recording for "{live_class.title}" - '
                f"{teacher_assignment.subject.name} is now available."
            ),
            notification_type=Notification.Type.LIVE_CLASS,
            related_url=(
                f"/student/recordings/{recording.public_id}"
            ),
        )
