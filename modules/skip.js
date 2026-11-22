// What the handles' submissions say, kept small: the problems solved and
// tried, the names and contests they came from, and the digest that lets a
// refresh read only the newest submissions. Loaded only when a handle is
// skipped, so a visit without one does not download it (see loadSkips in
// script.js).

import { isStale, problemKey } from "./problems.js"
import { fill } from "./i18n.js"

// Gym contests are numbered from 100001.
const isGym = (contestId) => contestId > 100000

// What the submissions seen so far say, small enough to keep and to add newer
// submissions to: the problems solved, the ones only tried, every problem
// outside the gym with its contest and rating, and the start time of each
// contest (see makeSkip for why).
export const emptyState = () => ({ solved: [], tried: [], problems: [], starts: [] })

// The state after `submissions`, newest first and all newer than what `state`
// already holds, are added to it. A submission made in a contest, or in
// practice after it, carries the contest's start time; a virtual one carries
// its own. Gym problems are left out of the names: the gym has no parallel
// rounds, and its problems are often named after their letter. Folding a
// history in two parts gives what folding it whole does.
export const foldSubmissions = (state, submissions) => {
    const solved = new Set(state.solved)
    const tried = new Set(state.tried)
    const problems = new Map(state.problems.map((entry) => [entry[0], entry]))
    const startOf = new Map(state.starts)
    for (const submission of submissions) {
        const problem = submission.problem
        if (!problem || problem.contestId === undefined) continue
        const start = submission.author?.startTimeSeconds
        if (submission.author?.participantType !== "VIRTUAL" && Number.isFinite(start)) {
            startOf.set(problem.contestId, start)
        }
        const key = problemKey(problem)
        if (submission.verdict === "OK") solved.add(key)
        else tried.add(key)
        if (!isGym(problem.contestId)) problems.set(key, [key, problem.name, problem.contestId, problem.rating ?? null])
    }
    for (const key of solved) tried.delete(key)
    return { solved: [...solved], tried: [...tried], problems: [...problems.values()], starts: [...startOf] }
}

// What a state says about the problems, in the shape makeSkip takes: the keys
// solved and tried, and the names of each with their contest, rating and the
// contest's start time.
export const summarizeState = (state) => {
    const problems = new Map(state.problems.map(([key, ...rest]) => [key, rest]))
    const startOf = new Map(state.starts)
    const namesOf = (keys) => {
        const names = new Map()
        for (const key of keys) {
            const problem = problems.get(key)
            if (!problem) continue
            const [name, contestId, rating] = problem
            if (!names.has(name)) names.set(name, [])
            names.get(name).push([contestId, rating, startOf.get(contestId) ?? null])
        }
        return [...names]
    }
    return {
        solved: state.solved,
        tried: state.tried,
        names: namesOf(state.solved),
        triedNames: namesOf(state.tried),
    }
}

export const summarizeSubmissions = (submissions) => summarizeState(foldSubmissions(emptyState(), submissions))

// Submissions younger than this may still change: the system tests of a round
// or a hack turn an accepted one into a failed one for a while. They stay out
// of a saved history, and are read again on every refresh.
export const SETTLE_SECONDS = 24 * 60 * 60

// A saved history is trusted for this long, then read from scratch: a
// submission can be rejudged or skipped days later.
export const REBUILD_AFTER_SECONDS = 3 * 24 * 60 * 60

// How many of the newest submissions a refresh asks for.
export const NEWEST_COUNT = 300

// A history saved so far: the state of every submission up to `cutoff` (a time
// in seconds), how many of them there were, and when it was last read from
// scratch.
export const emptyDigest = (now) => ({ cutoff: 0, count: 0, builtAt: now, state: emptyState() })

// The digest's times are in seconds, isStale() takes milliseconds.
export const isUsableDigest = (digest, now) => Boolean(digest) &&
    !isStale(digest.builtAt * 1000, now * 1000, REBUILD_AFTER_SECONDS * 1000)

// Whether `newest`, the answer to a request for `asked` of the latest
// submissions, reaches back to what the digest holds, so that nothing between
// the two is missing.
export const reachesDigest = (digest, newest, asked) => newest.length < asked ||
    newest.some((item) => item.creationTimeSeconds <= digest.cutoff)

// Adds `submissions`, newest first, to a digest as of `now` (seconds). Those
// the digest already holds are skipped, those old enough to have settled go
// into the new digest, and the rest are only read for the summary, so that
// what they change shows once and is read again next time.
export const advance = (digest, submissions, now) => {
    const cutoff = Math.max(digest.cutoff, now - SETTLE_SECONDS)
    const settled = submissions.filter((item) => item.creationTimeSeconds > digest.cutoff &&
        item.creationTimeSeconds <= cutoff)
    const recent = submissions.filter((item) => item.creationTimeSeconds > cutoff)
    const state = foldSubmissions(digest.state, settled)
    return {
        digest: { cutoff, count: digest.count + settled.length, builtAt: digest.builtAt, state },
        summary: summarizeState(foldSubmissions(state, recent)),
    }
}

// How far apart two contests can be numbered and still hold the same problem
// without starting together: the finals of a cup and its online mirror run on
// other days (VK Cup 2015 Finals 562 and 566, ABBYY Cup 3.0 Finals 324 and
// 331). Of all the problems Codeforces lists, the closest two contests
// holding different problems of one name and rating are nine apart.
const PARALLEL_GAP = 7

