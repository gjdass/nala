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
    private FakeFamilyRepository _families = null!;
    private FixedTimeProvider _time = null!;
    private RegistrationService _service = null!;
    private User _anna = null!;
    private Guid _familyId;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _families = new FakeFamilyRepository(_users);
        _invitations = new FakeInvitationRepository(_users, _families);
        _time = new FixedTimeProvider(Now);
        _service = new RegistrationService(_invitations, _users, _families, new FakePasswordHasher(), _time);
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
        _familyId = _families.Seed("Martins", Now, _anna).Id;
    }

    /// <summary>Seeds an invitation created by Anna now, to her family unless <paramref name="newFamily"/>; returns its token.</summary>
    private string Invite(Action<Invitation>? change = null, bool newFamily = false)
    {
        var token = LinkToken.Generate();
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            TokenHash = LinkToken.Hash(token),
            FamilyId = newFamily ? null : _familyId,
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

    [Test]
    public async Task Lookup_of_a_join_invitation_returns_its_kind_and_family_name()
    {
        var valid = (InvitationLookup.Valid)await _service.LookupAsync(Invite());

        Assert.That(valid.Kind, Is.EqualTo(InvitationKind.Join));
        Assert.That(valid.FamilyName, Is.EqualTo("Martins"));
    }

    [Test]
    public async Task Lookup_of_a_new_family_invitation_has_no_family_name()
    {
        var valid = (InvitationLookup.Valid)await _service.LookupAsync(Invite(newFamily: true));

        Assert.That(valid.Kind, Is.EqualTo(InvitationKind.NewFamily));
        Assert.That(valid.FamilyName, Is.Null);
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

    private User AddBen()
    {
        var ben = new User
        {
            Id = Guid.NewGuid(),
            Email = "ben@mail.com",
            DisplayName = "Ben",
            PasswordHash = "hashed:x",
            PreferredLanguage = "en",
            CreatedAt = Now,
        };
        _users.Users.Add(ben);
        _families.Seed("Others", Now, ben);
        return ben;
    }

    [Test]
    public async Task Accept_adds_a_member_membership_and_consumes_the_invitation()
    {
        var ben = AddBen();

        var result = await _service.AcceptAsync(ben, Invite());

        Assert.That(result, Is.EqualTo(new AcceptResult.Accepted(_familyId)));
        var membership = _families.Memberships.Single(m => m.FamilyId == _familyId && m.UserId == ben.Id);
        Assert.That(
            new { membership.Role, membership.JoinedAt },
            Is.EqualTo(new { Role = FamilyRole.Member, JoinedAt = Now }));
        var invitation = _invitations.Invitations.Single();
        Assert.That(invitation.UsedAt, Is.EqualTo(Now));
        Assert.That(invitation.UsedByUserId, Is.EqualTo(ben.Id));
    }

    [Test]
    public async Task Accept_by_someone_already_in_the_family_is_already_member_and_leaves_the_invitation_unused()
    {
        var result = await _service.AcceptAsync(_anna, Invite());

        Assert.That(result, Is.EqualTo(new AcceptResult.AlreadyMember()));
        Assert.That(_invitations.Invitations.Single().UsedAt, Is.Null);
        Assert.That(_families.Memberships.Count(m => m.UserId == _anna.Id), Is.EqualTo(1));
    }

    [TestCase(InvitationProblem.Expired)]
    [TestCase(InvitationProblem.Used)]
    [TestCase(InvitationProblem.Revoked)]
    public async Task Accept_of_an_unavailable_invitation_is_refused(InvitationProblem problem)
    {
        var ben = AddBen();
        var token = Invite(i =>
        {
            switch (problem)
            {
                case InvitationProblem.Expired: i.ExpiresAt = Now; break;
                case InvitationProblem.Used: i.UsedAt = Now; i.UsedByUserId = _anna.Id; break;
                default: i.RevokedAt = Now; break;
            }
        });

        Assert.That(await _service.AcceptAsync(ben, token), Is.EqualTo(new AcceptResult.Unavailable(problem)));
        Assert.That(_families.Memberships.Any(m => m.FamilyId == _familyId && m.UserId == ben.Id), Is.False);
    }

    [Test]
    public async Task Accept_of_an_unknown_token_is_refused() =>
        Assert.That(
            await _service.AcceptAsync(AddBen(), "unknown"),
            Is.EqualTo(new AcceptResult.Unavailable(InvitationProblem.Unknown)));

    [Test]
    public async Task Accept_of_an_invitation_consumed_concurrently_is_used()
    {
        var ben = AddBen();
        var token = Invite();
        _invitations.ConsumedConcurrently = true;

        Assert.That(await _service.AcceptAsync(ben, token), Is.EqualTo(new AcceptResult.Unavailable(InvitationProblem.Used)));
        Assert.That(_families.Memberships.Any(m => m.FamilyId == _familyId && m.UserId == ben.Id), Is.False);
    }

    [Test]
    public async Task Accept_racing_another_membership_is_already_member()
    {
        var ben = AddBen();
        var token = Invite();
        _invitations.MembershipConflict = true;

        Assert.That(await _service.AcceptAsync(ben, token), Is.EqualTo(new AcceptResult.AlreadyMember()));
        Assert.That(_invitations.Invitations.Single().UsedAt, Is.Null);
    }

    private static RegisterCommand Register(string token, string? familyName) =>
        Register(token) with { FamilyName = familyName };

    [Test]
    public async Task Register_with_a_new_family_invitation_creates_the_family_with_them_as_its_admin()
    {
        var token = Invite(newFamily: true);

        var result = await _service.RegisterAsync(Register(token, " Dupont "));

        var ben = ((RegisterResult.Registered)result).User;
        var family = _families.Families.Single(f => f.Id != _familyId);
        var membership = _invitations.Memberships.Single();
        Assert.Multiple(() =>
        {
            Assert.That(family.Name, Is.EqualTo("Dupont"));
            Assert.That(family.CreatedByUserId, Is.EqualTo(ben.Id));
            Assert.That(family.CreatedAt, Is.EqualTo(Now));
            Assert.That(
                new { membership.FamilyId, membership.UserId, membership.Role, membership.JoinedAt },
                Is.EqualTo(new { FamilyId = family.Id, UserId = ben.Id, Role = FamilyRole.Admin, JoinedAt = Now }));
            Assert.That(ben.IsAdmin, Is.False);
            Assert.That(_invitations.Invitations.Single().UsedByUserId, Is.EqualTo(ben.Id));
        });
    }

    [TestCase(null, "required")]
    [TestCase("   ", "required")]
    public async Task Register_with_a_new_family_invitation_needs_a_family_name(string? familyName, string code)
    {
        var token = Invite(newFamily: true);

        var result = await _service.RegisterAsync(Register(token, familyName) with { Password = "short" });

        Assert.That(
            ((RegisterResult.Invalid)result).Errors,
            Is.EqualTo(new Dictionary<string, string> { ["password"] = "tooShort", ["familyName"] = code }));
        Assert.That(_users.Users, Has.Count.EqualTo(1));
        Assert.That(_invitations.Invitations.Single().UsedAt, Is.Null);
    }

    [Test]
    public async Task Register_with_a_new_family_invitation_refuses_a_family_name_too_long()
    {
        var result = await _service.RegisterAsync(Register(Invite(newFamily: true), new string('a', 51)));

        Assert.That(
            ((RegisterResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["familyName"] = "tooLong" }));
    }

    [Test]
    public async Task Register_with_a_join_invitation_ignores_the_family_name()
    {
        var result = await _service.RegisterAsync(Register(Invite(), new string('a', 51)));

        Assert.That(result, Is.InstanceOf<RegisterResult.Registered>());
        Assert.That(_families.Families, Has.Count.EqualTo(1));
        Assert.That(_invitations.Memberships.Single().FamilyId, Is.EqualTo(_familyId));
    }

    [Test]
    public async Task Accept_of_a_new_family_invitation_creates_the_family_with_them_as_its_admin()
    {
        var ben = AddBen();
        var token = Invite(newFamily: true);

        var result = await _service.AcceptAsync(ben, token, " Dupont ");

        var family = _families.Families.Single(f => f.Name == "Dupont");
        Assert.That(result, Is.EqualTo(new AcceptResult.Accepted(family.Id)));
        Assert.That(family.CreatedByUserId, Is.EqualTo(ben.Id));
        var membership = _families.Memberships.Single(m => m.FamilyId == family.Id);
        Assert.That(
            new { membership.UserId, membership.Role, membership.JoinedAt },
            Is.EqualTo(new { UserId = ben.Id, Role = FamilyRole.Admin, JoinedAt = Now }));
        Assert.That(_invitations.Invitations.Single().UsedByUserId, Is.EqualTo(ben.Id));
    }

    [Test]
    public async Task Accept_of_a_new_family_invitation_by_the_instance_admin_creates_another_family()
    {
        var result = await _service.AcceptAsync(_anna, Invite(newFamily: true), "Second");

        Assert.That(result, Is.InstanceOf<AcceptResult.Accepted>());
        Assert.That(_families.Memberships.Count(m => m.UserId == _anna.Id && m.Role == FamilyRole.Admin), Is.EqualTo(2));
    }

    [TestCase(null, "required")]
    [TestCase(" ", "required")]
    [TestCase("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "tooLong")]
    public async Task Accept_of_a_new_family_invitation_validates_the_family_name(string? familyName, string code)
    {
        var ben = AddBen();

        var result = await _service.AcceptAsync(ben, Invite(newFamily: true), familyName);

        Assert.That(
            ((AcceptResult.Invalid)result).Errors, Is.EqualTo(new Dictionary<string, string> { ["familyName"] = code }));
        Assert.That(_invitations.Invitations.Single().UsedAt, Is.Null);
        Assert.That(_families.Families, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task Accept_checks_the_invitation_before_the_family_name()
    {
        var token = Invite(i => i.RevokedAt = Now, newFamily: true);

        Assert.That(
            await _service.AcceptAsync(AddBen(), token, familyName: null),
            Is.EqualTo(new AcceptResult.Unavailable(InvitationProblem.Revoked)));
    }

    [Test]
    public async Task Accept_of_a_join_invitation_ignores_the_family_name()
    {
        var ben = AddBen();

        Assert.That(await _service.AcceptAsync(ben, Invite(), familyName: ""), Is.EqualTo(new AcceptResult.Accepted(_familyId)));
    }
}
