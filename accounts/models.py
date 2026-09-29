from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class CustomUserManager(UserManager):

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'platform_admin')

        return super().create_superuser(
            username,
            email,
            password,
            **extra_fields
        )


class User(AbstractUser):

    class Role(models.TextChoices):
     PLATFORM_ADMIN = 'platform_admin', 'Platform Admin'
     COLLEGE_ADMIN = 'college_admin', 'College Admin'
     TEACHER = 'teacher', 'Teacher'
     STUDENT = 'student', 'Student'
     PARENT = 'parent', 'Parent'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
    )
    organization = models.ForeignKey(
    'institutions.Organization',
    on_delete=models.CASCADE,
    null=True,
    blank=True,
    related_name='users'
)

    objects = CustomUserManager()

    def __str__(self):
        return self.username


class TeacherProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='teacher_profile'
    )

    employee_id = models.CharField(
        max_length=50,
        unique=True
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    qualification = models.CharField(
        max_length=150,
        blank=True
    )

    joining_date = models.DateField(
        null=True,
        blank=True
    )

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class StudentProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )

    admission_number = models.CharField(
        max_length=50,
        unique=True
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    date_of_birth = models.DateField(
        null=True,
        blank=True
    )

    admission_date = models.DateField(
        null=True,
        blank=True
    )

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class ParentProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='parent_profile'
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    occupation = models.CharField(
        max_length=100,
        blank=True
    )

    def __str__(self):
        return self.user.get_full_name() or self.user.username