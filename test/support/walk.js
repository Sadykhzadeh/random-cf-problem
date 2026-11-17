// Reads the page's files and walks the static import graph of its script, so
// the tests that compare the page with its graph and budget its first load
// use the same reading of it. A dynamic import() is not a static import: it
// is fetched when it runs, so it is not part of the first load.
import { readFileSync } from "node:fs"
import { dirname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

export const read = (file) => readFileSync(join(root, file), "utf8")

export const staticImports = (file) => [...read(file).matchAll(/^\s*import\s[^;]*?from\s+"(\.{1,2}\/[^"]+)"|^\s*import\s+"(\.{1,2}\/[^"]+)"/gm)]
    .map((match) => normalize(join(dirname(file), match[1] ?? match[2])).replaceAll("\\", "/"))

// Every module the script reaches through static imports, transitively.
export const firstLoad = (entry) => {
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
