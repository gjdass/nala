using Nala.Api.Families;
using Nala.Api.Auth;
using Nala.Core.Babies;

namespace Nala.Api.Babies;

/// <summary>
/// Measurements are decimals so a fractional weight gets a validation code rather than a binding error.
/// <c>FamilyId</c> is only read when adding: a baby never changes family.
/// </summary>
public sealed record BabyRequest(
    Guid? FamilyId,
    string? Name,
    DateOnly? BirthDate,
    string? Sex,
    decimal? BirthWeightG,
    decimal? BirthLengthCm,
    decimal? BirthHeadCircumferenceCm);

/// <summary><c>BirthDate</c> is <c>yyyy-MM-dd</c>; <c>Sex</c> is <c>girl</c>, <c>boy</c> or <c>unspecified</c>.</summary>
public sealed record BabyResponse(
    Guid Id,
    Guid FamilyId,
    string Name,
    DateOnly BirthDate,
    string Sex,
    int? BirthWeightG,
    decimal? BirthLengthCm,
    decimal? BirthHeadCircumferenceCm);

/// <summary>
/// The babies of the caller's families (fallback session policy, family check in Core); there is no per-baby access.
/// Deleting is for the family admin only.
/// </summary>
public static class BabyEndpoints
{
    public static IServiceCollection AddNalaBabies(this IServiceCollection services) =>
        services.AddScoped<BabyService>();

    public static IEndpointRouteBuilder MapNalaBabies(this IEndpointRouteBuilder endpoints)
    {
        var babies = endpoints.MapGroup("/api/babies");
        babies.MapGet("", ListAsync);
        babies.MapPost("", CreateAsync);
        babies.MapPut("/{id:guid}", UpdateAsync);
        babies.MapDelete("/{id:guid}", DeleteAsync);
        return endpoints;
    }

    private static async Task<IResult> ListAsync(BabyService babies, HttpContext context, CancellationToken cancellationToken) =>
        Results.Ok((await babies.ListAsync(AuthEndpoints.CurrentUser(context)!, cancellationToken)).Select(ToResponse));

    private static async Task<IResult> CreateAsync(
        BabyRequest request, BabyService babies, HttpContext context, CancellationToken cancellationToken)
    {
        var result = await babies.CreateAsync(AuthEndpoints.CurrentUser(context)!, request.FamilyId, ToInput(request), cancellationToken);
        return result switch
        {
            CreateBabyResult.Created created => Results.Created($"/api/babies/{created.Baby.Id}", ToResponse(created.Baby)),
            CreateBabyResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            _ => FamilyEndpoints.FamilyNotFound(),
        };
    }

    private static async Task<IResult> UpdateAsync(
        Guid id, BabyRequest request, BabyService babies, HttpContext context, CancellationToken cancellationToken) =>
        await babies.UpdateAsync(AuthEndpoints.CurrentUser(context)!, id, ToInput(request), cancellationToken) switch
        {
            UpdateBabyResult.Updated updated => Results.Ok(ToResponse(updated.Baby)),
            UpdateBabyResult.Invalid invalid => AuthEndpoints.ValidationProblem(invalid.Errors),
            _ => BabyNotFound(),
        };

    private static async Task<IResult> DeleteAsync(
        Guid id, BabyService babies, HttpContext context, CancellationToken cancellationToken) =>
        await babies.DeleteAsync(AuthEndpoints.CurrentUser(context)!, id, cancellationToken) switch
        {
            DeleteBabyResult.Deleted => Results.NoContent(),
            DeleteBabyResult.NotFound => BabyNotFound(),
            _ => FamilyEndpoints.FamilyAdminOnly(),
        };

    private static IResult BabyNotFound() =>
        Results.Json(new ErrorResponse("babyNotFound"), statusCode: StatusCodes.Status404NotFound);

    private static BabyInput ToInput(BabyRequest request) =>
        new(request.Name, request.BirthDate, request.Sex, request.BirthWeightG, request.BirthLengthCm, request.BirthHeadCircumferenceCm);

    private static BabyResponse ToResponse(Baby baby) =>
        new(baby.Id, baby.FamilyId, baby.Name, baby.BirthDate, BabyFields.Format(baby.Sex), baby.BirthWeightG, baby.BirthLengthCm, baby.BirthHeadCircumferenceCm);
}
