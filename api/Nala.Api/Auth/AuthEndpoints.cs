using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Nala.Api.Email;
using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Api.Auth;

public sealed record SetupRequest(string? Email, string? DisplayName, string? Password, string? Language, string? FamilyName);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record RegisterRequest(string? Email, string? DisplayName, string? Password, string? Language);

public sealed record InvitationResponse(string InvitedBy, DateTimeOffset ExpiresAt);

public sealed record ForgotPasswordRequest(string? Email);

public sealed record PasswordResetLookupResponse(string Email, DateTimeOffset ExpiresAt);

public sealed record ResetPasswordRequest(string? Password);

/// <summary>
/// A failure not tied to a field (<c>invalidCredentials</c>, <c>tooManyAttempts</c>, <c>accountDisabled</c>, <c>invitation…</c>,
/// <c>resetLink…</c>, <c>emailResetDisabled</c>).
/// </summary>
public sealed record ErrorResponse(string Code);

public sealed record CurrentUserResponse(Guid Id, string Email, string DisplayName, string Language, bool IsAdmin);

/// <summary><c>SmtpEnabled</c>: "Forgot password" can email a reset link.</summary>
public sealed record AuthStateResponse(bool SetupRequired, CurrentUserResponse? User, bool SmtpEnabled);

public static class AuthEndpoints
{
    public const string CookieName = "nala.session";

    /// <summary>The server-side session the cookie points to; the cookie carries nothing else but the user id.</summary>
    private const string SessionIdClaim = "sid";

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
                // Persistent and rolling: the cookie is reissued whenever the server-side session is extended.
                options.ExpireTimeSpan = SessionPolicy.IdleTimeout;
                options.SlidingExpiration = false;
                options.Events.OnValidatePrincipal = ValidateSessionAsync;
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
        // Every endpoint needs a session unless it opts out with AllowAnonymous.
        services.AddAuthorization(options =>
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
        services.AddScoped<SetupService>();
        services.AddScoped<LoginService>();
        services.AddScoped<SessionService>();
        services.AddScoped<RegistrationService>();
        services.AddScoped<PasswordResetService>();
        return services;
    }

    public static IEndpointRouteBuilder MapNalaAuth(this IEndpointRouteBuilder endpoints)
    {
        var auth = endpoints.MapGroup("/api/auth");
        auth.MapGet("/state", GetState).AllowAnonymous();
        auth.MapPost("/setup", SetupAsync).AllowAnonymous();
        auth.MapPost("/login", LoginAsync).AllowAnonymous();
        auth.MapPost("/logout", LogoutAsync);
        auth.MapGet("/invitations/{token}", LookupInvitationAsync).AllowAnonymous();
        auth.MapPost("/invitations/{token}/register", RegisterAsync).AllowAnonymous();
        auth.MapPost("/password-resets", RequestPasswordResetAsync).AllowAnonymous();
        auth.MapGet("/password-resets/{token}", LookupResetLinkAsync).AllowAnonymous();
        auth.MapPost("/password-resets/{token}", ResetPasswordAsync).AllowAnonymous();
        return endpoints;
    }

    private static async Task<AuthStateResponse> GetState(
        HttpContext context, IUserRepository users, EmailOptions email, CancellationToken cancellationToken)
    {
        var user = CurrentUser(context);
        var setupRequired = user is null && !await users.AnyAsync(cancellationToken);
        return new AuthStateResponse(setupRequired, user is null ? null : ToResponse(user), email.Enabled);
    }

    /// <summary>The state after signing <paramref name="user"/> in.</summary>
    private static IResult SignedIn(HttpContext context, User user) =>
        Results.Ok(new AuthStateResponse(
            false, ToResponse(user), context.RequestServices.GetRequiredService<EmailOptions>().Enabled));

    private static async Task<IResult> SetupAsync(
        SetupRequest request, SetupService setup, SessionService sessions, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await setup.SetupAsync(
            new SetupCommand(request.Email, request.DisplayName, request.Password, request.Language, request.FamilyName), cancellationToken);

        switch (result)
        {
            case SetupResult.Created created:
                await SignInAsync(context, sessions, created.User, cancellationToken);
                return SignedIn(context, created.User);
            case SetupResult.Invalid invalid:
                return ValidationProblem(invalid.Errors);
            default:
                return Results.StatusCode(StatusCodes.Status403Forbidden);
        }
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request, LoginService login, SessionService sessions, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await login.LoginAsync(new LoginCommand(request.Email, request.Password), cancellationToken);

        switch (result)
        {
            case LoginResult.Success success:
                await SignInAsync(context, sessions, success.User, cancellationToken);
                return SignedIn(context, success.User);
            case LoginResult.Invalid invalid:
                return ValidationProblem(invalid.Errors);
            case LoginResult.AccountDisabled:
                return AccountDisabled();
            case LoginResult.LockedOut:
                return Results.Json(new ErrorResponse("tooManyAttempts"), statusCode: StatusCodes.Status429TooManyRequests);
            default:
                return Results.Json(new ErrorResponse("invalidCredentials"), statusCode: StatusCodes.Status401Unauthorized);
        }
    }

    private static async Task<IResult> LookupInvitationAsync(
        string token, RegistrationService registration, CancellationToken cancellationToken)
    {
        var lookup = await registration.LookupAsync(token, cancellationToken);
        return lookup is InvitationLookup.Valid valid
            ? Results.Ok(new InvitationResponse(valid.InvitedBy, valid.ExpiresAt))
            : InvitationUnavailable(((InvitationLookup.Unavailable)lookup).Problem);
    }

