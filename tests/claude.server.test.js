import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @anthropic-ai/sdk before importing the module under test
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn(function() {
    this.messages = { stream: vi.fn() };
  });
  return { Anthropic: MockAnthropic };
});

// Mock config
vi.mock('../app/services/config.server.js', () => ({
  default: {
    api: {
      defaultModel: 'claude-haiku-4-5-20251001',
      maxTokens: 2000,
      defaultPromptType: 'standardAssistant',
    },
    errorMessages: {},
    tools: {},
  },
  AppConfig: {
    api: {
      defaultModel: 'claude-haiku-4-5-20251001',
      maxTokens: 2000,
      defaultPromptType: 'standardAssistant',
    },
  },
}));

const { createClaudeService } = await import('../app/services/claude.server.js');

describe('createClaudeService', () => {
  let service;

  beforeEach(() => {
    service = createClaudeService('test-api-key');
  });

  // ── getSystemPrompt ────────────────────────────────────────────────────────

  describe('getSystemPrompt', () => {
    it('returns the base prompt for a valid prompt type with no demographics', () => {
      const prompt = service.getSystemPrompt('standardAssistant', null);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('falls back to standardAssistant when an unknown prompt type is given', () => {
      const fallback = service.getSystemPrompt('standardAssistant', null);
      const unknown = service.getSystemPrompt('nonExistentType', null);
      expect(unknown).toBe(fallback);
    });

    it('appends demographics summary when a valid demographicsContext is provided', () => {
      const ctx = { estimated_gender: 'female', estimated_age_bracket: 'young_adult', confidence: 'medium' };
      const prompt = service.getSystemPrompt('demographicAssistant', ctx);
      expect(prompt).toContain('Customer context (use to personalize, do not disclose):');
      expect(prompt).toContain('gender=female');
      expect(prompt).toContain('age_bracket=young_adult');
    });

    it('does not append demographics when context is null', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', null);
      expect(prompt).not.toContain('Customer context');
    });

    it('does not append demographics when context is an empty object', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', {});
      expect(prompt).not.toContain('Customer context');
    });

    it('does not append demographics when context is a non-object value', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', 'bad-input');
      expect(prompt).not.toContain('Customer context');
    });

    it('does not append demographics when context is a number', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', 42);
      expect(prompt).not.toContain('Customer context');
    });
  });

  // ── buildDemographicsSummary (via getSystemPrompt) ─────────────────────────

  describe('demographics summary content', () => {
    it('includes source when provided', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', { source: 'metafield' });
      expect(prompt).toContain('source=metafield');
    });

    it('includes price_sensitivity when provided', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', { price_sensitivity: 'high' });
      expect(prompt).toContain('price_sensitivity=high');
    });

    it('includes confidence when provided', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', { confidence: 'low' });
      expect(prompt).toContain('confidence=low');
    });

    it('includes all fields when all are provided', () => {
      const ctx = {
        source: 'voice_analysis',
        estimated_age_bracket: 'adult',
        estimated_gender: 'male',
        price_sensitivity: 'medium',
        confidence: 'low',
      };
      const prompt = service.getSystemPrompt('demographicAssistant', ctx);
      expect(prompt).toContain('source=voice_analysis');
      expect(prompt).toContain('age_bracket=adult');
      expect(prompt).toContain('gender=male');
      expect(prompt).toContain('price_sensitivity=medium');
      expect(prompt).toContain('confidence=low');
    });

    it('silently omits fields that are missing without throwing', () => {
      const ctx = { estimated_gender: 'female' };
      const prompt = service.getSystemPrompt('demographicAssistant', ctx);
      expect(prompt).toContain('gender=female');
      // The summary should not include key=value pairs for absent fields
      expect(prompt).not.toContain('age_bracket=');
      expect(prompt).not.toContain('price_sensitivity=');
    });

    it('handles extra unknown fields gracefully without including them', () => {
      const ctx = { estimated_gender: 'male', unknown_field: 'ignored' };
      const prompt = service.getSystemPrompt('demographicAssistant', ctx);
      expect(prompt).not.toContain('unknown_field');
    });
  });

  // ── Phase 2: demographicAssistant prompt requires metafield instructions ───

  describe('demographicAssistant prompt — Phase 2 Customer Metafield requirements', () => {
    it('instructs Claude to query Customer Account metafields at conversation start', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', null);
      // Must direct Claude to retrieve demographic data from Customer Account MCP
      expect(prompt.toLowerCase()).toMatch(/customer.*(account|metafield)/i);
    });

    it('references the customer_profile namespace or metafield keys', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', null);
      expect(prompt).toMatch(/customer_profile|age_bracket|price_sensitivity/i);
    });

    it('instructs Claude not to reveal inferred demographics to the customer', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', null);
      expect(prompt.toLowerCase()).toMatch(/do not (reveal|disclose|share|tell)/);
    });

    it('instructs Claude to treat metafield data as higher confidence than voice inferences', () => {
      const prompt = service.getSystemPrompt('demographicAssistant', null);
      // Metafield data should be prioritized / treated as higher confidence
      expect(prompt.toLowerCase()).toMatch(/metafield|account data|customer data/i);
    });
  });
});
