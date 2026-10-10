namespace Nala.Core.Users;

/// <summary>A caregiver account. Every user of the instance is a member of its family.</summary>
public class User
{
    public Guid Id { get; init; }

    /// <summary>Normalized (trimmed, lower-case). Null once the account is deleted.</summary>
    public string? Email { get; set; }

    public required string DisplayName { get; set; }

    /// <summary>Null once the account is deleted.</summary>
    public string? PasswordHash { get; set; }

    public required string PreferredLanguage { get; set; }

    public bool IsAdmin { get; init; }

    public DateTimeOffset? DeletedAt { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? LastActivityAt { get; set; }
}
