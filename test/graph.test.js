import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// The page's modules, read from the files themselves, so the preload hints
// cannot drift from the imports.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => readFileSync(join(root, file), "utf8")

// The modules a file imports statically. A dynamic import() is not one: it
// is fetched when it runs, so it is not part of the first load.
const staticImports = (file) => [...read(file).matchAll(/^\s*import\s[^;]*?from\s+"(\.{1,2}\/[^"]+)"|^\s*import\s+"(\.{1,2}\/[^"]+)"/gm)]
    .map((match) => normalize(join(dirname(file), match[1] ?? match[2])).replaceAll("\\", "/"))

// Everything the first load needs: the script and each module it reaches
// through static imports, transitively.
const firstLoad = (entry) => {
    const seen = new Set()
    const visit = (file) => {
        for (const next of staticImports(file)) {
            if (seen.has(next)) continue
            seen.add(next)
            visit(next)
        }
    }
    visit(entry)
    return [...seen].sort()
}

const preloaded = () => [...read("index.html").matchAll(/<link rel="modulepreload" href="([^"]+)">/g)]
    .map((match) => match[1])
    .sort()

test("the modules the page imports statically are exactly the ones it preloads", () => {
    assert.ok(firstLoad("script.js").length >= 6, "the graph is read, not empty")
    assert.deepEqual(preloaded(), firstLoad("script.js"))
})

test("a module loaded with import() is not preloaded, since the first load does not need it", () => {
    const chosen = read("modules/i18n.js").match(/import\(([^)]*)\)/)
    assert.ok(chosen, "i18n.js loads the language with import()")
    for (const path of preloaded()) assert.ok(!path.includes("strings-") && !path.includes("practice"), path)
})
