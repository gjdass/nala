using Nala.Core.Auth;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class InvitationServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeInvitationRepository _invitations = null!;
    private InvitationService _service = null!;
    private User _anna = null!;

    [SetUp]
    public async Task SetUp()
    {
        _users = new FakeUserRepository();
        _invitations = new FakeInvitationRepository(_users);
        _service = new InvitationService(_invitations, _users, new FixedTimeProvider(Now));
        _anna = NewUser("Anna", isAdmin: true);
        await _users.AddAsync(_anna);
    }

    private static User NewUser(string name, bool isAdmin = false) => new()
    {
        Id = Guid.NewGuid(),
        Email = $"{name.ToLowerInvariant()}@mail.com",
        DisplayName = name,
        PreferredLanguage = "en",
        IsAdmin = isAdmin,
    };

    private Invitation Seed(Action<Invitation>? change = null, User? createdBy = null, DateTimeOffset? createdAt = null)
    {
        var at = createdAt ?? Now.AddDays(-1);
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(LinkToken.Generate()),
            CreatedByUserId = (createdBy ?? _anna).Id,
            CreatedAt = at,
            ExpiresAt = at + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        _invitations.Invitations.Add(invitation);
        return invitation;
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Any_member_creates_a_link_valid_7_days_and_only_its_hash_is_stored(bool isAdmin)
    {
        var actor = NewUser("Ben", isAdmin);

        var created = await _service.CreateAsync(actor);

        var stored = _invitations.Invitations.Single();
        Assert.Multiple(() =>
        {
            Assert.That(created.Token, Is.Not.Empty);
            Assert.That(created.ExpiresAt, Is.EqualTo(Now.AddDays(7)));
            Assert.That(stored.Id, Is.EqualTo(created.Id));
            Assert.That(stored.TokenHash, Is.EqualTo(LinkToken.Hash(created.Token)));
            Assert.That(stored.TokenHash, Is.Not.EqualTo(created.Token));
            Assert.That(stored.CreatedByUserId, Is.EqualTo(actor.Id));
            Assert.That(stored.CreatedAt, Is.EqualTo(Now));
            Assert.That(stored.ExpiresAt, Is.EqualTo(Now.AddDays(7)));
            Assert.That(stored.ProblemAt(Now), Is.Null);
        });
    }

    [Test]
    public async Task Each_link_is_different()
    {
        var first = await _service.CreateAsync(_anna);
        var second = await _service.CreateAsync(_anna);

        Assert.That(second.Token, Is.Not.EqualTo(first.Token));
    }

    [Test]
    public async Task ListPending_returns_only_pending_newest_first_with_the_creator_name()
    {
        var ben = NewUser("Ben");
        await _users.AddAsync(ben);
        var older = Seed(createdAt: Now.AddDays(-3));
        var newer = Seed(createdBy: ben, createdAt: Now.AddHours(-1));
        Seed(i =>
        {
            i.UsedAt = Now.AddHours(-2);
            i.UsedByUserId = ben.Id;
        });
        Seed(i => i.RevokedAt = Now.AddHours(-2));
        Seed(createdAt: Now.AddDays(-7));

        var pending = await _service.ListPendingAsync();

        Assert.That(pending, Is.EqualTo(new[]
        {
            new PendingInvitation(newer.Id, "Ben", newer.CreatedAt, newer.ExpiresAt),
            new PendingInvitation(older.Id, "Anna", older.CreatedAt, older.ExpiresAt),
        }));
    }

    [Test]
    public async Task Revoke_marks_a_pending_invitation_revoked()
    {
        var invitation = Seed();

        var result = await _service.RevokeAsync(invitation.Id);

        Assert.That(result, Is.InstanceOf<RevokeInvitationResult.Revoked>());
        Assert.That(invitation.RevokedAt, Is.EqualTo(Now));
        Assert.That(invitation.ProblemAt(Now), Is.EqualTo(InvitationProblem.Revoked));
    }

    [Test]
    public async Task Revoking_a_revoked_invitation_again_changes_nothing()
    {
        var invitation = Seed(i => i.RevokedAt = Now.AddHours(-1));

        var result = await _service.RevokeAsync(invitation.Id);

        Assert.That(result, Is.InstanceOf<RevokeInvitationResult.Revoked>());
        Assert.That(invitation.RevokedAt, Is.EqualTo(Now.AddHours(-1)));
    }

    [Test]
    public async Task A_used_invitation_cannot_be_revoked()
    {
        var invitation = Seed(i => i.UsedAt = Now.AddHours(-1));

        var result = await _service.RevokeAsync(invitation.Id);

        Assert.That(result, Is.EqualTo(new RevokeInvitationResult.Unavailable(InvitationProblem.Used)));
        Assert.That(invitation.RevokedAt, Is.Null);
    }

    [Test]
    public async Task An_expired_invitation_cannot_be_revoked()
    {
        var invitation = Seed(createdAt: Now.AddDays(-7));

        var result = await _service.RevokeAsync(invitation.Id);

        Assert.That(result, Is.EqualTo(new RevokeInvitationResult.Unavailable(InvitationProblem.Expired)));
        Assert.That(invitation.RevokedAt, Is.Null);
    }

    [Test]
    public async Task Revoking_an_unknown_invitation_is_not_found()
    {
        var result = await _service.RevokeAsync(Guid.NewGuid());

        Assert.That(result, Is.InstanceOf<RevokeInvitationResult.NotFound>());
    }

    [Test]
    public async Task A_revoke_losing_the_race_to_a_registration_reports_it_used()
    {
        var invitation = Seed();
        _invitations.UsedBeforeRevoke = true;

        var result = await _service.RevokeAsync(invitation.Id);

        Assert.That(result, Is.EqualTo(new RevokeInvitationResult.Unavailable(InvitationProblem.Used)));
        Assert.That(invitation.RevokedAt, Is.Null);
    }
}
