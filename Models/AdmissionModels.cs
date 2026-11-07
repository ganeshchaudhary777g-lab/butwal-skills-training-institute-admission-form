using System.ComponentModel.DataAnnotations;

namespace AdmissionWeb.Models;

public sealed class Course
{
    public int Id { get; init; }
    public string Name { get; init; } = "";
    public string Description { get; init; } = "";
    public string Topics { get; init; } = "";
    public int RegularFee { get; init; }
    public int DiscountPercent { get; init; }
    public int AdvertisedFee { get; init; }
    public bool Active { get; init; }
    public bool RequiresConfirmation { get; init; }
    public bool HasPricingMismatch => AdvertisedFee != (int)Math.Round(RegularFee * (100 - DiscountPercent) / 100m, MidpointRounding.AwayFromZero);
    public bool NeedsConfirmation => RequiresConfirmation || HasPricingMismatch;
    public int PayableFee => NeedsConfirmation
        ? AdvertisedFee
        : (int)Math.Round(RegularFee * (100 - DiscountPercent) / 100m, MidpointRounding.AwayFromZero);
    public int DiscountAmount => RegularFee - PayableFee;
}

public sealed class AdmissionSubmission
{
    [Required, StringLength(100, MinimumLength = 2)] public string FullName { get; set; } = "";
    [Required, StringLength(100, MinimumLength = 2)] public string FatherName { get; set; } = "";
    [StringLength(80)] public string? PreferredClassTime { get; set; }
    [Required] public DateOnly? DateOfBirth { get; set; }
    [StringLength(30)] public string Gender { get; set; } = "";
    [Required, StringLength(20)] public string MobileNumber { get; set; } = "";
    [StringLength(254)] public string? Email { get; set; }
    [Required, StringLength(300)] public string PermanentAddress { get; set; } = "";
    [StringLength(300)] public string? CurrentAddress { get; set; }
    [StringLength(100)] public string Municipality { get; set; } = "";
    [StringLength(100)] public string District { get; set; } = "";
    [StringLength(100)] public string Province { get; set; } = "";
    [Required, StringLength(150)] public string HighestQualification { get; set; } = "";
    [StringLength(180)] public string? SchoolCollege { get; set; }
    public int? PassedYear { get; set; }
    [StringLength(100)] public string EmergencyContactName { get; set; } = "";
    [StringLength(80)] public string EmergencyRelationship { get; set; } = "";
    [StringLength(20)] public string EmergencyContactNumber { get; set; } = "";
    [Range(1, int.MaxValue)] public int CourseId { get; set; }
    [Range(0, 10_000_000)] public int InitialPaidAmount { get; set; }
    [Required, StringLength(30)] public string PaymentMethod { get; set; } = "";
    [StringLength(80)] public string? TransactionReference { get; set; }
    [Required, StringLength(80, MinimumLength = 20)] public string SubmissionToken { get; set; } = "";
    public bool ConfirmInformation { get; set; }
    /// <summary>Passport-size photo as a base64 string or data URL (JPEG, PNG or WebP, at most 400 KB after decoding).</summary>
    public string? PhotoData { get; set; }
}

public sealed record SavedAdmission(
    string ApplicationNumber, string CourseName, int OriginalFee, int DiscountPercent,
    int DiscountAmount, int PayableFee, string PaymentStatus, string ApplicationStatus,
    bool OfferNeedsConfirmation, DateTime SubmittedAt, bool IsDuplicate);

public sealed record AdmissionListRow(
    int Id, string ApplicationNumber, string FullName, string MobileNumber,
    string CourseName, int PayableFee, string ApplicationStatus,
    string PaymentStatus, DateTime SubmittedAt);

public sealed record AdminPageResult(
    IReadOnlyList<AdmissionListRow> Rows, int Page, int PageSize, int TotalRows);

public sealed record AdminSummary(
    int TotalApplications, int PendingApplications, int ApprovedApplications,
    int RejectedApplications, int PendingPayments, int VerifiedPayments);

public sealed record AdmissionDetails(
    int Id, string ApplicationNumber, string FullName, string FatherName, string PreferredClassTime, string MobileNumber,
    string Email, string DateOfBirth, string Gender, string PermanentAddress,
    string CurrentAddress, string Municipality, string District, string Province,
    string HighestQualification, string SchoolCollege, int? PassedYear,
    string EmergencyContactName, string EmergencyRelationship, string EmergencyContactNumber,
    string CourseName, int OriginalFee, int DiscountPercent, int DiscountAmount,
    int PayableFee, int ClaimedPaymentAmount, string PaymentMethod, string TransactionReference,
    string PaymentStatus, string ApplicationStatus, bool OfferNeedsConfirmation,
    DateTime PaymentUpdatedAt, DateTime SubmittedAt);

public sealed class CourseUpdate
{
    [Required, StringLength(120, MinimumLength = 3)] public string Name { get; set; } = "";
    [StringLength(400)] public string Description { get; set; } = "";
    [StringLength(600)] public string Topics { get; set; } = "";
    [Range(1, int.MaxValue)] public int RegularFee { get; set; }
    [Range(0, 100)] public int DiscountPercent { get; set; }
    [Range(0, int.MaxValue)] public int AdvertisedFee { get; set; }
    public bool Active { get; set; }
    public bool RequiresConfirmation { get; set; }
}

public sealed class StudentUpdate
{
    public string FullName { get; set; } = "";
    public string FatherName { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    public string Gender { get; set; } = "";
    public string MobileNumber { get; set; } = "";
    public string? Email { get; set; }
    public string PermanentAddress { get; set; } = "";
    public string? CurrentAddress { get; set; }
    public string Municipality { get; set; } = "";
    public string District { get; set; } = "";
    public string Province { get; set; } = "";
    public string HighestQualification { get; set; } = "";
    public string? PreferredClassTime { get; set; }
}

public sealed record StatusChange(string Status, string? Note);
public sealed record PaymentChange(string Status, string? TransactionReference, string? Note);
public sealed record AdminLogin(string Username, string Password);
public sealed record AdminAccountRequest(string Username, string Password);
public sealed record AdminPasswordResetRequest(string Username, string Password);
public sealed record ApiError(string Error);
