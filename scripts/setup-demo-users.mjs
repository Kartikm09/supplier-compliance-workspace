const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

const users = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    email: "admin@apex-components.invalid",
    password: required("E2E_BUYER_ADMIN_PASSWORD"),
    displayName: "Bela Apex",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    email: "reviewer@apex-components.invalid",
    password: required("E2E_BUYER_REVIEWER_PASSWORD"),
    displayName: "Rina Reviewer",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0",
    email: "owner@nova-plastics.invalid",
    password: required("E2E_NOVA_OWNER_PASSWORD"),
    displayName: "Nora Nova",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc0",
    email: "owner@greenline-packaging.invalid",
    password: required("E2E_GREENLINE_OWNER_PASSWORD"),
    displayName: "Gia Greenline",
  },
];

for (const user of users) {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${user.id}`,
    {
      method: "PUT",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { display_name: user.displayName },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Could not configure ${user.email}: ${response.status} ${detail}`,
    );
  }
}

console.log(`Configured ${users.length} environment-controlled demo users.`);
