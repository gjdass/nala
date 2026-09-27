using Microsoft.EntityFrameworkCore;

namespace Nala.Sql;

public class NalaDbContext(DbContextOptions<NalaDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NalaDbContext).Assembly);
}
