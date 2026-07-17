# Claude Session — April 7, 2026

## Topic: OpenAI API vs. Anthropic API Comparison

---

## Authentication & Base Setup

Both APIs use bearer token authentication via an `Authorization` header (or SDK client initialization). The SDKs are nearly parallel in structure:

**OpenAI:**
```python
from openai import OpenAI
client = OpenAI(api_key="sk-...")
```

**Anthropic:**
```python
import anthropic
client = anthropic.Anthropic(api_key="sk-ant-...")
```

---

## Message Format

This is the most significant structural difference.

**OpenAI** uses a flat `messages` array with a `system` role baked in:
```python
client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "Hello"}
    ]
)
```

**Anthropic** separates the system prompt as a top-level parameter:
```python
client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    system="You are helpful.",
    messages=[
        {"role": "user", "content": "Hello"}
    ]
)
```

Anthropic also **requires `max_tokens`** explicitly — OpenAI makes it optional.

---

## Response Structure

**OpenAI:**
```python
response.choices[0].message.content
```

**Anthropic:**
```python
response.content[0].text
```

Anthropic returns a `content` list (to accommodate multi-block responses including text, tool use, etc.), while OpenAI wraps it in `choices`.

---

## Tool / Function Calling

Both support tool use, with slightly different schemas.

**OpenAI** calls them `tools` with a `function` type wrapper:
```python
tools=[{
    "type": "function",
    "function": {
        "name": "get_weather",
        "parameters": { "type": "object", "properties": {...} }
    }
}]
```

**Anthropic** uses a flatter structure:
```python
tools=[{
    "name": "get_weather",
    "description": "...",
    "input_schema": { "type": "object", "properties": {...} }
}]
```

Key difference: Anthropic uses `input_schema` instead of `parameters`, and the schema is at the top level rather than nested under a `function` key.

---

## Streaming

Both support streaming with similar patterns, but response object shapes differ:

**OpenAI** uses `stream=True` and yields `delta.content`.  
**Anthropic** uses `stream=True` and yields events with types like `content_block_delta`, with the text in `event.delta.text`.

---

## Multimodal (Vision)

Both support image inputs as base64 or URL, but Anthropic's schema is more verbose:

**OpenAI:**
```python
{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
```

**Anthropic:**
```python
{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "..."}}
```

---

## Key Functional Differences at a Glance

| Feature | OpenAI | Anthropic |
|---|---|---|
| System prompt | In `messages` array | Top-level `system` param |
| `max_tokens` | Optional | **Required** |
| Response access | `choices[0].message.content` | `content[0].text` |
| Tool schema key | `parameters` | `input_schema` |
| Context window | Up to 128K (GPT-4o) | Up to 200K (Claude 3.x+) |
| Batch API | ✅ | ✅ |
| Native PDF support | ❌ (as of early 2025) | ✅ |

---

## Summary

The APIs are conceptually very similar — if you've used one, picking up the other takes maybe an hour. The main gotchas are the **system prompt location**, the **required `max_tokens`**, and the **response traversal path**. Most migration work is mechanical find-and-replace rather than architectural rethinking.
