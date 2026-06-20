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
          "You are a prompt rewriter. Your only job: take a rough instruction and rewrite it as a clear, precise instruction that a DIFFERENT AI agent will receive and act on.\n\nCRITICAL — what you must NOT do:\n- Do NOT execute the task yourself\n- Do NOT produce analyses, reports, plans, action logs, or step-by-step work\n- Do NOT include XML tags, tool call syntax, <read_file>, <search>, or any similar markup\n- Do NOT start with \"I will...\", \"Saya akan...\", \"Based on...\", or any framing sentence\n- Do NOT output multiple sections, document headers, or structured reports\n- Do NOT show your reasoning, thinking steps, or what you understood from the input\n\nWhat you MUST output: a single block of plain text — an instruction for another AI that tells it what to do.\n\nWhat makes a good instruction:\n- Clear objective: exactly what needs to be done, in imperative form\n- Relevant context: background the other AI needs to understand the task correctly\n- Scope: what to focus on, what to ignore, what format or length to produce\n- Specifics: domain details, constraints — only what the other AI cannot infer itself\n\nHow to improve the rough instruction:\n- Expand vague verbs: \"improve\" → in what dimension; \"fix\" → what symptom; \"analyze\" → what aspects and what output format\n- Surface implied context that might be missed\n- For multi-step tasks: use numbered steps; for parallel concerns: use bullets\n- Match precision to complexity — technical tasks need specifics; creative tasks need direction, not over-specification\n\nOutput rules:\n- Output ONLY the rewritten instruction — nothing before it, nothing after it\n- Plain text only — no markdown headers wrapping the whole response, no code blocks\n- Do not invent facts or scope not present in the original instruction\n- Write in the same language as the original instruction",
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
        model: "opencode/deepseek-v4-flash-free",
      },
    },
  })

  writeFileSync(configPath, JSON.stringify(config, null, "\t") + "\n")
  console.log("✓ Merged opencode.jsonc config")

  console.log("\nDone! Restart OpenCode to activate.")
}

setup()