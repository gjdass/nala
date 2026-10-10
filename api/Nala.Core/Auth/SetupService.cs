using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Core.Auth;

public sealed record SetupCommand(string? Email, string? DisplayName, string? Password, string? Language, string? FamilyName);

public abstract record SetupResult
{
    public sealed record Created(User User) : SetupResult;

    public sealed record AlreadySetUp : SetupResult;

    /// <summary>Field name → error code (<c>required</c>, <c>invalid</c>, <c>tooShort</c>, <c>tooLong</c>), <c>familyName</c> included.</summary>
    public sealed record Invalid(IReadOnlyDictionary<string, string> Errors) : SetupResult;
}

/// <summary>First-run setup: the first account of an empty instance becomes its only admin, and the admin of its first family.</summary>
public class SetupService(IUserRepository users, IFamilyRepository families, IPasswordHasher hasher, TimeProvider time)
{
    public async Task<SetupResult> SetupAsync(SetupCommand command, CancellationToken cancellationToken = default)
    {
        if (await users.AnyAsync(cancellationToken))
        {
            return new SetupResult.AlreadySetUp();
        }

        var errors = AccountFields.Validate(command.Email, command.DisplayName, command.Password);
        if (FamilyName.Validate(command.FamilyName, out var familyName) is { } familyNameError)
        {
            errors["familyName"] = familyNameError;
        }

        if (errors.Count > 0)
        {
            return new SetupResult.Invalid(errors);
        }

        EmailAddress.TryNormalize(command.Email, out var email);
        DisplayName.TryNormalize(command.DisplayName, out var displayName);
        var now = time.GetUtcNow();
        var admin = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = displayName,
            PasswordHash = hasher.Hash(command.Password!),
            PreferredLanguage = Language.OrDefault(command.Language),
            IsAdmin = true,
            CreatedAt = now,
        };
        var family = new Family { Id = Guid.NewGuid(), Name = familyName, CreatedByUserId = admin.Id, CreatedAt = now };
        var membership = new Membership { FamilyId = family.Id, UserId = admin.Id, Role = FamilyRole.Admin, JoinedAt = now };

        try
        {
            await families.AddWithNewAdminAsync(admin, family, membership, cancellationToken);
        }
        catch (UserConflictException)
        {
            // Another setup won the race for the single admin slot.
            return new SetupResult.AlreadySetUp();
        }

        return new SetupResult.Created(admin);
    }
}
