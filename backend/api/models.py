from django.db import models
from django.contrib.auth.models import User

class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    file = models.FileField(upload_to='contracts/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=255, blank=True)
    
    # Analysis Results
    score = models.IntegerField(null=True, blank=True)
    summary = models.TextField(null=True, blank=True)
    risks = models.JSONField(null=True, blank=True) # Requires Django 3.1+
    
    def __str__(self):
        return self.name or f"Document {self.id}"

    def save(self, *args, **kwargs):
        if not self.name and self.file:
            self.name = self.file.name
        super().save(*args, **kwargs)
