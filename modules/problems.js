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
export const matchingProblems = (problems, { min = 0, max = Infinity, tags = [], mode = "all", special = true, skip, since, starts } = {}) => {
    const hasTags = mode === "any" ? (problem) => tags.some((tag) => problem.tags.includes(tag))
        : mode === "none" ? (problem) => !tags.some((tag) => problem.tags.includes(tag))
        : (problem) => tags.every((tag) => problem.tags.includes(tag))
    return problems.filter((problem) =>
        typeof problem.rating === "number" &&
        min <= problem.rating && problem.rating <= max &&
        (!tags.length || hasTags(problem)) &&
        (special || !problem.tags.includes("*special")) &&
        !(since !== undefined && starts?.get(problem.contestId) < since) &&
        !(skip && skip(problem)))
}

// The first second of a year, in the seconds contest.list counts in.
export const yearStart = (year) => Date.UTC(year, 0, 1) / 1000

// Handles typed into one field, separated by commas or spaces: each once,
// whatever its case, and no more than `limit` of them.
export const parseHandles = (text, limit = 5) => {
    const seen = new Set()
    const handles = []
    for (const handle of String(text).split(/[\s,;]+/)) {
        if (!handle || seen.has(handle.toLowerCase())) continue
        seen.add(handle.toLowerCase())
        handles.push(handle)
    }
    return { handles: handles.slice(0, limit), dropped: Math.max(0, handles.length - limit) }
}

const problemKey = (problem) => `${problem.contestId}|${problem.index}`

// Gym contests are numbered from 100001.
const isGym = (contestId) => contestId > 100000

// What a handle's submissions say, small enough to keep: the problems it
// solved, the ones it only tried, and the names of each with their contest,
// rating and the contest's start time (see makeSkip for why). Gym problems
// are left out of the names: the gym has no parallel rounds, and its
// problems are often named after their letter.
export const summarizeSubmissions = (submissions) => {
    const solved = new Set()
    const tried = new Set()
    const problems = new Map()
    // A submission made in a contest, or in practice after it, carries the
    // contest's start time; a virtual one carries its own.
    const startOf = new Map()
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
        if (!isGym(problem.contestId)) problems.set(key, problem)
    }
    for (const key of solved) tried.delete(key)
    const namesOf = (keys) => {
        const names = new Map()
        for (const key of keys) {
            const problem = problems.get(key)
            if (!problem) continue
            if (!names.has(problem.name)) names.set(problem.name, [])
            names.get(problem.name).push(
                [problem.contestId, problem.rating ?? null, startOf.get(problem.contestId) ?? null])
        }
        return [...names]
    }
    return {
        solved: [...solved],
        tried: [...tried],
        names: namesOf(solved),
        triedNames: namesOf(tried),
    }
}

// A problem shared by a Div. 1 and a Div. 2 round is listed once in the
// problemset, under one of the two contests, while a submission records the
// contest it was made in. So a problem also counts as solved when a problem
// of the same name and rating was solved in a contest that started at the
// same second (`starts` maps a contest to its start time), or in one
// numbered one or two away, as an online mirror of an onsite round is.
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
            (Math.abs(contestId - problem.contestId) <= 2 || (start !== undefined && start === solvedStart)))
    }
}

// contest.list boiled down to [contest, start time] pairs, and back to a
// map; anything that does not read back cleanly is no data at all.
export const packContestStarts = (contests) =>
    contests.filter((contest) => Number.isFinite(contest.startTimeSeconds))
        .map((contest) => [contest.id, contest.startTimeSeconds])

export const unpackContestStarts = (packed) => {
    if (!Array.isArray(packed)) return null
    const starts = new Map()
    for (const item of packed) {
        if (!Array.isArray(item) || !Number.isFinite(item[0]) || !Number.isFinite(item[1])) return null
        starts.set(item[0], item[1])
    }
    return starts
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

// How long a Codeforces call may take. Without a limit a connection that
// stalls leaves the page on "Loading..." for as long as the tab is open.
export const REQUEST_TIMEOUT_MS = 30000

// AbortSignal.timeout() aborts with a TimeoutError, which is what a stalled
// call looks like to the code that catches it.
export const isTimeout = (error) => Boolean(error) && error.name === "TimeoutError"

export { problemKey }
