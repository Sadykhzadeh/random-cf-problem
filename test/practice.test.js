import { test } from "node:test"
import assert from "node:assert/strict"

import { MAX_SET, buildLadder, decodeSet, encodeSet, ladderRatings, resolveSet, setMarkdown } from "../modules/practice.js"

// A fixed generator, so the picks are the same on every run.
const seeded = (seed) => () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
}

const problem = (contestId, index, rating, name = `P${contestId}${index}`) =>
    ({ contestId, index, name, rating, tags: [] })

test("the rungs are in equal steps from one end of the ladder to the other", () => {
    assert.deepEqual(ladderRatings(5, 1200, 1600), [1200, 1300, 1400, 1500, 1600])
    assert.deepEqual(ladderRatings(1, 1200, 1600), [1200], "one rung sits at the bottom")
    assert.deepEqual(ladderRatings(3, 1600, 1200), [1600, 1400, 1200], "a ladder run backwards still goes from its first end")
})

test("each rung takes a problem nearest its rating, and no two come from one contest", () => {
    const pool = [
        problem(10, "A", 1200), problem(10, "B", 1300), problem(11, "A", 1300),
        problem(12, "A", 1400), problem(13, "A", 1500), problem(14, "A", 1600),
        problem(15, "A", 1700),
    ]
    const picked = buildLadder(pool, 5, 1200, 1600, seeded(1))
    assert.deepEqual(picked.map((p) => p.rating), [1200, 1300, 1400, 1500, 1600])
    assert.equal(new Set(picked.map((p) => p.contestId)).size, 5)
    assert.equal(picked[1].contestId, 11, "the 1300 rung cannot take contest 10's second problem")
})

test("a rung is filled from its nearest ratings when none is exact, and a short pool gives a short set", () => {
    const pool = [problem(1, "A", 1250), problem(2, "A", 1600)]
    const picked = buildLadder(pool, 3, 1200, 1600, seeded(9))
    assert.deepEqual(picked.map((p) => p.contestId), [1, 2], "two problems, one from each contest")
    assert.deepEqual(buildLadder([], 4, 800, 1200, seeded(9)), [])
})

test("a rung picks at random among equally near problems, reproducibly", () => {
    const pool = Array.from({ length: 50 }, (_, i) => problem(100 + i, "A", 1500))
    const first = buildLadder(pool, 1, 1500, 1500, seeded(42))
    const again = buildLadder(pool, 1, 1500, 1500, seeded(42))
    assert.deepEqual(first, again)
    const random = seeded(7)
    const spread = new Set()
    for (let i = 0; i < 200; i++) spread.add(buildLadder(pool, 1, 1500, 1500, random)[0].contestId)
    assert.ok(spread.size > 35, `picks spread over ${spread.size} of 50 contests`)
})

test("a set's ids survive the address, and anything that is not an id is dropped", () => {
    const ids = [{ contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }, { contestId: 2000, index: "H" }]
    assert.equal(encodeSet(ids), "1520F2,4A,2000H")
    assert.deepEqual(decodeSet("1520F2, 4A,,junk,12,A4,7B1"), [
        { contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }, { contestId: 7, index: "B1" },
    ])
    assert.deepEqual(decodeSet(null), [])
    const long = Array.from({ length: MAX_SET + 5 }, (_, i) => `${i + 1}A`).join(",")
    assert.equal(decodeSet(long).length, MAX_SET, "no more than the set size is read")
})

test("a set resolves to the same problems, and an id no longer listed is reported", () => {
    const problems = [problem(1520, "F2", 2200), problem(4, "A", 800)]
    const ids = decodeSet("4A,9999Z,1520F2")
    const { found, missing } = resolveSet(problems, ids)
    assert.deepEqual(found.map((p) => `${p.contestId}${p.index}`), ["4A", "1520F2"], "in the order the set gives")
    assert.deepEqual(missing, [{ contestId: 9999, index: "Z" }])
})

test("the set copies as a Markdown list with its links and ratings, brackets escaped", () => {
    const problems = [
        problem(1520, "F2", 2200, "Guess the K-th Zero (Hard version)"),
        problem(4, "A", 800, "Water [melon] *fresh*"),
    ]
    assert.equal(setMarkdown(problems), [
        "- [1520F2. Guess the K-th Zero (Hard version)](https://codeforces.com/problemset/problem/1520/F2) (2200)",
        "- [4A. Water \\[melon\\] \\*fresh\\*](https://codeforces.com/problemset/problem/4/A) (800)",
    ].join("\n"))
})
