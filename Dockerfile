FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . ./
RUN dotnet restore AdmissionWeb.csproj
RUN dotnet publish AdmissionWeb.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
# Npgsql looks for the Kerberos/GSSAPI library when it connects; the slim image lacks it and logs "Cannot load library libgssapi_krb5.so.2".
RUN apt-get update && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
# The official .NET images already contain a non-root user and group named "app".
# Creating them again (groupadd/useradd) fails the build, so reuse the existing user.
RUN mkdir -p /app/App_Data && chown -R app:app /app
COPY --from=build --chown=app:app /app/publish ./
ENV ASPNETCORE_URLS=http://+:10000 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true \
    ASPNETCORE_HTTP_PORTS=10000
EXPOSE 10000
USER app
ENTRYPOINT ["dotnet", "AdmissionWeb.dll"]
