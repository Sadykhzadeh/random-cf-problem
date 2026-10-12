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

// Rated problems within [min, max] that carry all of the tags, or any of
// them when mode is "any"; no tags means any problem. Unrated problems are
// left out: there is no telling whether they fit. `special: false` drops
// the problems Codeforces tags *special - April Fools jokes, rounds in Q#,
// Kotlin or an unknown language, olympiad mirrors with subtasks. `skip`
// drops problems someone has already solved.
export const matchingProblems = (problems, { min = 0, max = Infinity, tags = [], mode = "all", special = true, skip } = {}) => {
    const hasTags = mode === "any"
        ? (problem) => tags.some((tag) => problem.tags.includes(tag))
        : (problem) => tags.every((tag) => problem.tags.includes(tag))
    return problems.filter((problem) =>
        typeof problem.rating === "number" &&
        min <= problem.rating && problem.rating <= max &&
        (!tags.length || hasTags(problem)) &&
        (special || !problem.tags.includes("*special")) &&
        !(skip && skip(problem)))
}

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

// What a handle's submissions say, small enough to keep: the problems it
// solved, the ones it only tried, and the names of the solved ones with
// their contests (see makeSkip for why).
export const summarizeSubmissions = (submissions) => {
    const solved = new Set()
    const tried = new Set()
    const names = new Map()
    for (const submission of submissions) {
        const problem = submission.problem
        if (!problem || problem.contestId === undefined) continue
        const key = problemKey(problem)
        if (submission.verdict === "OK") {
            solved.add(key)
            if (!names.has(problem.name)) names.set(problem.name, new Set())
            names.get(problem.name).add(problem.contestId)
        } else {
            tried.add(key)
        }
    }
    for (const key of solved) tried.delete(key)
    return {
        solved: [...solved],
        tried: [...tried],
        names: [...names].map(([name, contests]) => [name, [...contests]]),
    }
}

// A problem shared by a Div. 1 and a Div. 2 round is listed once in the
// problemset, under one of the two contests, while a submission records the
// contest it was made in. So a problem also counts as solved when a problem
// of the same name was solved in a contest one or two numbers away -
// parallel rounds are numbered side by side. For tourist that is 49 solved
// problems the contest and letter alone would have offered again.
export const makeSkip = (summaries, { includeTried = false } = {}) => {
    const keys = new Set()
    const names = new Map()
    for (const summary of summaries) {
        for (const key of summary.solved) keys.add(key)
        if (includeTried) for (const key of summary.tried) keys.add(key)
        for (const [name, contests] of summary.names) {
            if (!names.has(name)) names.set(name, [])
            names.get(name).push(...contests)
        }
    }
    return (problem) => {
        if (keys.has(problemKey(problem))) return true
        const contests = names.get(problem.name)
        return Boolean(contests) && contests.some((contestId) => {
            const apart = Math.abs(contestId - problem.contestId)
            return apart >= 1 && apart <= 2
        })
    }
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
