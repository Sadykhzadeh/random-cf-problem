import { test } from "node:test"
import assert from "node:assert/strict"

import { startTogether } from "../modules/startup.js"

test("the language file and the problem list both start before either has finished", async () => {
    const calls = []
    const settled = []
    const pending = (name) => () => {
        calls.push(name)
        return new Promise((resolve) => setTimeout(() => resolve(name), 5)).then((value) => {
            settled.push(value)
            return value
        })
    }
    const started = startTogether({ text: pending("text"), list: pending("list") })
    assert.deepEqual(calls, ["text", "list"], "both began as the page started")
    assert.deepEqual(settled, [], "neither had finished")
    assert.deepEqual(await Promise.all([started.text, started.list]), ["text", "list"])
})

test("a load that fails does not stop the other from starting", async () => {
    let listStarted = false
    const started = startTogether({
        text: () => Promise.reject(new Error("no file")),
        list: () => { listStarted = true; return Promise.resolve("list") },
    })
    assert.equal(listStarted, true, "the list began although the text failed")
    await assert.rejects(started.text)
    assert.equal(await started.list, "list")
})
