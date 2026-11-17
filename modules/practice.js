// A practice set: a few problems on a rating ladder, one rung per problem and
// no two from the same contest. A set is shared as the ids of its problems, so
// its link brings back exactly the same problems, whatever the list says now.

import { problemKey, problemUrl } from "./problems.js"

// Sets are kept to this many problems, in the page and in an address.
export const MAX_SET = 20

// The ratings of the rungs: `count` of them in equal steps from `from` to `to`.
export const ladderRatings = (count, from, to) =>
    count <= 1 ? [from] : Array.from({ length: count }, (_, i) => from + (i * (to - from)) / (count - 1))

// One problem for each rung: among the problems whose rating is nearest the
// rung's, one at random, never two from one contest. A rung with no problem
// left is skipped, so a short pool gives a shorter set rather than a repeat.
export const buildLadder = (pool, count, from, to, random = Math.random) => {
    const contests = new Set()
    const picked = []
    for (const target of ladderRatings(count, from, to)) {
        let best = Infinity
        let nearest = []
        for (const problem of pool) {
            if (contests.has(problem.contestId)) continue
            const distance = Math.abs(problem.rating - target)
            if (distance < best) {
                best = distance
                nearest = [problem]
            } else if (distance === best) {
                nearest.push(problem)
            }
        }
        if (!nearest.length) continue
        const problem = nearest[Math.floor(random() * nearest.length)]
        contests.add(problem.contestId)
        picked.push(problem)
    }
    return picked
}

// The ids of a set as they go in an address: the contest number and the letter,
// comma-separated, such as 1520F2,4A.
export const encodeSet = (ids) => ids.map((id) => `${id.contestId}${id.index}`).join(",")

// The ids read back from an address. Anything that is not an id is skipped,
// and no more than MAX_SET are kept.
export const decodeSet = (text) => String(text ?? "").split(",")
    .map((id) => /^(\d+)([A-Za-z]\d*)$/.exec(id.trim()))
    .filter(Boolean)
    .slice(0, MAX_SET)
    .map((match) => ({ contestId: Number(match[1]), index: match[2] }))

// The problems the ids name, in order, and the ids that no problem in the list
// has any more.
export const resolveSet = (problems, ids) => {
    const byKey = new Map(problems.map((problem) => [problemKey(problem), problem]))
    const found = []
    const missing = []
    for (const id of ids) {
        const problem = byKey.get(`${id.contestId}|${id.index}`)
        if (problem) found.push(problem)
        else missing.push(id)
    }
    return { found, missing }
}

// The set as a Markdown list, one problem a line, with its rating. Brackets
// and emphasis characters in a name are escaped so the link stays a link.
export const setMarkdown = (problems) => problems.map((problem) => {
    const name = problem.name.replace(/[\\[\]*_`]/g, "\\$&")
    return `- [${problem.contestId}${problem.index}. ${name}](${problemUrl(problem)}) (${problem.rating ?? "unrated"})`
}).join("\n")

// The ticks kept for at most this many sets, the most recently ticked first.
export const KEPT_SETS = 20

// A problem's id as the set's address writes it, and the same key as the
// problemset keeps it under (contest and index, as problemKey writes them).
export const idKey = (id) => `${id.contestId}${id.index}`
export const solvedKey = (id) => `${id.contestId}|${id.index}`

// The problems of a set that are ticked, in the set's order.
export const doneOf = (ids, done) => ids.filter((id) => done.includes(idKey(id)))

// The ticks already there with the ones the handles have solved added, each
// once.
export const mergeTicks = (done, accepted) => [...new Set([...done, ...accepted])]

// The problems of a set the handles have solved, given the solved keys of the
// submissions read (each "contestId|index", as the summaries hold them).
export const acceptedOf = (ids, solved) => {
    const keys = new Set(solved)
    return ids.filter((id) => keys.has(solvedKey(id))).map(idKey)
}

// The ticks of every set, read back from storage: anything that is not a
// set's ticks is dropped, and only the most recent KEPT_SETS are kept.
export const unpackTicks = (stored) => {
    if (!Array.isArray(stored)) return []
    return stored
        .filter((entry) => entry && typeof entry.key === "string" && Array.isArray(entry.done) &&
            Number.isFinite(entry.at))
        .map((entry) => ({ key: entry.key, done: entry.done.filter((id) => typeof id === "string"), at: entry.at }))
        .sort((a, b) => b.at - a.at)
        .slice(0, KEPT_SETS)
}

// The entries with the set `key` holding `done`, as of `at`; any older entry
// for the same set is replaced, and all but the KEPT_SETS most recent are
// dropped.
export const withTicks = (entries, key, done, at) =>
    [{ key, done: [...new Set(done)], at }, ...entries.filter((entry) => entry.key !== key)]
        .sort((a, b) => b.at - a.at)
        .slice(0, KEPT_SETS)

export const ticksOf = (entries, key) => entries.find((entry) => entry.key === key)?.done ?? []

// A timed session on a set: the deadline is kept, not a running count, so the
// time left is worked out from the clock whenever it is shown.
export const SESSION_MAX_MINUTES = 600

// The limit the form's field gives, in whole minutes, or null when there is none.
export const sessionLength = (raw) => {
    const minutes = Number(raw)
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= SESSION_MAX_MINUTES ? minutes : null
}

// The session started at `now` (ms) for the set `key`. `notified` says the end
// has been announced, so it is announced once however often the page opens.
export const newSession = (key, now, minutes) => ({ key, deadline: now + minutes * 60000, notified: false })

// A session read back from storage, or null when what is stored is not one.
export const unpackSession = (stored) => stored && typeof stored.key === "string" &&
    Number.isFinite(stored.deadline) && typeof stored.notified === "boolean"
    ? { key: stored.key, deadline: stored.deadline, notified: stored.notified }
    : null

// The session stored for this set, or null: a session belongs to one set.
export const pickSession = (stored, key) => {
    const session = unpackSession(stored)
    return session && session.key === key ? session : null
}

export const timeLeft = (session, now) => Math.max(0, session.deadline - now)

// mm:ss, rounding a part second up so the display reads 00:01 until it is over.
export const clockText = (ms) => {
    const seconds = Math.ceil(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

// Shows the time left of a session while it runs, once a second, and nothing
// is scheduled once it is over or when there is no session at all. `end` is
// called once, when the time runs out, and the session is marked notified.
// Returns a function that stops the display.
export const followSession = (session, { now, every = 1000, schedule, unschedule, show, end }) => {
    let timer = null
    const stop = () => {
        if (timer !== null) unschedule(timer)
        timer = null
    }
    const tick = () => {
        const left = timeLeft(session, now())
        show(left)
        if (left > 0) return
        stop()
        if (!session.notified) {
            session.notified = true
            end(session)
        }
    }
    tick()
    if (timeLeft(session, now()) > 0) timer = schedule(tick, every)
    return stop
}
