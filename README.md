# Prompt Enhancer

An AI-powered desktop tray application that enhances selected text using multiple LLM providers. Select any text, press a global shortcut, and get an AI-enhanced version pasted in its place.

## Features

- **Global Shortcut** — Select text anywhere and press `Ctrl+Shift+Q` to enhance it
- **Undo** — Press `Ctrl+Alt+Z` to restore the original text after an enhancement
- **Multiple Providers** — OpenAI, Claude (Anthropic), Nvidia NIM, Groq, Google Gemini, Cohere, Mistral, DeepSeek, Together AI
- **Enhancement Styles** — Expert Role Prefix, Clarify & Expand, Concise, Professional, Casual & Friendly, Custom
- **History** — Stores the last 200 enhancements with search, copy, and delete
- **System Tray** — Blue circle icon in the system tray; click to open dashboard
- **Auto-start** — Optional launch on Windows startup
- **Persistent Config** — API keys and settings are saved locally

## Installation

```bash
# Clone or navigate to the project directory
cd prompt-enhance

# Install dependencies
npm install

# Run the app
npm start
```

## Usage

1. **Launch** the app — a blue icon appears in your system tray
2. **Configure** — click the tray icon to open the dashboard
3. **Add API Key** — select your provider and paste your API key, then click Save
4. **Select text** in any application
5. **Press `Ctrl+Shift+Q`** — the text is enhanced and pasted automatically
6. **Undo** — press `Ctrl+Alt+Z` immediately to restore the original text

### Dashboard

| Tab | Description |
|-----|-------------|
| **Settings** | Configure provider, model, API key, enhancement style, and auto-start |
| **History** | Browse past enhancements, search, copy, or delete entries |

### Shortcuts

| Action | Shortcut |
|--------|----------|
| Enhance selected text | `Ctrl+Shift+Q` |
| Undo last enhancement | `Ctrl+Alt+Z` |

If `Ctrl+Shift+Q` is taken by another application, the app falls back to `Ctrl+Alt+Q`. The active shortcuts are shown on the dashboard.

## Providers

| Provider | API Endpoint |
|----------|-------------|
| **OpenAI** | `https://api.openai.com/v1/chat/completions` |
| **Claude (Anthropic)** | `https://api.anthropic.com/v1/messages` |
| **Nvidia NIM** | `https://integrate.api.nvidia.com/v1/chat/completions` |
| **Groq** | `https://api.groq.com/openai/v1/chat/completions` |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/models` |
| **Cohere** | `https://api.cohere.ai/v1/chat` |
| **Mistral** | `https://api.mistral.ai/v1/chat/completions` |
| **DeepSeek** | `https://api.deepseek.com/v1/chat/completions` |
| **Together AI** | `https://api.together.xyz/v1/chat/completions` |

## Enhancement Styles

- **Expert Role Prefix** — Adds "You are a world-class expert..." context
- **Clarify & Expand** — Rewrites for clarity and detail
- **Concise** — Brief and impactful
- **Professional** — Formal, polished tone
- **Casual & Friendly** — Natural, conversational tone
- **Custom** — Use your own prompt template

## Project Structure

```
prompt-enhance/
├── main.js                  # Electron main process (tray, shortcuts, IPC)
├── preload.js               # Bridge between main and renderer
├── providers/
│   └── index.js             # LLM provider adapters
├── renderer/
│   ├── index.html           # Dashboard UI
│   ├── style.css            # Styles
│   └── renderer.js          # Dashboard logic
├── icon.png                 # Tray icon
├── package.json
└── README.md
```

## Building

To create a distributable Windows installer:

```bash
npm run dist
```

The installer will be created in the `dist/` directory.

## Tech Stack

- **Electron** — Desktop framework
- **@nut-tree-fork/nut-js** — Keyboard simulation for clipboard operations
- **electron-store** — Persistent configuration storage
- **Node.js** — Backend logic and API calls
