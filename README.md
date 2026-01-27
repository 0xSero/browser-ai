# Parchi

Parchi is a browser sidepanel extension for AI-powered browsing assistance. It pairs a chat UI with tool-driven browser automation so you can navigate, read, and act on pages without leaving your workflow.

## What it does

- Chat-driven browser automation with tool execution
- Inline tool-call timeline + reasoning during streaming
- Session history and profile-driven settings

## Architecture

```mermaid
flowchart LR
  UI[Sidepanel UI] -->|user_message| BG[Background Service Worker]
  BG -->|chat| LLM[AI Provider]
  LLM -->|tool calls| BG
  BG -->|tool exec| Browser[Chrome APIs]
  BG -->|assistant_response| UI
```

## Streaming flow

```mermaid
sequenceDiagram
  participant UI as Sidepanel
  participant BG as Background
  participant LLM as AI Provider

  UI->>BG: user_message
  BG->>LLM: chat (stream)
  LLM-->>BG: stream delta
  BG-->>UI: assistant_stream delta
  LLM-->>BG: final response
  BG-->>UI: assistant_response
```

## Quality

Last verified: 2026-01-21

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm run test:unit` | 31/31 passing |

## Development

- `npm install`
- `npm run build`
- Load the unpacked extension from `dist/` in Chrome
