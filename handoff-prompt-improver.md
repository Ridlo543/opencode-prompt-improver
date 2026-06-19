# Handoff: Prompt Improver Plugin for OpenCode

**Project**: `C:\Users\Advan\opencode-prompt-improver`
**Status**: Plugin complete (source, tests, configs, README). Ready for installation and live testing.

---

## What This Is

A plugin that adds a `/improve` command to OpenCode. User writes a rough prompt, triggers improvement, and the improved prompt appears in the chat input — reviewable, editable — user decides when to send.

## Architecture

```
src/index.ts                     # Plugin entry: command.execute.before hook
tests/index.test.ts              # 8 unit tests (all pass)
prompts/improver.txt             # System prompt reference
install/opencode.jsonc           # Agent + command config to merge
install/tui.jsonc                # Keybind Ctrl+Shift+I → /improve
```

### Flow

1. User runs `/improve <rough prompt>` (or presses Ctrl+Shift+I)
2. `command.execute.before` hook intercepts it
3. Plugin reads `client.config.get()` for model resolution (agent config → system default)
4. Creates a **temp sub-session** via `client.session.create()` — avoids polluting the main chat
5. Calls LLM via `client.session.prompt()` on the temp session with plain text parts
6. On success: `client.tui.clearPrompt()` → `client.tui.appendPrompt({ body: { text } })` → success toast
7. On error: error toast
8. Always: deletes temp session in `finally` block
9. Sets `output.parts = []` to suppress the raw `/improve` command from reaching the agent

### Model Resolution

Priority: `config.agent["prompt-improver"].model` → system default (no `model` option passed).

Model ID format: `"providerID/modelID"` split at first `/`.

## Configuration Required

### opencode.jsonc (merge these entries)

```jsonc
{
  "agent": {
    "prompt-improver": {
      "hidden": true,
      "temperature": 0.1,
      "permission": {
        "edit": "deny",
        "bash": "deny",
        "webfetch": "deny"
      }
    }
  },
  "command": {
    "improve": {
      "description": "Improve and structure the current prompt before sending",
      "subtask": true
    }
  }
}
```

### tui.json (merge this entry)

```jsonc
{
  "keybinds": {
    "prompt_improve": {
      "bindings": ["C-S-i"],
      "command": "command.execute",
      "description": "Improve the current prompt in the chat input"
    }
  }
}
```

### Plugin file

Copy `src/index.ts` to `~/.config/opencode/plugins/prompt-improver.ts` (global) or `.opencode/plugins/prompt-improver.ts` (project).

## Test Results

```
bun test → 8/8 pass, 16 expect() calls
bun run typecheck → clean (no errors)
```

Tests cover: non-improve passthrough, empty prompt warning, structured output parsing, text fallback, error handling, temp session cleanup, cleanup on error, model resolution from agent config.

## Known Quirks

- Heavy use of `as any` casts — the generated SDK types (`Options<TData>` wrapper from Hey API) don't match runtime JS parameter shapes. The actual API calls work correctly (verified from JS source).
- `client.tui.appendPrompt()` is cast to `as any` — the SDK type expects different arg shape than runtime.
- Temp session ID is captured and cleaned up in `finally` to prevent leaks.
- The `improver.txt` prompt file exists for reference but the actual system prompt is inlined in `src/index.ts` as `SYSTEM_PROMPT` constant.

## Immediate Next Steps (for the next agent)

1. **Install the plugin**: Copy `src/index.ts` to `~/.config/opencode/plugins/prompt-improver.ts`
2. **Merge config**: Add agent + command entries from `install/opencode.jsonc` into `~/.config/opencode/opencode.jsonc`
3. **Add keybind**: Merge `install/tui.jsonc` entry into `~/.config/opencode/tui.json`
4. **Restart OpenCode** and test: type `/improve refactor the button component`
5. **Verify the TUI flow**: prompt appears in input, not in agent output

## Unverified Assumptions (critical to test live)

- Whether `command.execute.before` blocks agent output when `output.parts = []` is set (mocked in tests, not tested against real OpenCode process)
- Whether custom keybind `prompt_improve` with `command.execute` actually triggers `/improve` (keybind command mapping behavior)
- Whether `client.tui.appendPrompt()` works correctly when called during the hook (race condition with TUI state)
- Whether JSON structured output actually works with the dahono provider's models (some free models may not support it — fallback handles this)

## Suggested Skills

- `diagnose` — if installation doesn't work as expected
- `context7-mcp` — if SDK API reference needed
- `prototype` — if UX behavior deviates from expected flow

---

**Environment**: OpenCode v1.17.8, Windows, Bunny runtime, dahono provider with many free models.
**No git repo** — this is a standalone plugin project.