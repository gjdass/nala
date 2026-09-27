using Testcontainers.PostgreSql;

using Nala.Tests.Support;

namespace Nala.Tests;

/// <summary>Root-namespace setup fixture: one PostgreSQL server shared by the whole test run. Tests isolate themselves with a fresh database each.</summary>
[SetUpFixture]
public class SharedPostgres
{
    private static PostgreSqlContainer? _container;

    public static PostgreSqlContainer Container =>
        _container ?? throw new InvalidOperationException("Shared PostgreSQL container is not started.");

    [OneTimeSetUp]
    public async Task StartAsync() => _container = await PostgresContainer.StartAsync();

    [OneTimeTearDown]
    public async Task StopAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }
}
