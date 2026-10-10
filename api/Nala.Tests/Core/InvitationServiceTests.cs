using Nala.Core.Auth;
using Nala.Core.Email;
using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class InvitationServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeInvitationRepository _invitations = null!;
    private FakeFamilyRepository _families = null!;
    private Family _family = null!;
    private FakeEmailOutbox _outbox = null!;
    private InvitationService _service = null!;
    private User _anna = null!;

    private static readonly Uri PublicUrl = new("https://nala.example.com/");

    [SetUp]
    public async Task SetUp()
    {
        _users = new FakeUserRepository();
        _invitations = new FakeInvitationRepository(_users);
        _outbox = new FakeEmailOutbox();
        _families = new FakeFamilyRepository(_users);
        _service = new InvitationService(_invitations, _users, _families, _outbox, new FixedTimeProvider(Now));
        _anna = NewUser("Anna", isAdmin: true);
        await _users.AddAsync(_anna);
        _family = _families.Seed("Martins", Now, _anna);
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
        var family = _families.Seed("Ben's", Now, actor);

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
            Assert.That(stored.FamilyId, Is.EqualTo(family.Id));
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

    private static string TokenIn(EmailMessage message)
    {
        const string prefix = "https://nala.example.com/invite/";
        var start = message.Body.IndexOf(prefix, StringComparison.Ordinal);
        Assert.That(start, Is.GreaterThanOrEqualTo(0), message.Body);
        return new string(message.Body[(start + prefix.Length)..].TakeWhile(c => !char.IsWhiteSpace(c)).ToArray());
    }

    [Test]
    public async Task Email_invitation_creates_a_7_day_invitation_and_queues_the_link_to_that_address()
    {
        var result = await _service.SendByEmailAsync(_anna, " Ben@Mail.com ", PublicUrl);

        var stored = _invitations.Invitations.Single();
        var message = _outbox.Messages.Single();
        Assert.Multiple(() =>
        {
            Assert.That(result, Is.EqualTo(new SendInvitationResult.Sent(Now.AddDays(7))));
            Assert.That(stored.CreatedByUserId, Is.EqualTo(_anna.Id));
            Assert.That(stored.FamilyId, Is.EqualTo(_family.Id));
            Assert.That(stored.ExpiresAt, Is.EqualTo(Now.AddDays(7)));
            Assert.That(message.To, Is.EqualTo("ben@mail.com"));
            Assert.That(stored.TokenHash, Is.EqualTo(LinkToken.Hash(TokenIn(message))));
        });
    }

    [TestCase("en", "You're invited to Nala", "Anna invites you")]
    [TestCase("fr", "Invitation à rejoindre Nala", "Anna vous invite")]
    [TestCase("de", "You're invited to Nala", "Anna invites you")]
    public async Task Email_invitation_is_in_the_inviters_language(string language, string subject, string greeting)
    {
        _anna.PreferredLanguage = language;

        await _service.SendByEmailAsync(_anna, "ben@mail.com", PublicUrl);

        var message = _outbox.Messages.Single();
        Assert.That(message.Subject, Is.EqualTo(subject));
        Assert.That(message.Body, Does.Contain(greeting));
    }

    [TestCase(null, "required")]
    [TestCase("  ", "required")]
    [TestCase("no-at", "invalid")]
    [TestCase("ben@mail", "invalid")]
    public async Task Email_invitation_rejects_a_missing_or_malformed_email(string? email, string code)
    {
        var result = await _service.SendByEmailAsync(_anna, email, PublicUrl);

        Assert.That(result, Is.InstanceOf<SendInvitationResult.Invalid>());
        Assert.That(((SendInvitationResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["email"] = code }));
        Assert.That(_invitations.Invitations, Is.Empty);
        Assert.That(_outbox.Messages, Is.Empty);
    }

    [TestCase(false)]
    [TestCase(true)]
    public async Task Email_invitation_refuses_an_email_that_has_an_account(bool disabled)
    {
        var ben = NewUser("Ben");
        ben.IsDisabled = disabled;
        await _users.AddAsync(ben);

        var result = await _service.SendByEmailAsync(_anna, " BEN@mail.com", PublicUrl);

        Assert.That(result, Is.InstanceOf<SendInvitationResult.Invalid>());
        Assert.That(((SendInvitationResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["email"] = "taken" }));
        Assert.That(_invitations.Invitations, Is.Empty);
        Assert.That(_outbox.Messages, Is.Empty);
    }

    [Test]
    public async Task Email_invitation_accepts_the_former_email_of_a_deleted_account()
    {
        var ben = NewUser("Ben");
        ben.Email = null;
        ben.DeletedAt = Now.AddDays(-1);
        await _users.AddAsync(ben);

        var result = await _service.SendByEmailAsync(_anna, "ben@mail.com", PublicUrl);

        Assert.That(result, Is.InstanceOf<SendInvitationResult.Sent>());
        Assert.That(_outbox.Messages.Single().To, Is.EqualTo("ben@mail.com"));
    }
}
