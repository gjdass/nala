namespace Nala.Sql.Auth;

/// <summary>Storage row for <see cref="Nala.Core.Auth.ILoginFailureRepository"/>; not a domain entity.</summary>
public class LoginFailure
{
    public long Id { get; init; }

    public required string Email { get; init; }

    public DateTimeOffset FailedAt { get; init; }
}
