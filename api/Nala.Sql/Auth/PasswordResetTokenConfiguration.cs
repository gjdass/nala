using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Auth;
using Nala.Core.Users;

namespace Nala.Sql.Auth;

public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> token)
    {
        token.ToTable("password_reset_tokens");
        token.HasKey(t => t.Id);
        token.Property(t => t.Id).HasColumnName("id").ValueGeneratedNever();
        token.Property(t => t.TokenHash).HasColumnName("token_hash");
        token.Property(t => t.UserId).HasColumnName("user_id");
        token.Property(t => t.CreatedAt).HasColumnName("created_at");
        token.Property(t => t.ExpiresAt).HasColumnName("expires_at");
        token.Property(t => t.UsedAt).HasColumnName("used_at");

        token.HasIndex(t => t.TokenHash).IsUnique().HasDatabaseName("ux_password_reset_tokens_token_hash");
        token.HasIndex(t => t.UserId).HasDatabaseName("ix_password_reset_tokens_user_id");

        // Users are never hard-deleted (deletion only clears their credentials).
        token.HasOne<User>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
