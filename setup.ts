import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { homedir } from "node:os"

const OPENDODE_CONFIG = resolve(homedir(), ".config/opencode")

function stripJsoncComments(text: string): string {
  const out: string[] = []
  let inString = false
  let stringDelim = ""
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    const next = text[i + 1] ?? ""

    if (inLineComment) {
      if (ch === "\n") { inLineComment = false; out.push(ch) }
      continue
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; i++ }
      continue
    }
    if (inString) {
      if (ch === "\\") { out.push(ch, next); i++; continue }
      if (ch === stringDelim) inString = false
      out.push(ch)
      continue
    }
    if (ch === "/" && next === "/") { inLineComment = true; i++; continue }
    if (ch === "/" && next === "*") { inBlockComment = true; i++; continue }
    if (ch === '"' || ch === "'") { inString = true; stringDelim = ch }
    out.push(ch)
  }

  return out.join("")
}

function deepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] || {}, source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

export function setup() {
  // 1. Ensure plugins directory
  const pluginsDir = resolve(OPENDODE_CONFIG, "plugins")
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true })
  }

  // 2. Copy plugin file
  const src = resolve(import.meta.dirname, "src", "index.ts")
  const dest = resolve(pluginsDir, "prompt-improver.ts")
  cpSync(src, dest)
  console.log("✓ Copied plugin →", dest)

  // 3. Merge opencode.jsonc
  const configPath = resolve(OPENDODE_CONFIG, "opencode.jsonc")
  let config: any = {}
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8").trim()
    if (raw) config = JSON.parse(stripJsoncComments(raw))
  }

  deepMerge(config, {
    agent: {
      "prompt-improver": {
        hidden: true,
        temperature: 0.1,
        model: "opencode/deepseek-v4-flash-free",
        prompt:
          "You are an expert prompt engineer. Your task: transform rough, vague instructions into precise, well-structured prompts that any AI assistant can execute effectively — with full context, clear scope, and no room for misinterpretation.\n\nWhat makes an excellent AI prompt:\n- Clear objective: exactly what needs to be done, in imperative form\n- Relevant context: background the AI needs to understand the task correctly\n- Scope and constraints: what to focus on, what to ignore, what format or style to follow\n- Expected output: what done looks like — format, depth, length, or style when it matters\n- Key specifics: domain knowledge, examples, edge cases — only what the AI cannot infer itself\n\nHow to improve:\n- Expand vague verbs: \"improve\" → what dimension; \"fix\" → what symptom and where; \"make it better\" → better in what way\n- Surface implied context the AI would need but might miss\n- Add acceptance criteria or a success definition where helpful\n- For multi-step tasks: use numbered steps; for parallel concerns: use bullets\n- Match precision to the task — technical work needs specifics; creative work needs direction, not over-specification\n\nNon-negotiable output rules:\n- Return ONLY the improved prompt — no preamble, explanation, or meta-commentary\n- Plain text only — no code blocks, backticks, or markdown wrappers around the whole response\n- Completeness over brevity — a thorough prompt prevents wasted turns and misunderstandings\n- Do not invent details not present in the original; only clarify and expand what is given\n- Do not add scope beyond what was asked\n- Write in the same language as the original instruction",
        // "*": "deny" blocks ALL tool calls — the improver only needs to think and respond
        permission: {
          "*": "deny",
        },
      },
    },
    command: {
      improve: {
        description: "Expand and sharpen your rough instruction into a precise prompt before sending",
        template: "$ARGUMENTS",
      },
    },
  })

  writeFileSync(configPath, JSON.stringify(config, null, "\t") + "\n")
  console.log("✓ Merged opencode.jsonc config")

  // 4. Merge tui.json
  const tuiPath = resolve(OPENDODE_CONFIG, "tui.json")
  let tui: any = {}
  if (existsSync(tuiPath)) {
    const raw = readFileSync(tuiPath, "utf-8").trim()
    if (raw) tui = JSON.parse(raw)
  }

  deepMerge(tui, {
    keybinds: {
      prompt_improve: {
        bindings: ["C-S-i"],
        command: "command.execute",
        description: "Improve the current prompt in the chat input",
      },
    },
  })

  writeFileSync(tuiPath, JSON.stringify(tui, null, 2) + "\n")
  console.log("✓ Merged tui.json keybinds")

  console.log("\nDone! Restart OpenCode to activate.")
}

setup()