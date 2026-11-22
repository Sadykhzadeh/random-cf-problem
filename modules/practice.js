// A practice set: a few problems on a rating ladder, one rung per problem and
// no two from the same contest. A set is shared as the ids of its problems, so
// its link brings back exactly the same problems, whatever the list says now.

import { problemKey, problemLabel, problemUrl } from "./problems.js"

// Sets are kept to this many problems, in the page and in an address.
export const MAX_SET = 20

// The ratings of the rungs: `count` of them in equal steps from `from` to `to`.
export const ladderRatings = (count, from, to) =>
    count <= 1 ? [from] : Array.from({ length: count }, (_, i) => from + (i * (to - from)) / (count - 1))

// The problem nearest `rating` in the pool that `allowed` takes, at random among
// those equally near, or undefined from an empty pool.
const nearestOf = (pool, rating, random, allowed = () => true) => {
    let best = Infinity
    let nearest = []
    for (const problem of pool) {
        if (!allowed(problem)) continue
        const distance = Math.abs(problem.rating - rating)
        if (distance < best) {
            best = distance
            nearest = [problem]
        } else if (distance === best) {
            nearest.push(problem)
        }
    }
    return nearest.length ? nearest[Math.floor(random() * nearest.length)] : undefined
}

// One problem for each rung: among the problems whose rating is nearest the
// rung's, one at random, never two from one contest. A rung with no problem
// left is skipped, so a short pool gives a shorter set rather than a repeat.
export const buildLadder = (pool, count, from, to, random = Math.random) => {
    const contests = new Set()
    const picked = []
    for (const target of ladderRatings(count, from, to)) {
        const problem = nearestOf(pool, target, random, (candidate) => !contests.has(candidate.contestId))
        if (!problem) continue
        contests.add(problem.contestId)
        picked.push(problem)
    }
    return picked
}

// A problem to take the place of `replaced` in a set: the one nearest its rating
// among the pool's problems that the set does not hold and whose contests the
// rest of the set does not use. `set` holds the set's problems with their
// ratings. Undefined when no problem is left.
export const replacementOf = (pool, set, replaced, random = Math.random) => {
    const held = new Set(set.map(problemKey))
    const contests = new Set(set.filter((problem) => problemKey(problem) !== problemKey(replaced))
        .map((problem) => problem.contestId))
    return nearestOf(pool.filter((problem) => !held.has(problemKey(problem)) && !contests.has(problem.contestId)),
        replaced.rating, random)
}

// A problem's id as an address writes it: the contest number and the letter,
// such as 1520F2. A numbered index, as the Labyrinth round of contest 921 has
// them, is joined by a dash, since 92114 would read as contest 92114.
// The ids of a set as they go in an address, comma-separated, such as 1520F2,4A.
export const encodeSet = (ids) => ids.map(problemLabel).join(",")

// The ids read back from an address. Anything that is not an id is skipped, an
// id given twice is kept once, and no more than MAX_SET are kept. The letter is
// read in capitals, as Codeforces writes it, so a link typed as 1520f2 finds the
// same problem. The contest number and the index are bounded to what Codeforces
// has, so a run of digits a problem never has is not read as one.
export const decodeSet = (text) => {
    const seen = new Set()
    return String(text ?? "").split(",")
        .map((id) => /^(\d{1,9})(?:-(\d{1,3})|([A-Za-z]\d{0,3}))$/.exec(id.trim()))
        .filter(Boolean)
        .map((match) => ({ contestId: Number(match[1]), index: match[2] ?? match[3].toUpperCase() }))
        .filter((id) => {
            if (seen.has(idKey(id))) return false
            seen.add(idKey(id))
            return true
        })
        .slice(0, MAX_SET)
}

