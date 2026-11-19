import { test } from "node:test"
import assert from "node:assert/strict"

import { localize_tags, tags } from "../modules/tags.js"

test("a topic is named in Russian on the Russian page and by Codeforces' own name otherwise", () => {
    assert.equal(localize_tags("binary search", "ru"), "бинарный поиск")
    assert.equal(localize_tags("binary search", "en"), "binary search")
    assert.equal(localize_tags("dp", "ru"), "дп")
})

test("a topic the list does not know keeps its name in both languages", () => {
    assert.equal(localize_tags("*special", "ru"), "*special")
    assert.equal(localize_tags("*special", "en"), "*special")
})

test("every topic in the list is listed once, with a name and a title in each language", () => {
    assert.equal(new Set(tags.map((tag) => tag.value)).size, tags.length)
    for (const tag of tags) {
        assert.ok(tag.name && tag.title && tag.titleEn, tag.value)
        assert.equal(localize_tags(tag.value, "ru"), tag.name)
        assert.equal(localize_tags(tag.value, "en"), tag.value)
    }
})
