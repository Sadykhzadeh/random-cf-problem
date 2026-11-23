import { test } from "node:test"
import assert from "node:assert/strict"

import { dailyPool, dailyProblem, dayKey, dayStartSeconds, generator, streakAfter, todaysProblem } from "../modules/daily.js"

test("the day is the UTC date, so it changes at midnight UTC wherever the visitor is", () => {
    assert.equal(dayKey(Date.UTC(2026, 10, 18, 23, 59, 59)), "2026-11-18")
    assert.equal(dayKey(Date.UTC(2026, 10, 19, 0, 0, 0)), "2026-11-19")
    assert.equal(dayKey(Date.UTC(2027, 0, 1, 0, 0, 0)), "2027-01-01")
})

test("the day is still the UTC date where the clock is behind UTC, and the problem of the day moves at midnight UTC", async (t) => {
    const zone = process.env.TZ
    process.env.TZ = "America/Los_Angeles"
    try {
        assert.equal(dayKey(Date.UTC(2026, 10, 18, 3, 0, 0)), "2026-11-18")
        t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 10, 19, 0, 0, 0) })
        const pool = [{ contestId: 1, index: "A", name: "Watermelon", rating: 800, tags: [] }]
        const day = await todaysProblem({ prepare: async () => pool, starts: async () => new Map([[1, 0]]), filter: () => ({}), none: () => null, show: (problem, day) => day })
        assert.equal(day, "2026-11-19")
    } finally {
        if (zone === undefined) delete process.env.TZ
        else process.env.TZ = zone
    }
})

test("the generator is fixed by its seed and stays in [0, 1)", () => {
    const first = generator(12345)
    const again = generator(12345)
    const values = Array.from({ length: 1000 }, () => first())
    assert.deepEqual(values, Array.from({ length: 1000 }, () => again()))
    assert.ok(values.every((value) => value >= 0 && value < 1))
    assert.ok(new Set(values).size > 990, "not repeating")
})

test("the day's problem is the same for the same day and list, and changes from day to day", () => {
    const pool = Array.from({ length: 40 }, (_, i) => ({ contestId: 100 + i, index: "A", name: `P${i}` }))
    const today = dailyProblem(pool, "2026-11-18")
    assert.deepEqual(dailyProblem(pool, "2026-11-18"), today)
    const days = new Set()
    for (let day = 1; day <= 30; day++) days.add(dailyProblem(pool, `2026-11-${String(day).padStart(2, "0")}`).name)
    assert.ok(days.size >= 15, `${days.size} different problems over 30 days from 40`)
})

test("an empty pool has no problem of the day, and the pool itself is not changed", () => {
    assert.equal(dailyProblem([], "2026-11-18"), undefined)
    const pool = [{ contestId: 1, index: "A" }, { contestId: 2, index: "A" }]
    dailyProblem(pool, "2026-11-18")
    assert.deepEqual(pool, [{ contestId: 1, index: "A" }, { contestId: 2, index: "A" }])
})

test("a day's problem from a fixed list is the same from one release to the next", () => {
    const pool = Array.from({ length: 40 }, (_, i) => ({ contestId: 100 + i, index: "A", name: `P${i}` }))
    const picks = ["2026-11-18", "2026-11-19", "2026-01-01", "2026-02-14", "2027-07-04"].map((day) => dailyProblem(pool, day).name)
    assert.deepEqual(picks, ["P20", "P1", "P25", "P35", "P27"])
    assert.equal(generator(12345)(), 0.9797282677609473)
})

test("a pool of one problem is the problem of every day", () => {
    const only = { contestId: 1, index: "A", name: "Only" }
    assert.equal(dailyProblem([only], "2026-11-18"), only)
    assert.equal(dailyProblem([only], "2027-03-01"), only)
})

test("the streak counts the UTC days in a row the problem was opened", () => {
    const first = streakAfter(null, "2026-11-18")
    assert.deepEqual(first, { last: "2026-11-18", count: 1 })
    assert.deepEqual(streakAfter(first, "2026-11-18"), first, "opening it again the same day changes nothing")
    const second = streakAfter(first, "2026-11-19")
    assert.deepEqual(second, { last: "2026-11-19", count: 2 })
    assert.deepEqual(streakAfter(second, "2026-11-20"), { last: "2026-11-20", count: 3 })
    assert.deepEqual(streakAfter(second, "2026-11-21"), { last: "2026-11-21", count: 1 }, "a day missed starts again")
    assert.deepEqual(streakAfter({ last: "2026-10-31", count: 4 }, "2026-11-01"), { last: "2026-11-01", count: 5 }, "across a month")
    assert.deepEqual(streakAfter({ last: "2026-12-31", count: 4 }, "2027-01-01"), { last: "2027-01-01", count: 5 }, "across a year")
})

