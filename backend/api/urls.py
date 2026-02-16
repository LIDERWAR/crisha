from django.urls import path
from .views import HealthCheckView, ContractAnalysisView, DocumentListView, RegisterView, LoginView, LogoutView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('analyze/', ContractAnalysisView.as_view(), name='analyze_contract'),
    path('documents/', DocumentListView.as_view(), name='document_list'),
]