    private static async Task<IResult> RegisterAsync(
        string token,
        RegisterRequest request,
        RegistrationService registration,
        SessionService sessions,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var result = await registration.RegisterAsync(
            new RegisterCommand(token, request.Email, request.DisplayName, request.Password, request.Language), cancellationToken);

        switch (result)
        {
            case RegisterResult.Registered registered:
                await SignInAsync(context, sessions, registered.User, cancellationToken);
                return SignedIn(context, registered.User);
            case RegisterResult.Invalid invalid:
                return ValidationProblem(invalid.Errors);
            default:
                return InvitationUnavailable(((RegisterResult.Unavailable)result).Problem);
        }
    }

    /// <summary>404 for an unknown link, 410 for one that existed but can no longer be used; the code tells why.</summary>
    public static IResult InvitationUnavailable(InvitationProblem problem) =>
        Results.Json(
            new ErrorResponse($"invitation{problem}"),
            statusCode: problem == InvitationProblem.Unknown ? StatusCodes.Status404NotFound : StatusCodes.Status410Gone);

    /// <summary>"Forgot password": the same 202 whether or not an email goes out, which happens in the background.</summary>
    private static async Task<IResult> RequestPasswordResetAsync(
        ForgotPasswordRequest request, PasswordResetService resets, EmailOptions email, CancellationToken cancellationToken)
    {
        if (!email.Enabled)
        {
            return Results.Json(new ErrorResponse("emailResetDisabled"), statusCode: StatusCodes.Status404NotFound);
        }

        return await resets.RequestByEmailAsync(request.Email, email.PublicUrl!, cancellationToken) switch
        {
            RequestResetResult.Invalid invalid => ValidationProblem(invalid.Errors),
            _ => Results.Accepted(),
        };
    }

    private static async Task<IResult> LookupResetLinkAsync(
        string token, PasswordResetService resets, CancellationToken cancellationToken) =>
        await resets.LookupAsync(token, cancellationToken) switch
        {
            ResetLinkLookup.Valid valid => Results.Ok(new PasswordResetLookupResponse(valid.Email, valid.ExpiresAt)),
            ResetLinkLookup.Unavailable unavailable => Unavailable(unavailable.Problem),
            _ => AccountDisabled(),
        };

    /// <summary>Sets the new password, ends every session of the user, then signs them in on this device.</summary>
    private static async Task<IResult> ResetPasswordAsync(
        string token,
        ResetPasswordRequest request,
        PasswordResetService resets,
        SessionService sessions,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var result = await resets.ResetAsync(new ResetPasswordCommand(token, request.Password), cancellationToken);

        switch (result)
        {
            case ResetPasswordResult.Reset reset:
                await SignInAsync(context, sessions, reset.User, cancellationToken);
                return SignedIn(context, reset.User);
            case ResetPasswordResult.Invalid invalid:
                return ValidationProblem(invalid.Errors);
            case ResetPasswordResult.Unavailable unavailable:
                return Unavailable(unavailable.Problem);
            default:
                return AccountDisabled();
        }
    }

    /// <summary>404 for an unknown link, 410 for one that existed but can no longer be used; the code tells why.</summary>
    private static IResult Unavailable(ResetLinkProblem problem) =>
        Results.Json(
            new ErrorResponse($"resetLink{problem}"),
            statusCode: problem == ResetLinkProblem.Unknown ? StatusCodes.Status404NotFound : StatusCodes.Status410Gone);

    internal static IResult AccountDisabled() =>
        Results.Json(new ErrorResponse("accountDisabled"), statusCode: StatusCodes.Status403Forbidden);

    /// <summary>Ends this device's session only.</summary>
    private static async Task<IResult> LogoutAsync(
        ClaimsPrincipal principal, SessionService sessions, HttpContext context, CancellationToken cancellationToken)
    {
        if (CurrentSessionId(principal) is { } sessionId)
        {
            await sessions.EndAsync(sessionId, cancellationToken);
        }

        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static async Task SignInAsync(
        HttpContext context, SessionService sessions, User user, CancellationToken cancellationToken)
    {
        var session = await sessions.StartAsync(user, cancellationToken);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(SessionIdClaim, session.Id.ToString()),
                ],
                CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = true });
    }

    /// <summary>
    /// Runs on every request carrying the cookie: the server-side session must still exist and be live.
    /// Each use extends it, and the cookie is reissued with it.
    /// </summary>
    private static async Task ValidateSessionAsync(CookieValidatePrincipalContext context)
    {
        var validation = context.Principal is not null && CurrentSessionId(context.Principal) is { } sessionId
            ? await context.HttpContext.RequestServices.GetRequiredService<SessionService>()
                .ValidateAsync(sessionId, context.HttpContext.RequestAborted)
            : null;

        if (validation is null)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }

        context.HttpContext.Items[typeof(User)] = validation.User;
        context.ShouldRenew = validation.Renewed;
    }

    /// <summary>The signed-in user, loaded while validating the session; null when anonymous.</summary>
    internal static User? CurrentUser(HttpContext context) =>
        context.User.Identity?.IsAuthenticated == true ? context.Items[typeof(User)] as User : null;

    /// <summary>The server-side session the request's cookie points to; null when anonymous.</summary>
    internal static Guid? CurrentSessionId(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(SessionIdClaim), out var sessionId) ? sessionId : null;

    /// <summary>400 validation problem with one error code per field.</summary>
    internal static IResult ValidationProblem(IReadOnlyDictionary<string, string> errors) =>
        Results.ValidationProblem(errors.ToDictionary(e => e.Key, e => new[] { e.Value }));

    internal static CurrentUserResponse ToResponse(User user) =>
        new(user.Id, user.Email!, user.DisplayName, user.PreferredLanguage, user.IsAdmin);
}
