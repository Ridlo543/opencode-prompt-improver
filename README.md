# opencode-prompt-improver

An OpenCode plugin that transforms rough, vague instructions into precise, well-structured prompts before you send them to the AI agent.

Type `/improve <rough instruction>`, get a polished prompt in your chat input. Review, edit if needed, then press **Enter** to send — nothing is submitted automatically.

Works for any task: coding, analysis, writing, research, debugging, creative work — any AI conversation.

## How It Works

1. Type `/improve <your rough instruction>` in the chat input
2. A lightweight LLM rewrites it into a clear, context-rich prompt
3. The improved prompt replaces the text in your chat input
4. Review and edit freely, then press **Enter** to send

The plugin runs in a hidden sub-session that is immediately deleted after use. No session messages are created, no tool calls are made, no file access occurs — it is a pure text transformer.

## Installation

### Requirements

- [OpenCode](https://opencode.ai) installed and working
- [Bun](https://bun.sh) installed

### Quick Setup

```bash
git clone https://github.com/your-username/opencode-prompt-improver
cd opencode-prompt-improver
bun install
bun run setup
```

Restart OpenCode. Done.

### What `bun run setup` does

| Step | Action |
|------|--------|
| Plugin | Copies `src/index.ts` → `~/.config/opencode/plugins/prompt-improver.ts` |
| Agent config | Merges `agent.prompt-improver` into `~/.config/opencode/opencode.jsonc` |
| Command config | Merges `command.improve` into `~/.config/opencode/opencode.jsonc` |
| Keybind | Merges `keybinds.prompt_improve` into `~/.config/opencode/tui.json` |

### Manual Installation

**1. Copy the plugin**

```bash
# Linux / macOS
cp src/index.ts ~/.config/opencode/plugins/prompt-improver.ts

# Windows (PowerShell)
cp src/index.ts "$env:USERPROFILE\.config\opencode\plugins\prompt-improver.ts"
```

**2. Add to your `opencode.jsonc`**

Merge the contents of [`install/opencode.jsonc`](install/opencode.jsonc) into your OpenCode config file:
- Global: `~/.config/opencode/opencode.jsonc`
- Project-level: `.opencode/opencode.jsonc`

**3. (Optional) Add the keybind**

Merge the contents of [`install/tui.jsonc`](install/tui.jsonc) into `~/.config/opencode/tui.json` to use `Ctrl+Shift+I` as a shortcut.

**4. Restart OpenCode.**

## Usage

```
/improve fix the login bug
/improve add dark mode to the settings page
/improve write a blog post about async/await
/improve analyze the codebase and identify problems
/improve analisa kode di workspace ini dan identifikasi masalahnya
```

### Keyboard Shortcut

Press **Ctrl+Shift+I** to improve whatever is currently typed in the chat input (same as `/improve <current text>`).

## Token Efficiency

The plugin is designed to consume as few tokens as possible:

| What | How |
|------|-----|
| No tool calls | `"*": "deny"` blocks all tools — the LLM only reads and writes text |
| No default system prompt | Custom `agent.prompt` replaces the full OpenCode system prompt (tools, MCP, project context), saving hundreds of tokens per call |
| Minimal user message | Only the raw instruction is sent, not a repeated system prompt |
| Fast free model | `deepseek-v4-flash-free` by default — low latency, no cost |

## Model Configuration

The default model is `opencode/deepseek-v4-flash-free` — free and fast, no API key required.

### Free models from the `opencode` provider

These work out of the box with no additional setup:

| Model ID | Notes |
|----------|-------|
| `opencode/deepseek-v4-flash-free` | Default — fast, reasoning, 1M context |
| `opencode/big-pickle` | OpenCode's own flagship free model |
| `opencode/mimo-v2.5-free` | MiMo V2.5 |
| `opencode/north-mini-code-free` | North Mini Code |
| `opencode/nemotron-3-ultra-free` | Nemotron 3 Ultra |

Run `/models` in the OpenCode TUI to see the full current list of available free models.

### Using your own provider

You can use any model from a provider you have already configured:

```jsonc
{
  "agent": {
    "prompt-improver": {
      "model": "anthropic/claude-haiku-4-5"
    }
  }
}
```

Examples: `openai/gpt-4o-mini`, `anthropic/claude-haiku-4-5`, `google/gemini-flash-1.5`, or any model ID shown in `/models`.

## Configuration Reference

All configuration lives in `agent.prompt-improver` inside your `opencode.jsonc`.

| Key | Default | Description |
|-----|---------|-------------|
| `model` | `opencode/deepseek-v4-flash-free` | Model used for improvement |
| `temperature` | `0.1` | Low value for consistent, deterministic output |
| `hidden` | `true` | Hides this agent from the agent selector |
| `prompt` | *(see `install/opencode.jsonc`)* | System prompt for the improver LLM |
| `permission["*"]` | `"deny"` | Blocks all tool calls — keeps the LLM focused on text only |

### Customizing the system prompt

The default system prompt instructs the LLM to expand vague instructions into precise, context-rich prompts. You can override it in your `opencode.jsonc`:

```jsonc
{
  "agent": {
    "prompt-improver": {
      "prompt": "Your custom system prompt here"
    }
  }
}
```

## Development

```bash
bun install      # install dependencies
bun test         # run tests
bun run setup    # install to local OpenCode
bun run typecheck  # TypeScript check
```

### Project structure

```
opencode-prompt-improver/
├── src/index.ts       ← plugin code (the only runtime file)
├── install/
│   ├── opencode.jsonc ← config template (agent + command)
│   └── tui.jsonc      ← keybind template
├── tests/             ← unit tests
├── setup.ts           ← installer script
└── package.json
```

## License

MIT
