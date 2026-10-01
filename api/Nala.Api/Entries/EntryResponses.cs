using Nala.Core.Entries;

namespace Nala.Api.Entries;

/// <summary>Who logged or last changed an entry; a deleted account keeps its display name.</summary>
public sealed record UserNameResponse(Guid Id, string DisplayName)
{
    public static UserNameResponse From(UserName user) => new(user.Id, user.DisplayName);
}
