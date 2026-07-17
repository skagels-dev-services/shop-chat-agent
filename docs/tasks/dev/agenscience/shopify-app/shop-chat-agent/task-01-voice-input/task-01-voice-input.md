# Shopify: Shop Chat Agent - Voice Input

As a shopify store customer, I want to interact with the shop chat agent via voice.

The shop chat agent, when receiving voice input should analyze the user's voice for demographic information so that it may make provide targeted responses to the user's prompts.

## Customer accounts MCP server

Shopify provides APIs to gather information about the customer and the store. The agent should use these APIs as needed to gather any information that may be helpful in assisting the customer. However, the agent should be sure to follow privacy policies and business ethics, not attempting to access or share any personal sensitive information that it may gather from APIs or application data. Ask me for clarification if this is unclear.

#### How much can the agent gather about the customer?

The chat agent has access to the Customer accounts MCP server. If age, gender, and other demographics are gathered and stored in Customer account metafields then they can be retrieved by the agent.

The chat agent also has access to the StoreFront MCP server. This grants the agent access to the store catalog (search, lookup) and shopping cart ( get, add to cart, checkout, etc.).

#### Simple optimizer/Sort by price elasticity

If snowboards have a price elasticity the agent should take it into consideration for search. Shopify provides Metafield for Product and Customer objects. These could be used  to track product's price elasticity or customer demographics

#### Does Shopify or Chat Agent support Voice input?

- Does Chat agent support Voice/Mic input?
- Is there anything off the shelf that already analyzes voice, etc.?
- Can an agent determine gender, age, education level, other demographic info from customer's voice ... is this NLP built-in or do we need to use a 3rd party solution?
- Google search results:

Are there any off the shelf solutions that analyzes voice, etc.?
