from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0006_classfeatureaccess"),
    ]

    operations = [
        migrations.AddField(
            model_name="classfeatureaccess",
            name="parent_enabled",
            field=models.BooleanField(default=True),
        ),
    ]
