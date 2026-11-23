import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { root } from "./support/walk.js"

const css = readFileSync(join(root, "styles/styles.css"), "utf8")

// The text of the block opened by `header`, up to its matching brace.
const blockOf = (header) => {
    const start = css.indexOf(header)
    assert.notEqual(start, -1, `${header} is in the stylesheet`)
    let depth = 0
    for (let i = css.indexOf("{", start); i < css.length; i++) {
        if (css[i] === "{") depth++
        if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1)
    }
    throw new Error("unclosed block")
}

test("on a touch screen the small buttons, links and labels are at least 32px tall", () => {
    const touch = blockOf("@media (pointer: coarse)")
    for (const selector of ["button:not(#start):not(#buildSet)", "#langs a", "footer a", "#setList a", "#recentList a", ".topic", "#recentList label", "#setList label"]) {
        const rule = touch.split("}").find((part) => part.includes(selector))
        assert.ok(rule, `${selector} is made bigger for a finger`)
        const height = /min-height:\s*(\d+)px/.exec(rule) ?? /padding:\s*(\d+)px 0/.exec(rule)
        assert.ok(height, `${selector} has a height or padding`)
    }
    assert.ok([...touch.matchAll(/min-height:\s*(\d+)px/g)].every((match) => Number(match[1]) >= 32))
})

test("the mouse layout does not take the touch sizes", () => {
    assert.ok(!/min-height:\s*36px/.test(css.replace(blockOf("@media (pointer: coarse)"), "")))
})
