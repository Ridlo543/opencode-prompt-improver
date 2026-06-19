import type { Plugin } from "@opencode-ai/plugin"

const SYSTEM_PROMPT = `You are a prompt improvement assistant for AI coding agents.
Given a rough prompt, produce a refined version that is more specific, structured, and effective.

RULES:
- PRESERVE intent exactly — do NOT add features, scope, or requirements
- ADD specificity for vague parts (files, frameworks, patterns if contextually relevant)
- STRUCTURE with sections, bullets, or numbered steps for multi-part tasks
- USE precise technical language
- BE concise — quality over volume
- DO NOT add explanatory notes — return ONLY the improved prompt
- The output must be self-contained and ready to send to an AI coding agent`

export const PromptImprover: Plugin = async ({ client }) => {
  return {
    "command.execute.before": async (input, output) => {
      if (input.command !== "improve") return

      const rawPrompt = input.arguments?.trim() ?? ""

      if (!rawPrompt) {
        await client.tui.showToast({ body: { message: "Usage: /improve <your rough prompt>", variant: "warning" } })
        ;(output as any).parts = [{ type: "text", text: "No prompt provided." }]
        return
      }

      await client.tui.showToast({ body: { message: "Improving prompt…", variant: "info", duration: 15000 } })

      let subSessionID: string | undefined
      try {
        // Create temp sub-session to avoid polluting main chat
        const createResult = await client.session.create({ body: { title: "prompt-improve" } })
        const session = (createResult as any).data
        subSessionID = session?.id
        if (!subSessionID) throw new Error("Failed to create sub-session")

        // Use agent: "prompt-improver" so opencode picks up its configured model + temperature
        const promptResult = await client.session.prompt({
          path: { id: subSessionID },
          body: {
            agent: "prompt-improver",
            parts: [{ type: "text", text: SYSTEM_PROMPT + "\n\n<raw_prompt>\n" + rawPrompt + "\n</raw_prompt>" }],
          },
        } as any)

        // Extract text from response parts
        const responseParts: any[] = (promptResult as any).data?.parts ?? []
        const improved = responseParts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? "")
          .join("")
          .trim()

        if (!improved) throw new Error("Could not extract improved prompt from LLM response")

        // Inject improved prompt into chat input
        await client.tui.clearPrompt()
        await client.tui.appendPrompt({ body: { text: improved } })
        await client.tui.showToast({ body: { message: "Improved! Review and press Enter to send.", variant: "success" } })

        // Suppress the raw command from reaching the agent
        ;(output as any).parts = []
      } catch (error) {
        await client.tui.showToast({
          body: {
            message: "Failed: " + (error instanceof Error ? error.message : String(error)),
            variant: "error",
          },
        })
        ;(output as any).parts = [{ type: "text", text: "Prompt improvement failed." }]
      } finally {
        if (subSessionID) {
          try { await client.session.delete({ path: { id: subSessionID } }) } catch { /* ignore */ }
        }
      }
    },
  }
}

export default PromptImprover
