# Assumptions

1. **Reference implementation:** This is an independently designed portfolio
   project, not commissioned work and not an existing production deployment.
2. **Region:** Hosted data should use a European region, preferably Frankfurt.
3. **Cost:** Free-tier resources are preferred. No plan upgrade, purchase, or
   billing change is authorized.
4. **Demo identities:** Buyer and supplier users are created from environment
   variables. No shared public password is committed.
5. **Invitations:** In local demonstration mode, the one-time invitation link is
   returned to an authorized buyer administrator because no email provider is
   required. The token is shown once and stored only as a hash.
6. **Documents:** Only small, fictional, text-based PDFs and safe text fixtures
   are processed. OCR and active-content execution are excluded.
7. **Risk scoring:** Rules are deterministic and transparent. Scores are buyer
   internal unless explicitly represented by a supplier-safe summary.
8. **Relationship access:** Access requires both active organization membership
   and an active buyer-supplier relationship where applicable.
9. **Versioning:** Published program definitions, submitted snapshots, document
   versions, risk evaluations, and decisions are immutable historical records.
10. **Notifications:** Database notifications remain testable without an
    external email provider.
11. **Deployment providers:** Supabase is required; frontend or FastAPI hosts are
    used only if already authenticated without requiring payment.
12. **Operational limits:** This portfolio environment demonstrates engineering
    controls but is not represented as a certified compliance platform.
