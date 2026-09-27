using Microsoft.EntityFrameworkCore;
using Nala.Sql;

namespace Nala.Tests.Support;

/// <summary>A fresh, migrated database on the shared PostgreSQL server.</summary>
public static class TestDatabase
{
    public static async Task<Func<NalaDbContext>> CreateAsync()
    {
        var options = new DbContextOptionsBuilder<NalaDbContext>()
            .UseNpgsql(PostgresContainer.FreshDatabase(SharedPostgres.Container))
            .Options;
        await using (var db = new NalaDbContext(options))
        {
            await db.Database.MigrateAsync();
        }

        return () => new NalaDbContext(options);
    }
}
