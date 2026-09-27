using Nala.Core.Users;

namespace Nala.Core.Auth;

public sealed record LoginCommand(string? Email, string? Password);

public abstract record LoginResult
{
    public sealed record Success(User User) : LoginResult;

    /// <summary>Wrong email or wrong password: deliberately the same result.</summary>
    public sealed record InvalidCredentials : LoginResult;

    public sealed record LockedOut : LoginResult;

    /// <summary>Field name → error code (<c>required</c>).</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : LoginResult;
}

/// <summary>Email + password login, throttled per email whether or not an account has it.</summary>
public class LoginService(
    IUserRepository users, IPasswordHasher hasher, ILoginFailureRepository failures, TimeProvider time)
{
    public async Task<LoginResult> LoginAsync(LoginCommand command, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        if (string.IsNullOrWhiteSpace(command.Email))
        {
            errors["email"] = "required";
        }

        if (string.IsNullOrEmpty(command.Password))
        {
            errors["password"] = "required";
        }

        if (errors.Count > 0)
        {
            return new LoginResult.Invalid(errors);
        }

        // A malformed email is simply one no account has: it goes through the same path.
        EmailAddress.TryNormalize(command.Email, out var email);
        var now = time.GetUtcNow();
        if (await failures.CountSinceAsync(email, now - LoginThrottle.Window, cancellationToken) >= LoginThrottle.MaxFailures)
        {
            return new LoginResult.LockedOut();
        }

        var user = await users.GetByEmailAsync(email, cancellationToken);
        var valid = user?.PasswordHash is { } hash
            ? hasher.Verify(hash, command.Password!)
            : SpendHashingTime(command.Password!);

        if (!valid)
        {
            await failures.AddAsync(email, now, cancellationToken);
            return new LoginResult.InvalidCredentials();
        }

        await failures.ClearAsync(email, cancellationToken);
        return new LoginResult.Success(user!);
    }

    /// <summary>An unknown email costs as much as a wrong password, so response time doesn't tell them apart.</summary>
    private bool SpendHashingTime(string password)
    {
        hasher.Hash(password);
        return false;
    }
}
