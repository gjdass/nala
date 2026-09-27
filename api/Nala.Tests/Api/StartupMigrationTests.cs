using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Nala.Sql;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class StartupMigrationTests
{
    [Test]
    public async Task Pending_migrations_are_applied_at_startup()
    {
        await using var factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container));
        factory.Start();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NalaDbContext>();

        Assert.That(await db.Database.GetPendingMigrationsAsync(), Is.Empty);
        Assert.That(await db.Database.GetAppliedMigrationsAsync(), Has.Some.EndsWith("_InitialCreate"));
    }
}
