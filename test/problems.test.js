import { test } from "node:test"
import assert from "node:assert/strict"

import {
    makeSkip,
    matchingProblems,
    packContestStarts,
    packProblemset,
    parseHandles,
    fetchJson,
    isStale,
    isTimeout,
    pickOne,
    rankClass,
    staleSummaries,
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

test("a profile link stands for its handle", () => {
    assert.deepEqual(parseHandles("https://codeforces.com/profile/tourist, codeforces.com/profile/Um_nik/").handles,
        ["tourist", "Um_nik"])
    assert.deepEqual(parseHandles("https://m1.codeforces.com/profile/jiangly?locale=ru jiangly").handles, ["jiangly"])
    assert.deepEqual(parseHandles("http://codeforces.ml/profile/ksun48#").handles, ["ksun48"])
    assert.deepEqual(parseHandles("https://codeforces.com/contest/4").handles, ["https://codeforces.com/contest/4"],
        "anything else is left for Codeforces to judge")
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
    ], { starts: new Map([[1950, 1714487700], [1900, 1700000000]]) })
    assert.equal(skip({ contestId: 1500, index: "C", name: "Shared", rating: 1500 }), true)
    assert.equal(skip({ contestId: 1503, index: "C", name: "Shared", rating: 1500 }), true)
    assert.equal(skip({ contestId: 1510, index: "C", name: "Shared", rating: 1500 }), false)
    // The finals of a cup and its online mirror are days apart, a few contests apart:
    // VK Cup 2015 Finals is 562 and the mirror 566, ABBYY Cup 3.0 finals 324 and 331.
    const mirror = makeSkip([solvedIn(566, "Matching Names", 2300), solvedIn(331, "Second Mirror", 2400)])
    assert.equal(mirror({ contestId: 562, index: "F", name: "Matching Names", rating: 2300 }), true)
    assert.equal(mirror({ contestId: 324, index: "D", name: "Second Mirror", rating: 2400 }), true)
    assert.equal(mirror({ contestId: 557, index: "F", name: "Matching Names", rating: 2300 }), false, "nine apart")
    assert.equal(skip({ contestId: 1200, index: "A", name: "Common Name", rating: 1500 }), false)
    assert.equal(skip({ contestId: 77, index: "B", name: "Easy Version", rating: 1500 }), false, "same contest, other letter")
    assert.equal(skip({ contestId: 516, index: "E", name: "Same Title", rating: 3100 }), false, "same name, other rating")
    assert.equal(skip({ contestId: 1950, index: "A", name: "Far Apart", rating: 1400 }), true, "started together")
    assert.equal(skip({ contestId: 1900, index: "A", name: "Far Apart", rating: 1400 }), false, "started at another time")
    assert.equal(makeSkip([solvedIn(1972, "Far Apart", 1400, 1714487700)])(
        { contestId: 1950, index: "A", name: "Far Apart", rating: 1400 }), false, "no start times, no match")
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

test("summaries not used for a month, and all but the newest twenty, are pruned", () => {
    const day = 24 * 60 * 60 * 1000
    const now = Date.UTC(2026, 9, 19)
    const entries = [
        { key: "fresh", savedAt: now - day },
        { key: "old", savedAt: now - 31 * day },
        { key: "edge", savedAt: now - 30 * day },
        { key: "unstamped", savedAt: 0 },
    ]
    assert.deepEqual(staleSummaries(entries, now, { maxAge: 30 * day, maxCount: 20 }).map((e) => e.key),
        ["old", "unstamped"], "a month exactly is still kept")

    const many = Array.from({ length: 23 }, (_, i) => ({ key: `h${i}`, savedAt: now - i * 1000 }))
    const dropped = staleSummaries(many, now, { maxAge: 30 * day, maxCount: 20 }).map((e) => e.key)
    assert.deepEqual(dropped, ["h20", "h21", "h22"], "the three least recently saved go")
    assert.deepEqual(staleSummaries([], now, { maxAge: day, maxCount: 20 }), [])
})

test("a copy is stale past its age, and also when it is dated well ahead of the clock", () => {
    const minute = 60 * 1000
    const now = Date.UTC(2026, 9, 19)
    assert.equal(isStale(now - 10 * minute, now, 10 * minute), false, "exactly its age is still fresh")
    assert.equal(isStale(now - 10 * minute - 1, now, 10 * minute), true)
    assert.equal(isStale(now + 30 * 1000, now, 10 * minute), false, "a clock set back a little is not a reason to fetch")
    assert.equal(isStale(now + 2 * minute, now, 10 * minute), true, "stamped by a clock that was ahead")
})

test("a summary stamped in the future is pruned like an old one", () => {
    const day = 24 * 60 * 60 * 1000
    const now = Date.UTC(2026, 9, 19)
    const entries = [{ key: "fresh", savedAt: now - day }, { key: "ahead", savedAt: now + 400 * day }]
    assert.deepEqual(staleSummaries(entries, now, { maxAge: 30 * day, maxCount: 20 }).map((e) => e.key), ["ahead"])
})

// A stand-in for fetch whose body arrives in `parts`, `gap` milliseconds apart,
// and fails as a real body does when the signal aborts.
const trickle = (parts, gap) => (url, { signal }) => {
    let timer = 0
    const body = new ReadableStream({
        start(controller) {
            let next = 0
            const send = () => {
                if (next === parts.length) return controller.close()
                timer = setTimeout(() => {
                    controller.enqueue(new TextEncoder().encode(parts[next++]))
                    send()
                }, gap)
            }
            signal.addEventListener("abort", () => {
                clearTimeout(timer)
                controller.error(signal.reason)
            })
            send()
        },
    })
    return Promise.resolve(new Response(body, { status: 200 }))
}

test("a slow download is kept, a stalled one is cut off", async () => {
    const parts = Array.from({ length: 12 }, (_, i) => {
        if (i === 0) return '{"status":"OK","result":['
        if (i === 10) return "1"
        return i === 11 ? "]}" : "1,"
    })
    // Twelve chunks 30 ms apart take longer than the 200 ms limit, yet nothing goes quiet for anything
    // like that long; the wide margin keeps a busy machine's late timers from tripping it.
    const { response, json } = await fetchJson("x", { idleMs: 200, fetchFn: trickle(parts, 30) })
    assert.equal(response.status, 200)
    assert.equal(json.result.length, 10)

    const keepAlive = setTimeout(() => {}, 1000)
    await assert.rejects(
        fetchJson("x", { idleMs: 40, fetchFn: trickle(['{"status":"OK"', "}"], 400) }),
        isTimeout,
    )
    clearTimeout(keepAlive)
})

test("an error answer keeps its status and comment, and an HTML page parses as nothing", async () => {
    const limited = async () => new Response('{"status":"FAILED","comment":"Call limit exceeded"}', { status: 503 })
    const { response, json } = await fetchJson("x", { fetchFn: limited })
    assert.equal(response.status, 503)
    assert.equal(json.comment, "Call limit exceeded")
    const html = async () => new Response("<html>down</html>", { status: 502 })
    assert.equal((await fetchJson("x", { fetchFn: html })).json, null)
})
