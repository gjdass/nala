using Nala.Core.Auth;

namespace Nala.Tests.Support;

public class FakePasswordHasher : IPasswordHasher
{
    /// <summary>Number of hash or verify operations, i.e. the slow work a real hasher would do.</summary>
    public int Calls { get; private set; }

    public string Hash(string password)
    {
        Calls++;
        return $"hashed:{password}";
    }

    public bool Verify(string hash, string password)
    {
        Calls++;
        return hash == $"hashed:{password}";
    }
}
