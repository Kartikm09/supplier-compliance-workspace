# Screenshot Requirements

No screenshots are included in the documentation slice. This is intentional:
static mockups or fabricated terminal output are not implementation evidence.

After the application and test scenario are operational, capture genuine,
credential-free screenshots of:

1. Buyer dashboard
2. Supplier dashboard
3. Qualification-program builder
4. Supplier assessment form with validation
5. Private document review and version history
6. Finding and corrective-action timeline
7. Conditional approval decision
8. Audit trail
9. Access-denied state for an unrelated supplier

## Capture rules

- Use only fictional demonstration data.
- Hide email addresses unless they use an intentionally fictional local setup.
- Never show passwords, invitation tokens, API keys, signed URLs, private paths,
  browser storage, or service logs containing secrets.
- Capture the actual running application.
- Record viewport and scenario in an adjacent caption.
- Verify each image visually before linking it from the README.
- Do not label a local screenshot as hosted.

Recommended filenames:

```text
buyer-dashboard.png
supplier-dashboard.png
program-builder.png
assessment-validation.png
document-review.png
finding-corrective-action.png
conditional-approval.png
audit-trail.png
cross-supplier-denial.png
```
