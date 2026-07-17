# Notes - Agenscience.ai

# TB with Jon Bible, Agenscience.ai (johnbible@agenscience.ai)

## June 26, 2026

Tried to demo shopify chatbot today. Ran into a lot of technical issues:

- so many sites - which URLs do I really want to show?
- Chat bubble does not display in localhost preview store
- Chat - microphone access does not work in Shopify Admin: Online Store >  Edit Theme preview
- Chat does work on dev store: [https://a1-outfitters-2.myshopify.com](https://a1-outfitters-2.myshopify.com/)
  - Dev store can be accessed from Admin >  Online Store view
  - Store password can be retrieved from Admin > Online Store view
- Chat App Settings: 
  - Chat API Base URL should be the App URL shown in terminal window used to start app. This URL will change with every new app startup, which will require you to update the app setting in the store Admin. Or if you start the all with the --use-localhost option it should stabilize on the same localhost port.
  - Examples:
    - start app via `shopify app dev --use-localhost` - a localhost App URL will be used like https://localhost:3458
    - start app via `shopify app dev` - a new App URL will be created on the cloudflare.com site.


## May 26, 2026

## Proof of Concept

**Voice Analysis:**

- AssemblyAI
  - sentiment - free plan
  - age and gender - paid plan
- [GoVivace](https://govivace.com/products/speaker-characteristics/) Speech technology can be used to extract information about the characteristics of a speaker
  - such as age, gender, language, accent, or emotional state.
  - but pricing structure is not transparent. Call sales rep to discuss :(

**Voice Agent - Can our bot talk back?**

- AssemblyAI has a [Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api) for this.

**MVP Demo**

- favor breadth over depth
- aim for sufficient, not perfection

1. Gather customer info - customer fields in Customer records
2. View order history - what do past purchases tell AI about the customer?
3. Prompt for what customer is looking for today?
4. RAG from sales data

- recommend items based on age, weight, height, gender, skill level, budget, style, other preferences like color, branch, specific features
- Don't recommend a board already ordered unless customer has indicated to do so. Prompt user for more info on whether to take purchase history account (as inclusion or exclusion policy).
- guess search criteria based on assortment of purchase history (purchasing profile)

Recommendations:

- provide list of recommended products
- provide justification for each recommendation so we can follow AI agent's logic

**Build test data**

- orders - https://shopify.dev/docs/agents/orders/order-mcp

## May 15, 2025

- Worked with Claude to implement Phase 2 & 3 this week.
- Microphone is working for both phase 1 and 2 functionality
- Caveats:
  - Voice Analytics is limited by AssemblyAI free plan (does not analyse for demographics/requires a paid plan)
    - Free plan provides Sentiment analysis
- [Integration Guide](tasks/dev/agenscience/shopify-app/shop-chat-agent/task-01-voice-input/task-01-voice-input.integration-guide.md "Integration Guide")
- [Phase 2 Implementation Notes](tasks/dev/agenscience/shopify-app/shop-chat-agent/task-01-voice-input/task-01-voice-input.phase-02.impl-notes-2026-05-11.md "Phase 2 Implementation Notes")

```
Phase 2 - Demographics from Customer Metafields
    - Update system prompt to query Customer Account Metafields at conversation start.
    - Add demographicAssistant System Prompt (v2.0)
```

* [Phase 3 Implementation Notes](tasks/dev/agenscience/shopify-app/shop-chat-agent/task-01-voice-input/task-01-voice-input.phase-03.impl-notes-2026-05-11.md "Phase 3 Implementation Notes")

```
Phase 3 - Voice Analytics + Price Elasticity
    - Add /api/transcribe route with Deepgram/AssemblyAI integration.
    - Add consent disclosure UI before first voice analysis.
    - Add price elasticity logic to system prompt.
    - Merchant configures Product and Customer Metafields in Shopify admin.

More setup is needed to fully test Customer Account and Product metafields usage.
```

Not clear that AssemblyAI can help us with demographics on it's own. Worth looking into other technologies:

**Xdroid (VoiceAnalytics) & Sestek (Knovvu):** These conversational AI and speech analytics platforms map acoustic features to demographic brackets and emotional metrics instantly during call routing or quality assurance. [[1](https://ximasoftware.com/blog/voice-analytics-guide/),** **[2](https://www.gartner.com/reviews/market/speech-analytics-platforms)]

## May 11, 2025

Today we encountered many issues during our session: my microphone was often muted (according to google meet), microphone was not working with chatbot microphone button - but it did work for John, Cannot access Customer metadata and Product metadata.  My microphone issues may be due to Wispr Flow interference. We couldn't get the base URL working properly for the chatbot. There's a lot I need to figure out, like: how do I access the customer API and product API so that I can update the custom meta fields that I've defined.

shop password: @g3n$.41

## May 8, 2025

### Shopify: Customer accounts MCP server

#### How much can the agent gather about the customer?

The chat agent has access to the Customer accounts MCP server. If age, gender, and other demographics are gathered and stored in Customer account metafields then they can be retrieved by the agent.

The chat agent also has access to the StoreFront MCP server. This grants the agent access to the store catalog (search, lookup) and shopping cart ( get, add to cart, checkout, etc.).

#### Simple optimizer/Sort by price elasticity

If snowboards have a price elasticity the agent should take it into consideration for search.  We need some DB table that can determine sort order by custom value.

Shopify provides Metafield for Product and Customer objects. These could be used  to track product's price elasticity or customer demographics

#### Does Shopify or Chat Agent support Voice input?

- Does Chat agent support Voice/Mic input?
- Is there anything off the shelf that already analyzes voice, etc.?
- Can an agent determine gender, age, education level, other demographic info from customer's voice ... is this NLP built-in or do we need to use a 3rd party solution?
- Google search results:

Are there any off the shelf solutions that analyzes voice, etc.?

### Source Data:

Yes, several real-time voice analysis technologies, often utilizing AI, can determine specific demographic information (such as gender and age estimation) and behavioral traits from a speaker's voice= . These systems are primarily used in contact centers, security, and sentiment analysis. [[1](https://realtimevoiceanalyzer.com/home), [2](https://www.youtube.com/watch?v=hfQX6Y_5TcQ), [3](https://ximasoftware.com/blog/voice-analytics-guide/), [4](https://voicesense.com/), [5](https://www.phonexia.com/product/voice-biometrics/)]

Key technologies and platforms include:

* **Phonexia Voice Biometrics:** Uses neural networks to identify gender with high accuracy and estimate age in real-time, independent of language or accent.
* **Voicesense:** Analyzes voice signals to predict behavioral patterns and demographic traits, focusing on personality insights.
* **ECHO AI: Voice Analyzer:** A mobile-based AI app that claims to analyze voice in real-time for personality insights and voice characteristics.
* **Speech Analytics (Various):** Platforms like [Genesys](https://www.genesys.com/article/using-speech-analytics-real-time-customer-insights) and [Verint](https://www.verint.com/speech-analytics/) analyze voice for emotion, sentiment, and sometimes age/gender to assist contact center agents in real-time. [[1](https://play.google.com/store/apps/details?id=com.tanosapps.echo), [2](https://www.phonexia.com/product/voice-biometrics/), [3](https://www.phonexia.com/knowledge-base/voice-biometrics-essential-guide/), [4](https://voicesense.com/), [5](https://www.genesys.com/article/using-speech-analytics-real-time-customer-insights), [6](https://www.verint.com/speech-analytics/)]

*From [Customer accounts MCP server doc](https://shopify.dev/docs/apps/build/storefront-mcp/servers/customer-account "doc") - Shopify allows you to add additional customer info via metafields. These could be used to track birthday, age, gender, etc.*

Key tools include API services like **OpenAI Whisper** , **Deepgram** , or **ElevenLabs** . Common approaches include building conversational workflows using platforms like ****Vector Shift** or using Python libraries like** `speech_recognition` and `pyttsx3`

* **Implement Speech-to-Text (STT):**
  * Use APIs like **OpenAI's Whisper (often via Python)** or **Deepgram** for fast, real-time transcription of audio data into text.
* For browser-based apps, you can use the built-in [Web Speech API](https://medium.com/@sanikapatil0213/adding-voice-input-ai-responses-to-react-apps-508750627a29) for voice recognition.
* Integrate AI Processing: Send the transcribed text to an LLM (such as OpenAI's GPT) to process the request and generate a text response.

**How-to article:** https://forasoft.medium.com/ai-powered-voice-recognition-in-mobile-apps-the-complete-guide-to-building-voice-activated-apps-3c9c2a87c94f

**Recommended Technology Stack**

* Voice-to-Text: Deepgram, OpenAI Whisper, [Wit.ai](https://github.com/wit-ai/android-voice-demo)
* Conversation Logic: OpenAI API (GPT-4), LangChain
* Text-to-Speech: ElevenLabs, [Cartesia](https://medium.com/@amosgyamfi/build-your-first-voice-and-video-call-ai-agent-in-python-0da62cec51c4), [pyttsx3](https://ai-with-lil-bro.medium.com/steps-to-create-an-ai-powered-voice-assistant-%EF%B8%8F-18bd7e4926f7)
* Frameworks: Python, React [[1](https://github.com/wit-ai/android-voice-demo), [2](https://www.youtube.com/watch?v=Ew7fOQpkKBw), [3](https://medium.com/@amosgyamfi/build-your-first-voice-and-video-call-ai-agent-in-python-0da62cec51c4), [4](https://www.youtube.com/watch?v=tmWdk_5JMSg), [5](https://ai-with-lil-bro.medium.com/steps-to-create-an-ai-powered-voice-assistant-%EF%B8%8F-18bd7e4926f7), [6](https://www.youtube.com/watch?v=y_a7Jdl3Eds&t=13), [7](https://elevenlabs.io/blog/building-your-first-conversational-ai-agent-a-beginners-guide), [8](https://www.youtube.com/watch?v=h0FyNmnFk6o)]

#### Customer - standard fields

- acceptsMarketing
- addresses
- avatarUrl
- createdAt
- email
- name (first, last)
- id
- orders
- phone
- socialLoginProvider
- tags
- metafields (custom info),
- updatedAt

#### Requirements

- Your store must have a custom domain configured.
- Your app must meet Shopify's protected customer data requirements.
- You must have completed the customer accounts MCP integration steps.

### Shopify: Storefront MCP server

Implements Universal Commerce Protocol (UCP) - https://ucp.dev/specification/catalog/

- catalog tools: search_catalog ({context criteria}), lookup_catalog ({product/variant ID}), get_product
- standard tools: get_cart, update_cart, search_shop_policies_and_faqs

### Shopify AI Toolkit

From: https://shopify.dev/docs/apps/build/ai-toolkit

The Shopify AI Toolkit connects your AI tools to the Shopify platform. With the Toolkit, you can build apps using Shopify's documentation, API schemas, and code validation, and manage your Shopify store through the CLI's store execute capabilities. The Toolkit ensures your agent works with Shopify correctly, rather than guessing at how things are implemented.

You can set up the AI Toolkit via our plugin, or manually with skills or MCP:

* **[(Recommended) Install the plugin:](https://shopify.dev/docs/apps/build/ai-toolkit#install-with-a-plugin)** The plugin updates automatically, so you'll always have the latest capabilities as they're released.
* **[Install with agent skills:](https://shopify.dev/docs/apps/build/ai-toolkit#install-with-agent-skills)** Manually add some or all of the AI Toolkit's agent skill files.
* **[Install with the Dev MCP server:](https://shopify.dev/docs/apps/build/ai-toolkit#install-with-the-dev-mcp-server)** Connect to Shopify's developer resources through an MCP server.

## May 1, 2026

shop-chat-agent

- how much info does the agent know about the customer - access user profile? Can the bot take into account who is searching
- Simple optimizer - sort by price elasticity - if snowboards have a price elasticity - impact search results - some table that can sort by some elasticity order - where can I store external tables - does require our own MCP server or does Shopify have an API/MCP Server for this
- Chat/Voice interface? Does it support microphone input? Info from voice - gender, age, education level and should change search criteria
- Is there anything off the shelf that already analyzes voice, etc.?
- On-the-fly

John:
Scot Wingo, Substack conversation

## April 27, 2026

- demo'd dev store, and separate chat program.
- Tallk to agent instead of typing (seems more natural)
- How can Agenscience differentiate products from what everyone else is doing? There are so many starts up there, need a real compelling pitch.

Can the agent do real time analytics while interacting with the customer?

How much will AI change the shopping experience?

Digital flyer - as customer enters brick and mortar store it could notify customer about current sales.

How much can AI learn about the customer during a session just by talking, observing voice, clothes, etsc?

Salesman agent - hone in how much customer is willing to spend and direct them to best choices?

How much the agent learn about the store it is selling for?

Provide dev plan to John.

## April 7, 2026

**Azure** - retailers who don't want to support Amazon (their greatest rival) are staying clear from AWS, and choosing Azure and Copilot integration with Excel and the rest of the SM Office suite

shopify app store - eCommerce platform with some backend machine learning

- or google chrome extension, AWS marketplace apps

small eCommerce platfoorm

- customizaiton
- search history, cookies,
- optimized for speed shopping
- gen ai - on the fly creation

demo shopping experience agentic sales

- prompts being generated in real time

Ultimately, John wants to focus on price optimization, and  assortment optimization, but these are also served by demos mentioned

next Thursday or Friday TB

/Users/scott/dev/agenscience_ai/claude-sessions-2026-04-07.md

```
# Test it manually like this:
echo '{
  "session_id": "test-1234",
  "transcript_path": "/Users/scott/.claude/projects/some-project/abc123.jsonl",
  "cwd": "/Users/scott/dev/agentscience_ai"
}' | python3 .claude/hooks/export-session.py
```
