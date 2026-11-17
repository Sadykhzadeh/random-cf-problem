import { test } from "node:test"
import assert from "node:assert/strict"

import { canShare, createSettle, share, sharePayload, shortcutFor } from "../modules/ui.js"

// Plain descriptions of where a key press lands: the page's body, a button,
// and fields of each kind.
const body = { tagName: "BODY" }
const button = { tagName: "BUTTON" }
const link = { tagName: "A" }
const checkbox = { tagName: "INPUT", type: "checkbox" }
const radio = { tagName: "INPUT", type: "radio" }
const textField = { tagName: "INPUT", type: "text" }
const numberField = { tagName: "INPUT", type: "number" }
const select = { tagName: "SELECT" }
const textarea = { tagName: "TEXTAREA" }
const editable = { tagName: "DIV", isContentEditable: true }

const press = (key, code, target = body, extra = {}) => shortcutFor({ key, code, target, ...extra })

test("R draws again whatever the keyboard layout", () => {
    assert.equal(press("r", "KeyR"), "draw")
    assert.equal(press("R", "KeyR"), "draw", "with Shift or Caps Lock")
    assert.equal(press("к", "KeyR"), "draw", "the same key on a Russian layout")
    assert.equal(press("К", "KeyR"), "draw")
    assert.equal(press("r", "KeyO"), "draw", "R on Dvorak")
    assert.equal(press("p", "KeyR"), null, "the key that types P on Dvorak")
    assert.equal(press("к", "KeyK"), null)
})

test("O opens the problem whatever the keyboard layout", () => {
    assert.equal(press("o", "KeyO"), "open")
    assert.equal(press("O", "KeyO"), "open")
    assert.equal(press("щ", "KeyO"), "open", "the same key on a Russian layout")
    assert.equal(press("o", "KeyS"), "open", "O on Dvorak")
    assert.equal(press("r", "KeyO"), "draw", "the key that types R on Dvorak draws")
    assert.equal(press("щ", "KeyK"), null)
})

test("C copies the link whatever the keyboard layout", () => {
    assert.equal(press("c", "KeyC"), "copy")
    assert.equal(press("с", "KeyC"), "copy", "the same key on a Russian layout")
    assert.equal(press("c", "KeyI"), "copy", "C on Dvorak")
    assert.equal(press("c", "KeyC", button), "copy", "a focused button does not take C")
})

test("Space and Enter draw where nothing else would take them", () => {
    assert.equal(press(" ", "Space"), "draw")
    assert.equal(press("Enter", "Enter"), "draw")
    assert.equal(press(" ", "Space", checkbox), null, "ticking the box is what Space does there")
    assert.equal(press(" ", "Space", radio), null)
    assert.equal(press(" ", "Space", button), null, "pressing the button is what Space does")
    assert.equal(press("Enter", "Enter", button), null)
    assert.equal(press("Enter", "Enter", link), null, "Enter follows the link")
    assert.equal(press(" ", "Space", { tagName: "SUMMARY" }), null, "Space opens the topics")
    assert.equal(press("Enter", "Enter", { tagName: "DIV" }), "draw", "a plain part of the page")
})

test("nothing is a shortcut while a field is being typed in", () => {
    for (const field of [textField, numberField, select, textarea, editable]) {
        assert.equal(press("r", "KeyR", field), null)
        assert.equal(press("o", "KeyO", field), null)
        assert.equal(press("c", "KeyC", field), null)
        assert.equal(press(" ", "Space", field), null)
        assert.equal(press("Enter", "Enter", field), null, "Enter in a field is left to the form")
    }
})

test("a checkbox or radio button is not a field, so the letters still work there", () => {
    assert.equal(press("r", "KeyR", checkbox), "draw")
    assert.equal(press("o", "KeyO", radio), "open")
    assert.equal(press("c", "KeyC", checkbox), "copy")
})

test("shortcuts with Control, Command, Alt or a held key do nothing", () => {
    assert.equal(press("c", "KeyC", body, { ctrlKey: true }), null, "Ctrl+C copies text")
    assert.equal(press("r", "KeyR", body, { metaKey: true }), null)
    assert.equal(press("o", "KeyO", body, { altKey: true }), null)
    assert.equal(press("r", "KeyR", body, { repeat: true }), null, "a held key draws once")
})

// Timers that run only when the test says so.
const fakeTimers = () => {
    const pending = new Map()
    let next = 1
    return {
        setTimer: (fn) => { pending.set(next, fn); return next++ },
        clearTimer: (id) => { pending.delete(id) },
        fire: () => { for (const [id, fn] of [...pending]) { pending.delete(id); fn() } },
        count: () => pending.size,
    }
}

test("a value is announced once it settles, not on every keystroke", () => {
    const timers = fakeTimers()
    const said = []
    const settle = createSettle((text) => said.push(text), { delay: 600, setTimer: timers.setTimer, clearTimer: timers.clearTimer })
    settle.update("1 problem")
    settle.update("12 problems")
    settle.update("123 problems")
    assert.deepEqual(said, [], "nothing is said while the value keeps changing")
    assert.equal(timers.count(), 1, "one timer waits, however many updates there were")
    timers.fire()
    assert.deepEqual(said, ["123 problems"], "the latest value, once")
})

test("a change or a blur announces at once and drops the wait", () => {
    const timers = fakeTimers()
    const said = []
    const settle = createSettle((text) => said.push(text), { setTimer: timers.setTimer, clearTimer: timers.clearTimer })
    settle.update("5 problems")
    settle.commit("7 problems")
    assert.deepEqual(said, ["7 problems"])
    assert.equal(timers.count(), 0, "the pending announcement is gone")
    timers.fire()
    assert.deepEqual(said, ["7 problems"], "not said twice")
})

test("a share button is offered only where the device can share", () => {
    assert.equal(canShare({ share: () => {} }), true)
    assert.equal(canShare({}), false, "no share sheet")
    assert.equal(canShare(undefined), false, "no navigator")
})

test("a share sends the title and the link, and nothing without a link", () => {
    assert.deepEqual(sharePayload("  2274A. Name ", "https://codeforces.com/problemset/problem/2274/A"), {
        title: "2274A. Name", url: "https://codeforces.com/problemset/problem/2274/A",
    })
    assert.deepEqual(sharePayload(undefined, "https://example.org/x"), { title: "", url: "https://example.org/x" })
    assert.equal(sharePayload("title", ""), null)
})

test("a share goes to the device's sheet, and dismissing the sheet is not an error", async () => {
    const sent = []
    await share({ share: async (payload) => { sent.push(payload) } }, { title: "t", url: "u" })
    assert.deepEqual(sent, [{ title: "t", url: "u" }])
    await share({ share: async () => { throw Object.assign(new Error("closed"), { name: "AbortError" }) } }, { title: "t", url: "u" })
})
