using Nala.Core.Auth;
using Nala.Core.Families;
using Nala.Core.Invitations;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class RegistrationServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 27, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeInvitationRepository _invitations = null!;
    private FixedTimeProvider _time = null!;
    private RegistrationService _service = null!;
    private User _anna = null!;
    private readonly Guid _familyId = Guid.NewGuid();

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _invitations = new FakeInvitationRepository(_users);
        _time = new FixedTimeProvider(Now);
        _service = new RegistrationService(_invitations, _users, new FakePasswordHasher(), _time);
        _anna = new User
        {
            Id = Guid.NewGuid(),
            Email = "anna@mail.com",
            DisplayName = "Anna",
            PasswordHash = "hashed:x",
            PreferredLanguage = "en",
            IsAdmin = true,
            CreatedAt = Now,
        };
        _users.Users.Add(_anna);
    }

    /// <summary>Seeds an invitation created by Anna now; returns its token.</summary>
    private string Invite(Action<Invitation>? change = null)
    {
        var token = LinkToken.Generate();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            FamilyId = _familyId,
            CreatedByUserId = _anna.Id,
            CreatedAt = Now,
            ExpiresAt = Now + InvitationPolicy.Lifetime,
        };
        change?.Invoke(invitation);
        _invitations.Invitations.Add(invitation);
        return token;
    }

    private static RegisterCommand Register(string token) => new(token, "Ben@Mail.com ", " Ben ", "correct horse", "fr");

    [Test]
    public async Task Lookup_of_a_valid_invitation_returns_the_inviter_and_expiry()
    {
        var result = await _service.LookupAsync(Invite());

        Assert.That(result, Is.InstanceOf<InvitationLookup.Valid>());
        var valid = (InvitationLookup.Valid)result;
        Assert.That(valid.InvitedBy, Is.EqualTo("Anna"));
        Assert.That(valid.ExpiresAt, Is.EqualTo(Now + TimeSpan.FromDays(7)));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("not-a-token")]
    public async Task Lookup_of_an_unknown_token_is_unknown(string? token) =>
        Assert.That(await _service.LookupAsync(token), Is.EqualTo(new InvitationLookup.Unavailable(InvitationProblem.Unknown)));

    [Test]
    public async Task Lookup_at_the_expiry_is_expired()
    {
        var token = Invite();
        _time.Now = Now + InvitationPolicy.Lifetime;

        Assert.That(await _service.LookupAsync(token), Is.EqualTo(new InvitationLookup.Unavailable(InvitationProblem.Expired)));
    }

    [Test]
    public async Task Lookup_just_before_the_expiry_is_valid()
    {
        var token = Invite();
        _time.Now = Now + InvitationPolicy.Lifetime - TimeSpan.FromSeconds(1);

        Assert.That(await _service.LookupAsync(token), Is.InstanceOf<InvitationLookup.Valid>());
    }

    [Test]
    public async Task Lookup_of_a_used_invitation_is_used() =>
        Assert.That(
            await _service.LookupAsync(Invite(i => { i.UsedAt = Now; i.UsedByUserId = _anna.Id; })),
            Is.EqualTo(new InvitationLookup.Unavailable(InvitationProblem.Used)));

    [Test]
    public async Task Lookup_of_a_revoked_invitation_is_revoked() =>
        Assert.That(
            await _service.LookupAsync(Invite(i => i.RevokedAt = Now)),
            Is.EqualTo(new InvitationLookup.Unavailable(InvitationProblem.Revoked)));

    [Test]
    public async Task Register_creates_a_member_and_consumes_the_invitation()
    {
        var result = await _service.RegisterAsync(Register(Invite()));

        Assert.That(result, Is.InstanceOf<RegisterResult.Registered>());
        var ben = _users.Users.Single(u => u != _anna);
        Assert.That(((RegisterResult.Registered)result).User, Is.SameAs(ben));
        Assert.That(ben.Email, Is.EqualTo("ben@mail.com"));
        Assert.That(ben.DisplayName, Is.EqualTo("Ben"));
        Assert.That(ben.PasswordHash, Is.EqualTo("hashed:correct horse"));
        Assert.That(ben.PreferredLanguage, Is.EqualTo("fr"));
        Assert.That(ben.IsAdmin, Is.False);
        Assert.That(ben.CreatedAt, Is.EqualTo(Now));
        var invitation = _invitations.Invitations.Single();
        Assert.That(invitation.UsedAt, Is.EqualTo(Now));
        Assert.That(invitation.UsedByUserId, Is.EqualTo(ben.Id));
    }

    [Test]
    public async Task Registering_joins_the_invitations_family_as_a_member()
    {
        var result = await _service.RegisterAsync(Register(Invite()));

        var ben = ((RegisterResult.Registered)result).User;
        var membership = _invitations.Memberships.Single();
        Assert.That(
            new { membership.FamilyId, membership.UserId, membership.Role, membership.JoinedAt },
            Is.EqualTo(new { FamilyId = _familyId, UserId = ben.Id, Role = FamilyRole.Member, JoinedAt = Now }));
    }

    [Test]
    public async Task Register_with_an_unsupported_language_falls_back_to_english()
    {
        await _service.RegisterAsync(Register(Invite()) with { Language = "de" });

        Assert.That(_users.Users.Single(u => u != _anna).PreferredLanguage, Is.EqualTo("en"));
    }

    [Test]
    public async Task Invitation_is_single_use()
    {
        var token = Invite();
        await _service.RegisterAsync(Register(token));

        var result = await _service.RegisterAsync(Register(token) with { Email = "carl@mail.com" });

        Assert.That(result, Is.EqualTo(new RegisterResult.Unavailable(InvitationProblem.Used)));
        Assert.That(_users.Users, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task Register_with_an_unavailable_invitation_is_refused_before_checking_the_fields()
    {
        var token = Invite(i => i.RevokedAt = Now);

        var result = await _service.RegisterAsync(new RegisterCommand(token, "anna@mail.com", "", "x", "en"));

        Assert.That(result, Is.EqualTo(new RegisterResult.Unavailable(InvitationProblem.Revoked)));
        Assert.That(_users.Users, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Register_with_an_unknown_token_is_refused()
    {
        var result = await _service.RegisterAsync(Register("unknown"));

        Assert.That(result, Is.EqualTo(new RegisterResult.Unavailable(InvitationProblem.Unknown)));
        Assert.That(_users.Users, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Register_with_an_expired_invitation_is_refused()
    {
        var token = Invite();
        _time.Now = Now + InvitationPolicy.Lifetime;

        Assert.That(await _service.RegisterAsync(Register(token)), Is.EqualTo(new RegisterResult.Unavailable(InvitationProblem.Expired)));
        Assert.That(_users.Users, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Invalid_fields_return_their_codes_and_leave_the_invitation_unused()
    {
        var result = await _service.RegisterAsync(new RegisterCommand(Invite(), "ben@localhost", "", "short", "en"));

        Assert.That(result, Is.InstanceOf<RegisterResult.Invalid>());
        Assert.That(((RegisterResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string>
        {
            ["email"] = "invalid",
            ["displayName"] = "required",
            ["password"] = "tooShort",
        }));
        Assert.That(_invitations.Invitations.Single().UsedAt, Is.Null);
    }

    [TestCase("anna@mail.com")]
    [TestCase(" Anna@MAIL.com ")]
    public async Task Email_with_an_account_is_taken(string email)
    {
        var result = await _service.RegisterAsync(Register(Invite()) with { Email = email });

        Assert.That(result, Is.InstanceOf<RegisterResult.Invalid>());
        Assert.That(((RegisterResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string> { ["email"] = "taken" }));
        Assert.That(_invitations.Invitations.Single().UsedAt, Is.Null);
    }

    [Test]
    public async Task Email_of_a_deleted_account_is_free()
    {
        var deletedEmail = "old@mail.com";
        _users.Users.Add(new User
        {
            Id = Guid.NewGuid(),
            Email = deletedEmail,
            DisplayName = "Old",
            PreferredLanguage = "en",
            DeletedAt = Now,
            CreatedAt = Now,
        });

        var result = await _service.RegisterAsync(Register(Invite()) with { Email = deletedEmail });

        Assert.That(result, Is.InstanceOf<RegisterResult.Registered>());
    }

    [Test]
    public async Task Email_taken_concurrently_is_taken()
    {
        var token = Invite();
        _users.ConflictOnAdd = true;

        var result = await _service.RegisterAsync(Register(token));

        Assert.That(((RegisterResult.Invalid)result).Errors, Is.EquivalentTo(new Dictionary<string, string> { ["email"] = "taken" }));
    }

    [Test]
    public async Task Invitation_consumed_concurrently_is_used()
    {
        var token = Invite();
        _invitations.ConsumedConcurrently = true;

        var result = await _service.RegisterAsync(Register(token));

        Assert.That(result, Is.EqualTo(new RegisterResult.Unavailable(InvitationProblem.Used)));
        Assert.That(_users.Users, Has.Count.EqualTo(1));
    }
}
