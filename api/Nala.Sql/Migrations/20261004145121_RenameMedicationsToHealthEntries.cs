using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <summary>
    /// Spec 09 slice 3: Medication is renamed Health. The table is renamed with its keys and indexes, so every entry is
    /// kept, and each user's preference row for the "medication" section becomes "health" (same position, visibility).
    /// </summary>
    public partial class RenameMedicationsToHealthEntries : Migration
    {
        private static readonly string[] Constraints =
        [
            "PK_{0}",
            "FK_{0}_babies_baby_id",
            "FK_{0}_users_logged_by_user_id",
            "FK_{0}_users_updated_by_user_id",
        ];

        private static readonly string[] Indexes =
        [
            "ix_{0}_baby_id_time_id",
            "IX_{0}_logged_by_user_id",
            "IX_{0}_updated_by_user_id",
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            Rename(migrationBuilder, from: "medications", to: "health_entries");
            migrationBuilder.Sql("UPDATE user_section_preferences SET key = 'health' WHERE key = 'medication';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE user_section_preferences SET key = 'medication' WHERE key = 'health';");
            Rename(migrationBuilder, from: "health_entries", to: "medications");
        }

        private static void Rename(MigrationBuilder migrationBuilder, string from, string to)
        {
            migrationBuilder.RenameTable(name: from, newName: to);
            foreach (var constraint in Constraints)
            {
                // Renaming the primary key constraint renames its index too.
                migrationBuilder.Sql(
                    $"ALTER TABLE {to} RENAME CONSTRAINT \"{string.Format(constraint, from)}\" TO \"{string.Format(constraint, to)}\";");
            }

            // PostgreSQL 18+ names NOT NULL constraints after the table ("medications_id_not_null"); older versions have none.
            migrationBuilder.Sql($"""
                DO $$
                DECLARE c record;
                BEGIN
                    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = '{to}'::regclass AND contype = 'n' AND conname LIKE '{from}\_%' LOOP
                        EXECUTE format('ALTER TABLE {to} RENAME CONSTRAINT %I TO %I', c.conname, '{to}' || substr(c.conname, {from.Length + 1}));
                    END LOOP;
                END $$;
                """);

            foreach (var index in Indexes)
            {
                migrationBuilder.RenameIndex(name: string.Format(index, from), table: to, newName: string.Format(index, to));
            }
        }
    }
}
