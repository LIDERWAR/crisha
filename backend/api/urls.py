from django.urls import path
from .views import (
    HealthCheckView, ContractAnalysisView, DocumentListView, 
    RegisterView, LoginView, LogoutView, DocumentDetailView, 
    UserInfoView, ChangePasswordView, CreatePaymentView, PaymentWebhookView
)

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('user/info/', UserInfoView.as_view(), name='user-info'),
    path('user/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('analyze/', ContractAnalysisView.as_view(), name='analyze_contract'),
    path('documents/', DocumentListView.as_view(), name='document_list'),
    path('documents/<int:pk>/', DocumentDetailView.as_view(), name='document_detail'),
    path('payment/create/', CreatePaymentView.as_view(), name='payment_create'),
    path('payment/webhook/', PaymentWebhookView.as_view(), name='payment_webhook'),
]
