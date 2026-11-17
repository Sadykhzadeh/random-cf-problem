import { test } from "node:test"
import assert from "node:assert/strict"

import { fill, loadStrings, pickLanguage } from "../modules/i18n.js"
import en from "../modules/strings-en.js"
import ru from "../modules/strings-ru.js"

test("the address beats the remembered choice, which beats the browser", () => {
    assert.equal(pickLanguage("?lang=ru", "en", ["en-US"]), "ru")
    assert.equal(pickLanguage("", "ru", ["en-US"]), "ru")
    assert.equal(pickLanguage("", null, ["de-DE", "ru-RU", "en"]), "ru")
    assert.equal(pickLanguage("", null, ["uk"]), "en")
    assert.equal(pickLanguage("?lang=fr", "xx", []), "en", "unknown values are ignored")
})

test("each language file is the one its visit asks for", async () => {
    assert.equal(await loadStrings("en"), en)
    assert.equal(await loadStrings("ru"), ru)
    assert.equal(await loadStrings("fr"), en, "anything but Russian reads English")
})

test("both language files have the same keys, each with text", () => {
    assert.deepEqual(Object.keys(ru).sort(), Object.keys(en).sort())
    for (const value of [...Object.values(en), ...Object.values(ru)]) {
        assert.equal(typeof value, "string")
        assert.ok(value.length > 0)
    }
})

test("placeholders are filled and unknown ones left alone", () => {
    assert.equal(fill("{count} of {total} {x}", { count: 3, total: 10 }), "3 of 10 {x}")
})
