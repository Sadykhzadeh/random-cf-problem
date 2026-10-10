import { test } from "node:test"
import assert from "node:assert/strict"

import { DEFAULTS, readParams, writeParams } from "../modules/params.js"

test("settings survive a round trip through the address", () => {
    const settings = {
        min: "1200",
        max: "1600",
        tags: ["dp", "binary search"],
        mode: "any",
        handles: "tourist, jiangly",
        tried: true,
        hide: true,
    }
    const search = writeParams(settings)
    assert.equal(search, "min=1200&max=1600&tags=dp,binary+search&any=1&skip=tourist,+jiangly&tried=1&hide=1")
    assert.deepEqual(readParams(`?${search}`), settings)
})

test("defaults are left out of the link", () => {
    assert.equal(writeParams(DEFAULTS), "")
    assert.equal(writeParams(DEFAULTS, "ru"), "lang=ru")
    assert.equal(writeParams({ ...DEFAULTS, mode: "any", tried: true }), "", "neither means anything alone")
})

test("an address without settings says so, and bad values are dropped", () => {
    assert.equal(readParams("?lang=ru"), null)
    assert.equal(readParams(""), null)
    assert.deepEqual(readParams("?min=abc&max=99999&tags=,dp,,&hide=yes"), {
        ...DEFAULTS,
        tags: ["dp"],
    })
    assert.equal(readParams("?min=0800").min, "800")
})
