import { test } from "node:test"
import assert from "node:assert/strict"
import { baseKeys } from "./support/keys.js"

import {
    KEPT_SETS,
    MAX_SET,
    acceptedOf,
    buildFlat,
    buildLadder,
    decodeSet,
    doneOf,
    encodeSet,
    idKey,
    ladderRatings,
    mergeTicks,
    replacementOf,
    resolveSet,
    setMarkdown,
    ticksOf,
    unpackTicks,
    unseenOf,
    withTicks,
    moveTicks,
    clockText,
    followSession,
    dueMarks,
    newSession,
    passedMarks,
    pickSession,
    spendTime,
    adoptPause,
    pauseTime,
    resumeTime,
    storesSession,
    unpackSession,
    timeLeft,
    sessionLength,
    solvedKey,
    mergeProgress,
    progressText,
    unpackProgress,
    unpackRecentSets,
    withRecentSet,
} from "../modules/practice.js"
import { countText, fill } from "../modules/i18n.js"
import { read } from "./support/walk.js"
import { practiceMessages } from "../modules/practice-strings.js"

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

test("a swapped-out problem is replaced by the nearest rating the set lacks, from a contest the rest of the set does not use", () => {
    const set = [problem(10, "A", 1200), problem(11, "A", 1400), problem(12, "A", 1600)]
    const pool = [problem(10, "A", 1200), problem(10, "B", 1300), problem(11, "B", 1450), problem(13, "A", 1250), problem(12, "C", 1500)]
    assert.equal(idKey(replacementOf(pool, set, set[1], seeded(1))), "11B", "its own contest is free again, and 11B is nearest")
    assert.equal(idKey(replacementOf(pool, set, set[0], seeded(1))), "13A", "13A is nearer than 10B, and 11B and 12C share contests the set uses")
    assert.equal(replacementOf([set[2]], set, set[2], seeded(1)), undefined, "a set with nothing else to take has no replacement")
    assert.equal(replacementOf([], set, set[0], seeded(1)), undefined)
})

test("a replacement among equally near problems is picked by the random draw", () => {
    const set = [problem(10, "A", 1200)]
    const pool = [problem(11, "A", 1300), problem(12, "A", 1100)]
    assert.equal(idKey(replacementOf(pool, set, set[0], () => 0)), "11A")
    assert.equal(idKey(replacementOf(pool, set, set[0], () => 0.99)), "12A")
})

test("a replacement is never from a contest the rest of the set uses, even when it is nearest", () => {
    const set = [problem(10, "A", 1200), problem(11, "A", 1400)]
    const pool = [problem(11, "B", 1210), problem(12, "A", 1300)]
    assert.equal(idKey(replacementOf(pool, set, set[0], seeded(1))), "12A")
})

test("a set's ids survive the address, and anything that is not an id is dropped", () => {
    const ids = [{ contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }, { contestId: 2000, index: "H" }]
    assert.equal(encodeSet(ids), "1520F2,4A,2000H")
    assert.deepEqual(decodeSet("1520F2, 4A,,junk,12,A4,7B1"), [
        { contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }, { contestId: 7, index: "B1" },
    ])
    assert.deepEqual(decodeSet("1520f2,4a"), [{ contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }], "a letter in lower case is capitals")
    assert.deepEqual(decodeSet("1520F2,1520f2,4A,1520F2"), [
        { contestId: 1520, index: "F2" }, { contestId: 4, index: "A" },
    ], "an id given twice is read once")
    assert.deepEqual(decodeSet("99999999999999999999999A,4A"), [{ contestId: 4, index: "A" }], "a contest number no Codeforces id has is skipped")
    assert.deepEqual(decodeSet("4-99999999999999999999"), [], "a numbered index no problem has is skipped")
    assert.deepEqual(decodeSet("4A99999999999999999999"), [], "a letter's digits no problem has are skipped")
    assert.deepEqual(decodeSet(null), [])
    const long = Array.from({ length: MAX_SET + 5 }, (_, i) => `${i + 1}A`).join(",")
    assert.equal(decodeSet(long).length, MAX_SET, "no more than the set size is read")
})

test("an address id with four digits after its letter is not an id", () => {
    assert.deepEqual(decodeSet("4A1234"), [])
    assert.deepEqual(decodeSet("4A1234,4B"), [{ contestId: 4, index: "B" }])
})

