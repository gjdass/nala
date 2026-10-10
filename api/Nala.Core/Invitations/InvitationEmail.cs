using System.Globalization;
using Nala.Core.Email;
using Nala.Core.Users;

namespace Nala.Core.Invitations;

/// <summary>The email carrying a join invitation link to <c>familyName</c>, in the inviter's language (English when it has no translation).</summary>
public static class InvitationEmail
{
    public static EmailMessage Compose(User inviter, string familyName, string to, Uri publicUrl, string token, DateTimeOffset expiresAt)
    {
        var link = $"{publicUrl.AbsoluteUri.TrimEnd('/')}/invite/{token}";
        var utc = expiresAt.UtcDateTime;
        return inviter.PreferredLanguage == "fr"
            ? new EmailMessage(
                to,
                "Invitation à rejoindre Nala",
                $"""
                Bonjour,

                {inviter.DisplayName} vous invite à rejoindre la famille « {familyName} » sur Nala, pour suivre ensemble les repas, le sommeil et les couches de bébé. Ouvrez ce lien pour la rejoindre ; il ne sert qu'une fois, jusqu'au {utc.ToString("d MMMM yyyy 'à' HH:mm", CultureInfo.GetCultureInfo("fr-FR"))} (UTC) :

                {link}

                Si vous ne connaissez pas {inviter.DisplayName}, ignorez cet email.

                """)
            : new EmailMessage(
                to,
                "You're invited to Nala",
                $"""
                Hello,

                {inviter.DisplayName} invites you to join the family "{familyName}" on Nala, to keep track of the baby's feeds, sleep and diapers together. Open this link to join; it works once, until {utc.ToString("MMMM d, yyyy 'at' HH:mm", CultureInfo.GetCultureInfo("en-US"))} (UTC):

                {link}

                If you don't know {inviter.DisplayName}, ignore this email.

                """);
    }
}
