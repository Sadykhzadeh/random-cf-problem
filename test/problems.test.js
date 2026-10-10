import { test } from "node:test"
import assert from "node:assert/strict"

import {
    matchingProblems,
    packProblemset,
    pickOne,
    rankClass,
    unpackProblemset,
} from "../modules/problems.js"

const result = {
    problems: [
        { contestId: 1520, index: "F2", name: "Guess the K-th Zero (Hard version)", rating: 2200, tags: ["binary search", "interactive"] },
        { contestId: 4, index: "A", name: "Watermelon", rating: 800, tags: ["brute force", "math"] },
        { contestId: 2000, index: "H", name: "Fresh", tags: ["dp"] },
        { contestId: 1, index: "B", name: "Spreadsheets", rating: 1600, tags: ["implementation", "math"] },
    ],
    problemStatistics: [
        { contestId: 1520, index: "F2", solvedCount: 5000 },
        { contestId: 4, index: "A", solvedCount: 300000 },
        { contestId: 1, index: "B", solvedCount: 20000 },
    ],
}

test("a packed problemset unpacks to the same problems with their solve counts", () => {
    const problems = unpackProblemset(JSON.parse(JSON.stringify(packProblemset(result))))
    assert.equal(problems.length, 4)
    assert.deepEqual(problems[1], {
        contestId: 4, index: "A", name: "Watermelon", rating: 800, tags: ["brute force", "math"], solvedCount: 300000,
    })
    assert.equal(problems[2].rating, undefined)
    assert.equal(problems[2].solvedCount, undefined)
})

test("anything that is not a packed problemset is refused", () => {
    assert.equal(unpackProblemset(null), null)
    assert.equal(unpackProblemset({ problems: [] }), null)
    assert.equal(unpackProblemset([[1, "A", "x"]]), null)
    assert.equal(unpackProblemset([["1", "A", "x", 800, [], 1]]), null)
    assert.deepEqual(unpackProblemset([]), [])
})

test("only rated problems inside the range, with the tag, match", () => {
    const problems = unpackProblemset(packProblemset(result))
    const names = (filter) => matchingProblems(problems, filter).map((p) => p.name)
    assert.deepEqual(names({}), ["Guess the K-th Zero (Hard version)", "Watermelon", "Spreadsheets"])
    assert.deepEqual(names({ min: 800, max: 1600 }), ["Watermelon", "Spreadsheets"])
    assert.deepEqual(names({ tag: "math" }), ["Watermelon", "Spreadsheets"])
    assert.deepEqual(names({ tag: "dp" }), [], "the only dp problem is unrated")
    assert.deepEqual(names({ min: 2300 }), [])
})

test("ratings get the colour of the Codeforces rank they fall in", () => {
    assert.equal(rankClass(800), "rank-newbie")
    assert.equal(rankClass(1199), "rank-newbie")
    assert.equal(rankClass(1200), "rank-pupil")
    assert.equal(rankClass(1500), "rank-specialist")
    assert.equal(rankClass(1600), "rank-expert")
    assert.equal(rankClass(2000), "rank-cm")
    assert.equal(rankClass(2300), "rank-master")
    assert.equal(rankClass(2400), "rank-gm")
    assert.equal(rankClass(3500), "rank-gm")
    assert.equal(rankClass(undefined), "")
})

test("a pick is uniform over the list and never out of range", () => {
    const list = ["a", "b", "c", "d"]
    assert.equal(pickOne(list, () => 0), "a")
    assert.equal(pickOne(list, () => 0.999999), "d")
    assert.equal(pickOne([], () => 0.5), undefined)
    const counts = new Map()
    let seed = 7
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    for (let i = 0; i < 40000; i++) {
        const value = pickOne(list, random)
        counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    for (const value of list) assert.ok(Math.abs(counts.get(value) - 10000) < 500, `${value}: ${counts.get(value)}`)
})
