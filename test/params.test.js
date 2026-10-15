import { test } from "node:test"
import assert from "node:assert/strict"

import { DEFAULTS, readParams, writeParams } from "../modules/params.js"

test("settings survive a round trip through the address", () => {
    const settings = {
        min: "1200",
        max: "1600",
        since: "2019",
        tags: ["dp", "binary search"],
        mode: "any",
        nospecial: true,
        handles: "tourist, jiangly",
        tried: true,
        hide: true,
    }
    const search = writeParams(settings)
    assert.equal(search, "min=1200&max=1600&since=2019&tags=dp,binary+search&any=1&nospecial=1&skip=tourist,+jiangly&tried=1&hide=1")
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
    for (const since of ["19", "20190", "2019.5", "abcd"]) assert.equal(readParams(`?since=${since}`).since, "")
})

test("leaving the topics out survives a round trip", () => {
    const settings = { ...DEFAULTS, tags: ["interactive", "geometry"], mode: "none" }
    assert.equal(writeParams(settings), "tags=interactive,geometry&none=1")
    assert.deepEqual(readParams("?tags=interactive,geometry&none=1"), settings)
    assert.equal(writeParams({ ...DEFAULTS, mode: "none" }), "", "nothing to leave out")
})
