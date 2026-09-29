from rest_framework import serializers

from academics.models import ClassRoom, Section
from .models import Notice


class NoticeSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source="classroom.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Notice
        fields = [
            "id",
            "title",
            "message",
            "audience",
            "classroom",
            "classroom_name",
            "section",
            "section_name",
            "publish_at",
            "expires_at",
            "attachment",
            "attachment_url",
            "is_active",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_by_name",
            "created_at",
            "updated_at",
            "attachment_url",
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.attachment.url) if request else obj.attachment.url

    def validate(self, attrs):
        request = self.context["request"]
        organization = request.user.organization
        audience = attrs.get("audience", getattr(self.instance, "audience", Notice.Audience.EVERYONE))
        classroom = attrs.get("classroom", getattr(self.instance, "classroom", None))
        section = attrs.get("section", getattr(self.instance, "section", None))
        publish_at = attrs.get("publish_at", getattr(self.instance, "publish_at", None))
        expires_at = attrs.get("expires_at", getattr(self.instance, "expires_at", None))

        if classroom and classroom.organization_id != organization.id:
            raise serializers.ValidationError({"classroom": "Class must belong to your organization."})

        if section and section.organization_id != organization.id:
            raise serializers.ValidationError({"section": "Section must belong to your organization."})

        if audience == Notice.Audience.CLASS and not classroom:
            raise serializers.ValidationError({"classroom": "Class is required for class audience."})

        if audience == Notice.Audience.SECTION and not section:
            raise serializers.ValidationError({"section": "Section is required for section audience."})

        if expires_at and publish_at and expires_at <= publish_at:
            raise serializers.ValidationError({"expires_at": "Expiry must be after publish date."})

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        validated_data["organization"] = request.user.organization
        validated_data["created_by"] = request.user

        if validated_data.get("audience") != Notice.Audience.CLASS:
            validated_data["classroom"] = None
        if validated_data.get("audience") != Notice.Audience.SECTION:
            validated_data["section"] = None

        return super().create(validated_data)

    def update(self, instance, validated_data):
        audience = validated_data.get("audience", instance.audience)
        if audience != Notice.Audience.CLASS:
            validated_data["classroom"] = None
        if audience != Notice.Audience.SECTION:
            validated_data["section"] = None
        return super().update(instance, validated_data)


class NoticeFilterOptionsSerializer(serializers.Serializer):
    classes = serializers.ListField(child=serializers.DictField(), read_only=True)
    sections = serializers.ListField(child=serializers.DictField(), read_only=True)
