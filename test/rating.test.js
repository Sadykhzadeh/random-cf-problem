import { test } from "node:test"
import assert from "node:assert/strict"

import { RATING_FRESH_FOR, applyRating, ratingRange, readRating } from "../modules/skip.js"

test("the range runs from a hundred below the rating to three hundred above, rounded to hundreds", () => {
    assert.deepEqual(ratingRange(1500), { min: 1400, max: 1800 })
    assert.deepEqual(ratingRange(1549), { min: 1400, max: 1800 }, "rounds down")
    assert.deepEqual(ratingRange(1551), { min: 1500, max: 1900 }, "rounds up")
    assert.deepEqual(ratingRange(1400), { min: 1300, max: 1700 })
})

test("the range stays within 800 to 3500", () => {
    assert.deepEqual(ratingRange(500), { min: 800, max: 800 }, "a low rating is lifted to the floor")
    assert.deepEqual(ratingRange(820), { min: 800, max: 1100 })
    assert.deepEqual(ratingRange(3400), { min: 3300, max: 3500 }, "a high one stops at the ceiling")
    assert.deepEqual(ratingRange(3600), { min: 3500, max: 3500 })
})

test("an unrated handle gets the range of a newcomer", () => {
    assert.deepEqual(ratingRange(null), { min: 800, max: 1200 })
    assert.deepEqual(ratingRange(undefined), { min: 800, max: 1200 })
})

// A cache held in memory, as the Cache API would hold it. Each write is kept in `writes`.
const memoryCache = (entries = {}) => {
    const writes = []
    const urlOf = (key) => typeof key === "string" ? key : key.url
    return {
        async match(key) {
            if (!(urlOf(key) in entries)) return undefined
            return new Response(JSON.stringify(entries[urlOf(key)]), { headers: { "Content-Type": "application/json" } })
        },
        put(key, response) {
            const write = response.json().then((value) => { entries[key] = value })
            writes.push(write)
            return write
        },
        async keys() {
            return Object.keys(entries).map((url) => ({ url }))
        },
        async delete(key) {
            return delete entries[urlOf(key)]
        },
        entries,
        writes,
    }
}

const answer = (result) => async () => ({ response: { ok: true, status: 200 }, json: { status: "OK", result } })
const failure = (response, json) => new Error(`failed: ${json?.comment ?? response.status}`)

test("a rating is asked for once and then kept, and an unrated handle keeps no rating", async () => {
    let asked = 0
    const request = async (url) => { asked++; return answer([{ handle: "x", rating: 1500 }])() }
    const cache = memoryCache()
    const io = { request, cache, key: "k", failure, now: () => 1000 }
    assert.equal(await readRating("x", io), 1500)
    await Promise.all(cache.writes)
    assert.equal(await readRating("x", io), 1500)
    assert.equal(asked, 1, "the second read comes from the copy")
    assert.equal(await readRating("y", { ...io, request: answer([{ handle: "y" }]), key: "k2" }), null, "unrated")
})

test("a copy too old to be read again is dropped when another rating is kept", async () => {
    const cache = memoryCache({ "https://x.test/problemset.v1.json": { savedAt: 0 } })
    const kept = (handle, now) => readRating(handle, {
        request: answer([{ handle, rating: 1500 }]),
        cache,
        key: `https://x.test/rating.ru.v1/${handle}.json`,
        failure,
        now: () => now,
    })
    await kept("a", 0)
    await kept("b", RATING_FRESH_FOR)
    await Promise.all(cache.writes)
    await new Promise((resolve) => setImmediate(resolve))
    await kept("c", RATING_FRESH_FOR + 1)
    await Promise.all(cache.writes)
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(Object.keys(cache.entries).sort(), [
        "https://x.test/problemset.v1.json",
        "https://x.test/rating.ru.v1/b.json",
        "https://x.test/rating.ru.v1/c.json",
    ], "a is past its freshness and goes; b is still fresh and c is new; the problemset copy is another folder")
})

test("a fresh copy without a rating reads as unrated, without asking again", async () => {
    const cache = memoryCache({ k: { savedAt: 1000 } })
    const request = async () => { throw new Error("asked") }
    assert.equal(await readRating("x", { request, cache, key: "k", failure, now: () => 1000 }), null)
})

test("an old copy is asked for again, and a failed answer is reported as a failure", async () => {
    const cache = memoryCache({ k: { savedAt: 0, rating: 900 } })
    const now = () => RATING_FRESH_FOR + 1
    assert.equal(await readRating("x", { request: answer([{ rating: 1200 }]), cache, key: "k", failure, now }), 1200)
    const bad = async () => ({ response: { ok: false, status: 400 }, json: { status: "FAILED", comment: "no such user" } })
    await assert.rejects(readRating("zz", { request: bad, cache: null, key: "z", failure }), /no such user/)
})

test("use my rating sets the range and says which rating it used, or that the handle is unrated", async () => {
    const text = {
        ratingUsed: "{handle} is rated {rating}: the range is now {min} to {max}.",
        ratingUnrated: "{handle} is unrated: the range is now {min} to {max}.",
    }
    const ranges = []
    const said = []
    const run = (result) => applyRating({
        handle: "tourist",
        request: answer(result),
        cache: null,
        key: "k",
        failure,
        text,
        setRange: (min, max) => ranges.push([min, max]),
        say: (message) => said.push(message),
        fail: (error) => said.push(`failed: ${error.message}`),
    })
    await run([{ handle: "tourist", rating: 1500 }])
    await run([{ handle: "tourist" }])
    assert.deepEqual(ranges, [[1400, 1800], [800, 1200]])
    assert.deepEqual(said, [
        "tourist is rated 1500: the range is now 1400 to 1800.",
        "tourist is unrated: the range is now 800 to 1200.",
    ])
})

test("use my rating leaves the range alone when Codeforces refuses the handle", async () => {
    const ranges = []
    const said = []
    const failed = []
    const refused = async () => ({ response: { ok: false, status: 400 }, json: { status: "FAILED", comment: "handle: Field should contain between 3 and 24 characters" } })
    await applyRating({
        handle: "ab",
        request: refused,
        cache: null,
        key: "k",
        failure: (response, json) => new Error(json.comment),
        text: {},
        setRange: (min, max) => ranges.push([min, max]),
        say: (message) => said.push(message),
        fail: (error) => failed.push(error.message),
    })
    assert.deepEqual(ranges, [], "no range is set")
    assert.deepEqual(said, [], "no message is said")
    assert.deepEqual(failed, ["handle: Field should contain between 3 and 24 characters"], "the reason is reported as a failure")
})
