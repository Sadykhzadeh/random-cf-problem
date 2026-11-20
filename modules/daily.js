import { matchingProblems } from "./problems.js"

// The problem of the day: one pick from the filtered pool, the same for
// everyone on a UTC day given the same filters and list. The day seeds a small
// generator, so nothing is stored.

// The UTC date a time falls on, as YYYY-MM-DD.
export const dayKey = (now) => new Date(now).toISOString().slice(0, 10)

// FNV-1a over the text, for the generator's seed.
const seedOf = (text) => {
    let hash = 0x811c9dc5
    for (const char of text) {
        hash ^= char.codePointAt(0)
        hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
}

// mulberry32: a generator of numbers in [0, 1) from a 32-bit seed.
export const generator = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// The day's problem from the pool, or undefined from an empty one.
export const dailyProblem = (pool, day) =>
    pool.length ? pool[Math.floor(generator(seedOf(day))() * pool.length)] : undefined

// The streak after opening the day's problem on `day`: the number of UTC days
// in a row the visitor has opened it, ending on `day`. Opening it again on the
// same day changes nothing, and a day missed starts the count again at one.
// `stored` is what was kept last time, or anything else.
export const streakAfter = (stored, day) => {
    const last = typeof stored?.last === "string" ? stored.last : ""
    const count = Number.isInteger(stored?.count) && stored.count > 0 ? stored.count : 0
    if (last === day) return { last, count: count || 1 }
    // A stored day after this one means the clock has been set back. The
    // stored day stays as it is and the count holds until the clock reaches
    // that day again, however far back it was set; the next day in a row after
    // the stored one then adds to the count.
    if (last > day && /^\d{4}-\d{2}-\d{2}$/.test(last)) return { last, count: count || 1 }
    const yesterday = dayKey(Date.parse(`${day}T00:00:00Z`) - 86400000)
    return { last: day, count: last === yesterday && count ? count + 1 : 1 }
}

// Shows the problem of the day through the page's own functions: `prepare`
// resolves the list, `filter` gives the settings, `none` says when the
// settings leave nothing, and `show` puts the problem and its day on screen.
export const todaysProblem = async ({ prepare, filter, none, show }) => {
    const all = await prepare()
    const settings = filter()
    const problems = matchingProblems(all, settings)
    if (!problems.length) return none(settings)
    const day = dayKey(Date.now())
    return show(dailyProblem(problems, day), day)
}
