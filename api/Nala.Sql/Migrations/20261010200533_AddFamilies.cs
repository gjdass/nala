using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <inheritdoc />
    public partial class AddFamilies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "family_id",
                table: "invitations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "family_id",
                table: "babies",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "families",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_families", x => x.id);
                    table.ForeignKey(
                        name: "FK_families_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "family_memberships",
                columns: table => new
                {
                    family_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_family_memberships", x => new { x.family_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_family_memberships_families_family_id",
                        column: x => x.family_id,
                        principalTable: "families",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_family_memberships_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            // An existing instance was one family: it becomes the family "Family", administered by the instance admin, with
            // every other non-deleted, enabled user as a member, and every baby and invitation in it (spec 03).
            migrationBuilder.Sql("""
                INSERT INTO families (id, name, created_by_user_id, created_at)
                SELECT gen_random_uuid(), 'Family', id, created_at FROM users WHERE is_admin;

                INSERT INTO family_memberships (family_id, user_id, role, joined_at)
                SELECT f.id, u.id, CASE WHEN u.is_admin THEN 'admin' ELSE 'member' END, u.created_at
                FROM users u CROSS JOIN families f
                WHERE u.deleted_at IS NULL AND NOT u.is_disabled;

                UPDATE babies SET family_id = (SELECT id FROM families);
                UPDATE invitations SET family_id = (SELECT id FROM families);
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "family_id",
                table: "babies",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_invitations_family_id",
                table: "invitations",
                column: "family_id");

            migrationBuilder.CreateIndex(
                name: "ix_babies_family_id",
                table: "babies",
                column: "family_id");

            migrationBuilder.CreateIndex(
                name: "IX_families_created_by_user_id",
                table: "families",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_family_memberships_user_id",
                table: "family_memberships",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ux_family_memberships_single_admin",
                table: "family_memberships",
                column: "family_id",
                unique: true,
                filter: "role = 'admin'");

            migrationBuilder.AddForeignKey(
                name: "FK_babies_families_family_id",
                table: "babies",
                column: "family_id",
                principalTable: "families",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_invitations_families_family_id",
                table: "invitations",
                column: "family_id",
                principalTable: "families",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_babies_families_family_id",
                table: "babies");

            migrationBuilder.DropForeignKey(
                name: "FK_invitations_families_family_id",
                table: "invitations");

            migrationBuilder.DropTable(
                name: "family_memberships");

            migrationBuilder.DropTable(
                name: "families");

            migrationBuilder.DropIndex(
                name: "ix_invitations_family_id",
                table: "invitations");

            migrationBuilder.DropIndex(
                name: "ix_babies_family_id",
                table: "babies");

            migrationBuilder.DropColumn(
                name: "family_id",
                table: "invitations");

            migrationBuilder.DropColumn(
                name: "family_id",
                table: "babies");
        }
    }
}
