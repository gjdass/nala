using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Nala.Sql;

namespace Nala.Tests.Support;

/// <summary>A fresh, migrated database on the shared PostgreSQL server.</summary>
public static class TestDatabase
{
    /// <summary>Migrated up to <paramref name="migration"/> when given (e.g. to test a data migration), else to the latest.</summary>
    public static async Task<Func<NalaDbContext>> CreateAsync(string? migration = null)
    {
        var options = new DbContextOptionsBuilder<NalaDbContext>()
            .UseNpgsql(PostgresContainer.FreshDatabase(SharedPostgres.Container))
            .Options;
        await using (var db = new NalaDbContext(options))
        {
            await db.GetService<IMigrator>().MigrateAsync(migration);
        }

        return () => new NalaDbContext(options);
    }
}
