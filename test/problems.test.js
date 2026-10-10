import { test } from "node:test"
import assert from "node:assert/strict"

import {
    makeSkip,
    matchingProblems,
    packProblemset,
    parseHandles,
    pickOne,
    rankClass,
    summarizeSubmissions,
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
    assert.deepEqual(names({ tags: ["math"] }), ["Watermelon", "Spreadsheets"])
    assert.deepEqual(names({ tags: ["dp"] }), [], "the only dp problem is unrated")
    assert.deepEqual(names({ min: 2300 }), [])
})

test("several tags match all of them, or any of them", () => {
    const problems = unpackProblemset(packProblemset(result))
    const names = (filter) => matchingProblems(problems, filter).map((p) => p.name)
    assert.deepEqual(names({ tags: ["math", "brute force"] }), ["Watermelon"])
    assert.deepEqual(names({ tags: ["math", "brute force"], mode: "all" }), ["Watermelon"])
    assert.deepEqual(names({ tags: ["interactive", "brute force"], mode: "any" }),
        ["Guess the K-th Zero (Hard version)", "Watermelon"])
    assert.deepEqual(names({ tags: ["interactive", "brute force"] }), [])
    assert.deepEqual(names({ tags: [], mode: "any" }).length, 3, "no tags is no filter either way")
})

test("handles are split on commas and spaces, once each, five at most", () => {
    assert.deepEqual(parseHandles(" tourist,  Jiangly;tourist  ksun48 "), {
        handles: ["tourist", "Jiangly", "ksun48"],
        dropped: 0,
    })
    assert.deepEqual(parseHandles("TOURIST tourist"), { handles: ["TOURIST"], dropped: 0 })
    assert.deepEqual(parseHandles("a1 b2 c3 d4 e5 f6 g7"), { handles: ["a1", "b2", "c3", "d4", "e5"], dropped: 2 })
    assert.deepEqual(parseHandles(""), { handles: [], dropped: 0 })
})

test("solved problems are skipped, tried ones only when asked", () => {
    const sub = (contestId, index, name, verdict) => ({ verdict, problem: { contestId, index, name } })
    const summary = summarizeSubmissions([
        sub(4, "A", "Watermelon", "WRONG_ANSWER"),
        sub(4, "A", "Watermelon", "OK"),
        sub(1, "B", "Spreadsheets", "TIME_LIMIT_EXCEEDED"),
        sub(1501, "E", "Shared Problem", "OK"),
        sub(1, "C", "Never judged", undefined),
        { verdict: "OK", problem: { index: "A", name: "acmsguru, no contest" } },
    ])
    assert.deepEqual(summary.solved, ["4|A", "1501|E"])
    assert.deepEqual(summary.tried, ["1|B", "1|C"], "a solved problem is not also tried")

    const problems = unpackProblemset(packProblemset(result))
    const names = (skip) => matchingProblems(problems, { skip }).map((p) => p.name)
    assert.deepEqual(names(makeSkip([summary])), ["Guess the K-th Zero (Hard version)", "Spreadsheets"])
    assert.deepEqual(names(makeSkip([summary], { includeTried: true })), ["Guess the K-th Zero (Hard version)"])
})

test("a problem solved in the parallel round counts, a namesake elsewhere does not", () => {
    const solvedIn = (contestId, name) => ({ solved: [`${contestId}|X`], tried: [], names: [[name, [contestId]]] })
    const skip = makeSkip([solvedIn(1501, "Shared"), solvedIn(900, "Common Name"), solvedIn(77, "Easy Version")])
    assert.equal(skip({ contestId: 1500, index: "C", name: "Shared" }), true)
    assert.equal(skip({ contestId: 1503, index: "C", name: "Shared" }), true)
    assert.equal(skip({ contestId: 1504, index: "C", name: "Shared" }), false)
    assert.equal(skip({ contestId: 1200, index: "A", name: "Common Name" }), false)
    assert.equal(skip({ contestId: 77, index: "B", name: "Easy Version" }), false, "same contest, other letter")
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
