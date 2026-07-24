# Sample Document Source Material

These files are fictional source material for future generation of small,
text-based PDF fixtures. They are not real certificates, registrations,
insurance records, policies, or customer documents.

## Sources

| File | Intended generated fixture | Scenario |
| --- | --- | --- |
| `fictional-business-registration.txt` | `fictional-business-registration.pdf` | Required evidence accepted |
| `fictional-quality-certificate-v1.txt` | `fictional-quality-certificate-v1.pdf` | Approaching expiry and replacement requested |
| `fictional-quality-certificate-v2.txt` | `fictional-quality-certificate-v2.pdf` | Replacement version accepted |
| `fictional-insurance-confirmation.txt` | `fictional-insurance-confirmation.pdf` | Required evidence accepted |
| `fictional-environmental-policy.md` | `fictional-environmental-policy.pdf` | Optional demonstration policy |
| `malformed-document-source.txt` | Invalid parser fixture | Safe text describing a deliberately invalid input |

## Generation rules

When PDF generation code exists:

- render text only
- embed no JavaScript, attachment, external reference, form, macro, or image
- mark every page `DEMONSTRATION DATA - NOT A REAL DOCUMENT`
- use deterministic metadata where the PDF library permits
- keep each file below the configured one-megabyte fixture limit
- record generated SHA-256 values rather than inventing them

No generated PDF is committed or reported as tested until the generator and
parser checks execute successfully.
