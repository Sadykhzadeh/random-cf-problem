import { test } from "node:test"
import assert from "node:assert/strict"

import { dailyProblem, dayKey, generator, streakAfter } from "../modules/daily.js"

test("the day is the UTC date, so it changes at midnight UTC wherever the visitor is", () => {
    assert.equal(dayKey(Date.UTC(2026, 10, 18, 23, 59, 59)), "2026-11-18")
    assert.equal(dayKey(Date.UTC(2026, 10, 19, 0, 0, 0)), "2026-11-19")
    assert.equal(dayKey(Date.UTC(2027, 0, 1, 0, 0, 0)), "2027-01-01")
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
