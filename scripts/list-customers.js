/**
 * List customers from the Shopify dev store with their customer_profile metafields.
 *
 * Required env vars (add to .env):
 *   SHOPIFY_STORE_DOMAIN   — e.g. your-dev-store.myshopify.com
 *   SHOPIFY_ADMIN_TOKEN    — Admin API access token with read_customers scope
 *
 * Usage:
 *   node scripts/list-customers.js
 *   node scripts/list-customers.js --limit 10
 */

import 'dotenv/config';

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION  = '2026-04';

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 25;

if (!STORE_DOMAIN || !ADMIN_TOKEN) {
  console.error(
    'Missing required env vars.\n' +
    'Add to your .env file:\n' +
    '  SHOPIFY_STORE_DOMAIN=your-store.myshopify.com\n' +
    '  SHOPIFY_ADMIN_TOKEN=shpat_...\n\n' +
    'Get an Admin API token:\n' +
    '  Shopify Admin → Settings → Apps and sales channels → Develop apps\n' +
    '  Create a custom app → configure Admin API scopes (read_customers) → install'
  );
  process.exit(1);
}

const CUSTOMER_PROFILE_KEYS = ['age_bracket', 'gender', 'price_sensitivity', 'preferred_style'];

const query = `
  query listCustomers($first: Int!) {
    customers(first: $first) {
      edges {
        node {
          id
          firstName
          lastName
          email
          numberOfOrders
          metafields(namespace: "customer_profile", first: 10) {
            edges {
              node {
                key
                value
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchCustomers() {
  const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ query, variables: { first: limit } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Admin API request failed: ${res.status} ${res.statusText}\n` +
      `URL: ${url}\n` +
      `Response: ${body}\n\n` +
      `Check:\n` +
      `  1. App is installed on the store (Develop apps → your app → Install app)\n` +
      `  2. "read_customers" scope is enabled (Configuration tab → Admin API integration)\n` +
      `  3. Token was copied correctly from the API credentials tab`
    );
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
  }

  return json.data.customers;
}

function formatMetafields(metafieldsEdges) {
  const map = {};
  for (const { node } of metafieldsEdges) {
    map[node.key] = node.value;
  }

  return CUSTOMER_PROFILE_KEYS.map(key => {
    const val = map[key];
    return `  ${key.padEnd(20)} ${val ?? '(not set)'}`;
  }).join('\n');
}

async function main() {
  console.log(`Fetching up to ${limit} customers from ${STORE_DOMAIN}...\n`);

  const customers = await fetchCustomers();
  const edges = customers.edges;

  if (edges.length === 0) {
    console.log('No customers found.');
    return;
  }

  for (const { node: c } of edges) {
    const id = c.id.replace('gid://shopify/Customer/', '');
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '(no name)';
    const metaStr = formatMetafields(c.metafields.edges);

    console.log(`── ${name} <${c.email ?? 'no email'}> (id: ${id}, orders: ${c.numberOfOrders})`);
    console.log(`  customer_profile metafields:`);
    console.log(metaStr);
    console.log();
  }

  console.log(`Shown: ${edges.length} customer(s). Has more: ${customers.pageInfo.hasNextPage}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
