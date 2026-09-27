FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY Nala.Api/Nala.Api.csproj Nala.Api/
COPY Nala.Core/Nala.Core.csproj Nala.Core/
COPY Nala.Sql/Nala.Sql.csproj Nala.Sql/
RUN dotnet restore Nala.Api/Nala.Api.csproj
COPY Nala.Api/ Nala.Api/
COPY Nala.Core/ Nala.Core/
COPY Nala.Sql/ Nala.Sql/
RUN dotnet publish Nala.Api/Nala.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Nala.Api.dll"]
