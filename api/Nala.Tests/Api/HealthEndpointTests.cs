using System.Net;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class HealthEndpointTests
{
    [Test]
    public async Task Health_returns_200_ok_when_database_reachable()
    {
        await using var factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container));
        var client = factory.Start();

        var response = await client.GetAsync("/api/health");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(response.Content.Headers.ContentType?.MediaType, Is.EqualTo("application/json"));
        Assert.That(await response.Content.ReadAsStringAsync(), Is.EqualTo("""{"status":"ok"}"""));
    }

    [Test]
    public async Task Health_returns_503_when_database_unreachable()
    {
        // Own server, so stopping it doesn't affect other tests.
        await using var container = await PostgresContainer.StartAsync();
        await using var factory = new NalaApiFactory(container.GetConnectionString());
        var client = factory.Start();

        await container.StopAsync();
        var response = await client.GetAsync("/api/health");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.ServiceUnavailable));
    }
}
