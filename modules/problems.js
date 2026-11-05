// Works on plain problemset data and never touches the page, so it can be
// tested under Node.

// problemset.problems answers with the problems and, separately, how many
// people solved each. Only what a draw needs is kept, as arrays: the full
// answer is 2.3 MB of JSON, this is about a third of that.
export const packProblemset = (result) => {
    const solved = new Map()
    for (const stat of result.problemStatistics ?? []) {
        solved.set(`${stat.contestId}|${stat.index}`, stat.solvedCount)
    }
    return result.problems.map((problem) => [
        problem.contestId,
        problem.index,
        problem.name,
        problem.rating ?? null,
        problem.tags ?? [],
        solved.get(`${problem.contestId}|${problem.index}`) ?? null,
    ])
}

// Anything that does not unpack cleanly is treated as no data at all.
export const unpackProblemset = (packed) => {
    if (!Array.isArray(packed)) return null
    const problems = []
    for (const item of packed) {
        if (!Array.isArray(item) || item.length !== 6) return null
        const [contestId, index, name, rating, tags, solvedCount] = item
        if (!Number.isFinite(contestId) || typeof index !== "string" || typeof name !== "string") {
            return null
        }
        problems.push({
            contestId,
            index,
            name,
            rating: rating ?? undefined,
            tags: Array.isArray(tags) ? tags : [],
            solvedCount: solvedCount ?? undefined,
        })
    }
    return problems
}

// Rated problems within [min, max] that carry all of the tags, any of them
// when mode is "any", or none of them when it is "none"; no tags means any
// problem. Unrated problems are
// left out: there is no telling whether they fit. `special: false` drops
// the problems Codeforces tags *special - April Fools jokes, rounds in Q#,
// Kotlin or an unknown language, olympiad mirrors with subtasks. `skip`
// drops problems someone has already solved. `since` drops problems from
// contests that started before it (`starts` maps a contest to its start
// time); a contest missing from `starts` is newer than the list, so it stays.
// `minSolved` keeps the problems at least that many people have solved, and
// leaves out one whose count is not known.
export const matchingProblems = (problems, { min = 0, max = Infinity, minSolved = 0, tags = [], mode = "all", special = true, skip, since, starts, divisions = [], contestDivisions: divisionsOf } = {}) => {
    const hasTags = mode === "any" ? (problem) => tags.some((tag) => problem.tags.includes(tag))
        : mode === "none" ? (problem) => !tags.some((tag) => problem.tags.includes(tag))
        : (problem) => tags.every((tag) => problem.tags.includes(tag))
    return problems.filter((problem) =>
        typeof problem.rating === "number" &&
        min <= problem.rating && problem.rating <= max &&
        (!minSolved || problem.solvedCount >= minSolved) &&
        (!tags.length || hasTags(problem)) &&
        (special || !problem.tags.includes("*special")) &&
        !(since !== undefined && starts?.get(problem.contestId) < since) &&
        (!divisions.length || divisions.some((division) => divisionsOf?.get(problem.contestId)?.includes(division))) &&
        !(skip && skip(problem)))
}

// The first second of a year, in the seconds contest.list counts in.
export const yearStart = (year) => Date.UTC(year, 0, 1) / 1000

