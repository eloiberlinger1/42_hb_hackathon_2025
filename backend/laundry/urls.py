from django.urls import path
from . import views

urlpatterns = [
        path('start', views.start_machine, name='start_machine'),
        path('empty', views.empty_machine, name='empty_machine'),
        path('leaderboard', views.leaderboard, name='leaderboard'),
        path('state', views.state, name='state'),
        path("api/auth/callback/", forty_two_callback), 
        ]
