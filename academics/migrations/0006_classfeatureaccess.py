from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0005_alter_academicsession_name"),
        ("institutions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassFeatureAccess",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "feature_key",
                    models.CharField(
                        choices=[
                            ("classes", "My Classes"),
                            ("recorded_classes", "Recorded Classes"),
                            ("recorded_courses", "Recorded Courses"),
                            ("attendance", "Attendance"),
                            ("assignments", "Assignments"),
                            ("results", "Results"),
                            ("documents", "Documents"),
                            ("fees", "Fees"),
                            ("notifications", "Notifications"),
                        ],
                        max_length=50,
                    ),
                ),
                ("is_enabled", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "classroom",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="feature_access",
                        to="academics.classroom",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_feature_access",
                        to="institutions.organization",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="classfeatureaccess",
            constraint=models.UniqueConstraint(
                fields=("organization", "classroom", "feature_key"),
                name="uniq_class_feature_access",
            ),
        ),
    ]