// A link to a profile or to someone's submissions, as copied from the address
// bar on any Codeforces host, stands for its handle.
const PROFILE_LINK = /^(?:https?:\/\/)?(?:[\w-]+\.)*(?:codeforces\.[a-z]+|codeforc\.es)\/(?:profile|submissions)\/([^/?#]+)/i

// Handles typed into one field, separated by commas or spaces: each once,
// whatever its case, and no more than `limit` of them.
export const parseHandles = (text, limit = 5) => {
    const seen = new Set()
    const handles = []
    for (const word of String(text).split(/[\s,;]+/)) {
        const handle = PROFILE_LINK.exec(word)?.[1] ?? word
        if (!handle || seen.has(handle.toLowerCase())) continue
        seen.add(handle.toLowerCase())
        handles.push(handle)
    }
    return { handles: handles.slice(0, limit), dropped: Math.max(0, handles.length - limit) }
}

const problemKey = (problem) => `${problem.contestId}|${problem.index}`

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

export const isUsableDigest = (digest, now) => Boolean(digest) && now - digest.builtAt < REBUILD_AFTER_SECONDS

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
    const keys = new Set()
    const names = new Map()
    const addNames = (list) => {
        for (const [name, solvedIn] of list) {
            if (!names.has(name)) names.set(name, [])
            names.get(name).push(...solvedIn)
        }
    }
    for (const summary of summaries) {
        for (const key of summary.solved) keys.add(key)
        addNames(summary.names)
        if (includeTried) {
            for (const key of summary.tried) keys.add(key)
            addNames(summary.triedNames)
        }
    }
    return (problem) => {
        if (keys.has(problemKey(problem))) return true
        const solvedIn = names.get(problem.name)
        if (!solvedIn) return false
        const start = starts.get(problem.contestId)
        return solvedIn.some(([contestId, rating, solvedStart]) =>
            contestId !== problem.contestId && rating === (problem.rating ?? null) &&
            (Math.abs(contestId - problem.contestId) <= PARALLEL_GAP || (start !== undefined && start === solvedStart)))
    }
}

// The divisions a contest is for, as its name says: 1 to 4, or "edu" for an
// Educational round, whose "Rated for Div. 2" is not a Div. 2 round. A
// Global round or a cup names none.
export const contestDivisions = (name) => {
    if (/educational/i.test(name ?? "")) return ["edu"]
    const numbers = [...String(name ?? "").matchAll(/Div[.]?[ ]*([1-4])/gi)].map((match) => match[1])
    return [...new Set(numbers)].sort()
}

// contest.list boiled down to [contest, start time, divisions] triples, the
// divisions as one string, and back to maps; anything that does not read back
// cleanly is no data at all. The problemset lists the problems two parallel
// rounds share under one of them, so a Div. 1 round holds problems of Div. 2
// as well: each of the two takes the divisions of both.
export const packContestStarts = (contests) => {
    const started = contests.filter((contest) => Number.isFinite(contest.startTimeSeconds))
    const together = new Map()
    for (const contest of started) {
        const own = contestDivisions(contest.name).filter((division) => division !== "edu")
        if (!own.length) continue
        together.set(contest.startTimeSeconds, [...(together.get(contest.startTimeSeconds) ?? []), ...own])
    }
    return started.map((contest) => {
        const own = contestDivisions(contest.name)
        const all = own.length && own[0] !== "edu" ? [...new Set(together.get(contest.startTimeSeconds))].sort() : own
        return [contest.id, contest.startTimeSeconds, all.join(",")]
    })
}

export const unpackContestDivisions = (packed) => {
    if (!Array.isArray(packed)) return null
    const divisions = new Map()
    for (const item of packed) {
        if (!Array.isArray(item) || !Number.isFinite(item[0]) || typeof item[2] !== "string") return null
        divisions.set(item[0], item[2] ? item[2].split(",") : [])
    }
    return divisions
}

export const unpackContestStarts = (packed) => {
    if (!Array.isArray(packed)) return null
    const starts = new Map()
    for (const item of packed) {
        if (!Array.isArray(item) || !Number.isFinite(item[0]) || !Number.isFinite(item[1])) return null
        starts.set(item[0], item[1])
    }
    return starts
}

// Whether a copy saved at `savedAt` is older than `maxAge`. One saved by a
// clock that ran ahead looks younger than it is, and would stay fresh until
// the clock caught up, so a stamp more than a minute in the future counts as
// stale too; a smaller step back is an ordinary clock adjustment.
const CLOCK_SLACK = 60 * 1000
export const isStale = (savedAt, now, maxAge) => now - savedAt > maxAge || savedAt - now > CLOCK_SLACK

// Of the entries, each with a savedAt time, the ones to drop: those stale
// by `maxAge`, and then all but the `maxCount` newest.
export const staleSummaries = (entries, now, { maxAge, maxCount }) => {
    const fresh = entries.filter((entry) => !isStale(entry.savedAt, now, maxAge))
        .sort((a, b) => b.savedAt - a.savedAt)
    const stale = entries.filter((entry) => isStale(entry.savedAt, now, maxAge))
    return [...stale, ...fresh.slice(maxCount)]
}

// Which Codeforces rank colour a rating is shown in.
export const rankClass = (rating) => {
    if (typeof rating !== "number") return ""
    if (rating < 1200) return "rank-newbie"
    if (rating < 1400) return "rank-pupil"
    if (rating < 1600) return "rank-specialist"
    if (rating < 1900) return "rank-expert"
    if (rating < 2100) return "rank-cm"
    if (rating < 2400) return "rank-master"
    return "rank-gm"
}

// One problem at random. Problems whose keys are in `avoid` (the ones drawn
// lately) are passed over while anything else is left to choose from.
export const pickOne = (list, random = Math.random, avoid) => {
    const fresh = avoid && avoid.size ? list.filter((problem) => !avoid.has(problemKey(problem))) : list
    const pool = fresh.length ? fresh : list
    return pool.length ? pool[Math.floor(random() * pool.length)] : undefined
}

// How long a Codeforces call may go without delivering anything. Without a
// limit a connection that stalls leaves the page on "Loading..." for as long
// as the tab is open.
export const REQUEST_TIMEOUT_MS = 30000

// AbortSignal.timeout() aborts with a TimeoutError, which is what a stalled
// call looks like to the code that catches it.
export const isTimeout = (error) => Boolean(error) && error.name === "TimeoutError"

// Fetches a JSON answer and parses it. The limit applies to silence, not to
// the whole call: a problemset or a history of tens of thousands of
// submissions can take longer than the limit to arrive in full on a slow
// connection, while one that stops delivering must still give up. Resolves
// with the response and the parsed body, which is null when the body is not
// JSON, as an HTML error page is. A stall throws a TimeoutError, wherever in
// the call it happens.
export const fetchJson = async (url, { idleMs = REQUEST_TIMEOUT_MS, fetchFn = fetch } = {}) => {
    const controller = new AbortController()
    let timer = 0
    const arm = () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
            controller.abort(new DOMException("No data for too long.", "TimeoutError"))
        }, idleMs)
    }
    arm()
    try {
        const response = await fetchFn(url, { signal: controller.signal })
        let text = ""
        if (response.body) {
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            const parts = []
            for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
                arm()
                parts.push(decoder.decode(chunk.value, { stream: true }))
            }
            text = parts.join("") + decoder.decode()
        }
        let json = null
        try {
            json = JSON.parse(text)
        } catch {
            // Not JSON: the caller judges the status instead.
        }
        return { response, json }
    } finally {
        clearTimeout(timer)
    }
}

// An answer that is not about the question and may be a different one in a
// few seconds: the call limit, or a gateway that is busy.
const isTransient = (status, json) => status === 429 || [502, 503, 504].includes(status) ||
    /call limit/i.test(typeof json?.comment === "string" ? json.comment : "")

// fetchJson, made a second time when the first answer was transient. Another
// tab or another person behind the same address spends the call limit too,
// and it passes within the two seconds Codeforces asks for. `again` is the
// caller's way of waiting for its turn; it resolves false when the answer is
// no longer wanted, and without it nothing is repeated.
export const fetchApi = async (url, { again, ...options } = {}) => {
    const first = await fetchJson(url, options)
    if (!again || !isTransient(first.response.status, first.json) || !await again()) return first
    return fetchJson(url, options)
}

export { problemKey }
