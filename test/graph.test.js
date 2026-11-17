import { test } from "node:test"
import assert from "node:assert/strict"

import { firstLoad, read } from "./support/walk.js"

const preloaded = () => [...read("index.html").matchAll(/<link rel="modulepreload" href="([^"]+)">/g)]
    .map((match) => match[1])
    .sort()

test("the modules the page imports statically are exactly the ones it preloads", () => {
    assert.ok(firstLoad("script.js").length >= 6, "the graph is read, not empty")
    assert.deepEqual(preloaded(), firstLoad("script.js"))
})

test("the language files and the practice set load on demand, so they are not preloaded", () => {
    for (const path of preloaded()) assert.ok(!/strings-|practice/.test(path), path)
})