// The problems the ids name, in order, and the ids that no problem in the list
// has any more.
export const resolveSet = (problems, ids) => {
    const byContest = new Map()
    for (const problem of problems) {
        if (!byContest.has(problem.contestId)) byContest.set(problem.contestId, new Map())
        byContest.get(problem.contestId).set(problem.index, problem)
    }
    const found = []
    const missing = []
    for (const id of ids) {
        const problem = byContest.get(id.contestId)?.get(id.index)
        if (problem) found.push(problem)
        else missing.push(id)
    }
    return { found, missing }
}

// The set as a Markdown task list, one problem a line, with its rating and
// ticked when the visitor has done it (`done` holds the ids ticked, in their
// address form). Brackets, angle brackets, ampersands and emphasis characters in
// a name are escaped so the link stays a link and the name stays text.
export const setMarkdown = (problems, done = []) => problems.map((problem) => {
    const name = problem.name.replace(/[\\[\]*_`<&]/g, "\\$&")
    return `- [${done.includes(idKey(problem)) ? "x" : " "}] [${idKey(problem)}. ${name}](${problemUrl(problem)}) (${problem.rating ?? "unrated"})`
}).join("\n")

// The ticks kept for at most this many sets, the most recently ticked first.
export const KEPT_SETS = 20

// A problem's id as the set's address writes it, and the same key as the
// problemset keeps it under (contest and index, as problemKey writes them).
export const idKey = (id) => problemLabel(id)
export const solvedKey = (id) => `${id.contestId}|${id.index}`

// The problems of a set that are ticked, in the set's order.
export const doneOf = (ids, done) => ids.filter((id) => done.includes(idKey(id)))

// The ticks already there with the ones the handles have solved added, each
// once.
export const mergeTicks = (done, accepted) => [...new Set([...done, ...accepted])]

// The problems of a set the handles have solved, given as a test of a problem
// (the page's skip test, which counts a parallel round's twin as solved too).
export const acceptedOf = (problems, isSolved) => problems.filter(isSolved).map((problem) => idKey(problem))

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

// The entries with a set's ticks moved from its old address to its new one, the
// problem `dropped` (an id in address form) left out, and the old entry removed.
export const moveTicks = (entries, fromKey, toKey, dropped, at) =>
    withTicks(entries.filter((entry) => entry.key !== fromKey), toKey,
        mergeTicks(ticksOf(entries, toKey), ticksOf(entries, fromKey).filter((id) => id !== dropped)), at)

export const ticksOf = (entries, key) => entries.find((entry) => entry.key === key)?.done ?? []

// The keys of the sets built or opened lately, the most recent first and at most
// KEPT_SETS. `replaces` is the key a set has moved away from, which is dropped.
export const withRecentSet = (keys, key, replaces) =>
    [key, ...keys.filter((other) => other !== key && other !== replaces)].slice(0, KEPT_SETS)

// The recent keys read back from storage: only addresses that read as a set,
// each once.
export const unpackRecentSets = (stored) => {
    if (!Array.isArray(stored)) return []
    return [...new Set(stored.filter((key) => typeof key === "string" && key !== "" && encodeSet(decodeSet(key)) === key))]
        .slice(0, KEPT_SETS)
}

// The practice progress as a file's text: the ticks of every set and the sets
// lately built or opened.
export const progressText = (ticks, sets) => JSON.stringify({ ticks, sets })

// The largest progress file that is read.
export const PROGRESS_MAX_BYTES = 1024 * 1024

// Whether `key` is a set's address written the way encodeSet writes it.
const isSetKey = (key) => typeof key === "string" && key !== "" && encodeSet(decodeSet(key)) === key

// A file's tick entry, which must name a set and tick only problems of that set,
// each once, with a time.
const isTickEntry = (entry) => {
    if (!entry || typeof entry !== "object" || !isSetKey(entry.key) || !Number.isFinite(entry.at) || !Array.isArray(entry.done)) return false
    const ids = decodeSet(entry.key).map(idKey)
    return new Set(entry.done).size === entry.done.length && entry.done.length <= ids.length &&
        entry.done.every((id) => ids.includes(id))
}

// The progress a file holds, or null when the text is not one. Strict: a file
// with any entry that does not read as a set's, or more sets than are kept, is
// refused whole.
export const unpackProgress = (text) => {
    let data
    try {
        data = JSON.parse(text)
    } catch {
        return null
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return null
    const hasTicks = Array.isArray(data.ticks)
    const hasSets = Array.isArray(data.sets)
    if (!hasTicks && !hasSets) return null
    if (("ticks" in data && !hasTicks) || ("sets" in data && !hasSets)) return null
    const ticks = hasTicks ? data.ticks : []
    const sets = hasSets ? data.sets : []
    if (ticks.length > KEPT_SETS || sets.length > KEPT_SETS) return null
    if (!ticks.every(isTickEntry) || !sets.every(isSetKey)) return null
    return { ticks: ticks.map((entry) => ({ key: entry.key, done: [...entry.done], at: entry.at })), sets: [...sets] }
}

// The progress of this browser with a file's merged in. The ticks of at most
// KEPT_SETS sets are kept, the most recently ticked first, as storage keeps them;
// the lists of recent sets keep this browser's first. `left` counts the sets of
// either list that did not fit.
export const mergeProgress = (local, incoming) => {
    const ticks = incoming.ticks.reduce((entries, entry) => {
        const own = entries.find((other) => other.key === entry.key)
        return withTicks(entries, entry.key, mergeTicks(own?.done ?? [], entry.done), Math.max(entry.at, own?.at ?? 0))
    }, local.ticks)
    const sets = [...new Set([...local.sets, ...incoming.sets])].slice(0, KEPT_SETS)
    const all = new Set([...local.ticks, ...incoming.ticks].map((entry) => entry.key).concat(local.sets, incoming.sets))
    const kept = new Set([...ticks.map((entry) => entry.key), ...sets])
    return { ticks, sets, left: all.size - kept.size }
}

// A timed session on a set: the limit is kept with the time spent so far. The
// time spent grows by the wall-clock time since the last update, so the time
// left never grows back, even when the clock is set back.
export const SESSION_MAX_MINUTES = 600

// The limit the form's field gives, in whole minutes, or null when there is none.
export const sessionLength = (raw) => {
    const minutes = Number(raw)
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= SESSION_MAX_MINUTES ? minutes : null
}

// The session started at `now` (ms) for the set `key`. `said` lists the
// moments of it that have been read out, so each is read once however often
// the page opens.
export const newSession = (key, now, minutes) => ({ key, started: now, limit: minutes * 60000, spent: 0, seen: now, said: [], paused: false })

// A session read back from storage, or null when what is stored is not one.
// Time spent is kept within the limit. A session holding a deadline in place
// of a limit is read with the time left until that deadline, counted from `now`.
export const unpackSession = (stored, now) => {
    if (!stored || typeof stored.key !== "string" || !Array.isArray(stored.said)) return null
    const said = stored.said.filter((mark) => typeof mark === "string")
    if ([stored.started, stored.limit, stored.spent, stored.seen].every(Number.isFinite)) {
        const limit = Math.max(0, stored.limit)
        const spent = Math.min(limit, Math.max(0, stored.spent))
        return { key: stored.key, started: stored.started, limit, spent, seen: stored.seen, said, paused: stored.paused === true }
    }
    if (Number.isFinite(stored.deadline)) {
        return { key: stored.key, started: now, limit: Math.max(0, stored.deadline - now), spent: 0, seen: now, said, paused: false }
    }
    return null
}

// The session stored for this set, or null: a session belongs to one set.
export const pickSession = (stored, key, now) => {
    const session = unpackSession(stored, now)
    return session && session.key === key ? session : null
}

// Moves the session's clock on to `now`. A clock set back spends nothing, and
// the time after it counts from the new clock; so does a paused session, which
// spends nothing until it is resumed.
export const spendTime = (session, now) => {
    if (!session.paused) session.spent = Math.min(session.limit, session.spent + Math.max(0, now - session.seen))
    session.seen = now
}

// Stops the session's clock at `now`. The time until it is resumed is not spent.
export const pauseTime = (session, now) => {
    spendTime(session, now)
    session.paused = true
}

// Starts the session's clock again at `now`, with nothing spent while it was paused.
export const resumeTime = (session, now) => {
    spendTime(session, now)
    session.paused = false
}

export const timeLeft = (session) => Math.max(0, session.limit - session.spent)

// Whether what storage holds is `session` itself. A tab writes its session only
// while this holds, so a session another tab started in its place is kept.
export const storesSession = (stored, session) => stored?.started === session.started

// Takes over the pause that another tab has put on the session stored, from
// `now`, so the time spent here follows it. A stored session that is not this
// one, or is paused the same way, changes nothing.
export const adoptPause = (session, stored, now) => {
    if (!storesSession(stored, session) || Boolean(stored.paused) === session.paused) return session
    if (stored.paused) pauseTime(session, now)
    else resumeTime(session, now)
    return session
}

// mm:ss, rounding a part second up so the display reads 00:01 until it is over.
export const clockText = (ms) => {
    const seconds = Math.ceil(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

// The moments of a session that are read out, by the time left at which each
// is reached: five minutes, one minute, and the end.
export const TIMER_MARKS = [
    { mark: "five", left: 5 * 60000 },
    { mark: "one", left: 60000 },
    { mark: "end", left: 0 },
]

// The moments reached at `left` that have not been read out yet.
export const dueMarks = (left, said) =>
    TIMER_MARKS.filter((moment) => left <= moment.left && !said.includes(moment.mark)).map((moment) => moment.mark)

// Moments already reached when the page starts watching a session are not read
// out: a session set for four minutes has no five-minute notice, and one set
// for five or one minutes starts on its notice. They are marked as read instead.
// The end is left out, so a session that is over is still announced once.
export const passedMarks = (left, said) =>
    TIMER_MARKS.filter((moment) => moment.left >= left && moment.left > 0 && !said.includes(moment.mark)).map((moment) => moment.mark)

// Shows the time left of a session while it runs, once a second, and nothing
// is scheduled once it is over or when there is no session at all. `announce`
// is called once for each moment reached, and the session records it in `said`.
// Returns a function that stops the display.
export const followSession = (session, { now, every = 1000, schedule, unschedule, show, announce }) => {
    let timer = null
    const stop = () => {
        if (timer !== null) unschedule(timer)
        timer = null
    }
    const tick = () => {
        spendTime(session, now())
        const left = timeLeft(session)
        show(left)
        for (const mark of dueMarks(left, session.said)) {
            session.said.push(mark)
            announce(mark)
        }
        if (left === 0) stop()
    }
    spendTime(session, now())
    session.said.push(...passedMarks(timeLeft(session), session.said))
    tick()
    if (timeLeft(session) > 0) timer = schedule(tick, every)
    return stop
}

// The flat set: `count` problems from the pool at random, no two from one
// contest, listed by rating. The pool is the rating range itself.
export const buildFlat = (pool, count, random = Math.random) => {
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const contests = new Set()
    const picked = []
    for (const problem of shuffled) {
        if (picked.length >= count) break
        if (contests.has(problem.contestId)) continue
        contests.add(problem.contestId)
        picked.push(problem)
    }
    return picked.sort((a, b) => a.rating - b.rating)
}

// The pool without the problems the visitor has seen: those drawn lately, and
// those ticked done in any set. `drawn` is a list of problems, `done` the ids
// ticked (in their address form).
export const unseenOf = (pool, { drawn = [], done = [] }) => {
    const seenInDraws = new Set(drawn.map(solvedKey))
    const ticked = new Set(done)
    return pool.filter((problem) => !seenInDraws.has(solvedKey(problem)) && !ticked.has(idKey(problem)))
}
