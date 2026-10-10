using Nala.Core.Families;
using Nala.Core.Members;
using Nala.Core.Users;
using Nala.Tests.Support;

namespace Nala.Tests.Core;

public class MemberServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 28, 20, 0, 0, TimeSpan.Zero);

    private FakeUserRepository _users = null!;
    private FakeFamilyRepository _families = null!;
    private MemberService _service = null!;

    [SetUp]
    public void SetUp()
    {
        _users = new FakeUserRepository();
        _families = new FakeFamilyRepository(_users);
        _service = new MemberService(
            new FamilyAccess(_families, new FakeBabyRepository(_families)), _families, _users, new FixedTimeProvider(Now));
    }

    private User NewUser(string name)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = $"{name.ToLowerInvariant()}@mail.com",
            DisplayName = name,
            PreferredLanguage = "en",
        };
        _users.Users.Add(user);
        return user;
    }

    private static IEnumerable<User> Users(ListMembersResult result) =>
        ((ListMembersResult.Listed)result).Members.Select(m => m.User);

    [Test]
    public async Task List_has_the_familys_non_deleted_members_family_admin_first_then_by_name()
    {
        var zack = NewUser("Zack");
        var anna = NewUser("anna");
        var ben = NewUser("Ben");
        var deleted = NewUser("Deleted");
        deleted.DeletedAt = Now;
        var family = _families.Seed("Martins", Now, zack, ben, anna, deleted);
        _families.Seed("Others", Now, NewUser("Carl"), ben);

        var result = await _service.ListAsync(ben, family.Id);

        Assert.That(Users(result), Is.EqualTo(new[] { zack, anna, ben }));
        Assert.That(
            ((ListMembersResult.Listed)result).Members.Select(m => m.Role),
            Is.EqualTo(new[] { FamilyRole.Admin, FamilyRole.Member, FamilyRole.Member }));
    }

    [Test]
    public async Task List_of_a_family_the_caller_isnt_in_is_not_found()
    {
        var anna = NewUser("Anna");
        var family = _families.Seed("Martins", Now, anna);
        var carl = NewUser("Carl");
        _families.Seed("Others", Now, carl);

        Assert.That(await _service.ListAsync(carl, family.Id), Is.TypeOf<ListMembersResult.NotFound>());
        Assert.That(await _service.ListAsync(carl, Guid.NewGuid()), Is.TypeOf<ListMembersResult.NotFound>());
    }

    [Test]
    public async Task Family_admin_removes_a_member()
    {
        var anna = NewUser("Anna");
        var ben = NewUser("Ben");
        var family = _families.Seed("Martins", Now, anna, ben);

        var result = await _service.RemoveAsync(anna, family.Id, ben.Id);

        Assert.That(result, Is.TypeOf<RemoveMemberResult.Removed>());
        Assert.That(_families.Memberships.Select(m => m.UserId), Is.EqualTo(new[] { anna.Id }));
        Assert.That(_families.RemovedAt, Is.EqualTo(Now));
    }

    [Test]
    public async Task Remove_checks_the_family_before_the_role()
    {
        var anna = NewUser("Anna");
        var ben = NewUser("Ben");
        var family = _families.Seed("Martins", Now, anna, ben);
        var carl = NewUser("Carl");
        _families.Seed("Others", Now, carl);

        Assert.That(await _service.RemoveAsync(carl, family.Id, ben.Id), Is.TypeOf<RemoveMemberResult.NotFound>());
        Assert.That(await _service.RemoveAsync(carl, Guid.NewGuid(), ben.Id), Is.TypeOf<RemoveMemberResult.NotFound>());
        Assert.That(_families.Memberships, Has.Count.EqualTo(3));
    }

    [Test]
    public async Task A_member_who_isnt_the_family_admin_is_forbidden_before_the_target_is_checked()
    {
        var anna = NewUser("Anna");
        var ben = NewUser("Ben");
        var chloe = NewUser("Chloe");
        var family = _families.Seed("Martins", Now, anna, ben, chloe);

        Assert.That(await _service.RemoveAsync(ben, family.Id, chloe.Id), Is.TypeOf<RemoveMemberResult.Forbidden>());
        Assert.That(await _service.RemoveAsync(ben, family.Id, Guid.NewGuid()), Is.TypeOf<RemoveMemberResult.Forbidden>());
        Assert.That(await _service.RemoveAsync(ben, family.Id, anna.Id), Is.TypeOf<RemoveMemberResult.Forbidden>());
        Assert.That(_families.Memberships, Has.Count.EqualTo(3));
    }

    [Test]
    public async Task Someone_not_in_the_family_or_deleted_is_user_not_found()
    {
        var anna = NewUser("Anna");
        var dan = NewUser("Dan");
        dan.DeletedAt = Now;
        var family = _families.Seed("Martins", Now, anna, dan);
        var carl = NewUser("Carl");
        _families.Seed("Others", Now, carl);

        foreach (var id in new[] { Guid.NewGuid(), carl.Id, dan.Id })
        {
            Assert.That(await _service.RemoveAsync(anna, family.Id, id), Is.TypeOf<RemoveMemberResult.UserNotFound>());
        }
    }

    [Test]
    public async Task Family_admin_cannot_remove_themselves()
    {
        var anna = NewUser("Anna");
        var family = _families.Seed("Martins", Now, anna);

        Assert.That(await _service.RemoveAsync(anna, family.Id, anna.Id), Is.TypeOf<RemoveMemberResult.AdminCannotRemove>());
        Assert.That(_families.Memberships, Has.Count.EqualTo(1));
    }
}
