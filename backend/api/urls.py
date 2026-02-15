from django.urls import path
from .views import HealthCheckView, ContractAnalysisView

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('analyze/', ContractAnalysisView.as_view(), name='analyze_contract'),
]
