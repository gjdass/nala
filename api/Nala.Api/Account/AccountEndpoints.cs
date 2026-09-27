using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Nala.Api.Auth;
using Nala.Core.Account;

namespace Nala.Api.Account;

public sealed record UpdateAccountRequest(string? DisplayName, string? Language);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public sealed record DeleteAccountRequest(string? Password);

/// <summary>The signed-in user's own account. Every endpoint needs a session (fallback policy).</summary>
public static class AccountEndpoints
{
    public static IServiceCollection AddNalaAccount(this IServiceCollection services) =>
        services.AddScoped<AccountService>();

    public static IEndpointRouteBuilder MapNalaAccount(this IEndpointRouteBuilder endpoints)
    {
        var account = endpoints.MapGroup("/api/account");
        account.MapPatch("", UpdateAsync);
        account.MapPost("/password", ChangePasswordAsync);
        account.MapDelete("", DeleteAsync);
        return endpoints;
    }

    private static async Task<IResult> UpdateAsync(
        UpdateAccountRequest request, AccountService account, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await account.UpdateAsync(
            AuthEndpoints.CurrentUser(context)!, new UpdateAccountCommand(request.DisplayName, request.Language), cancellationToken);

        return result is UpdateAccountResult.Updated updated
            ? Results.Ok(AuthEndpoints.ToResponse(updated.User))
            : AuthEndpoints.ValidationProblem(((UpdateAccountResult.Invalid)result).Errors);
    }

    /// <summary>Keeps this device signed in and ends every other session.</summary>
    private static async Task<IResult> ChangePasswordAsync(
        ChangePasswordRequest request,
        AccountService account,
        HttpContext context,
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var result = await account.ChangePasswordAsync(
            AuthEndpoints.CurrentUser(context)!,
            AuthEndpoints.CurrentSessionId(principal)!.Value,
            new ChangePasswordCommand(request.CurrentPassword, request.NewPassword),
            cancellationToken);

        return result is ChangePasswordResult.Changed
            ? Results.NoContent()
            : AuthEndpoints.ValidationProblem(((ChangePasswordResult.Invalid)result).Errors);
    }

    /// <summary>Signs this device out too; 403 for the admin, who must always exist.</summary>
    private static async Task<IResult> DeleteAsync(
        [FromBody] DeleteAccountRequest request, AccountService account, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await account.DeleteAsync(
            AuthEndpoints.CurrentUser(context)!, new DeleteAccountCommand(request.Password), cancellationToken);

        switch (result)
        {
            case DeleteAccountResult.Deleted:
                await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Results.NoContent();
            case DeleteAccountResult.Invalid invalid:
                return AuthEndpoints.ValidationProblem(invalid.Errors);
            default:
                return Results.Json(new ErrorResponse("adminCannotDelete"), statusCode: StatusCodes.Status403Forbidden);
        }
    }
}
