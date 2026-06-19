import { describe, it, expect, mock } from "bun:test"
import type { PluginInput, Hooks } from "@opencode-ai/plugin"

// Simulate client with tui and session APIs
function createMockPluginInput(overrides: Partial<{
  sessionCreateFail: boolean
  promptFail: boolean
  promptTextResponse: string
}> = {}) {
  const tuiCalls: { method: string; args: any }[] = []
  const sessionCalls: { method: string; args: any }[] = []

  const client = {
    tui: {
      showToast: mock(async (args: any) => { tuiCalls.push({ method: "showToast", args }) }),
      clearPrompt: mock(async () => { tuiCalls.push({ method: "clearPrompt", args: undefined }) }),
      appendPrompt: mock(async (args: any) => { tuiCalls.push({ method: "appendPrompt", args }) }),
    },
    session: {
      create: mock(async (args: any) => {
        sessionCalls.push({ method: "create", args })
        if (overrides.sessionCreateFail) throw new Error("session create failed")
        return { data: { id: "tmp-session-1" } }
      }),
      prompt: mock(async (args: any) => {
        sessionCalls.push({ method: "prompt", args })
        if (overrides.promptFail) throw new Error("LLM call failed")
        return {
          data: {
            info: {},
            parts: [
              { type: "text", text: overrides.promptTextResponse ?? "Improved prompt text" },
            ],
          },
        }
      }),
      delete: mock(async (args: any) => {
        sessionCalls.push({ method: "delete", args })
        return {}
      }),
    },
  } as any

  return { client, tuiCalls, sessionCalls }
}

describe("PromptImprover plugin", () => {
  it("ignores non-improve commands", async () => {
    const { client, tuiCalls } = createMockPluginInput()
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [{ type: "text", text: "original" }] }
    await hooks["command.execute.before"]!(
      { command: "other", sessionID: "s1", arguments: "something" },
      output,
    )

    expect(output.parts).toEqual([{ type: "text", text: "original" }])
    expect(tuiCalls).toHaveLength(0)
  })

  it("shows warning for empty prompt", async () => {
    const { client, tuiCalls } = createMockPluginInput()
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [{ type: "text", text: "" }] }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "" },
      output,
    )

    expect(tuiCalls[0]!.method).toBe("showToast")
    expect(tuiCalls[0]!.args.body.variant).toBe("warning")
    expect(output.parts[0]!.text).toContain("No prompt")
  })

  it("improves prompt and injects into chat input", async () => {
    const { client, tuiCalls } = createMockPluginInput({
      promptTextResponse: "## Refactored\n\n1. Do X\n2. Do Y",
    })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [{ type: "text", text: "should be cleared" }] }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "fix the bug" },
      output,
    )

    // Should suppress the original command
    expect(output.parts).toEqual([])

    // Should clear then append prompt
    expect(tuiCalls.find(c => c.method === "clearPrompt")).toBeTruthy()
    const appendCall = tuiCalls.find(c => c.method === "appendPrompt")
    expect(appendCall!.args.body.text).toBe("## Refactored\n\n1. Do X\n2. Do Y")

    // Success toast
    expect(tuiCalls.find(c => c.method === "showToast" && c.args.body.variant === "success")).toBeTruthy()
  })

  it("extracts text directly from response parts", async () => {
    const { client, tuiCalls } = createMockPluginInput({
      promptTextResponse: "Refactored prompt text",
    })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [] as any[] }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      output,
    )

    const appendCall = tuiCalls.find(c => c.method === "appendPrompt")
    expect(appendCall!.args.body.text).toBe("Refactored prompt text")
  })

  it("shows error toast on failure", async () => {
    const { client, tuiCalls } = createMockPluginInput({ promptFail: true })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [] as any[] }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      output,
    )

    const errorToast = tuiCalls.find(c => c.method === "showToast" && c.args.body.variant === "error")
    expect(errorToast).toBeTruthy()
    expect(output.parts[0]!.text).toContain("failed")
  })

  it("cleans up temp session after completion", async () => {
    const { client, sessionCalls } = createMockPluginInput({
      promptTextResponse: "done",
    })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      { parts: [] } as any,
    )

    const deleteCall = sessionCalls.find(c => c.method === "delete")
    expect(deleteCall).toBeTruthy()
    expect(deleteCall!.args.path.id).toBe("tmp-session-1")
  })

  it("cleans up temp session even on error", async () => {
    const { client, sessionCalls } = createMockPluginInput({
      sessionCreateFail: false,
      promptFail: true,
    })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      { parts: [] } as any,
    )

    const deleteCall = sessionCalls.find(c => c.method === "delete")
    expect(deleteCall).toBeTruthy()
  })

  it("uses prompt-improver agent for model + temperature config", async () => {
    const { client, sessionCalls } = createMockPluginInput({
      promptTextResponse: "ok",
    })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      { parts: [] } as any,
    )

    const promptCall = sessionCalls.find(c => c.method === "prompt")
    expect(promptCall!.args.body.agent).toBe("prompt-improver")
  })
})