test("an address id with a contest number of nine digits is read, one of ten is not", () => {
    assert.deepEqual(decodeSet("123456789A"), [{ contestId: 123456789, index: "A" }])
    assert.deepEqual(decodeSet("1234567890A"), [])
})

test("a problem with a numbered index keeps its contest in the address, and reads back", () => {
    const ids = [{ contestId: 921, index: "14" }, { contestId: 1520, index: "F2" }, { contestId: 9211, index: "A" }]
    assert.equal(encodeSet(ids), "921-14,1520F2,9211A")
    assert.deepEqual(decodeSet(encodeSet(ids)), ids)
    assert.equal(idKey({ contestId: 921, index: "14" }), "921-14")
    assert.deepEqual(decodeSet("92114,921-14"), [{ contestId: 921, index: "14" }], "a bare run of digits is not an id")
})

test("a set resolves to the same problems, and an id no longer listed is reported", () => {
    const problems = [problem(1520, "F2", 2200), problem(4, "A", 800)]
    const ids = decodeSet("4A,9999Z,1520F2")
    const { found, missing } = resolveSet(problems, ids)
    assert.deepEqual(found.map((p) => `${p.contestId}${p.index}`), ["4A", "1520F2"], "in the order the set gives")
    assert.deepEqual(missing, [{ contestId: 9999, index: "Z" }])
})

test("the set copies as a Markdown task list with its links, ratings and ticks, brackets escaped", () => {
    const problems = [
        problem(1520, "F2", 2200, "Guess the K-th Zero (Hard version)"),
        problem(4, "A", 800, "Water [melon] *fresh*"),
    ]
    assert.equal(setMarkdown([problem(921, "14", 1500, "Labyrinth")]), "- [ ] [921-14. Labyrinth](https://codeforces.com/problemset/problem/921/14) (1500)", "a numbered index is joined by a dash, as in the address")
    assert.equal(setMarkdown(problems), [
        "- [ ] [1520F2. Guess the K-th Zero (Hard version)](https://codeforces.com/problemset/problem/1520/F2) (2200)",
        "- [ ] [4A. Water \\[melon\\] \\*fresh\\*](https://codeforces.com/problemset/problem/4/A) (800)",
    ].join("\n"))
    assert.equal(setMarkdown(problems, ["4A"]), [
        "- [ ] [1520F2. Guess the K-th Zero (Hard version)](https://codeforces.com/problemset/problem/1520/F2) (2200)",
        "- [x] [4A. Water \\[melon\\] \\*fresh\\*](https://codeforces.com/problemset/problem/4/A) (800)",
    ].join("\n"), "a ticked problem is ticked in the list")
})

test("a name's angle brackets and ampersands are escaped, so markup and entities stay text", () => {
    assert.equal(setMarkdown([problem(1, "A", 800, "Tags <b>x</b> & &amp;")]),
        "- [ ] [1A. Tags \\<b>x\\</b> \\& \\&amp;](https://codeforces.com/problemset/problem/1/A) (800)")
})

const ids = [{ contestId: 1520, index: "F2" }, { contestId: 4, index: "A" }, { contestId: 2000, index: "H" }]

test("ticks are kept per set, merged with what the handles solved, and only for ids in the set", () => {
    assert.deepEqual(doneOf(ids, ["4A", "9999Z", "2000H"]).map(idKey), ["4A", "2000H"])
    assert.deepEqual(mergeTicks(["4A"], ["4A", "1520F2"]), ["4A", "1520F2"], "each once")
    const solved = new Set(["1520|F2", "7|A", "4|A"])
    assert.deepEqual(acceptedOf(ids, (id) => solved.has(solvedKey(id))), ["1520F2", "4A"], "in the set's order")
    assert.deepEqual(acceptedOf(ids, () => false), [])
})

test("the progress line says how many are done, in English and in Russian", () => {
    assert.equal(fill(practiceMessages.en.progress, { done: 2, total: 5 }), "2 of 5 done")
    assert.equal(fill(practiceMessages.ru.progress, { done: 2, total: 5 }), "Сделано: 2 из 5")
    assert.deepEqual(baseKeys(practiceMessages.ru), baseKeys(practiceMessages.en), "both languages have every message")
})

