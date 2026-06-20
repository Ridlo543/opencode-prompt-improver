import { describe, it, expect, mock } from "bun:test"
import type { PluginInput, Hooks } from "@opencode-ai/plugin"

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
      abort: mock(async (args: any) => {
        sessionCalls.push({ method: "abort", args })
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

  it("shows warning and sets noMessage for empty prompt", async () => {
    const { client, tuiCalls } = createMockPluginInput()
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [], noMessage: false }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "" },
      output,
    )

    expect(tuiCalls[0]!.method).toBe("showToast")
    expect(tuiCalls[0]!.args.body.variant).toBe("warning")
    expect(output.noMessage).toBe(true)
  })

  it("improves prompt, populates chat input, and sets noMessage to skip session message", async () => {
    const { client, tuiCalls, sessionCalls } = createMockPluginInput({
      promptTextResponse: "## Refactored\n\n1. Do X\n2. Do Y",
    })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [{ type: "text", text: "raw rough prompt" }], noMessage: false }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "fix the bug" },
      output,
    )

    // noMessage=true — no session message created, no agent runs, session stays clean
    expect(output.noMessage).toBe(true)

    // Chat input updated with improved text for review
    const appendCall = tuiCalls.find(c => c.method === "appendPrompt")
    expect(appendCall!.args.body.text).toBe("## Refactored\n\n1. Do X\n2. Do Y")

    // Success toast shown
    expect(tuiCalls.find(c => c.method === "showToast" && c.args.body.variant === "success")).toBeTruthy()

    expect(sessionCalls.find(c => c.method === "abort")).toBeUndefined()
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

  it("shows error toast on failure and sets noMessage to keep session clean", async () => {
    const { client, tuiCalls, sessionCalls } = createMockPluginInput({ promptFail: true })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    const output: any = { parts: [] as any[], noMessage: false }
    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      output,
    )

    const errorToast = tuiCalls.find(c => c.method === "showToast" && c.args.body.variant === "error")
    expect(errorToast).toBeTruthy()
    // noMessage still true on error — session stays clean, toast is enough feedback
    expect(output.noMessage).toBe(true)
    expect(sessionCalls.find(c => c.method === "abort")).toBeUndefined()
  })

  it("cleans up temp session after completion", async () => {
    const { client, sessionCalls } = createMockPluginInput({ promptTextResponse: "done" })
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
    const { client, sessionCalls } = createMockPluginInput({ promptFail: true })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      { parts: [] } as any,
    )

    const deleteCall = sessionCalls.find(c => c.method === "delete")
    expect(deleteCall).toBeTruthy()
  })

  it("uses prompt-improver agent for model + temperature config", async () => {
    const { client, sessionCalls } = createMockPluginInput({ promptTextResponse: "ok" })
    const hooks = await (await import("../src/index")).default({ client } as PluginInput) as Hooks

    await hooks["command.execute.before"]!(
      { command: "improve", sessionID: "s1", arguments: "test" },
      { parts: [] } as any,
    )

    const promptCall = sessionCalls.find(c => c.method === "prompt")
    expect(promptCall!.args.body.agent).toBe("prompt-improver")
  })
})
