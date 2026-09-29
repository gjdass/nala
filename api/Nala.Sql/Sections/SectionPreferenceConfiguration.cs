using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Nala.Core.Sections;
using Nala.Core.Users;

namespace Nala.Sql.Sections;

public class SectionPreferenceConfiguration : IEntityTypeConfiguration<SectionPreference>
{
    public void Configure(EntityTypeBuilder<SectionPreference> preference)
    {
        preference.ToTable("user_section_preferences");
        preference.HasKey(p => new { p.UserId, p.Key });
        preference.Property(p => p.UserId).HasColumnName("user_id");
        preference.Property(p => p.Key).HasColumnName("key").HasMaxLength(SectionKeys.MaxLength);
        preference.Property(p => p.Position).HasColumnName("position");
        preference.Property(p => p.Visible).HasColumnName("visible");

        // Users are only soft-deleted; the cascade just keeps the table clean if one ever goes.
        preference.HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
