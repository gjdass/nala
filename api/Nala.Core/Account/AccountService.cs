using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Core.Account;

/// <summary>Fields left null are unchanged.</summary>
public sealed record UpdateAccountCommand(string? DisplayName, string? Language);

public abstract record UpdateAccountResult
{
    public sealed record Updated(User User) : UpdateAccountResult;

    /// <summary>Field name → error code (<c>required</c>, <c>tooLong</c>, <c>invalid</c>).</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : UpdateAccountResult;
}

public sealed record ChangePasswordCommand(string? CurrentPassword, string? NewPassword);

public abstract record ChangePasswordResult
{
    public sealed record Changed : ChangePasswordResult;

    /// <summary>Field name → error code (<c>required</c>, <c>incorrect</c>, <c>tooShort</c>).</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : ChangePasswordResult;
}

/// <summary>The signed-in user's own account: display name, language, password.</summary>
public class AccountService(IUserRepository users, ISessionRepository sessions, IPasswordHasher hasher)
{
    public async Task<UpdateAccountResult> UpdateAsync(
        User user, UpdateAccountCommand command, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        var displayName = user.DisplayName;
        if (command.DisplayName is not null && !DisplayName.TryNormalize(command.DisplayName, out displayName))
        {
            errors["displayName"] = displayName.Length == 0 ? "required" : "tooLong";
        }

        if (command.Language is not null && !Language.Supported.Contains(command.Language))
        {
            errors["language"] = "invalid";
        }

        if (errors.Count > 0)
        {
            return new UpdateAccountResult.Invalid(errors);
        }

        user.DisplayName = displayName;
        user.PreferredLanguage = command.Language ?? user.PreferredLanguage;
        await users.UpdateAsync(user, cancellationToken);
        return new UpdateAccountResult.Updated(user);
    }

    /// <summary>Needs the current password; ends every other session of the user, keeping <paramref name="currentSessionId"/>.</summary>
    public async Task<ChangePasswordResult> ChangePasswordAsync(
        User user, Guid currentSessionId, ChangePasswordCommand command, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrEmpty(command.CurrentPassword))
        {
            errors["currentPassword"] = "required";
        }

        if (string.IsNullOrEmpty(command.NewPassword))
        {
            errors["newPassword"] = "required";
        }
        else if (!PasswordPolicy.IsValid(command.NewPassword))
        {
            errors["newPassword"] = "tooShort";
        }

        if (!errors.ContainsKey("currentPassword")
            && (user.PasswordHash is not { } hash || !hasher.Verify(hash, command.CurrentPassword!)))
        {
            errors["currentPassword"] = "incorrect";
        }

        if (errors.Count > 0)
        {
            return new ChangePasswordResult.Invalid(errors);
        }

        user.PasswordHash = hasher.Hash(command.NewPassword!);
        await users.UpdateAsync(user, cancellationToken);
        await sessions.DeleteOthersAsync(user.Id, currentSessionId, cancellationToken);
        return new ChangePasswordResult.Changed();
    }
}
