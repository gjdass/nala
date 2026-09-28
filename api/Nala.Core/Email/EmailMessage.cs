namespace Nala.Core.Email;

/// <summary>A plain-text email to one recipient.</summary>
public sealed record EmailMessage(string To, string Subject, string Body);
