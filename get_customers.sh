curl -X POST \
  "https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ADMIN_TOKEN" \
  -d '{"query": "{ customers(first: 50) { edges { node { id firstName lastName email } } } }"}'
