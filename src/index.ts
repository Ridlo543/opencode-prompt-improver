import type { Plugin } from "@opencode-ai/plugin"

export const PromptImprover: Plugin = async ({ client }) => {
  return {
    "command.execute.before": async (input, output) => {
      if (input.command !== "improve") return

      // noMessage: skip session message creation entirely — this is a pure text transform
      output.noMessage = true

      const rawPrompt = input.arguments?.trim() ?? ""

      if (!rawPrompt) {
        await client.tui.showToast({ body: { message: "Usage: /improve <your rough prompt>", variant: "warning" } })
        return
      }

      await client.tui.showToast({ body: { message: "Improving prompt…", variant: "info", duration: 15000 } })

      let subSessionID: string | undefined
      try {
        const createResult = await client.session.create({ body: { title: "prompt-improve" } })
        const session = (createResult as any).data
        subSessionID = session?.id
        if (!subSessionID) throw new Error("Failed to create sub-session")

        const promptResult = await client.session.prompt({
          path: { id: subSessionID },
          body: {
            agent: "prompt-improver",
            parts: [{ type: "text", text: rawPrompt }],
          },
        } as any)

        const responseParts: any[] = (promptResult as any).data?.parts ?? []
        const raw = responseParts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? "")
          .join("")
          .trim()
        // Strip code-block wrapping if the LLM adds it despite instructions
        const improved = raw.replace(/^```[^\n]*\n?([\s\S]*?)```\s*$/s, "$1").trim()

        if (!improved) throw new Error("Could not extract improved prompt from LLM response")

        await client.tui.appendPrompt({ body: { text: improved } })
        await client.tui.showToast({
          body: { message: "Improved! Review then press Enter to send.", variant: "success" },
        })
      } catch (error) {
        await client.tui.showToast({
          body: {
            message: "Failed: " + (error instanceof Error ? error.message : String(error)),
            variant: "error",
          },
        })
      } finally {
        if (subSessionID) {
          try { await client.session.delete({ path: { id: subSessionID } }) } catch { /* ignore */ }
        }
      }
    },
  }
}

export default PromptImprover
