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

// A saved copy of the problemset as read back from the cache: its problems and
// the time it was saved. A copy that does not read back, or that holds no
// problems at all, is no copy, so the list is fetched again.
export const unpackSaved = (data) => {
    const problems = unpackProblemset(data?.problems)
    return problems?.length && Number.isFinite(data.savedAt) ? { savedAt: data.savedAt, problems } : null
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

// Whether the skips, and nothing else, leave the filter with no problem: the
// settings match problems, all of which the handles have solved or tried.
export const emptiedBySkips = (problems, filter) =>
    !matchingProblems(problems, filter).length &&
    matchingProblems(problems, { ...filter, skip: undefined }).length > 0

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

// Whether a copy saved at `savedAt` is older than `maxAge`. One saved by a
// clock that ran ahead looks younger than it is, and would stay fresh until
// the clock caught up, so a stamp more than a minute in the future counts as
// stale too; a smaller step back is an ordinary clock adjustment.
const CLOCK_SLACK = 60 * 1000
export const isStale = (savedAt, now, maxAge) => now - savedAt > maxAge || savedAt - now > CLOCK_SLACK

// The page of a problem in the problemset, as Codeforces addresses it.
export const problemUrl = (problem) => `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`

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

// One problem at random, or undefined from an empty list.
export const pickOne = (list, random = Math.random) =>
    list.length ? list[Math.floor(random() * list.length)] : undefined

// A round of draws: every problem of the list comes up once before any comes
// up again. `drawn` holds the keys drawn so far in the round, and the result
// holds them with the problem just drawn added. Once the list is used up, a
// new round starts with that problem alone.
export const drawFromRound = (list, drawn, random = Math.random) => {
    const fresh = list.filter((problem) => !drawn.has(problemKey(problem)))
    const problem = pickOne(fresh.length ? fresh : list, random)
    if (!problem) return { problem, drawn }
    const next = fresh.length ? new Set(drawn) : new Set()
    next.add(problemKey(problem))
    return { problem, drawn: next }
}

// The draws kept for the history list, newest first, each with the time it
// was drawn. A problem drawn again moves to the front rather than repeating.
export const HISTORY_COUNT = 20

export const addDraw = (history, problem, at) => [
    { contestId: problem.contestId, index: problem.index, name: problem.name, rating: problem.rating, at },
    ...history.filter((entry) => problemKey(entry) !== problemKey(problem)),
].slice(0, HISTORY_COUNT)

// A history read back from storage: anything that is not a draw is dropped,
// and a time that does not read as one is forgotten rather than the draw.
export const unpackHistory = (stored) => {
    if (!Array.isArray(stored)) return []
    return stored
        .filter((p) => p && Number.isFinite(p.contestId) && typeof p.index === "string" && typeof p.name === "string")
        .slice(0, HISTORY_COUNT)
        .map((p) => {
            const when = new Date(p.at).getTime()
            return {
                contestId: p.contestId,
                index: p.index,
                name: p.name,
                rating: typeof p.rating === "number" ? p.rating : undefined,
                at: Number.isFinite(when) ? when : undefined,
            }
        })
}

// The keys drawn in the current round, read back from storage.
export const unpackRound = (stored) =>
    new Set(Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : [])

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
