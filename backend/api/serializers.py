from rest_framework import serializers
from .models import Document

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'name', 'uploaded_at', 'status', 'score', 'summary', 'risks']
        read_only_fields = ['id', 'uploaded_at', 'status', 'score', 'summary', 'risks']
