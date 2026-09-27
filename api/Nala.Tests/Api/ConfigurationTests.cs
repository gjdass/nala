using System.Net;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

public class ConfigurationTests
{
    [Test]
    public async Task Connection_string_is_read_from_environment_variable()
    {
        // NalaApiFactory only provides the connection string through the environment variable.
        await using var factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container));
        var client = factory.Start();

        var response = await client.GetAsync("/api/health");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Startup_fails_with_clear_error_when_connection_string_missing()
    {
        await using var factory = new NalaApiFactory(connectionString: null);

        var error = Assert.Catch(() => factory.Start());

        var messages = Flatten(error).Select(e => e.Message);
        Assert.That(messages, Has.Some.Contains(NalaApiFactory.ConnectionStringVariable));
    }

    private static IEnumerable<Exception> Flatten(Exception? e)
    {
        for (; e is not null; e = e.InnerException)
        {
            yield return e;
        }
    }
}
