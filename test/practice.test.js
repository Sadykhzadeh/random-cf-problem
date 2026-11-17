import { test } from "node:test"
import assert from "node:assert/strict"

import {
    KEPT_SETS,
    MAX_SET,
    acceptedOf,
    buildLadder,
    decodeSet,
    doneOf,
    encodeSet,
    idKey,
    ladderRatings,
    mergeTicks,
    resolveSet,
    setMarkdown,
    ticksOf,
    unpackTicks,
    withTicks,
    clockText,
    followSession,
    newSession,
    pickSession,
    sessionLength,
} from "../modules/practice.js"
import { fill, strings } from "../modules/i18n.js"

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

const ids = [{ contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }, { contestId: 2000, index: "H" }]

test("ticks are kept per set, merged with what the handles solved, and only for ids in the set", () => {
    assert.deepEqual(doneOf(ids, ["4A", "9999Z", "2000H"]).map(idKey), ["4A", "2000H"])
    assert.deepEqual(mergeTicks(["4A"], ["4A", "1520F2"]), ["4A", "1520F2"], "each once")
    assert.deepEqual(acceptedOf(ids, ["1520|F2", "7|A", "4|A"]), ["1520F2", "4A"], "in the set's order")
    assert.deepEqual(acceptedOf(ids, []), [])
})

test("the progress line says how many are done, in English and in Russian", () => {
    assert.equal(fill(strings.en.progress, { done: 2, total: 5 }), "2 of 5 done")
    assert.equal(fill(strings.ru.progress, { done: 2, total: 5 }), "Сделано: 2 из 5")
})

test("only the most recent sets keep their ticks, and a set touched again moves to the front", () => {
    let entries = []
    for (let i = 0; i < KEPT_SETS + 5; i++) entries = withTicks(entries, `set${i}`, ["1A"], i)
    assert.equal(entries.length, KEPT_SETS)
    assert.equal(ticksOf(entries, "set0").length, 0, "the oldest sets are dropped")
    assert.deepEqual(ticksOf(entries, `set${KEPT_SETS + 4}`), ["1A"])
    entries = withTicks(entries, "set5", ["1A", "2B"], 1000)
    assert.equal(entries.length, KEPT_SETS, "a set does not appear twice")
    assert.equal(entries[0].key, "set5")
    assert.deepEqual(ticksOf(entries, "set5"), ["1A", "2B"])
})

test("ticks read back from storage keep the sets that read cleanly, newest first", () => {
    const stored = [
        { key: "a", done: ["1A"], at: 1 },
        { key: "b", done: ["2B", 7], at: 3 },
        { key: 5, done: [], at: 2 },
        { key: "c", done: "1A", at: 4 },
        null,
        { key: "d", done: [], at: "later" },
    ]
    assert.deepEqual(unpackTicks(stored), [
        { key: "b", done: ["2B"], at: 3 },
        { key: "a", done: ["1A"], at: 1 },
    ])
    assert.deepEqual(unpackTicks("junk"), [])
})

test("a session's limit is whole minutes from 1 to 600, and anything else is no limit", () => {
    assert.equal(sessionLength("25"), 25)
    assert.equal(sessionLength("600"), 600)
    for (const raw of ["", "0", "601", "2.5", "-3", "ten"]) assert.equal(sessionLength(raw), null, raw)
})

test("the clock reads mm:ss and rounds a part second up", () => {
    assert.equal(clockText(0), "00:00")
    assert.equal(clockText(999), "00:01")
    assert.equal(clockText(61000), "01:01")
    assert.equal(clockText(3600000), "60:00")
})

test("a session belongs to one set, and what is stored is read back only when it is one", () => {
    const session = newSession("1520F2,4A", 1000, 2)
    assert.deepEqual(session, { key: "1520F2,4A", deadline: 1000 + 120000, notified: false })
    assert.deepEqual(pickSession(JSON.parse(JSON.stringify(session)), "1520F2,4A"), session)
    assert.equal(pickSession(JSON.parse(JSON.stringify(session)), "4A"), null, "another set")
    assert.equal(pickSession({ key: "x", deadline: "soon", notified: false }, "x"), null)
    assert.equal(pickSession(null, "x"), null)
})

// A clock the test moves by hand, and a scheduler it can see.
const clockAndTimers = () => {
    const state = { now: 0, next: 1, live: new Map() }
    return {
        state,
        now: () => state.now,
        schedule: (fn) => { state.live.set(state.next, fn); return state.next++ },
        unschedule: (id) => state.live.delete(id),
        fire: () => { for (const fn of [...state.live.values()]) fn() },
        scheduled: () => state.live.size,
    }
}

test("a running session shows the time left each second, and schedules nothing once it is over", () => {
    const clock = clockAndTimers()
    const shown = []
    let ended = 0
    const session = newSession("k", 0, 1)
    followSession(session, {
        now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule,
        show: (left) => shown.push(clockText(left)), end: () => { ended++ },
    })
    assert.deepEqual(shown, ["01:00"])
    assert.equal(clock.scheduled(), 1)
    clock.state.now = 30000
    clock.fire()
    assert.deepEqual(shown, ["01:00", "00:30"])
    clock.state.now = 60000
    clock.fire()
    assert.deepEqual(shown, ["01:00", "00:30", "00:00"])
    assert.equal(clock.scheduled(), 0, "no timer once the time is up")
    assert.equal(ended, 1)
    assert.equal(session.notified, true)
})

test("time up is announced once, even when the page is opened again after it", () => {
    const clock = clockAndTimers()
    clock.state.now = 10 * 60000
    let ended = 0
    const late = { key: "k", deadline: 60000, notified: false }
    followSession(late, { now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule, show: () => {}, end: () => { ended++ } })
    assert.equal(ended, 1, "over before the page opened: said at once")
    assert.equal(clock.scheduled(), 0)
    const again = { key: "k", deadline: 60000, notified: true }
    followSession(again, { now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule, show: () => {}, end: () => { ended++ } })
    assert.equal(ended, 1, "not said again")
    assert.equal(clock.scheduled(), 0)
})

test("the stop returned for a session unschedules its timer", () => {
    const clock = clockAndTimers()
    const stop = followSession(newSession("k", 0, 5), { now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule, show: () => {}, end: () => {} })
    assert.equal(clock.scheduled(), 1)
    stop()
    assert.equal(clock.scheduled(), 0)
})
