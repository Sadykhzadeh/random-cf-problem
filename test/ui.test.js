import { test } from "node:test"
import assert from "node:assert/strict"

import { isDrawKey, isOpenKey } from "../modules/ui.js"

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

test("O opens the problem whatever the keyboard layout", () => {
    assert.equal(isOpenKey("o", "KeyO"), true)
    assert.equal(isOpenKey("O", "KeyO"), true)
    assert.equal(isOpenKey("щ", "KeyO"), true, "the same key on a Russian layout")
    assert.equal(isOpenKey("o", "KeyS"), true, "O on Dvorak")
    assert.equal(isOpenKey("r", "KeyO"), false, "the key that types R on Dvorak")
    assert.equal(isOpenKey("щ", "KeyK"), false)
})
