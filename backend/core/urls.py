from django.urls import path, re_path

from . import views

# Trailing slash optional: /api/reports and /api/reports/ both work.
urlpatterns = [
    re_path(r"^health/?$", views.health),
    re_path(r"^unions/?$", views.unions),
    re_path(r"^stations/?$", views.stations),
    re_path(r"^shelters/?$", views.shelters),
    re_path(r"^shelters/nearest/?$", views.shelters_nearest),
    re_path(r"^reports/?$", views.reports),
    re_path(r"^reports/(?P<pk>[\w\-:.]+)/?$", views.report_detail),
    re_path(r"^forecasts/?$", views.forecasts),
    re_path(r"^alerts/?$", views.alerts),
    re_path(r"^alerts/broadcast/?$", views.alerts_broadcast),
    re_path(r"^inbound/(?P<channel>sms|ivr)/?$", views.inbound),
    re_path(r"^dashboard/summary/?$", views.dashboard_summary),
]
_ = path  # keep import for readers adding routes
