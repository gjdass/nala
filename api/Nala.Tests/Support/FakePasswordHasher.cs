using Nala.Core.Auth;

namespace Nala.Tests.Support;

public class FakePasswordHasher : IPasswordHasher
{
    public string Hash(string password) => $"hashed:{password}";

    public bool Verify(string hash, string password) => hash == Hash(password);
}
