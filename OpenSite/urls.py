from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

import OpenBench.urls

urlpatterns = []

if settings.ENABLE_DJANGO_ADMIN:
    urlpatterns.append(path(r'admin/', admin.site.urls))

urlpatterns.append(path(r'', include(OpenBench.urls.urlpatterns)))

urlpatterns += staticfiles_urlpatterns()