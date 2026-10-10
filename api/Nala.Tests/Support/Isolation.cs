using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NUnit.Framework;

namespace Nala.Tests.Support;

/// <summary>Assertions for family isolation tests (spec 03): another family's data answers like an unknown id.</summary>
public static class Isolation
{
    /// <summary>Asserts a 404 with <paramref name="code"/>; <paramref name="what"/> names the request in the failure message.</summary>
    public static async Task AssertNotFoundAsync(Task<HttpResponseMessage> request, string code, string what)
    {
        using var response = await request;
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound), what);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.That(body.GetProperty("code").GetString(), Is.EqualTo(code), what);
    }

    /// <summary>Adds a baby to the other family through its own client.</summary>
    public static async Task<Guid> AddBabyAsync(OtherFamily other, string name = "Max")
    {
        var response = await TestBabies.PostAsync(other.Client, new { name, birthDate = "2026-09-01" });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created));
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }
}
