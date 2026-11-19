// The practice set on the page: built, listed, ticked, copied. Loaded the first
// time the practice section is touched or the address names a set, so a visit
// that does not use it does not download it. `host` is the page's own functions
// and strings (see script.js), passed in so this file can stay off the page's
// critical path.

import {
    MAX_SET,
    acceptedOf,
    buildFlat,
    buildLadder,
    clockText,
    decodeSet,
    doneOf,
    encodeSet,
    followSession,
    idKey,
    mergeTicks,
    newSession,
    pickSession,
    replacementOf,
    resolveSet,
    sessionLength,
    setMarkdown,
    ticksOf,
    unpackTicks,
    unseenOf,
    moveTicks,
    withTicks,
} from "./practice.js"
import { matchingProblems, parseHandles } from "./problems.js"
import { countText, fill } from "./i18n.js"
import { canShare, share, sharePayload } from "./ui.js"
import { practiceMessages } from "./practice-strings.js"

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

const everyTick = () => readTicks().flatMap((entry) => entry.done)

function writeTicks(entries) {
    try {
        localStorage.setItem(TICKS_KEY, JSON.stringify(entries))
    } catch {
        // Remembering the ticks is a convenience, not a requirement.
    }
}

const SESSION_KEY = "random-cf-problem:session"

// A timed session is kept as its deadline, so it survives a reload. Only one
// is kept, for the set it was started on.
function readSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
        return null
    }
}

function writeSession(session) {
    try {
        if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        else localStorage.removeItem(SESSION_KEY)
    } catch {
        // Without storage a session lasts for this visit only.
    }
}

const ratingField = (id, fallback) => {
    const raw = byId(id).value
    const value = raw === "" ? fallback : Number(raw)
    return Number.isFinite(value) ? Math.min(3800, Math.max(0, value)) : fallback
}

