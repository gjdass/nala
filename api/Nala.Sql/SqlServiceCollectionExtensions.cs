using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Nala.Sql;

public static class SqlServiceCollectionExtensions
{
    public static IServiceCollection AddNalaSql(this IServiceCollection services, string connectionString) =>
        services.AddDbContext<NalaDbContext>(options => options.UseNpgsql(connectionString));
}
