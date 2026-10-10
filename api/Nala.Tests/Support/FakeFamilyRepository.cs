using Nala.Core.Families;
using Nala.Core.Users;

namespace Nala.Tests.Support;

/// <summary>Adding a new admin adds the user to the given user repository, like the real save.</summary>
public class FakeFamilyRepository(FakeUserRepository? users = null) : IFamilyRepository
{
    public List<Family> Families { get; } = [];

    public List<Membership> Memberships { get; } = [];

    public async Task AddWithNewAdminAsync(User admin, Family family, Membership membership, CancellationToken cancellationToken = default)
    {
        if (users is not null)
        {
            await users.AddAsync(admin, cancellationToken);
        }

        Families.Add(family);
        Memberships.Add(membership);
    }

    public Task<Family?> GetAsync(Guid familyId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Families.SingleOrDefault(f => f.Id == familyId));

    public Task<FamilyRole?> GetRoleAsync(Guid familyId, Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(Memberships.SingleOrDefault(m => m.FamilyId == familyId && m.UserId == userId)?.Role);

    public Task<Family?> RenameAsync(Guid familyId, string name, CancellationToken cancellationToken = default)
    {
        var family = Families.SingleOrDefault(f => f.Id == familyId);
        if (family is not null)
        {
            family.Name = name;
        }

        return Task.FromResult(family);
    }

    public Task<IReadOnlyList<UserFamily>> ListForUserAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<UserFamily>>(Memberships
            .Where(m => m.UserId == userId)
            .Select(m => new UserFamily(Families.Single(f => f.Id == m.FamilyId), m.Role))
            .ToList());

    /// <summary>When the last membership was removed (invitations are revoked by the real repository only).</summary>
    public DateTimeOffset? RemovedAt { get; private set; }

    /// <summary>Needs the user repository given to the constructor.</summary>
    public Task<IReadOnlyList<FamilyMember>> ListMembersAsync(Guid familyId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<FamilyMember>>(Memberships
            .Where(m => m.FamilyId == familyId)
            .Select(m => new FamilyMember(users!.Users.Single(u => u.Id == m.UserId), m.Role))
            .Where(m => m.User.DeletedAt is null)
            .ToList());

    public Task<bool> RemoveMemberAsync(Guid familyId, Guid userId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        var removed = Memberships.RemoveAll(m => m.FamilyId == familyId && m.UserId == userId) > 0;
        if (removed)
        {
            RemovedAt = now;
        }

        return Task.FromResult(removed);
    }

    /// <summary>Seeds a family with its members (the first one its admin).</summary>
    public Family Seed(string name, DateTimeOffset createdAt, params User[] members)
    {
        var family = new Family { Id = Guid.NewGuid(), Name = name, CreatedByUserId = members[0].Id, CreatedAt = createdAt };
        Families.Add(family);
        Memberships.AddRange(members.Select((user, index) => new Membership
        {
            FamilyId = family.Id,
            UserId = user.Id,
            Role = index == 0 ? FamilyRole.Admin : FamilyRole.Member,
            JoinedAt = createdAt,
        }));
        return family;
    }
}