test("a one-problem set is worded in the singular in English", () => {
    const en = practiceMessages.en
    assert.equal(fill(countText(en, "setCountText", 1, "en"), { count: 1 }), "1 problem.")
    assert.equal(fill(countText(en, "setCountText", 5, "en"), { count: 5 }), "5 problems.")
    assert.equal(fill(countText(en, "setMissing", 1, "en"), { count: 1 }), "1 problem of this set is no longer in the list.")
    assert.equal(fill(countText(en, "setShortFlat", 1, "en"), { count: 1, wanted: 3 }), "Only 1 problem of the 3 fits the range.")
    assert.equal(fill(countText(en, "checkedAccepted", 0, "en"), { count: 0 }), "Ticked 0 problems the handles have solved.")
    assert.equal(fill(countText(en, "checkedAccepted", 1, "en"), { count: 1 }), "Ticked 1 problem the handles have solved.")
})

test("a timer is worded in the singular for one minute in English", () => {
    const en = practiceMessages.en
    assert.equal(fill(countText(en, "timerStarted", 1, "en"), { minutes: 1 }), "Timer started: 1 minute.")
    assert.equal(fill(countText(en, "timerStarted", 45, "en"), { minutes: 45 }), "Timer started: 45 minutes.")
})

test("a swapped problem moves the set's ticks to its new address and leaves the old entry out", () => {
    const entries = [{ key: "1520F2,4A", done: ["1520F2", "4A"], at: 1 }, { key: "9A", done: ["9A"], at: 2 }]
    assert.deepEqual(moveTicks(entries, "1520F2,4A", "1520F2,5B", "4A", 5), [
        { key: "1520F2,5B", done: ["1520F2"], at: 5 },
        { key: "9A", done: ["9A"], at: 2 },
    ])
    assert.deepEqual(moveTicks(entries, "7Z", "8C", "7Z", 6), [
        { key: "8C", done: [], at: 6 },
        { key: "9A", done: ["9A"], at: 2 },
        { key: "1520F2,4A", done: ["1520F2", "4A"], at: 1 },
    ], "a set with no ticks moves to nothing")
})

