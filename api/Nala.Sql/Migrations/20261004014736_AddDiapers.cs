using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Nala.Sql.Migrations
{
    /// <inheritdoc />
    public partial class AddDiapers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "diapers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    baby_id = table.Column<Guid>(type: "uuid", nullable: false),
                    time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    wet = table.Column<bool>(type: "boolean", nullable: false),
                    dirty = table.Column<bool>(type: "boolean", nullable: false),
                    rash = table.Column<bool>(type: "boolean", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    logged_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by_user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_diapers", x => x.id);
                    table.ForeignKey(
                        name: "FK_diapers_babies_baby_id",
                        column: x => x.baby_id,
                        principalTable: "babies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_diapers_users_logged_by_user_id",
                        column: x => x.logged_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_diapers_users_updated_by_user_id",
                        column: x => x.updated_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_diapers_baby_id_time_id",
                table: "diapers",
                columns: new[] { "baby_id", "time", "id" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_diapers_logged_by_user_id",
                table: "diapers",
                column: "logged_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_diapers_updated_by_user_id",
                table: "diapers",
                column: "updated_by_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "diapers");
        }
    }
}
