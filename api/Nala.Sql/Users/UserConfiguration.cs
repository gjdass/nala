using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Sql.Users;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> user)
    {
        user.ToTable("users");
        user.HasKey(u => u.Id);
        user.Property(u => u.Id).HasColumnName("id").ValueGeneratedNever();
        user.Property(u => u.Email).HasColumnName("email").HasMaxLength(EmailAddress.MaxLength);
        user.Property(u => u.DisplayName).HasColumnName("display_name").HasMaxLength(DisplayName.MaxLength);
        user.Property(u => u.PasswordHash).HasColumnName("password_hash");
        user.Property(u => u.PreferredLanguage).HasColumnName("preferred_language").HasMaxLength(8);
        user.Property(u => u.IsAdmin).HasColumnName("is_admin");
        user.Property(u => u.DeletedAt).HasColumnName("deleted_at");
        user.Property(u => u.CreatedAt).HasColumnName("created_at");
        user.Property(u => u.LastActivityAt).HasColumnName("last_activity_at");

        // Emails are stored normalized; a deleted account frees its email.
        user.HasIndex(u => u.Email).IsUnique().HasFilter("deleted_at IS NULL").HasDatabaseName("ux_users_email");

        // The instance has exactly one admin.
        user.HasIndex(u => u.IsAdmin).IsUnique().HasFilter("is_admin").HasDatabaseName("ux_users_single_admin");
    }
}
