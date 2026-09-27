using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Nala.Sql;

/// <summary>Used by `dotnet ef` only: lets migrations be generated without a database or environment variables.</summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<NalaDbContext>
{
    public NalaDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<NalaDbContext>().UseNpgsql("Host=localhost").Options);
}
