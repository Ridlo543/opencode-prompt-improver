# Prompt Improver for OpenCode

A plugin that automatically improves rough prompts before sending them to the AI agent.
The improved prompt appears in your chat input — reviewable, editable — you decide when to send.

## How It Works

1. Type `/improve <your rough prompt>` in the chat
2. The plugin calls an LLM (hidden, separate session) to refine your prompt
3. The improved prompt replaces the text in your chat input
4. Review, edit if needed, press Enter to send

## Installation

### 1. Run setup

```bash
bun install
bun run setup
```

This copies the plugin to `~/.config/opencode/plugins/` and merges the required agent, command, and keybind configs.

### 2. Restart OpenCode

The plugin loads on startup.

## Manual Installation

If `bun run setup` doesn't work for your environment, follow these steps:

### 1. Copy the plugin file

```
cp src/index.ts ~/.config/opencode/plugins/prompt-improver.ts
```

### 2. Merge config

Add the agent and command config from `install/opencode.jsonc` into your opencode.jsonc file.

### 3. (Optional) Add keybind

Add the keybind config from `install/tui.jsonc` into your `tui.json` to trigger improvement with `Ctrl+Shift+I`.

### 4. Restart OpenCode

## Model Selection

The plugin uses your default model by default. To use a specific model:

```jsonc
{
  "agent": {
    "prompt-improver": {
      "model": "opencode/deepseek-v4-flash-free"
    }
  }
}
```

Recommended: use a fast free model like `opencode/deepseek-v4-flash-free` or `opencode/mimo-v2.5-free`. List all available free models with `/models` in the TUI.

## Configuration Reference

| Config | Default | Description |
|---------|---------|-------------|
| `agent.prompt-improver.model` | system default | Model ID to use for improvement |
| `agent.prompt-improver.hidden` | `true` | Hide from agent list |
| `agent.prompt-improver.temperature` | `0.1` | Low temp for consistent output |
| `command.improve.subtask` | `true` | Treat as internal command |

## Development

```bash
bun install
bun test
```

## License

MIT
