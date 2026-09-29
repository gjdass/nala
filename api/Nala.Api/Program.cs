using Microsoft.EntityFrameworkCore;
using Nala.Api.Account;
using Nala.Api.Admin;
using Nala.Api.Auth;
using Nala.Api.Babies;
using Nala.Api.Email;
using Nala.Api.Health;
using Nala.Api.Invitations;
using Nala.Sql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Nala")
    ?? throw new InvalidOperationException(
        "Missing database connection string: set the ConnectionStrings__Nala environment variable.");

builder.Services.AddNalaSql(connectionString);
builder.Services.AddNalaHealth();
builder.Services.AddNalaEmail(builder.Configuration);
builder.Services.AddNalaAuth(builder.Environment);
builder.Services.AddNalaAccount();
builder.Services.AddNalaAdmin();
builder.Services.AddNalaBabies();
builder.Services.AddNalaInvitations();
builder.Services.AddSingleton(TimeProvider.System);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<NalaDbContext>().Database.Migrate();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapNalaHealth();
app.MapNalaAuth();
app.MapNalaAccount();
app.MapNalaAdmin();
app.MapNalaBabies();
app.MapNalaInvitations();

app.Run();

public partial class Program;
