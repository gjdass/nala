using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Api.Auth;

public sealed record SetupRequest(string? Email, string? DisplayName, string? Password, string? Language);

public sealed record CurrentUserResponse(Guid Id, string Email, string DisplayName, string Language, bool IsAdmin);

public sealed record AuthStateResponse(bool SetupRequired, CurrentUserResponse? User);

public static class AuthEndpoints
{
    public const string CookieName = "nala.session";

    public static IServiceCollection AddNalaAuth(this IServiceCollection services, IHostEnvironment environment)
    {
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                // Plain http://localhost must work in every browser while developing; everywhere else the cookie is Secure.
                options.Cookie.SecurePolicy = environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest
                    : CookieSecurePolicy.Always;
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });
        services.AddAuthorization();

        services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
        services.AddScoped<SetupService>();
        return services;
    }

    public static IEndpointRouteBuilder MapNalaAuth(this IEndpointRouteBuilder endpoints)
    {
        var auth = endpoints.MapGroup("/api/auth");
        auth.MapGet("/state", GetStateAsync);
        auth.MapPost("/setup", SetupAsync);
        return endpoints;
    }

    private static async Task<AuthStateResponse> GetStateAsync(
        ClaimsPrincipal principal, IUserRepository users, CancellationToken cancellationToken)
    {
        var user = await CurrentUserAsync(principal, users, cancellationToken);
        var setupRequired = user is null && !await users.AnyAsync(cancellationToken);
        return new AuthStateResponse(setupRequired, user is null ? null : ToResponse(user));
    }

    private static async Task<IResult> SetupAsync(
        SetupRequest request, SetupService setup, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await setup.SetupAsync(
            new SetupCommand(request.Email, request.DisplayName, request.Password, request.Language), cancellationToken);

        switch (result)
        {
            case SetupResult.Created created:
                await SignInAsync(context, created.User);
                return Results.Ok(new AuthStateResponse(false, ToResponse(created.User)));
            case SetupResult.Invalid invalid:
                return Results.ValidationProblem(invalid.Errors.ToDictionary(e => e.Key, e => new[] { e.Value }));
            default:
                return Results.StatusCode(StatusCodes.Status403Forbidden);
        }
    }

    private static Task SignInAsync(HttpContext context, User user) =>
        context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())],
                CookieAuthenticationDefaults.AuthenticationScheme)));

    /// <summary>The signed-in user, or null when anonymous or the account no longer exists.</summary>
    private static async Task<User?> CurrentUserAsync(
        ClaimsPrincipal principal, IUserRepository users, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
        {
            return null;
        }

        var user = await users.GetByIdAsync(id, cancellationToken);
        return user is { DeletedAt: null, Email: not null } ? user : null;
    }

    private static CurrentUserResponse ToResponse(User user) =>
        new(user.Id, user.Email!, user.DisplayName, user.PreferredLanguage, user.IsAdmin);
}
