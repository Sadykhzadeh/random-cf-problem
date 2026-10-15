import { test } from "node:test"
import assert from "node:assert/strict"

import {
    makeSkip,
    matchingProblems,
    packContestStarts,
    packProblemset,
    parseHandles,
    isTimeout,
    pickOne,
    rankClass,
    summarizeSubmissions,
    unpackContestStarts,
    unpackProblemset,
    yearStart,
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

test("special problems are dropped when asked, whatever their other tags", () => {
    const problems = [
        { contestId: 4, index: "A", name: "Watermelon", rating: 800, tags: ["brute force", "math"] },
        { contestId: 1002, index: "A1", name: "Generate superposition of all basis states", rating: 800, tags: ["*special"] },
        { contestId: 1505, index: "C", name: "Fibonacci Words", rating: 1400, tags: ["*special", "implementation"] },
    ]
    const names = (filter) => matchingProblems(problems, filter).map((p) => p.name)
    assert.deepEqual(names({}), ["Watermelon", "Generate superposition of all basis states", "Fibonacci Words"])
    assert.deepEqual(names({ special: false }), ["Watermelon"])
    assert.deepEqual(names({ tags: ["implementation"], special: false }), [])
})

test("several tags match all of them, any of them, or none of them", () => {
    const problems = unpackProblemset(packProblemset(result))
    const names = (filter) => matchingProblems(problems, filter).map((p) => p.name)
    assert.deepEqual(names({ tags: ["math", "brute force"] }), ["Watermelon"])
    assert.deepEqual(names({ tags: ["math", "brute force"], mode: "all" }), ["Watermelon"])
    assert.deepEqual(names({ tags: ["interactive", "brute force"], mode: "any" }),
        ["Guess the K-th Zero (Hard version)", "Watermelon"])
    assert.deepEqual(names({ tags: ["interactive", "brute force"] }), [])
    assert.deepEqual(names({ tags: ["interactive", "brute force"], mode: "none" }), ["Spreadsheets"])
    for (const mode of ["any", "none"]) assert.equal(names({ tags: [], mode }).length, 3, "no tags is no filter")
})

test("problems from contests that started before a year are left out", () => {
    const problems = [
        { contestId: 4, index: "A", name: "Watermelon", rating: 800, tags: [] },
        { contestId: 1520, index: "A", name: "Do Not Be Distracted!", rating: 800, tags: [] },
        { contestId: 2276, index: "A", name: "Not in contest.list yet", rating: 800, tags: [] },
    ]
    // 4 started in March 2010, 1520 in May 2021.
    const starts = new Map([[4, 1268395200], [1520, 1620225300]])
    const names = (filter) => matchingProblems(problems, filter).map((p) => p.name)
    assert.equal(yearStart(2021), 1609459200)
    assert.deepEqual(names({ since: yearStart(2021), starts }), ["Do Not Be Distracted!", "Not in contest.list yet"])
    assert.deepEqual(names({ since: yearStart(2010), starts }).length, 3)
    assert.deepEqual(names({ since: yearStart(2022), starts }), ["Not in contest.list yet"])
    assert.deepEqual(names({ starts }).length, 3, "no year, no filter")
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
    const solvedIn = (contestId, name, rating = 1500, start = null) =>
        ({ solved: [`${contestId}|X`], tried: [], names: [[name, [[contestId, rating, start]]]] })
    const skip = makeSkip([
        solvedIn(1501, "Shared"),
        solvedIn(900, "Common Name"),
        solvedIn(77, "Easy Version"),
        solvedIn(515, "Same Title", 1300),
        solvedIn(1972, "Far Apart", 1400, 1714487700),
    ], { starts: new Map([[1967, 1714487700], [1900, 1700000000]]) })
    assert.equal(skip({ contestId: 1500, index: "C", name: "Shared", rating: 1500 }), true)
    assert.equal(skip({ contestId: 1503, index: "C", name: "Shared", rating: 1500 }), true)
    assert.equal(skip({ contestId: 1504, index: "C", name: "Shared", rating: 1500 }), false)
    assert.equal(skip({ contestId: 1200, index: "A", name: "Common Name", rating: 1500 }), false)
    assert.equal(skip({ contestId: 77, index: "B", name: "Easy Version", rating: 1500 }), false, "same contest, other letter")
    assert.equal(skip({ contestId: 516, index: "E", name: "Same Title", rating: 3100 }), false, "same name, other rating")
    assert.equal(skip({ contestId: 1967, index: "A", name: "Far Apart", rating: 1400 }), true, "started together")
    assert.equal(skip({ contestId: 1900, index: "A", name: "Far Apart", rating: 1400 }), false, "started at another time")
    assert.equal(makeSkip([solvedIn(1972, "Far Apart", 1400, 1714487700)])(
        { contestId: 1967, index: "A", name: "Far Apart", rating: 1400 }), false, "no start times, no match")
})

test("a solved problem keeps its contest's start time, unless it came from a virtual run or the gym", () => {
    const sub = (contestId, index, name, verdict, participantType, startTimeSeconds) =>
        ({ verdict, problem: { contestId, index, name, rating: 1400 }, author: { participantType, startTimeSeconds } })
    const { names } = summarizeSubmissions([
        sub(1972, "C", "Permutation Counting", "OK", "PRACTICE", 1714487700),
        sub(1975, "A", "Virtual Only", "OK", "VIRTUAL", 1720000000),
        sub(1976, "A", "Tried In Contest", "WRONG_ANSWER", "CONTESTANT", 1715000000),
        sub(1976, "B", "Solved Virtually", "OK", "VIRTUAL", 1730000000),
        sub(100093, "E", "E", "OK", "PRACTICE", 1350000000),
    ])
    assert.deepEqual(names, [
        ["Permutation Counting", [[1972, 1400, 1714487700]]],
        ["Virtual Only", [[1975, 1400, null]]],
        ["Solved Virtually", [[1976, 1400, 1715000000]]],
    ])
})

test("a problem tried in the parallel round counts as tried", () => {
    const sub = (verdict) => ({
        verdict,
        problem: { contestId: 1972, index: "C", name: "Permutation Counting", rating: 1400 },
        author: { participantType: "CONTESTANT", startTimeSeconds: 1714487700 },
    })
    const summary = summarizeSubmissions([sub("WRONG_ANSWER"), sub("TIME_LIMIT_EXCEEDED")])
    assert.deepEqual(summary.names, [])
    assert.deepEqual(summary.triedNames, [["Permutation Counting", [[1972, 1400, 1714487700]]]])
    const starts = new Map([[1967, 1714487700], [1972, 1714487700]])
    const shared = { contestId: 1967, index: "A", name: "Permutation Counting", rating: 1400 }
    assert.equal(makeSkip([summary], { starts })(shared), false, "tried is not solved")
    assert.equal(makeSkip([summary], { starts, includeTried: true })(shared), true)
})

test("contest start times survive a round trip, and anything else is refused", () => {
    const contests = [
        { id: 1967, startTimeSeconds: 1714487700 },
        { id: 1972, startTimeSeconds: 1714487700 },
        { id: 2300 },
    ]
    const starts = unpackContestStarts(JSON.parse(JSON.stringify(packContestStarts(contests))))
    assert.deepEqual([...starts], [[1967, 1714487700], [1972, 1714487700]])
    assert.equal(unpackContestStarts(null), null)
    assert.equal(unpackContestStarts([[1967, "1714487700"]]), null)
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

test("recent draws are passed over while something else is left", () => {
    const list = [{ contestId: 1, index: "A" }, { contestId: 1, index: "B" }, { contestId: 2, index: "A" }]
    const avoid = new Set(["1|A", "2|A"])
    for (const r of [0, 0.5, 0.99]) assert.deepEqual(pickOne(list, () => r, avoid), { contestId: 1, index: "B" })
    const all = new Set(["1|A", "1|B", "2|A"])
    assert.deepEqual(pickOne(list, () => 0, all), { contestId: 1, index: "A" }, "all recent: pick from everything")
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

test("a call that never answers is cut off and recognised as a timeout", async () => {
    // A stand-in for fetch that honours the signal and otherwise hangs.
    const hang = (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason))
    })
    // Node does not keep the process alive for AbortSignal.timeout() alone.
    const keepAlive = setTimeout(() => {}, 1000)
    await assert.rejects(hang("x", { signal: AbortSignal.timeout(20) }), isTimeout)
    clearTimeout(keepAlive)
    assert.equal(isTimeout(new TypeError("Failed to fetch")), false)
    assert.equal(isTimeout(undefined), false)
})