test("a swap onto a set that already has ticks keeps those ticks as well", () => {
    const entries = [{ key: "1520F2,5B", done: ["5B"], at: 9 }, { key: "1520F2,4A", done: ["1520F2", "4A"], at: 1 }]
    assert.deepEqual(moveTicks(entries, "1520F2,4A", "1520F2,5B", "4A", 5), [
        { key: "1520F2,5B", done: ["5B", "1520F2"], at: 5 },
    ])
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

test("the sets built or opened lately are listed most recent first, and a set moved from one address to another leaves its old one", () => {
    let keys = []
    for (let i = 0; i < KEPT_SETS + 3; i++) keys = withRecentSet(keys, `${i}A`)
    assert.equal(keys.length, KEPT_SETS)
    assert.equal(keys[0], `${KEPT_SETS + 2}A`)
    assert.ok(!keys.includes("0A"), "the oldest set is dropped")
    keys = withRecentSet(keys, `${KEPT_SETS - 1}A`)
    assert.equal(keys.length, KEPT_SETS, "a set does not appear twice")
    assert.equal(keys[0], `${KEPT_SETS - 1}A`)
    keys = withRecentSet(keys, "1520F2,4A", `${KEPT_SETS - 1}A`)
    assert.equal(keys[0], "1520F2,4A")
    assert.ok(!keys.includes(`${KEPT_SETS - 1}A`), "the set it replaced is gone")
})

test("the stored sets read back only as canonical set addresses, each once", () => {
    const stored = ["1520F2,4A", "1520F2,4A", "", "junk", "4a", "921-14", 7, null, "1520F2,4A,1520F2"]
    assert.deepEqual(unpackRecentSets(stored), ["1520F2,4A", "921-14"])
    assert.deepEqual(unpackRecentSets({ 0: "1A" }), [])
    assert.deepEqual(unpackRecentSets(null), [])
})

test("a progress file brings back the ticks and recent sets, and a merge keeps what both browsers ticked", () => {
    const local = { ticks: [{ key: "1520F2,4A", done: ["4A"], at: 5 }], sets: ["1520F2,4A"] }
    const file = progressText([{ key: "1520F2,4A", done: ["1520F2"], at: 9 }, { key: "2C", done: ["2C"], at: 1 }], ["2C", "1520F2,4A"])
    const incoming = unpackProgress(file)
    assert.deepEqual(incoming, { ticks: [{ key: "1520F2,4A", done: ["1520F2"], at: 9 }, { key: "2C", done: ["2C"], at: 1 }], sets: ["2C", "1520F2,4A"] })
    assert.deepEqual(mergeProgress(local, incoming), {
        ticks: [{ key: "1520F2,4A", done: ["4A", "1520F2"], at: 9 }, { key: "2C", done: ["2C"], at: 1 }],
        sets: ["1520F2,4A", "2C"],
        left: 0,
    })
})

test("the progress file the README describes is one the page reads, and a saved file holds only its fields", () => {
    const example = JSON.parse(read("README.md").match(/```json\n([\s\S]*?)\n```/)[1])
    const loaded = unpackProgress(JSON.stringify(example))
    assert.deepEqual(loaded, { ticks: example.ticks, sets: example.sets })
    const saved = JSON.parse(progressText(unpackTicks(loaded.ticks), loaded.sets))
    assert.deepEqual(Object.keys(saved), ["ticks", "sets"])
    assert.deepEqual(saved.ticks.map((entry) => Object.keys(entry)), [["key", "done", "at"]])
})

test("a progress file is refused whole when an entry is not a set's own, or the file is past the sets kept", () => {
    const ok = { key: "4A", done: ["4A"], at: 1 }
    const refused = [
        "", "junk", "[]", "null", "42", "{}", "{\"ticks\":\"x\"}", "{\"sets\":\"x\"}",
        JSON.stringify({ sets: ["4a"] }), JSON.stringify({ sets: ["4A", "junk"] }),
        JSON.stringify({ ticks: [{ key: "4A", done: ["1B"], at: 1 }] }),
        JSON.stringify({ ticks: [{ key: "4A", done: ["4A", "4A"], at: 1 }] }),
        JSON.stringify({ ticks: [{ key: "4A", done: ["4A"], at: "soon" }] }),
        JSON.stringify({ ticks: [{ key: "4A", done: "4A", at: 1 }] }),
        JSON.stringify({ ticks: [{ key: "4A", done: [], at: 1 }, ok, { key: "4A", done: ["x"], at: 1 }] }),
        JSON.stringify({ sets: Array.from({ length: KEPT_SETS + 1 }, (_, i) => `${i + 1}A`) }),
    ]
    for (const text of refused) assert.equal(unpackProgress(text), null, text)
    assert.deepEqual(unpackProgress(JSON.stringify({ sets: ["4A"] })), { ticks: [], sets: ["4A"] })
    assert.deepEqual(unpackProgress(JSON.stringify({ ticks: [ok] })), { ticks: [ok], sets: [] })
})

test("a progress file with more tick entries than sets are kept is refused whole", () => {
    const ticks = Array.from({ length: KEPT_SETS + 1 }, (_, i) => ({ key: `${i + 1}A`, done: [], at: i }))
    assert.equal(unpackProgress(JSON.stringify({ ticks })), null)
    assert.equal(unpackProgress(JSON.stringify({ ticks: ticks.slice(0, KEPT_SETS) })).ticks.length, KEPT_SETS)
})

test("a progress file that ticks one problem twice is refused whole, even in a set with room for it", () => {
    const twice = { key: "4A,1B", done: ["4A", "4A"], at: 1 }
    assert.equal(unpackProgress(JSON.stringify({ ticks: [twice] })), null)
    assert.equal(unpackProgress(JSON.stringify({ ticks: [{ ...twice, done: ["4A"] }] })).ticks.length, 1)
})

test("a merge that does not fit keeps the most recently ticked sets and counts the ones left out", () => {
    const local = { ticks: Array.from({ length: KEPT_SETS }, (_, i) => ({ key: `${i + 1}A`, done: [], at: 1000 + i })), sets: [] }
    const incoming = { ticks: [{ key: "5B", done: ["5B"], at: 2000 }], sets: [] }
    const merged = mergeProgress(local, incoming)
    assert.equal(merged.ticks.length, KEPT_SETS)
    assert.equal(merged.ticks[0].key, "5B")
    assert.equal(merged.left, 1, "the oldest set does not fit")
    assert.ok(!merged.ticks.some((entry) => entry.key === "1A"))
})

test("a merge keeps the later time a set was ticked", () => {
    const local = { ticks: [{ key: "4A", done: ["4A"], at: 9 }], sets: [] }
    const incoming = { ticks: [{ key: "4A", done: ["4A"], at: 5 }], sets: [] }
    assert.equal(mergeProgress(local, incoming).ticks[0].at, 9)
    assert.equal(mergeProgress(incoming, local).ticks[0].at, 9)
})

test("a merge counts the recent sets it drops, not only the ticked ones", () => {
    const local = { ticks: [], sets: Array.from({ length: KEPT_SETS }, (_, i) => `${i + 1}A`) }
    const incoming = { ticks: [], sets: ["9001A", "9002A"] }
    const merged = mergeProgress(local, incoming)
    assert.equal(merged.left, 2, "the two recent sets that do not fit are counted")
    assert.equal(merged.sets.length, KEPT_SETS)
    assert.ok(!merged.sets.includes("9001A"))
    // A set named in both lists is counted once, not twice.
    const both = mergeProgress({ ticks: [{ key: "1A", done: ["1A"], at: 1 }], sets: ["1A"] },
        { ticks: [], sets: ["1A", "2A", "3A"] })
    assert.equal(both.left, 0, "nothing is dropped")
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
    assert.deepEqual(session, { key: "1520F2,4A", started: 1000, limit: 120000, spent: 0, seen: 1000, said: [], paused: false })
    assert.deepEqual(pickSession(JSON.parse(JSON.stringify(session)), "1520F2,4A", 5000), session)
    assert.equal(pickSession(JSON.parse(JSON.stringify(session)), "4A", 5000), null, "another set")
    assert.equal(pickSession({ key: "x", started: 1, limit: "soon", spent: 0, seen: 1, said: [] }, "x", 5000), null)
    assert.equal(pickSession({ key: "x", deadline: "soon", said: [] }, "x", 5000), null)
    assert.equal(pickSession({ key: "x", deadline: 1, said: "five" }, "x", 5000), null)
    assert.equal(pickSession(null, "x", 5000), null)
})

test("a session stored with a deadline keeps the time it had left, and one past its deadline has none", () => {
    const stored = JSON.parse(JSON.stringify({ key: "k", deadline: 1000 + 120000, said: ["five"] }))
    assert.deepEqual(pickSession(stored, "k", 1000 + 30000), { key: "k", started: 31000, limit: 90000, spent: 0, seen: 31000, said: ["five"], paused: false })
    assert.deepEqual(pickSession(stored, "k", 1000 + 200000), { key: "k", started: 201000, limit: 0, spent: 0, seen: 201000, said: ["five"], paused: false })
})

test("time spent counts from the last update, and a clock set back spends nothing", () => {
    const session = newSession("k", 1000000, 10)
    spendTime(session, 1000000 + 9 * 60000)
    assert.equal(timeLeft(session), 60000)
    spendTime(session, 1000000 - 3600000)
    assert.equal(timeLeft(session), 60000, "no time given back")
    spendTime(session, 1000000 - 3600000 + 30000)
    assert.equal(timeLeft(session), 30000, "the time after the set-back counts")
    spendTime(session, 1000000 - 3600000 + 10 * 60000)
    assert.equal(timeLeft(session), 0, "never below zero")
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

test("the moments of a session are reached once each, at five minutes, one minute and the end", () => {
    assert.deepEqual(dueMarks(25 * 60000, []), [])
    assert.deepEqual(dueMarks(5 * 60000, []), ["five"], "reached at exactly five minutes")
    assert.deepEqual(dueMarks(59000, ["five"]), ["one"])
    assert.deepEqual(dueMarks(0, ["five", "one"]), ["end"])
    assert.deepEqual(dueMarks(0, ["five", "one", "end"]), [], "none twice")
})

test("a moment passed before the page watches is marked read and not announced", () => {
    assert.deepEqual(passedMarks(4 * 60000, []), ["five"], "a four-minute session has no five-minute notice")
    assert.deepEqual(passedMarks(10 * 60000, []), [])
    assert.deepEqual(passedMarks(0, []), ["five", "one"])
    assert.deepEqual(passedMarks(5 * 60000, []), ["five"], "a five-minute session starts on its notice")
    assert.deepEqual(passedMarks(60000, []), ["five", "one"], "a one-minute session starts on its notice")
})

test("starting a one-minute or five-minute session announces nothing at once", () => {
    for (const minutes of [1, 5]) {
        const clock = clockAndTimers()
        const announced = []
        followSession(newSession("k", 0, minutes), {
            now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule,
            show: () => {}, announce: (mark) => announced.push(mark),
        })
        assert.deepEqual(announced, [], `${minutes} minute${minutes > 1 ? "s" : ""}`)
    }
})

test("a running session shows the time left each second and announces each moment once", () => {
    const clock = clockAndTimers()
    const shown = []
    const announced = []
    const session = newSession("k", 0, 6)
    followSession(session, {
        now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule,
        show: (left) => shown.push(clockText(left)), announce: (mark) => announced.push(mark),
    })
    assert.deepEqual(shown, ["06:00"])
    assert.deepEqual(announced, [])
    assert.equal(clock.scheduled(), 1)
    for (const at of [60000, 61000, 240000, 300000, 301000, 330000]) {
        clock.state.now = at
        clock.fire()
    }
    assert.deepEqual(announced, ["five", "one"], "five at five minutes, one at one minute")
    clock.state.now = 360000
    clock.fire()
    assert.deepEqual(announced, ["five", "one", "end"])
    assert.equal(clock.scheduled(), 0, "no timer once the time is up")
    assert.equal(session.said.length, 3)
})

test("a second tab's newer session is not overwritten by a tab still running an older one", () => {
    const mine = newSession("k", 1000, 6)
    const theirs = JSON.parse(JSON.stringify(newSession("k", 9000, 30)))
    assert.equal(storesSession(JSON.parse(JSON.stringify(mine)), mine), true, "its own session is stored")
    assert.equal(storesSession(theirs, mine), false, "a newer session in storage is left alone")
    assert.equal(storesSession(null, mine), false, "nothing stored")
})

test("stored time spent is kept between zero and the limit", () => {
    const base = { key: "k", started: 1, limit: 60000, seen: 1, said: [] }
    assert.equal(unpackSession({ ...base, spent: -5000 }, 0).spent, 0)
    assert.equal(unpackSession({ ...base, spent: 90000 }, 0).spent, 60000)
    assert.equal(unpackSession({ ...base, spent: 20000 }, 0).spent, 20000)
})

test("time spent in a session stops at its limit however long the page is away", () => {
    const session = newSession("k", 0, 1)
    spendTime(session, 600000)
    assert.equal(session.spent, 60000)
    assert.equal(timeLeft(session), 0)
})

test("a stored limit below zero reads back as no time", () => {
    const base = { key: "k", started: 1, spent: 0, seen: 1, said: [] }
    assert.equal(unpackSession({ ...base, limit: -5000 }, 0).limit, 0)
})

test("a stored pause counts as paused only when it is true", () => {
    const base = { key: "k", started: 1, limit: 60000, spent: 0, seen: 1, said: [] }
    assert.equal(unpackSession({ ...base, paused: true }, 0).paused, true)
    for (const paused of ["false", 1, undefined]) assert.equal(unpackSession({ ...base, paused }, 0).paused, false, String(paused))
})

test("a paused session spends nothing until it is resumed, and the stored pause is read back", () => {
    const session = newSession("k", 0, 10)
    pauseTime(session, 60000)
    spendTime(session, 600000)
    assert.equal(timeLeft(session), 540000, "nine minutes paused cost nothing")
    assert.equal(unpackSession(JSON.parse(JSON.stringify(session)), 0).paused, true)
    resumeTime(session, 600000)
    spendTime(session, 660000)
    assert.equal(timeLeft(session), 480000)
    assert.equal(unpackSession(JSON.parse(JSON.stringify(session)), 0).paused, false)
})

test("a pause ends at the moment it is resumed, so the time after it is what counts", () => {
    const session = newSession("k", 0, 10)
    pauseTime(session, 60000)
    resumeTime(session, 600000)
    spendTime(session, 660000)
    assert.equal(timeLeft(session), 480000, "one minute before the pause and one after it")
})

test("a tab takes over the pause another tab put on its session, and the paused time is not spent", () => {
    const mine = newSession("k", 0, 10)
    spendTime(mine, 60000)
    adoptPause(mine, { ...JSON.parse(JSON.stringify(mine)), paused: true }, 60000)
    assert.equal(mine.paused, true)
    spendTime(mine, 600000)
    assert.equal(timeLeft(mine), 540000, "nine minutes paused in the other tab cost nothing here")
    adoptPause(mine, { ...JSON.parse(JSON.stringify(mine)), paused: false }, 600000)
    assert.equal(mine.paused, false)
    spendTime(mine, 660000)
    assert.equal(timeLeft(mine), 480000)
    adoptPause(mine, { ...JSON.parse(JSON.stringify(mine)), key: "other", started: 5, paused: true }, 700000)
    assert.equal(mine.paused, false, "another session's pause is not taken")
})

test("a paused session shows the same time left until it is resumed", () => {
    const clock = clockAndTimers()
    const session = newSession("k", clock.now(), 5)
    const shown = []
    followSession(session, {
        now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule,
        show: (left) => shown.push(clockText(left)), announce: () => {},
    })
    clock.state.now = 60000
    clock.fire()
    pauseTime(session, clock.now())
    clock.state.now = 180000
    clock.fire()
    assert.deepEqual(shown, ["05:00", "04:00", "04:00"])
    resumeTime(session, clock.now())
    clock.state.now = 240000
    clock.fire()
    assert.equal(shown.at(-1), "03:00")
})

test("a clock set back while a session runs does not show more time than the limit", () => {
    const clock = clockAndTimers()
    clock.state.now = 3600000
    const session = newSession("k", clock.now(), 10)
    const shown = []
    followSession(session, {
        now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule,
        show: (left) => shown.push(clockText(left)), announce: () => {},
    })
    clock.state.now = 3600000 + 9 * 60000
    clock.fire()
    clock.state.now = 9 * 60000
    clock.fire()
    clock.state.now = 9 * 60000 + 30000
    clock.fire()
    assert.deepEqual(shown, ["10:00", "01:00", "01:00", "00:30"])
})

test("a session opened after it has run out announces only its end, once", () => {
    const clock = clockAndTimers()
    clock.state.now = 10 * 60000
    const announced = []
    const late = { key: "k", limit: 60000, spent: 0, seen: 0, said: [] }
    followSession(late, { now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule, show: () => {}, announce: (mark) => announced.push(mark) })
    assert.deepEqual(announced, ["end"])
    assert.equal(clock.scheduled(), 0)
    followSession(late, { now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule, show: () => {}, announce: (mark) => announced.push(mark) })
    assert.deepEqual(announced, ["end"], "not said again")
})

test("the stop returned for a session unschedules its timer", () => {
    const clock = clockAndTimers()
    const stop = followSession(newSession("k", 0, 5), { now: clock.now, schedule: clock.schedule, unschedule: clock.unschedule, show: () => {}, announce: () => {} })
    assert.equal(clock.scheduled(), 1)
    stop()
    assert.equal(clock.scheduled(), 0)
})

test("a flat set takes problems at random from the whole range, one per contest, in rating order", () => {
    const pool = Array.from({ length: 30 }, (_, i) => problem(100 + (i % 10), "A", 1200 + 25 * i))
    const picked = buildFlat(pool, 6, seeded(5))
    assert.equal(picked.length, 6)
    assert.equal(new Set(picked.map((p) => p.contestId)).size, 6)
    assert.deepEqual(picked.map((p) => p.rating), [...picked.map((p) => p.rating)].sort((a, b) => a - b))
    assert.deepEqual(buildFlat(pool, 6, seeded(5)), picked, "reproducible")
    assert.equal(buildFlat(pool, 4, seeded(2)).length, 4)
    assert.equal(buildFlat([problem(1, "A", 1000), problem(1, "B", 1100)], 5, seeded(3)).length, 1, "one contest gives one")
    assert.equal(buildFlat([], 3, seeded(3)).length, 0)
})

test("a practice set can leave out what was drawn lately and what was ticked done before", () => {
    const pool = [problem(1, "A", 1200), problem(1, "B", 1300), problem(2, "A", 1400), problem(3, "C", 1500)]
    const drawn = [problem(2, "A", 1400)]
    assert.deepEqual(unseenOf(pool, { drawn, done: ["1B"] }).map((p) => `${p.contestId}${p.index}`), ["1A", "3C"])
    assert.deepEqual(unseenOf(pool, {}), pool, "nothing seen, nothing left out")
    assert.deepEqual(unseenOf(pool, { drawn: [problem(9, "Z", 1)] }), pool, "a draw outside the pool leaves it alone")
    assert.equal(unseenOf(pool, { drawn: pool, done: [] }).length, 0, "all seen leaves none")
})
