using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Invitations;
using Nala.Core.Users;

namespace Nala.Sql.Invitations;

public class InvitationConfiguration : IEntityTypeConfiguration<Invitation>
{
    public void Configure(EntityTypeBuilder<Invitation> invitation)
    {
        invitation.ToTable("invitations");
        invitation.HasKey(i => i.Id);
        invitation.Property(i => i.Id).HasColumnName("id").ValueGeneratedNever();
        invitation.Property(i => i.TokenHash).HasColumnName("token_hash");
        invitation.Property(i => i.CreatedByUserId).HasColumnName("created_by_user_id");
        invitation.Property(i => i.CreatedAt).HasColumnName("created_at");
        invitation.Property(i => i.ExpiresAt).HasColumnName("expires_at");
        invitation.Property(i => i.UsedAt).HasColumnName("used_at");
        invitation.Property(i => i.UsedByUserId).HasColumnName("used_by_user_id");
        invitation.Property(i => i.RevokedAt).HasColumnName("revoked_at");

        invitation.HasIndex(i => i.TokenHash).IsUnique().HasDatabaseName("ux_invitations_token_hash");

        // Users are never hard-deleted (deletion only clears their credentials).
        invitation.HasOne<User>().WithMany().HasForeignKey(i => i.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        invitation.HasOne<User>().WithMany().HasForeignKey(i => i.UsedByUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
