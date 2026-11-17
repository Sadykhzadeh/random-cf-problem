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
