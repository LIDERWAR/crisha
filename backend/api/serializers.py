from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Document, UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['subscription_tier', 'checks_remaining', 'total_checks_count']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'name', 'file', 'uploaded_at', 'status', 'score', 'summary', 'risks', 'recommendations', 'improved_file']
        read_only_fields = ['id', 'uploaded_at', 'status', 'score', 'summary', 'risks', 'recommendations', 'improved_file']
