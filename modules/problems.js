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

// Rated problems within [min, max] that carry the tag, if one is given.
// Unrated problems are left out: there is no telling whether they fit.
export const matchingProblems = (problems, { min = 0, max = Infinity, tag = "" } = {}) =>
    problems.filter((problem) =>
        typeof problem.rating === "number" &&
        min <= problem.rating && problem.rating <= max &&
        (!tag || problem.tags.includes(tag)))

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

export const pickOne = (list, random = Math.random) =>
    list.length ? list[Math.floor(random() * list.length)] : undefined
