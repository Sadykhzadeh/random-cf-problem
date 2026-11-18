import { test } from "node:test"
import assert from "node:assert/strict"

import { countText, fill, loadStrings, pickLanguage } from "../modules/i18n.js"
import { baseKeys } from "./support/keys.js"
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
    assert.deepEqual(baseKeys(ru), baseKeys(en), "a count form is only compared with the bare key it extends")
    for (const value of [...Object.values(en), ...Object.values(ru)]) {
        assert.equal(typeof value, "string")
        assert.ok(value.length > 0)
    }
})

test("placeholders are filled and unknown ones left alone", () => {
    assert.equal(fill("{count} of {total} {x}", { count: 3, total: 10 }), "3 of 10 {x}")
})

test("a count takes the form its noun agrees with, in English and in Russian", () => {
    const strings = { task: "bare", taskOne: "one", taskFew: "few" }
    const form = (count, lang) => countText(strings, "task", count, lang)
    assert.equal(form(1, "en"), "one")
    assert.equal(form(2, "en"), "bare", "English has no few-form")
    for (const count of [1, 21, 101]) assert.equal(form(count, "ru"), "one", `${count} задача`)
    for (const count of [2, 3, 4, 22, 103]) assert.equal(form(count, "ru"), "few", `${count} задачи`)
    for (const count of [0, 5, 11, 12, 14, 15, 20, 25, 111, 112]) assert.equal(form(count, "ru"), "bare", `${count} задач`)
})

test("a count with no form of its own reads the bare key", () => {
    assert.equal(countText({ solved: "bare" }, "solved", 1, "en"), "bare")
    assert.equal(countText({ solved: "bare" }, "solved", 3, "ru"), "bare")
})
