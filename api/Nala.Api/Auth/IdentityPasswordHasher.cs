using Microsoft.AspNetCore.Identity;
using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Api.Auth;

/// <summary>ASP.NET Core Identity's hasher (PBKDF2, per-password salt). The user argument is unused by it.</summary>
public class IdentityPasswordHasher : IPasswordHasher
{
    private static readonly User Unused = new() { DisplayName = string.Empty, PreferredLanguage = Language.Default };

    private readonly PasswordHasher<User> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(Unused, password);

    public bool Verify(string hash, string password) =>
        _hasher.VerifyHashedPassword(Unused, hash, password) != PasswordVerificationResult.Failed;
}