// A problem shared by a Div. 1 and a Div. 2 round is listed once in the
// problemset, under one of the two contests, while a submission records the
// contest it was made in. So a problem also counts as solved when a problem
// of the same name and rating was solved in a contest that started at the
// same second (`starts` maps a contest to its start time), or in one
// numbered up to PARALLEL_GAP away, as an online mirror of an onsite round is.
// Round 942 is 1967 for Div. 1 and 1972 for Div. 2, and the problemset
// lists its shared problems under 1967 only. With `includeTried`, the same
// goes for a problem tried there.
export const makeSkip = (summaries, { includeTried = false, starts = new Map() } = {}) => {
    const keys = new Map()
    const names = new Map()
    const addKey = (key) => {
        const bar = key.indexOf("|")
        const contestId = Number(key.slice(0, bar))
        if (!keys.has(contestId)) keys.set(contestId, new Set())
        keys.get(contestId).add(key.slice(bar + 1))
    }
    const addNames = (list) => {
        for (const [name, solvedIn] of list) {
            if (!names.has(name)) names.set(name, [])
            names.get(name).push(...solvedIn)
        }
    }
    for (const summary of summaries) {
        for (const key of summary.solved) addKey(key)
        addNames(summary.names)
        if (includeTried) {
            for (const key of summary.tried) addKey(key)
            addNames(summary.triedNames)
        }
    }
    // Looked up by contest and then by letter, so a problem costs no key string.
    return (problem) => {
        if (keys.get(problem.contestId)?.has(problem.index)) return true
        const solvedIn = names.get(problem.name)
        if (!solvedIn) return false
        const start = starts.get(problem.contestId)
        return solvedIn.some(([contestId, rating, solvedStart]) =>
            contestId !== problem.contestId && rating === (problem.rating ?? null) &&
            (Math.abs(contestId - problem.contestId) <= PARALLEL_GAP || (start !== undefined && start === solvedStart)))
    }
}

// Of the entries, each with a savedAt time, the ones to drop: those stale
// by `maxAge`, and then all but the `maxCount` newest.
export const staleSummaries = (entries, now, { maxAge, maxCount }) => {
    const fresh = entries.filter((entry) => !isStale(entry.savedAt, now, maxAge))
        .sort((a, b) => b.savedAt - a.savedAt)
    const stale = entries.filter((entry) => isStale(entry.savedAt, now, maxAge))
    return [...stale, ...fresh.slice(maxCount)]
}


// The rating range a handle's rating suggests: from a hundred below it to
// three hundred above, rounded to hundreds and kept within the ratings the
// draws use. A handle with no rating gets the range of a newcomer.
export const RATING_LIMITS = { min: 800, max: 3500 }
export const ratingRange = (rating) => {
    if (!Number.isFinite(rating)) return { min: 800, max: 1200 }
    const hundreds = (value) => Math.round(value / 100) * 100
    const within = (value) => Math.min(RATING_LIMITS.max, Math.max(RATING_LIMITS.min, value))
    return { min: within(hundreds(rating - 100)), max: within(hundreds(rating + 300)) }
}

// How long a handle's rating is kept, as its other data is.
export const RATING_FRESH_FOR = 10 * 60 * 1000

// Rating copies are only read while they are fresh, so each one kept drops the
// copies of other handles that have gone stale. They share the cache with the
// rest of the page's copies and are told apart by their folder, which is the
// key's without its last part.
const dropStaleRatings = async (cache, key, now) => {
    const folder = key.slice(0, key.lastIndexOf("/") + 1)
    for (const request of await cache.keys()) {
        if (!request.url.startsWith(folder)) continue
        const entry = await (await cache.match(request))?.json().catch(() => null)
        if (!Number.isFinite(entry?.savedAt) || isStale(entry.savedAt, now(), RATING_FRESH_FOR)) {
            cache.delete(request).catch(() => {})
        }
    }
}

// The rating a handle has, or null when it has none, read from the cache when
// the copy is fresh and otherwise from user.info. `io` gives the page's own
// request (spaced and retried as its other calls are), its cache and the key
// the copy is kept under, and the error a failed answer makes.
export const readRating = async (handle, { request, cache, key, failure, now = Date.now }) => {
    try {
        const response = cache && await cache.match(key)
        const entry = response && await response.json()
        if (entry && Number.isFinite(entry.savedAt) && !isStale(entry.savedAt, now(), RATING_FRESH_FOR)) {
            return entry.rating ?? null
        }
    } catch {
        // Unreadable: asked for again below.
    }
    const { response, json } = await request(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`)
    if (!response.ok || !json || json.status !== "OK" || !Array.isArray(json.result)) throw failure(response, json)
    const rating = json.result[0]?.rating ?? null
    if (cache) {
        cache.put(key, new Response(JSON.stringify({ savedAt: now(), rating }), {
            headers: { "Content-Type": "application/json" },
        })).then(() => dropStaleRatings(cache, key, now)).catch(() => {})
    }
    return rating
}

// Sets the range from the handle's rating. The page gives what it needs: the
// request and cache, the key of the copy, the failure an answer makes, the
// range setter, and where a message or an error goes.
export const applyRating = async ({ handle, request, cache, key, failure, text, setRange, say, fail }) => {
    try {
        const rating = await readRating(handle, { request, cache, key, failure })
        const { min, max } = ratingRange(rating)
        setRange(min, max)
        say(rating === null
            ? fill(text.ratingUnrated, { handle, min, max })
            : fill(text.ratingUsed, { handle, rating, min, max }))
    } catch (error) {
        fail(error)
    }
}
