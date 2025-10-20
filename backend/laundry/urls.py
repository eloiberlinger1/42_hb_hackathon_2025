from django.urls import path
from . import views

urlpatterns = [
    path("machines", views.list_machines, name="list_machines"),
    path("machines/<int:machine_id>/start", views.start_cycle, name="start_cycle"),
    path("machines/<int:machine_id>/end", views.end_cycle, name="end_cycle"),
    path("sse", views.sse, name="sse"),
]


