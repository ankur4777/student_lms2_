from django.conf import settings
import django.core.files.storage
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion
import documents.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('academics', '0001_initial'),
        ('institutions', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Document',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True)),
                ('document_type', models.CharField(choices=[('notes', 'Notes'), ('syllabus', 'Syllabus'), ('timetable', 'Timetable'), ('study_material', 'Study Material'), ('worksheet', 'Worksheet'), ('notice', 'Notice'), ('other', 'Other')], default='other', max_length=30)),
                ('file', models.FileField(storage=django.core.files.storage.FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT), upload_to=documents.models.document_upload_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'])])),
                ('is_published', models.BooleanField(default=False)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='institutions.organization')),
                ('teacher_assignment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='academics.teacherassignment')),
                ('uploaded_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='uploaded_documents', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['organization', 'uploaded_by'], name='documents_d_organiz_84fef0_idx'),
                    models.Index(fields=['teacher_assignment', 'is_published'], name='documents_d_teacher_c7f338_idx'),
                ],
            },
        ),
    ]
