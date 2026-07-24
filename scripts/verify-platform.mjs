import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createClient } = require("@supabase/supabase-js");

const BUYER_ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const PROGRAM_ID = "50000000-0000-4000-8000-000000000001";
const REVIEWER_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const NOVA_RELATIONSHIP_ID = "40000000-0000-4000-8000-000000000001";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const supabaseUrl = required("E2E_SUPABASE_URL").replace(/\/$/, "");
const publishableKey = required("E2E_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = required("E2E_SUPABASE_SERVICE_ROLE_KEY");
const internalFunctionToken = required("E2E_INTERNAL_FUNCTION_TOKEN");

function client(key) {
  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function signIn(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user || !data.session) {
    throw error ?? new Error(`Could not sign in ${email}.`);
  }
  await supabase.realtime.setAuth(data.session.access_token);
  return { accessToken: data.session.access_token, user: data.user };
}

async function edgeRequest(accessToken, functionName, body, expectedStatuses) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        `${functionName} returned non-JSON content (${response.status}).`,
      );
    }
  }
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${functionName} returned ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return { payload, status: response.status };
}

async function processQueues() {
  const response = await fetch(`${supabaseUrl}/functions/v1/process-queues`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      "x-internal-token": internalFunctionToken,
    },
    body: "{}",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `process-queues returned ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload.queues;
}

async function subscribe(channel, expectedStatus, timeoutMs = 12_000) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Realtime did not reach ${expectedStatus}.`)),
      timeoutMs,
    );
    channel.subscribe((status) => {
      if (status === expectedStatus) {
        clearTimeout(timeout);
        resolve();
      } else if (
        expectedStatus !== "CHANNEL_ERROR" &&
        (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
      ) {
        clearTimeout(timeout);
        reject(new Error(`Realtime subscription failed with ${status}.`));
      }
    });
  });
}

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pdfBytes(label) {
  const safeLabel = label
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${safeLabel}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n`;
  document += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  document += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, "ascii");
}

const buyer = client(publishableKey);
const reviewer = client(publishableKey);
const nova = client(publishableKey);
const greenline = client(publishableKey);
const temporarySupplier = client(publishableKey);
const service = client(serviceRoleKey);

let buyerChannel;
let deniedChannel;
let temporaryUserId;
let temporaryOrganizationId;
let relationshipId;
let assessmentId;

try {
  const buyerSession = await signIn(
    buyer,
    "admin@apex-components.invalid",
    required("E2E_BUYER_ADMIN_PASSWORD"),
  );
  const reviewerSession = await signIn(
    reviewer,
    "reviewer@apex-components.invalid",
    required("E2E_BUYER_REVIEWER_PASSWORD"),
  );
  await signIn(
    nova,
    "owner@nova-plastics.invalid",
    required("E2E_NOVA_OWNER_PASSWORD"),
  );
  const greenlineSession = await signIn(
    greenline,
    "owner@greenline-packaging.invalid",
    required("E2E_GREENLINE_OWNER_PASSWORD"),
  );

  const { data: novaRelationships, error: novaRelationshipError } = await nova
    .from("supplier_relationships")
    .select("id")
    .eq("id", NOVA_RELATIONSHIP_ID);
  if (novaRelationshipError) throw novaRelationshipError;
  assert(
    novaRelationships.length === 1,
    "Nova could not read its relationship.",
  );

  const { data: crossTenantRows, error: crossTenantError } = await greenline
    .from("supplier_relationships")
    .select("id")
    .eq("id", NOVA_RELATIONSHIP_ID);
  if (crossTenantError) throw crossTenantError;
  assert(
    crossTenantRows.length === 0,
    "Greenline could read Nova's relationship.",
  );

  buyerChannel = buyer
    .channel(`buyer:${BUYER_ORGANIZATION_ID}:relationships`, {
      config: { private: true },
    })
    .on("broadcast", { event: "*" }, () => {});
  await subscribe(buyerChannel, "SUBSCRIBED");

  const unique = randomUUID().slice(0, 8);
  const temporaryEmail = `owner+${unique}@orbit-fasteners.invalid`;
  const temporaryPassword = randomBytes(24).toString("base64url");
  const { data: createdUser, error: createUserError } =
    await service.auth.admin.createUser({
      email: temporaryEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: "Orin Orbit" },
    });
  if (createUserError || !createdUser.user) {
    throw (
      createUserError ?? new Error("Temporary supplier user was not created.")
    );
  }
  temporaryUserId = createdUser.user.id;
  const temporarySession = await signIn(
    temporarySupplier,
    temporaryEmail,
    temporaryPassword,
  );

  const invitation = await edgeRequest(
    buyerSession.accessToken,
    "create-supplier-invitation",
    {
      buyer_organization_id: BUYER_ORGANIZATION_ID,
      intended_supplier_name: "Orbit Fasteners Demonstration Ltd.",
      invited_email: temporaryEmail,
      expires_in_hours: 24,
    },
    [201],
  );
  assert(
    invitation.payload.invitation_id && invitation.payload.token,
    "Invitation response was incomplete.",
  );

  const accepted = await edgeRequest(
    temporarySession.accessToken,
    "accept-supplier-invitation",
    {
      invitation_token: invitation.payload.token,
      new_supplier: {
        legal_name: "Orbit Fasteners Demonstration Ltd.",
        display_name: "Orbit Fasteners",
        slug: `orbit-fasteners-${unique}`,
        country_code: "DE",
      },
    },
    [200],
  );
  relationshipId = accepted.payload.relationship_id;
  temporaryOrganizationId = accepted.payload.organization_id;
  assert(
    relationshipId && temporaryOrganizationId,
    "Invitation acceptance did not return the relationship and organization.",
  );

  deniedChannel = greenline.channel(
    `relationship:${relationshipId}:assessment`,
    {
      config: { private: true },
    },
  );
  await subscribe(deniedChannel, "CHANNEL_ERROR");

  const assessmentBroadcast = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Assessment private Broadcast was not received.")),
      12_000,
    );
    buyerChannel.on(
      "broadcast",
      { event: "assessments.insert" },
      ({ payload }) => {
        if (payload.relationship_id === relationshipId) {
          clearTimeout(timeout);
          resolve();
        }
      },
    );
  });

  const { data: assessment, error: assessmentError } = await buyer.rpc(
    "create_assessment",
    {
      target_relationship_id: relationshipId,
      target_program_id: PROGRAM_ID,
      supplier_assignee: temporaryUserId,
      buyer_reviewer: REVIEWER_USER_ID,
    },
  );
  if (assessmentError) throw assessmentError;
  assessmentId = assessment.id;
  await assessmentBroadcast;

  const { error: startError } = await temporarySupplier.rpc(
    "transition_assessment",
    {
      p_assessment_id: assessmentId,
      p_expected_status: "draft",
      p_next_status: "in_progress",
    },
  );
  if (startError) throw startError;

  const incomplete = await edgeRequest(
    temporarySession.accessToken,
    "submit-assessment",
    {
      assessment_id: assessmentId,
      supplier_declaration:
        "I confirm this incomplete synthetic submission is accurate for validation.",
    },
    [422],
  );
  assert(
    incomplete.payload.error?.code === "validation_failed",
    "Incomplete submission did not return the safe validation error.",
  );

  const responses = [
    {
      assessment_id: assessmentId,
      question_id: "53000000-0000-4000-8000-000000000001",
      response_text:
        "Orbit Fasteners is a fictional demonstration supplier used for portfolio verification.",
      answered_by: temporaryUserId,
    },
    {
      assessment_id: assessmentId,
      question_id: "53000000-0000-4000-8000-000000000002",
      response_boolean: true,
      answered_by: temporaryUserId,
    },
    {
      assessment_id: assessmentId,
      question_id: "53000000-0000-4000-8000-000000000003",
      response_number: 97,
      answered_by: temporaryUserId,
    },
    {
      assessment_id: assessmentId,
      question_id: "53000000-0000-4000-8000-000000000004",
      response_option_id: "54000000-0000-4000-8000-000000000001",
      answered_by: temporaryUserId,
    },
    {
      assessment_id: assessmentId,
      question_id: "53000000-0000-4000-8000-000000000006",
      response_date: dateOffset(-30),
      answered_by: temporaryUserId,
    },
  ];
  const { error: responseError } = await temporarySupplier
    .from("assessment_responses")
    .insert(responses);
  if (responseError) throw responseError;

  const requirements = [
    {
      id: "55000000-0000-4000-8000-000000000001",
      key: "business_registration",
      filename: "orbit-business-registration-demo.pdf",
      mimeType: "application/pdf",
      bytes: pdfBytes("Demonstration Data - Fictional Business Registration"),
      issueDate: dateOffset(-30),
      expiryDate: null,
    },
    {
      id: "55000000-0000-4000-8000-000000000002",
      key: "quality_certificate",
      filename: "orbit-quality-certificate-demo.pdf",
      mimeType: "application/pdf",
      bytes: pdfBytes("Demonstration Data - Fictional Quality Certificate"),
      issueDate: dateOffset(-30),
      expiryDate: dateOffset(365),
    },
    {
      id: "55000000-0000-4000-8000-000000000003",
      key: "insurance_confirmation",
      filename: "orbit-insurance-confirmation-demo.pdf",
      mimeType: "application/pdf",
      bytes: pdfBytes("Demonstration Data - Fictional Insurance Confirmation"),
      issueDate: dateOffset(-30),
      expiryDate: dateOffset(365),
    },
    {
      id: "55000000-0000-4000-8000-000000000004",
      key: "environmental_policy",
      filename: "orbit-environmental-policy-demo.txt",
      mimeType: "text/plain",
      bytes: Buffer.from(
        "Demonstration Data\nFictional environmental policy for integration verification.\n",
      ),
      issueDate: null,
      expiryDate: null,
    },
  ];
  const documentVersionIds = [];

  for (const requirement of requirements) {
    const digest = createHash("sha256").update(requirement.bytes).digest("hex");
    const reservation = await edgeRequest(
      temporarySession.accessToken,
      "create-document-upload",
      {
        assessment_id: assessmentId,
        supplier_relationship_id: relationshipId,
        document_requirement_id: requirement.id,
        document_type: requirement.key,
        original_filename: requirement.filename,
        mime_type: requirement.mimeType,
        byte_size: requirement.bytes.length,
        sha256_hash: digest,
        issue_date: requirement.issueDate,
        expiry_date: requirement.expiryDate,
        issuing_body: "Fictional Demonstration Authority",
      },
      [201],
    );
    const upload = reservation.payload.upload;
    const { error: uploadError } = await temporarySupplier.storage
      .from(reservation.payload.bucket)
      .uploadToSignedUrl(upload.path, upload.token, requirement.bytes, {
        contentType: requirement.mimeType,
      });
    if (uploadError) throw uploadError;
    documentVersionIds.push(reservation.payload.document_version_id);
    await edgeRequest(
      temporarySession.accessToken,
      "finalize-document-upload",
      { document_version_id: reservation.payload.document_version_id },
      [202],
    );
  }

  const documentQueues = await processQueues();
  assert(
    documentQueues.document_processing.processed === requirements.length,
    `Expected ${requirements.length} processed documents, received ${documentQueues.document_processing.processed}.`,
  );

  const { data: readyVersions, error: readyError } = await temporarySupplier
    .from("document_versions")
    .select("id, upload_status")
    .in("id", documentVersionIds);
  if (readyError) throw readyError;
  assert(
    readyVersions.every((version) => version.upload_status === "ready"),
    "At least one evidence document did not become ready.",
  );

  const signedEvidence = await edgeRequest(
    buyerSession.accessToken,
    "get-signed-document-url",
    { document_version_id: documentVersionIds[0], expires_in_seconds: 60 },
    [200],
  );
  const evidenceResponse = await fetch(signedEvidence.payload.signed_url);
  assert(evidenceResponse.ok, "Authorized evidence download failed.");
  assert(
    Buffer.from(await evidenceResponse.arrayBuffer())
      .subarray(0, 4)
      .toString() === "%PDF",
    "Authorized evidence download was not the expected PDF.",
  );
  await edgeRequest(
    greenlineSession.accessToken,
    "get-signed-document-url",
    { document_version_id: documentVersionIds[0], expires_in_seconds: 60 },
    [403, 404],
  );

  const submitted = await edgeRequest(
    temporarySession.accessToken,
    "submit-assessment",
    {
      assessment_id: assessmentId,
      supplier_declaration:
        "I confirm that this synthetic qualification submission is complete and accurate.",
    },
    [200],
  );
  assert(
    submitted.payload.status === "submitted",
    "Assessment did not enter submitted status.",
  );
  await processQueues();

  const { error: reviewStartError } = await reviewer.rpc(
    "start_assessment_review",
    {
      target_assessment_id: assessmentId,
    },
  );
  if (reviewStartError) throw reviewStartError;

  const finding = await edgeRequest(
    reviewerSession.accessToken,
    "create-finding",
    {
      assessment_id: assessmentId,
      severity: "medium",
      category: "document_control",
      title: "Clarify fictional certificate ownership",
      description:
        "Provide a concise corrective action describing how certificate ownership is checked.",
      internal_note:
        "Synthetic reviewer-only note that must never reach supplier users.",
      assigned_supplier_user_id: temporaryUserId,
      due_at: `${dateOffset(14)}T12:00:00.000Z`,
    },
    [201],
  );

  const { data: supplierFinding, error: supplierFindingError } =
    await temporarySupplier
      .from("findings_visible")
      .select("id, internal_note")
      .eq("id", finding.payload.id)
      .single();
  if (supplierFindingError) throw supplierFindingError;
  assert(
    supplierFinding.internal_note === null,
    "The supplier could read a buyer-internal finding note.",
  );

  const correctiveAction = await edgeRequest(
    temporarySession.accessToken,
    "submit-corrective-action",
    {
      finding_id: finding.payload.id,
      root_cause:
        "The fictional ownership review step was not explicit in the demonstration checklist.",
      correction:
        "The checklist now records the certificate owner before a document is submitted.",
      preventive_action:
        "A second fictional reviewer will confirm ownership during every future submission.",
      target_completion_date: dateOffset(14),
    },
    [201],
  );

  const { error: verifyError } = await reviewer.rpc(
    "verify_corrective_action",
    {
      target_corrective_action_id: correctiveAction.payload.id,
      requested_outcome: "accepted",
      verification_comment:
        "The synthetic corrective action satisfies the demonstration finding.",
    },
  );
  if (verifyError) throw verifyError;

  const decision = await edgeRequest(
    buyerSession.accessToken,
    "record-approval-decision",
    {
      assessment_id: assessmentId,
      decision: "conditionally_approved",
      effective_from: dateOffset(0),
      valid_until: dateOffset(365),
      conditions:
        "Maintain current fictional certificates throughout the approval period.",
      internal_rationale:
        "Synthetic evidence, responses, and the verified corrective action support approval.",
    },
    [201],
  );
  assert(
    decision.payload.decision === "conditionally_approved",
    "Conditional approval was not recorded.",
  );

  await edgeRequest(
    buyerSession.accessToken,
    "generate-assessment-report",
    { assessment_id: assessmentId },
    [202],
  );
  const reportQueues = await processQueues();
  assert(
    reportQueues.report_generation.processed >= 1 &&
      reportQueues.report_generation.failed === 0,
    "The assessment report queue did not process the generated report.",
  );

  const { data: report, error: reportError } = await buyer
    .from("generated_assessment_reports")
    .select("storage_path, sha256_hash")
    .eq("assessment_id", assessmentId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();
  if (reportError) throw reportError;
  const { data: signedReport, error: signedReportError } = await buyer.storage
    .from("assessment-reports")
    .createSignedUrl(report.storage_path, 60);
  if (signedReportError || !signedReport) {
    throw (
      signedReportError ?? new Error("Assessment report URL was not created.")
    );
  }
  const reportResponse = await fetch(signedReport.signedUrl);
  const reportBytes = Buffer.from(await reportResponse.arrayBuffer());
  assert(
    reportResponse.ok && reportBytes.subarray(0, 4).toString() === "%PDF",
    "Generated assessment report was not a downloadable PDF.",
  );
  assert(
    createHash("sha256").update(reportBytes).digest("hex") ===
      report.sha256_hash,
    "Generated report checksum did not match its metadata.",
  );

  const { data: greenlineReport, error: greenlineReportError } =
    await greenline.storage
      .from("assessment-reports")
      .createSignedUrl(report.storage_path, 60);
  assert(
    greenlineReportError && !greenlineReport?.signedUrl,
    "Greenline obtained a report URL for the temporary supplier.",
  );

  const { count: buyerAuditCount, error: buyerAuditError } = await buyer
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("relationship_id", relationshipId);
  if (buyerAuditError) throw buyerAuditError;
  assert(
    (buyerAuditCount ?? 0) >= 7,
    "The buyer audit timeline is incomplete.",
  );
  const { count: combinedAuditCount, error: combinedAuditError } = await service
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("relationship_id", relationshipId);
  if (combinedAuditError) throw combinedAuditError;
  assert(
    (combinedAuditCount ?? 0) >= 12,
    "The combined buyer and supplier audit trail is incomplete.",
  );

  console.log(
    "Platform verification passed: Auth, invitation acceptance, relationship RLS, private Realtime, assessment validation, private Storage, durable queues, FastAPI processing, findings, corrective action, decision, report generation, and audit history.",
  );
} finally {
  if (buyerChannel) await buyer.removeChannel(buyerChannel);
  if (deniedChannel) await greenline.removeChannel(deniedChannel);

  await buyer.auth.signOut();
  await reviewer.auth.signOut();
  await nova.auth.signOut();
  await greenline.auth.signOut();
  await temporarySupplier.auth.signOut();
  buyer.realtime.disconnect();
  reviewer.realtime.disconnect();
  nova.realtime.disconnect();
  greenline.realtime.disconnect();
  temporarySupplier.realtime.disconnect();
}
