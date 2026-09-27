using Microsoft.EntityFrameworkCore;
using Nala.Api.Account;
using Nala.Api.Auth;
using Nala.Api.Health;
using Nala.Sql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Nala")
    ?? throw new InvalidOperationException(
        "Missing database connection string: set the ConnectionStrings__Nala environment variable.");

builder.Services.AddNalaSql(connectionString);
builder.Services.AddNalaHealth();
builder.Services.AddNalaAuth(builder.Environment);
builder.Services.AddNalaAccount();
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

app.Run();

public partial class Program;
