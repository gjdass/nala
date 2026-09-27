using System.Security.Cryptography;
using System.Text;

namespace Nala.Core.Invitations;

/// <summary>The secret in an invitation link: 32 random bytes, base64url. Only its hash is stored.</summary>
public static class InvitationToken
{
    public static string Generate() => Base64Url(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) => Base64Url(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
