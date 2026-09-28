using Npgsql;
using Testcontainers.PostgreSql;

namespace Nala.Tests.Support;

/// <summary>A disposable PostgreSQL server for tests that need a real database.</summary>
public static class PostgresContainer
{
    public const string Image = "postgres:18-alpine";

    public static async Task<PostgreSqlContainer> StartAsync()
    {
        var container = new PostgreSqlBuilder(Image).Build();
        await container.StartAsync();
        return container;
    }

    /// <summary>
    /// Connection string to a fresh, not yet created database on the given server. Without pooling: every test has its own
    /// database, and idle pooled connections to each of them would exhaust the shared server's connection limit.
    /// </summary>
    public static string FreshDatabase(PostgreSqlContainer container) =>
        new NpgsqlConnectionStringBuilder(container.GetConnectionString())
        {
            Database = $"nala_{Guid.NewGuid():N}",
            Pooling = false,
        }.ConnectionString;
}
