from academics.feature_access import StudentClassFeaturePermission

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification


def serialize_notification(notification):
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "notification_type": notification.notification_type,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "related_url": notification.related_url,
    }


def user_notifications(user):
    return Notification.objects.filter(
        user=user,
        organization=user.organization,
    )


class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "notifications"

    def get(self, request):
        notifications = user_notifications(request.user)

        return Response({
            "notifications": [
                serialize_notification(notification)
                for notification in notifications
            ]
        })


class NotificationUnreadCountAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "notifications"

    def get(self, request):
        unread_count = user_notifications(request.user).filter(
            is_read=False
        ).count()

        return Response({
            "unread_count": unread_count
        })


class NotificationMarkReadAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "notifications"

    def patch(self, request, notification_id):
        notification = user_notifications(request.user).filter(
            id=notification_id
        ).first()

        if not notification:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read"])

        return Response({
            "id": notification.id,
            "is_read": notification.is_read,
        })


class NotificationMarkAllReadAPIView(APIView):
    permission_classes = [IsAuthenticated, StudentClassFeaturePermission]
    student_feature_key = "notifications"

    def patch(self, request):
        notifications = user_notifications(request.user).filter(
            is_read=False
        )
        updated_count = notifications.update(is_read=True)

        return Response({
            "message": "Notifications marked as read.",
            "updated_count": updated_count,
            "unread_count": 0,
        })
