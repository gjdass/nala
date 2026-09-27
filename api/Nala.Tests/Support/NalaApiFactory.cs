using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace Nala.Tests.Support;

/// <summary>
/// Hosts the API in-process. The connection string is passed through the real environment variable,
/// so tests exercise the same configuration path as production. Clients talk HTTPS by default so
/// Secure cookies round-trip, and every log line is captured in <see cref="Logs"/>.
/// </summary>
public class NalaApiFactory(string? connectionString, string environment = "Development") : WebApplicationFactory<Program>
{
    public const string ConnectionStringVariable = "ConnectionStrings__Nala";

    private static readonly Lock EnvironmentLock = new();

    private readonly ConcurrentQueue<string> _logs = new();

    public IEnumerable<string> Logs => _logs;

    /// <summary>Starts the host with the environment variable set only for the duration of startup.</summary>
    public HttpClient Start(Uri? baseAddress = null)
    {
        lock (EnvironmentLock)
        {
            var previous = Environment.GetEnvironmentVariable(ConnectionStringVariable);
            Environment.SetEnvironmentVariable(ConnectionStringVariable, connectionString);
            try
            {
                return CreateClient(new WebApplicationFactoryClientOptions
                {
                    BaseAddress = baseAddress ?? new Uri("https://localhost"),
                });
            }
            finally
            {
                Environment.SetEnvironmentVariable(ConnectionStringVariable, previous);
            }
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.ConfigureLogging(logging =>
        {
            logging.SetMinimumLevel(LogLevel.Trace);
            logging.AddProvider(new CapturingLoggerProvider(_logs));
        });
    }

    private sealed class CapturingLoggerProvider(ConcurrentQueue<string> sink) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new CapturingLogger(sink, categoryName);

        public void Dispose()
        {
        }
    }

    private sealed class CapturingLogger(ConcurrentQueue<string> sink, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            sink.Enqueue($"{category}: {formatter(state, exception)} {exception}");
    }
}
