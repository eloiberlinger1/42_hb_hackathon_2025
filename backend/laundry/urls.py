from django.urls import path
from . import views

urlpatterns = [
    path('start', views.start_machine, name='start_machine'),
    path('empty', views.empty_machine, name='empty_machine'),
    path('leaderboard', views.leaderboard, name='leaderboard'),
    path('state', views.state, name='state'),
    # 42 OAuth
    path('auth/login/', views.forty_two_login, name='auth_login'),
    path('auth/callback/', views.forty_two_callback, name='auth_callback'),
    path('auth/me/', views.me, name='auth_me'),
    path('auth/logout/', views.logout_view, name='auth_logout'),
]
