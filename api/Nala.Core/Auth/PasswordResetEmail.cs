using Nala.Core.Email;
using Nala.Core.Users;

namespace Nala.Core.Auth;

/// <summary>The email carrying a reset link, in the user's language (English when it has no translation).</summary>
public static class PasswordResetEmail
{
    public static EmailMessage Compose(User user, Uri publicUrl, string token)
    {
        var link = $"{publicUrl.AbsoluteUri.TrimEnd('/')}/reset/{token}";
        return user.PreferredLanguage == "fr"
            ? new EmailMessage(
                user.Email!,
                "Réinitialiser votre mot de passe Nala",
                $"""
                Bonjour {user.DisplayName},

                Quelqu'un (vous, sans doute) a demandé à réinitialiser le mot de passe de votre compte Nala. Ouvrez ce lien pour en choisir un nouveau ; il ne sert qu'une fois et pendant 1 heure :

                {link}

                Si vous n'avez rien demandé, ignorez cet email : votre mot de passe ne change pas.

                """)
            : new EmailMessage(
                user.Email!,
                "Reset your Nala password",
                $"""
                Hello {user.DisplayName},

                Someone (hopefully you) asked to reset the password of your Nala account. Open this link to choose a new one; it works once, for 1 hour:

                {link}

                If you didn't ask, ignore this email: your password stays the same.

                """);
    }
}
