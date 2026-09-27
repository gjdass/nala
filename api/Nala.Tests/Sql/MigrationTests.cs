using Microsoft.EntityFrameworkCore;
using Nala.Sql;

namespace Nala.Tests.Sql;

public class MigrationTests
{
    [Test]
    public void Initial_migration_exists()
    {
        var options = new DbContextOptionsBuilder<NalaDbContext>().UseNpgsql("Host=unused").Options;
        using var db = new NalaDbContext(options);

        var migrations = db.Database.GetMigrations().ToArray();

        Assert.That(migrations, Is.Not.Empty);
        Assert.That(migrations[0], Does.EndWith("_InitialCreate"));
    }
}
