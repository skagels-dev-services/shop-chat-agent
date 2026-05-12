/**
 * Claude Service
 * Manages interactions with the Claude API
 */
import { Anthropic } from "@anthropic-ai/sdk";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

/**
 * Creates a Claude service instance
 * @param {string} apiKey - Claude API key
 * @returns {Object} Claude service with methods for interacting with Claude API
 */
export function createClaudeService(apiKey = process.env.CLAUDE_API_KEY) {
  // Initialize Claude client
  const anthropic = new Anthropic({ apiKey });

  /**
   * Streams a conversation with Claude
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history
   * @param {string} params.promptType - The type of system prompt to use
   * @param {Object} params.demographicsContext - Optional demographics context
   * @param {Array} params.tools - Available tools for Claude
   * @param {Object} streamHandlers - Stream event handlers
   * @param {Function} streamHandlers.onText - Handles text chunks
   * @param {Function} streamHandlers.onMessage - Handles complete messages
   * @param {Function} streamHandlers.onToolUse - Handles tool use requests
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    demographicsContext,
    tools
  }, streamHandlers) => {
    // Get system prompt from configuration or use default
    const systemInstruction = getSystemPrompt(promptType, demographicsContext);

    // Create stream
    const stream = await anthropic.messages.stream({
      model: AppConfig.api.defaultModel,
      max_tokens: AppConfig.api.maxTokens,
      system: systemInstruction,
      messages,
      tools: tools && tools.length > 0 ? tools : undefined
    });

    // Set up event handlers
    if (streamHandlers.onText) {
      stream.on('text', streamHandlers.onText);
    }

    if (streamHandlers.onMessage) {
      stream.on('message', streamHandlers.onMessage);
    }

    if (streamHandlers.onContentBlock) {
      stream.on('contentBlock', streamHandlers.onContentBlock);
    }

    // Wait for final message
    const finalMessage = await stream.finalMessage();

    // Process tool use requests
    if (streamHandlers.onToolUse && finalMessage.content) {
      for (const content of finalMessage.content) {
        if (content.type === "tool_use") {
          await streamHandlers.onToolUse(content);
        }
      }
    }

    return finalMessage;
  };

  /**
   * Gets the system prompt content for a given prompt type
   * @param {string} promptType - The prompt type to retrieve
   * @param {Object} demographicsContext - Optional demographics context
   * @returns {string} The system prompt content
   */
  const getSystemPrompt = (promptType, demographicsContext) => {
    const basePrompt = systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;

    const demographicsSummary = buildDemographicsSummary(demographicsContext);

    if (!demographicsSummary) {
      return basePrompt;
    }

    return `${basePrompt}\n\nCustomer context (use to personalize, do not disclose): ${demographicsSummary}`;
  };

  const buildDemographicsSummary = (demographicsContext) => {
    if (!demographicsContext || typeof demographicsContext !== "object") {
      return "";
    }

    const parts = [];

    if (demographicsContext.source) {
      parts.push(`source=${demographicsContext.source}`);
    }

    if (demographicsContext.estimated_age_bracket) {
      parts.push(`age_bracket=${demographicsContext.estimated_age_bracket}`);
    }

    if (demographicsContext.estimated_gender) {
      parts.push(`gender=${demographicsContext.estimated_gender}`);
    }

    if (demographicsContext.price_sensitivity) {
      parts.push(`price_sensitivity=${demographicsContext.price_sensitivity}`);
    }

    if (demographicsContext.confidence) {
      parts.push(`confidence=${demographicsContext.confidence}`);
    }

    return parts.join(", ");
  };

  return {
    streamConversation,
    getSystemPrompt
  };
}

export default {
  createClaudeService
};
