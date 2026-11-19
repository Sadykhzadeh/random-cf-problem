// When each contest started and which divisions it is for. Used by the
// since and division filters and by handle skips (see makeSkip in skip.js),
// so the page loads it only when one of those is asked for (see
// loadContestStarts in script.js).

// The divisions a contest is for, as its name says: 1 to 4, "edu" for an
// Educational round, whose "Rated for Div. 2" is not a Div. 2 round, or "global"
// for a Global round, which names no division. A cup names none.
export const contestDivisions = (name) => {
    const text = String(name ?? "")
    if (/educational/i.test(text)) return ["edu"]
    const numbers = [...text.matchAll(/Div[.]?[ ]*([1-4])/gi)].map((match) => match[1])
    if (!numbers.length && /global round/i.test(text)) return ["global"]
    return [...new Set(numbers)].sort()
}

// contest.list boiled down to [contest, start time, divisions] triples, the
// divisions as its name gives them and as one string, and back to maps;
// anything that does not read back cleanly is no data at all.
export const packContestStarts = (contests) =>
    contests.filter((contest) => Number.isFinite(contest.startTimeSeconds))
        .map((contest) => [contest.id, contest.startTimeSeconds, contestDivisions(contest.name).join(",")])

// The problemset lists the problems two parallel rounds share under one of
// them only: mostly the Div. 1 round, in older rounds the Div. 2 one. That
// one holds problems of both divisions, and the other only its own. Nothing
// says which is which, but the one holding the shared problems has more of
// `problems` listed under it, so of the rounds that started together it alone
// takes the divisions of them all. When they list as many, or one lists none
// (its problems are then under a cup round the two were based on), each keeps
// the divisions of its name, as all do without `problems`.
export const unpackContestDivisions = (packed, problems = []) => {
    if (!Array.isArray(packed)) return null
    const divisions = new Map()
    const together = new Map()
    for (const item of packed) {
        if (!Array.isArray(item) || !Number.isFinite(item[0]) || typeof item[2] !== "string") return null
        const own = item[2] ? item[2].split(",") : []
        divisions.set(item[0], own)
        if (!own.length || own[0] === "edu" || own[0] === "global") continue
        if (!together.has(item[1])) together.set(item[1], [])
        together.get(item[1]).push(item[0])
    }
    const listed = new Map()
    for (const problem of problems) listed.set(problem.contestId, (listed.get(problem.contestId) ?? 0) + 1)
    for (const contests of together.values()) {
        if (contests.length < 2) continue
        const counts = contests.map((contest) => listed.get(contest) ?? 0)
        const most = Math.max(...counts)
        if (Math.min(...counts) === 0 || counts.indexOf(most) !== counts.lastIndexOf(most)) continue
        const all = contests.flatMap((contest) => divisions.get(contest))
        divisions.set(contests[counts.indexOf(most)], [...new Set(all)].sort())
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
