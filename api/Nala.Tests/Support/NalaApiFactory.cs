using Microsoft.AspNetCore.Mvc.Testing;

namespace Nala.Tests.Support;

/// <summary>
/// Hosts the API in-process. The connection string is passed through the real environment variable,
/// so tests exercise the same configuration path as production.
/// </summary>
public class NalaApiFactory(string? connectionString) : WebApplicationFactory<Program>
{
    public const string ConnectionStringVariable = "ConnectionStrings__Nala";

    private static readonly Lock EnvironmentLock = new();

    /// <summary>Starts the host with the environment variable set only for the duration of startup.</summary>
    public HttpClient Start()
    {
        lock (EnvironmentLock)
        {
            var previous = Environment.GetEnvironmentVariable(ConnectionStringVariable);
            Environment.SetEnvironmentVariable(ConnectionStringVariable, connectionString);
            try
            {
                return CreateClient();
            }
            finally
            {
                Environment.SetEnvironmentVariable(ConnectionStringVariable, previous);
            }
        }
    }
}