test("a clock set back keeps the streak, and the next day in a row goes on from it", () => {
    assert.deepEqual(streakAfter({ last: "2026-11-20", count: 4 }, "2026-11-19"), { last: "2026-11-20", count: 4 })
    assert.deepEqual(streakAfter({ last: "2026-11-20", count: 4 }, "2026-11-21"), { last: "2026-11-21", count: 5 })
    assert.deepEqual(streakAfter({ last: "2026-11-20", count: 4 }, "2026-11-22"), { last: "2026-11-22", count: 1 })
})

test("a streak kept in a damaged shape starts again at one", () => {
    for (const stored of ["x", 7, { last: 3, count: 2 }, { last: "2026-11-17", count: "2" }, { last: "2026-11-17", count: 0 }]) {
        assert.deepEqual(streakAfter(stored, "2026-11-18"), { last: "2026-11-18", count: 1 }, JSON.stringify(stored))
    }
    assert.deepEqual(streakAfter({ last: "2026-11-18", count: 0 }, "2026-11-18"), { last: "2026-11-18", count: 1 })
})

test("today's problem is the day's pick from the settings' pool, and an empty pool says why", async (t) => {
    const all = [
        { contestId: 1, index: "A", name: "Easy", rating: 900, tags: [] },
        { contestId: 2, index: "B", name: "Middle", rating: 1500, tags: ["dp"] },
        { contestId: 3, index: "C", name: "Hard", rating: 2100, tags: ["dp"] },
    ]
    const settings = { min: 1400, max: 2200, tags: ["dp"], mode: "all" }
    const pool = [all[1], all[2]]
    const shown = []
    const none = []
    const showAt = (now, filter = settings) => {
        t.mock.method(Date, "now", () => now)
        return todaysProblem({
            prepare: async () => all,
            starts: async () => new Map([[1, 0], [2, 0], [3, 0]]),
            filter: () => filter,
            none: (given) => none.push(given),
            show: (problem, day) => shown.push([problem.name, day]),
        })
    }
    await showAt(Date.UTC(2026, 10, 18, 12, 0))
    await showAt(Date.UTC(2026, 10, 18, 23, 59))
    assert.deepEqual(shown, [[dailyProblem(pool, "2026-11-18").name, "2026-11-18"], [dailyProblem(pool, "2026-11-18").name, "2026-11-18"]],
        "the same problem all day, dated by UTC")
    await showAt(Date.UTC(2026, 10, 19, 0, 1))
    assert.deepEqual(shown.at(-1), [dailyProblem(pool, "2026-11-19").name, "2026-11-19"], "the next day's pick from the same pool")
    await showAt(Date.UTC(2026, 10, 19, 0, 1), { ...settings, min: 3000 })
    assert.deepEqual(none, [{ ...settings, min: 3000 }], "an empty pool is said, not shown")
    assert.equal(shown.length, 3)
})

test("the day's start is midnight UTC in the seconds contest.list counts", () => {
    assert.equal(dayStartSeconds("2026-11-18"), Date.UTC(2026, 10, 18) / 1000)
})

// Two readings of the list on the same day: the second is the first in another
// order, with a contest that started after midnight UTC added.
const snapshot = [
    { contestId: 1800, index: "B", name: "Late B", rating: 1200 },
    { contestId: 1700, index: "A", name: "Early A", rating: 1200 },
    { contestId: 1700, index: "C", name: "Early C", rating: 1300 },
    { contestId: 1650, index: "A", name: "Older A", rating: 1100 },
]
const starts = new Map([[1700, dayStartSeconds("2026-11-18") - 3600], [1650, dayStartSeconds("2026-11-01")], [1800, dayStartSeconds("2026-11-18") + 35 * 60]])

test("the day's pick is the same whatever order the list comes in, and whatever contests appear during the day", () => {
    const first = dailyProblem(dailyPool(snapshot, starts, "2026-11-18"), "2026-11-18")
    const reordered = [...snapshot].reverse().concat({ contestId: 1900, index: "A", name: "New", rating: 1200 })
    starts.set(1900, dayStartSeconds("2026-11-18") + 17 * 3600)
    const second = dailyProblem(dailyPool(reordered, starts, "2026-11-18"), "2026-11-18")
    assert.deepEqual(second, first)
    assert.ok(!dailyPool(reordered, starts, "2026-11-18").some((p) => p.name === "Late B" || p.name === "New"), "contests from after midnight are not in the pool")
})

test("a contest with no known start time is left out of the day's pool", () => {
    const pool = dailyPool([...snapshot, { contestId: 2000, index: "A", name: "Unknown", rating: 1200 }], starts, "2026-11-18")
    assert.ok(!pool.some((p) => p.name === "Unknown"))
    assert.deepEqual(pool.map((p) => p.name), ["Older A", "Early A", "Early C"], "in contest and letter order")
})
