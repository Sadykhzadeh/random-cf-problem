// The practice set on the page: built, listed, ticked, copied. Loaded the first
// time the practice section is touched or the address names a set, so a visit
// that does not use it does not download it. `host` is the page's own functions
// and strings (see script.js), passed in so this file can stay off the page's
// critical path.

import {
    MAX_SET,
    acceptedOf,
    buildLadder,
    decodeSet,
    doneOf,
    encodeSet,
    idKey,
    mergeTicks,
    resolveSet,
    setMarkdown,
    ticksOf,
    unpackTicks,
    withTicks,
} from "./practice.js"
import { matchingProblems } from "./problems.js"
import { fill } from "./i18n.js"

const byId = (id) => document.getElementById(id)

const TICKS_KEY = "random-cf-problem:ticks"

// Ticks are kept in localStorage; when it is missing or unreadable there are
// none, and a tick made then is simply not remembered.
function readTicks() {
    try {
        return unpackTicks(JSON.parse(localStorage.getItem(TICKS_KEY)))
    } catch {
        return []
    }
}

function writeTicks(entries) {
    try {
        localStorage.setItem(TICKS_KEY, JSON.stringify(entries))
    } catch {
        // Remembering the ticks is a convenience, not a requirement.
    }
}

const ratingField = (id, fallback) => {
    const raw = byId(id).value
    const value = raw === "" ? fallback : Number(raw)
    return Number.isFinite(value) ? Math.min(3800, Math.max(0, value)) : fallback
}

export const mountPractice = (host) => {
    const { text } = host
    let setIds = decodeSet(host.initialSet)
    let setFound = []
    let done = []

    // The set's key in the ticks is its address form, so the same set has
    // the same ticks however it was opened.
    const remember = (next) => {
        done = next
        writeTicks(withTicks(readTicks(), encodeSet(setIds), done, Date.now()))
    }

    // The check is offered only with handles to check.
    function showChecks() {
        byId("checkSubmissions").hidden = !setFound.length || !host.handles().trim()
    }

    function showProgress() {
        const ticked = doneOf(setFound, done).length
        byId("setProgress").textContent = setFound.length
            ? fill(text.progress, { done: ticked, total: setFound.length })
            : ""
    }

    // The set on screen, with what it says about itself: its size, unless a
    // note replaces that, and how many of its problems the list no longer has.
    function render(note) {
        const list = host.problems()
        const { found, missing } = list ? resolveSet(list, setIds) : { found: [], missing: [] }
        setFound = found
        done = ticksOf(readTicks(), encodeSet(setIds))
        byId("setList").replaceChildren(...found.map((problem) => {
            const item = document.createElement("li")
            const box = document.createElement("input")
            box.type = "checkbox"
            box.checked = done.includes(idKey(problem))
            box.setAttribute("aria-label", fill(text.doneBox, { name: `${problem.contestId}${problem.index}. ${problem.name}` }))
            box.addEventListener("change", () => {
                remember(box.checked
                    ? mergeTicks(done, [idKey(problem)])
                    : done.filter((key) => key !== idKey(problem)))
                showProgress()
            })
            item.append(box, " ", host.problemLink(problem), " ", host.ratingBadge(problem))
            return item
        }))
        byId("setActions").hidden = !found.length
        showChecks()
        const headline = note ?? (found.length ? fill(text.setCountText, { count: found.length }) : "")
        const lost = missing.length ? fill(text.setMissing, { count: missing.length }) : ""
        byId("setStatus").textContent = [headline, lost].filter(Boolean).join(" ")
        showProgress()
    }

    async function build() {
        const count = Math.min(MAX_SET, Math.max(1, Math.floor(Number(byId("setCount").value)) || 5))
        const from = ratingField("setFrom", 800)
        const to = ratingField("setTo", 2000)
        if (from > to) {
            byId("setStatus").textContent = text.minAboveMax
            return
        }
        // Disabling the button drops the focus to the page, so it is put back.
        const focused = document.activeElement
        const button = byId("buildSet")
        button.disabled = true
        try {
            const all = await host.prepare((message) => { byId("setStatus").textContent = message })
            // The other settings of the form apply: topics, divisions, special
            // rounds and the handles' skips. Only the ends of the ladder are its own.
            const filter = { ...host.filter(), min: from, max: to }
            const picked = buildLadder(matchingProblems(all, filter), count, from, to)
            if (picked.length) {
                setIds = picked
                render(picked.length < count ? fill(text.setShort, { count: picked.length, wanted: count }) : undefined)
            } else {
                setIds = []
                render(host.noneText(filter))
            }
            host.setChanged(encodeSet(setIds))
        } catch (error) {
            console.error(error)
            byId("setStatus").textContent = host.errorText(error)
        } finally {
            button.disabled = false
            if (document.activeElement === document.body) focused?.focus()
        }
    }

    // What the handles have solved is read as for a draw, and the set's
    // problems among them are ticked.
    byId("checkSubmissions").addEventListener("click", async () => {
        const button = byId("checkSubmissions")
        button.disabled = true
        try {
            const accepted = acceptedOf(setFound, await host.solvedByHandles())
            remember(mergeTicks(done, accepted))
            render(fill(text.checkedAccepted, { count: accepted.length }))
        } catch (error) {
            console.error(error)
            byId("setStatus").textContent = host.errorText(error)
        } finally {
            button.disabled = false
        }
    })

    byId("copySetMarkdown").addEventListener("click", async () => {
        if (!setFound.length) return
        byId("setStatus").textContent = await host.copyText(setMarkdown(setFound)) ? text.copied : text.copyFailed
    })

    byId("copySetLink").addEventListener("click", async () => {
        byId("setStatus").textContent = await host.copyText(host.setLink(encodeSet(setIds))) ? text.copied : text.copyFailed
    })

    render()
    return { build, render, showChecks }
}
