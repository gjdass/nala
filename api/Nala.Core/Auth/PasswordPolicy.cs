namespace Nala.Core.Auth;

/// <summary>Length is the only rule: no composition requirements.</summary>
public static class PasswordPolicy
{
    public const int MinLength = 8;

    public static bool IsValid(string? password) => password is not null && password.Length >= MinLength;
}
