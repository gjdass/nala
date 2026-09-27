# Nala API (.NET)

## Commands

Run from `api/`. Tests need Docker running (Testcontainers starts PostgreSQL).

| What | Command |
|---|---|
| Restore local tools (`dotnet-ef`) | `dotnet tool restore` |
| Build | `dotnet build` |
| Test | `dotnet test` |
| Lint (format check) | `dotnet format --verify-no-changes` |
| Run | `ConnectionStrings__Nala="Host=localhost;Port=5432;Database=nala;Username=…;Password=…" dotnet run --project Nala.Api` |
| Add a migration | `dotnet ef migrations add <Name> -p Nala.Sql -s Nala.Sql -o Migrations` |

- The connection string comes only from the `ConnectionStrings__Nala` environment variable; the API refuses to start without it.
- Pending migrations are applied at startup. `dotnet ef` uses `DesignTimeDbContextFactory` in `Nala.Sql`, so generating a migration needs no database.
- Health: `GET /api/health` → 200 `{"status":"ok"}`, or 503 `{"status":"unavailable"}` when the database is unreachable.

## Solution structure

| Project      | Role                                                                        | References          |
|--------------|-----------------------------------------------------------------------------|---------------------|
| `Nala.Api`   | ASP.NET Core host: controllers/endpoints, DTOs, DI wiring, auth, startup    | `Nala.Core`, `Nala.Sql` |
| `Nala.Core`  | Domain entities, business logic/services, repository interfaces             | nothing             |
| `Nala.Sql`   | EF Core `DbContext`, entity configurations, migrations, repository implementations (Npgsql) | `Nala.Core` |
| `Nala.Tests` | Unit tests for all of the above (NUnit)                                     | all                 |

Dependency rule: `Nala.Core` has no dependency on EF Core, ASP.NET or any infrastructure. Business rules go in Core, not in controllers or the DbContext.

## Conventions

- Controllers stay thin: validate input, map DTO ↔ domain, call a Core service.
- Never expose EF entities directly over HTTP. Use DTOs.
- Entity configuration uses `IEntityTypeConfiguration<T>` classes in `Nala.Sql`, not data annotations on Core entities.
- Every schema change goes through an EF migration committed with the change. Migrations are applied at startup.
- Store timestamps in UTC (`timestamptz`) and let the client handle local-time display.
- Configuration (connection string, etc.) comes from environment variables.

## Tests

- Test first (see root `CLAUDE.md`): write the failing test in `Nala.Tests`, run it and see it fail, then implement.
- Core services are unit-tested with fake/mocked repositories.
- Data-access tests run against a real PostgreSQL (e.g. Testcontainers), not the EF in-memory provider.
