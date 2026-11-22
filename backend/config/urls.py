from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root(_request):
    return JsonResponse({"service": "Pani Shakkhi API", "docs": "see docs/api.md", "health": "/api/health"})


urlpatterns = [
    path("", root),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
