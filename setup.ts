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
        permission: {
          edit: "deny",
          bash: "deny",
          webfetch: "deny",
        },
      },
    },
    command: {
      improve: {
        description: "Improve and structure the current prompt before sending",
        template: "{{input}}",
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