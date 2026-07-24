import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createClient } = require("@supabase/supabase-js");

const BUYER_ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const NOVA_RELATIONSHIP_ID = "40000000-0000-4000-8000-000000000001";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const supabaseUrl = required("E2E_SUPABASE_URL").replace(/\/$/, "");
const publishableKey = required("E2E_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = required("E2E_SUPABASE_SERVICE_ROLE_KEY");

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
  if (error || !data.session) {
    throw error ?? new Error(`Could not sign in ${email}.`);
  }
  await supabase.realtime.setAuth(data.session.access_token);
  return data.session.access_token;
}

async function subscribe(channel, expectedStatus, timeoutMs = 15_000) {
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

async function edgeRequest(accessToken, functionName, body, expectedStatuses) {
  const headers = {
    apikey: publishableKey,
    "content-type": "application/json",
  };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  assert(
    expectedStatuses.includes(response.status),
    `${functionName} returned unexpected status ${response.status}.`,
  );
  return payload;
}

const anonymous = client(publishableKey);
const buyer = client(publishableKey);
const nova = client(publishableKey);
const greenline = client(publishableKey);
const service = client(serviceRoleKey);

let buyerChannel;
let deniedChannel;
let notificationId;

try {
  const buyerAccessToken = await signIn(
    buyer,
    "admin@apex-components.invalid",
    required("E2E_BUYER_ADMIN_PASSWORD"),
  );
  await signIn(
    nova,
    "owner@nova-plastics.invalid",
    required("E2E_NOVA_OWNER_PASSWORD"),
  );
  const greenlineAccessToken = await signIn(
    greenline,
    "owner@greenline-packaging.invalid",
    required("E2E_GREENLINE_OWNER_PASSWORD"),
  );

  const { data: anonymousRows, error: anonymousError } = await anonymous
    .from("supplier_relationships")
    .select("id");
  assert(
    anonymousError?.code === "42501" || anonymousRows?.length === 0,
    "Anonymous access returned business records.",
  );

  const { data: novaRows, error: novaError } = await nova
    .from("supplier_relationships")
    .select("id")
    .eq("id", NOVA_RELATIONSHIP_ID);
  if (novaError) throw novaError;
  assert(novaRows.length === 1, "Nova could not read its own relationship.");

  const { data: crossTenantRows, error: crossTenantError } = await greenline
    .from("supplier_relationships")
    .select("id")
    .eq("id", NOVA_RELATIONSHIP_ID);
  if (crossTenantError) throw crossTenantError;
  assert(
    crossTenantRows.length === 0,
    "Greenline could read Nova's relationship.",
  );

  const { data: supplierFindings, error: supplierFindingsError } = await nova
    .from("findings_visible")
    .select("id, internal_note")
    .eq("supplier_relationship_id", NOVA_RELATIONSHIP_ID);
  if (supplierFindingsError) throw supplierFindingsError;
  assert(
    supplierFindings.every((finding) => finding.internal_note === null),
    "A supplier-visible finding exposed an internal buyer note.",
  );

  await edgeRequest(
    null,
    "create-supplier-invitation",
    {
      buyer_organization_id: BUYER_ORGANIZATION_ID,
      intended_supplier_name: "Unauthorized Demonstration Supplier",
      invited_email: "unauthorized@portfolio-demo.invalid",
    },
    [401],
  );
  await edgeRequest(
    greenlineAccessToken,
    "create-supplier-invitation",
    {
      buyer_organization_id: BUYER_ORGANIZATION_ID,
      intended_supplier_name: "Cross-Tenant Demonstration Supplier",
      invited_email: "cross-tenant@portfolio-demo.invalid",
    },
    [403, 404],
  );

  const { data: novaDocument, error: novaDocumentError } = await service
    .from("documents")
    .select("current_version_id")
    .eq("supplier_relationship_id", NOVA_RELATIONSHIP_ID)
    .not("current_version_id", "is", null)
    .limit(1)
    .single();
  if (novaDocumentError) throw novaDocumentError;
  await edgeRequest(
    greenlineAccessToken,
    "get-signed-document-url",
    {
      document_version_id: novaDocument.current_version_id,
      expires_in_seconds: 60,
    },
    [403, 404],
  );

  const { data: evidenceBucket, error: bucketError } =
    await service.storage.getBucket("supplier-evidence");
  if (bucketError) throw bucketError;
  assert(
    evidenceBucket.public === false,
    "Supplier evidence bucket is public.",
  );

  buyerChannel = buyer
    .channel(`organization:${BUYER_ORGANIZATION_ID}:notifications`, {
      config: { private: true },
    })
    .on("broadcast", { event: "notifications.insert" }, () => {});
  await subscribe(buyerChannel, "SUBSCRIBED");

  deniedChannel = greenline.channel(
    `organization:${BUYER_ORGANIZATION_ID}:notifications`,
    { config: { private: true } },
  );
  await subscribe(deniedChannel, "CHANNEL_ERROR");

  const testNotificationId = randomUUID();
  const broadcastReceived = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Hosted private Broadcast was not received.")),
      15_000,
    );
    buyerChannel.on(
      "broadcast",
      { event: "notifications.insert" },
      ({ payload }) => {
        if (payload.resource_id === testNotificationId) {
          clearTimeout(timeout);
          resolve();
        }
      },
    );
  });

  const { error: insertError } = await service.from("notifications").insert({
    id: testNotificationId,
    organization_id: BUYER_ORGANIZATION_ID,
    related_resource_type: "relationship",
    related_resource_id: NOVA_RELATIONSHIP_ID,
    notification_type: "hosted_smoke_test",
    title: "Hosted smoke verification",
    body: "Synthetic notification removed after private Broadcast verification.",
  });
  if (insertError) throw insertError;
  notificationId = testNotificationId;
  await broadcastReceived;

  await edgeRequest(
    buyerAccessToken,
    "get-signed-document-url",
    { document_version_id: randomUUID(), expires_in_seconds: 60 },
    [404],
  );

  console.log(
    "Hosted verification passed: Auth, anonymous denial, buyer/supplier RLS, internal-field confidentiality, Edge authorization, private Storage, private Realtime authorization, and live Broadcast delivery.",
  );
} finally {
  if (notificationId) {
    await service.from("notifications").delete().eq("id", notificationId);
  }
  if (buyerChannel) await buyer.removeChannel(buyerChannel);
  if (deniedChannel) await greenline.removeChannel(deniedChannel);
  await buyer.auth.signOut();
  await nova.auth.signOut();
  await greenline.auth.signOut();
  buyer.realtime.disconnect();
  nova.realtime.disconnect();
  greenline.realtime.disconnect();
}
