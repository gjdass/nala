using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Nala.Sql;

namespace Nala.Api.Health;

public static class HealthEndpoint
{
    public const string Path = "/api/health";

    public static IServiceCollection AddNalaHealth(this IServiceCollection services)
    {
        services.AddHealthChecks().AddDbContextCheck<NalaDbContext>();
        return services;
    }

    public static IEndpointRouteBuilder MapNalaHealth(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks(Path, new HealthCheckOptions { ResponseWriter = WriteAsync });
        return endpoints;
    }

    private static Task WriteAsync(HttpContext context, HealthReport report)
    {
        var status = report.Status == HealthStatus.Healthy ? "ok" : "unavailable";
        return context.Response.WriteAsJsonAsync(new { status });
    }
}
