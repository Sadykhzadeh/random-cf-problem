import { test } from "node:test"
import assert from "node:assert/strict"

import { fill, pickLanguage, strings } from "../modules/i18n.js"

test("the address beats the remembered choice, which beats the browser", () => {
    assert.equal(pickLanguage("?lang=ru", "en", ["en-US"]), "ru")
    assert.equal(pickLanguage("", "ru", ["en-US"]), "ru")
    assert.equal(pickLanguage("", null, ["de-DE", "ru-RU", "en"]), "ru")
    assert.equal(pickLanguage("", null, ["uk"]), "en")
    assert.equal(pickLanguage("?lang=fr", "xx", []), "en", "unknown values are ignored")
})

test("both languages have every string", () => {
    assert.deepEqual(Object.keys(strings.ru).sort(), Object.keys(strings.en).sort())
    for (const value of [...Object.values(strings.en), ...Object.values(strings.ru)]) {
        assert.equal(typeof value, "string")
        assert.ok(value.length > 0)
    }
})

test("placeholders are filled and unknown ones left alone", () => {
    assert.equal(fill("{count} of {total} {x}", { count: 3, total: 10 }), "3 of 10 {x}")
})
