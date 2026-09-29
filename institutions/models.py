from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=150)

    code = models.CharField(
        max_length=50,
        unique=True
    )

    logo = models.ImageField(
        upload_to='institutions/logos/',
        null=True,
        blank=True
    )

    primary_color = models.CharField(
        max_length=20,
        default='#0d6efd'
    )

    secondary_color = models.CharField(
        max_length=20,
        default='#6c757d'
    )

    email = models.EmailField(blank=True)

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    address = models.TextField(blank=True)

    website = models.URLField(blank=True)

    domain = models.CharField(
        max_length=150,
        blank=True
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name