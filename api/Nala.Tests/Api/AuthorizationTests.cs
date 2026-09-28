using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nala.Tests.Support;

namespace Nala.Tests.Api;

/// <summary>Every endpoint needs a session unless it is explicitly public.</summary>
public class AuthorizationTests
{
    private NalaApiFactory _factory = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new NalaApiFactory(PostgresContainer.FreshDatabase(SharedPostgres.Container));
        _factory.Start().Dispose();
    }

    [TearDown]
    public async Task TearDown() => await _factory.DisposeAsync();

    [Test]
    public void Only_the_public_endpoints_allow_anonymous()
    {
        var anonymous = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(e => $"{string.Join(",", e.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? ["*"])} {e.RoutePattern.RawText}");

        Assert.That(anonymous, Is.EquivalentTo(new[]
        {
            "* /api/health",
            "GET /api/auth/state",
            "POST /api/auth/setup",
            "POST /api/auth/login",
            "GET /api/auth/invitations/{token}",
            "POST /api/auth/invitations/{token}/register",
            "GET /api/auth/password-resets/{token}",
            "POST /api/auth/password-resets/{token}",
        }));
    }

    [Test]
    public void Endpoints_without_an_explicit_rule_require_an_authenticated_user()
    {
        var fallback = _factory.Services.GetRequiredService<IOptions<AuthorizationOptions>>().Value.FallbackPolicy;

        Assert.That(fallback, Is.Not.Null);
        Assert.That(fallback!.Requirements, Has.Some.InstanceOf<Microsoft.AspNetCore.Authorization.Infrastructure.DenyAnonymousAuthorizationRequirement>());
    }
}
