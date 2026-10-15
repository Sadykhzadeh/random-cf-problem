import { test } from "node:test"
import assert from "node:assert/strict"

import { isDrawKey } from "../modules/ui.js"

test("R draws again whatever the keyboard layout", () => {
    assert.equal(isDrawKey("r", "KeyR"), true)
    assert.equal(isDrawKey("R", "KeyR"), true, "with Shift or Caps Lock")
    assert.equal(isDrawKey("к", "KeyR"), true, "the same key on a Russian layout")
    assert.equal(isDrawKey("К", "KeyR"), true)
    assert.equal(isDrawKey("r", "KeyO"), true, "R on Dvorak")
    assert.equal(isDrawKey("p", "KeyR"), false, "the key that types P on Dvorak")
    assert.equal(isDrawKey("к", "KeyK"), false)
    assert.equal(isDrawKey("Enter", "Enter"), false)
})