export const mountPractice = (host) => {
    const { text } = host
    const messages = practiceMessages[host.lang] ?? practiceMessages.en
    let setIds = decodeSet(host.initialSet)
    let setFound = []
    let done = []
    // The timer shows the session of the set on screen, and runs only while
    // there is one; `stopTimer` stops the one running.
    let stopTimer = null
    let timedKey = null

    // The set's key in the ticks is its address form, so the same set has
    // the same ticks however it was opened.
    const remember = (next) => {
        done = next
        writeTicks(withTicks(readTicks(), encodeSet(setIds), done, Date.now()))
    }

    // The check is offered only with handles to check, and the timer only with
    // a limit to time by.
    function showControls() {
        byId("checkSubmissions").hidden = !setFound.length || !parseHandles(host.handles()).handles.length
        byId("startSession").hidden = sessionLength(byId("setLimit").value) === null
        byId("shareSet").hidden = !setFound.length || !canShare(navigator)
        byId("sessionLine").hidden = !setFound.length
    }

    const notice = { five: "fiveLeft", one: "oneLeft", end: "timeUp" }

    function follow(session) {
        stopTimer?.()
        timedKey = session.key
        stopTimer = followSession(session, {
            now: Date.now,
            schedule: (fn, ms) => setInterval(fn, ms),
            unschedule: clearInterval,
            // The clock is not a live region: it changes every second. Only the
            // moments that are reached are read out, once each.
            show: (left) => { byId("sessionClock").textContent = fill(messages.timeLeft, { clock: clockText(left) }) },
            announce: (mark) => {
                byId("sessionStatus").textContent = messages[notice[mark]]
                writeSession(session)
            },
        })
        writeSession(session)
    }

    // The session of the set on screen goes on where it was, if it has not
    // been dropped; a session for another set is forgotten.
    function resumeSession() {
        const key = encodeSet(setIds)
        const stored = readSession()
        const session = pickSession(stored, key)
        if (!session) {
            stopTimer?.()
            stopTimer = null
            timedKey = null
            byId("sessionClock").textContent = ""
            if (stored) writeSession(null)
            return
        }
        if (timedKey !== key) follow(session)
    }

    function showProgress() {
        const ticked = doneOf(setFound, done).length
        byId("setProgress").textContent = setFound.length
            ? fill(messages.progress, { done: ticked, total: setFound.length })
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
            const label = `${problem.contestId}${problem.index}. ${problem.name}`
            const box = document.createElement("input")
            box.type = "checkbox"
            box.checked = done.includes(idKey(problem))
            box.setAttribute("aria-label", fill(messages.doneBox, { name: label }))
            box.addEventListener("change", () => {
                remember(box.checked
                    ? mergeTicks(done, [idKey(problem)])
                    : done.filter((key) => key !== idKey(problem)))
                showProgress()
            })
            const swap = document.createElement("button")
            swap.type = "button"
            swap.textContent = messages.replace
            swap.setAttribute("aria-label", fill(messages.replaceBox, { name: label }))
            swap.addEventListener("click", () => swapOut(problem, swap))
            item.append(box, " ", host.problemLink(problem), " ", host.ratingBadge(problem), " ", swap)
            return item
        }))
        byId("setActions").hidden = !found.length
        showControls()
        resumeSession()
        const headline = note ?? (found.length ? fill(countText(messages, "setCountText", found.length, host.lang), { count: found.length }) : "")
        const lost = missing.length ? fill(countText(messages, "setMissing", missing.length, host.lang), { count: missing.length }) : ""
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
            const flat = byId("setShape").value === "flat"
            const matching = matchingProblems(all, filter)
            const skipping = byId("skipSeen").checked
            const pool = skipping ? unseenOf(matching, { drawn: host.recent(), done: everyTick() }) : matching
            const picked = flat ? buildFlat(pool, count) : buildLadder(pool, count, from, to)
            if (picked.length) {
                setIds = picked
                const short = picked.length < count
                    ? fill(countText(messages, flat ? "setShortFlat" : "setShort", picked.length, host.lang), { count: picked.length, wanted: count })
                    : undefined
                render(short)
            } else {
                setIds = []
                render(skipping && matching.length ? messages.allSeen : host.noneText(filter))
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

    // Puts another problem in the place of `problem`: the nearest rating the set
    // does not have, from the same settings as the set. The ticks and the timer
    // move to the set's new address with it.
    async function swapOut(problem, button) {
        button.disabled = true
        try {
            const all = await host.prepare((message) => { byId("setStatus").textContent = message })
            const filter = { ...host.filter(), min: ratingField("setFrom", 800), max: ratingField("setTo", 2000) }
            const matching = matchingProblems(all, filter)
            const pool = byId("skipSeen").checked ? unseenOf(matching, { drawn: host.recent(), done: everyTick() }) : matching
            const next = replacementOf(pool, setFound, problem)
            if (!next) {
                byId("setStatus").textContent = messages.noReplacement
                return
            }
            const oldKey = encodeSet(setIds)
            setIds = setIds.map((id) => idKey(id) === idKey(problem) ? next : id)
            writeTicks(moveTicks(readTicks(), oldKey, encodeSet(setIds), idKey(problem), Date.now()))
            const session = pickSession(readSession(), oldKey)
            if (session) writeSession({ ...session, key: encodeSet(setIds) })
            host.setChanged(encodeSet(setIds))
            render(fill(messages.replaced, { from: idKey(problem), to: idKey(next) }))
            const row = setFound.findIndex((found) => idKey(found) === idKey(next))
            byId("setList").children[row]?.querySelector("button")?.focus()
        } catch (error) {
            console.error(error)
            byId("setStatus").textContent = host.errorText(error)
        } finally {
            button.disabled = false
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
            render(fill(countText(messages, "checkedAccepted", accepted.length, host.lang), { count: accepted.length }))
        } catch (error) {
            console.error(error)
            byId("setStatus").textContent = host.errorText(error)
        } finally {
            button.disabled = false
        }
    })

    byId("shareSet").addEventListener("click", () => {
        share(navigator, sharePayload(text.practiceHeading, host.setLink(encodeSet(setIds))))
    })

    byId("copySetMarkdown").addEventListener("click", async () => {
        if (!setFound.length) return
        byId("setStatus").textContent = await host.copyText(setMarkdown(setFound, done)) ? text.copied : text.copyListFailed
    })

    byId("copySetLink").addEventListener("click", async () => {
        byId("setStatus").textContent = await host.copyText(host.setLink(encodeSet(setIds))) ? text.copied : text.copyFailed
    })

    byId("startSession").addEventListener("click", () => {
        const minutes = sessionLength(byId("setLimit").value)
        if (minutes === null) {
            byId("setStatus").textContent = messages.badLimit
            return
        }
        const session = newSession(encodeSet(setIds), Date.now(), minutes)
        writeSession(session)
        byId("sessionStatus").textContent = fill(messages.timerStarted, { minutes })
        follow(session)
    })

    render()
    return { build, render, showControls }
}
