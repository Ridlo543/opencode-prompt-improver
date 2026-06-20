import type { Plugin } from "@opencode-ai/plugin"

export const PromptImprover: Plugin = async ({ client, directory }) => {
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

      await client.tui.showToast({ body: { message: "Improving prompt…", variant: "info", duration: 300000 } })

      let subSessionID: string | undefined
      try {
        // parentID scopes the sub-session as a child of the main session so its
        // lifecycle events don't pollute the workspace's shared provider state.
        // query.directory pins it to the same workspace context as the main session.
        const createResult = await client.session.create({
          body: { title: "prompt-improve", parentID: input.sessionID },
          query: { directory },
        })
        const session = createResult.data
        subSessionID = session?.id
        if (!subSessionID) throw new Error("Failed to create sub-session")

        const promptResult = await client.session.prompt({
          path: { id: subSessionID },
          body: {
            agent: "prompt-improver",
            parts: [{ type: "text", text: rawPrompt }],
          },
          query: { directory },
        })

        const responseParts = promptResult.data?.parts ?? []
        const raw = responseParts
          .filter((p) => p.type === "text")
          .map((p) => (p as any).text ?? "")
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
          try { await client.session.delete({ path: { id: subSessionID }, query: { directory } }) } catch { /* ignore */ }
        }
      }
    },
  }
}

export default PromptImprover
