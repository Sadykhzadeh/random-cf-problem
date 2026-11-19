import {
    startTogether
} from "./modules/startup.js"
import {
    tags,
    localize_tags
} from "./modules/tags.js"
import {
    canShare,
    createSettle,
    disableAll,
    enableAll,
    share,
    sharePayload,
    shortcutFor
} from "./modules/ui.js"
import {
    emptiedBySkips,
    isStale,
    matchingProblems,
    packProblemset,
    parseHandles,
    addDraw,
    historyMarkdown,
    markDone,
    drawFromRound,
    unpackHistory,
    unpackRound,
    problemKey,
    fetchApi,
    problemUrl,
    rankClass,
    unpackProblemset,
    unpackSaved,
    yearStart
} from "./modules/problems.js"
import {
    countText,
    fill,
    loadStrings,
    pickLanguage
} from "./modules/i18n.js"
import {
    BadHandleError,
    HandleError,
    apiFailure,
    errorMessage,
    handleFailure
} from "./modules/errors.js"
import {
    DEFAULTS,
    DIVISIONS,
    letters,
    readParams,
    readShape,
    writeParams
} from "./modules/params.js"

const byId = (id) => document.getElementById(id)

const nameEl = byId("name"),
    ratingEl = byId("rating"),
    tagsEl = byId("tags"),
    chooseEl = byId("choose")

const LANG_KEY = "random-cf-problem:lang"

function storedLanguage() {
    try {
        return localStorage.getItem(LANG_KEY)
    } catch {
        return null
    }
}

const lang = pickLanguage(window.location.search, storedLanguage(), navigator.languages ?? [])
try {
    localStorage.setItem(LANG_KEY, lang)
} catch {
    // Remembering the language is a convenience, not a requirement.
}

// The whole archive is fetched once, without a tag, and filtered here, so a
// new tag costs no request. It is kept in the Cache API (a localStorage-sized
// copy would not fit) for a day; an older copy is still used at once while a
// fresh one loads for next time. Loading starts with the page, so the first
// draw rarely waits. Codeforces names the problems in the language asked
// for, where it has a translation, so each language keeps its own copy.
const PROBLEMSET_URL = `https://codeforces.com/api/problemset.problems?lang=${lang}`
const CACHE_NAME = "random-cf-problem"
// English keeps the names its copies have always had.
const inLanguage = (name) => lang === "en" ? name : name.replace(/\.v/, `.${lang}.v`)
const CACHE_KEY = new URL(inLanguage("problemset.v1.json"), window.location.href).href
const FRESH_FOR = 24 * 60 * 60 * 1000
const RETRY_AFTER = 60 * 1000

// Codeforces asks for no more than one API call every two seconds, and
// answers "Call limit exceeded" past that. Calls from this page queue up
// to keep to it.
const API_GAP = 2000
let nextCallAt = 0

// The list starts with the page, beside the language file (see startList).
let earlyList = null
let dailyOn = new URLSearchParams(window.location.search).get("daily") === "1"

const started = startTogether({ text: () => loadStrings(lang), list: startList })
earlyList = started.list
const text = await started.text

// The page is written in English; Russian is swapped in here.
document.documentElement.lang = lang
document.title = text.documentTitle
for (const [id, key] of [
    ["heading", "heading"],
    ["rating_label", "rating"],
    ["min_num_text", "minRating"],
    ["max_num_text", "maxRating"],
    ["since_label", "since"],
    ["until_label", "until"],
    ["minSolved_label", "minSolved"],
    ["division_label", "division"],
    ["letters_label", "letters"],
    ["choose_label", "topic"],
    ["topicsSummary", "anyTopic"],
    ["modeAll", "modeAll"],
    ["modeAny", "modeAny"],
    ["modeNone", "modeNone"],
    ["clearTopics", "clearTopics"],
    ["skipSpecial_label", "skipSpecial"],
    ["handles_label", "skipLabel"],
    ["skipTried_label", "skipTried"],
    ["doNotShowTags-label", "hideTopics"],
    ["start", "generate"],
    ["refreshData", "refresh"],
    ["sourceLink", "source"],
    ["recentHeading", "recent"],
    ["copyLink", "copyLink"],
    ["clearRecent", "clearRecent"],
    ["keyHints", "keyHints"],
    ["practiceHeading", "practiceHeading"],
    ["setCount_label", "setCount"],
    ["setRange_label", "setRange"],
    ["setFrom_text", "setFrom"],
    ["setTo_text", "setTo"],
    ["setNote", "setNote"],
    ["buildSet", "buildSet"],
    ["copySetMarkdown", "copyMarkdown"],
    ["copyRecent", "copyMarkdown"],
    ["copySetLink", "copyLink"],
    ["checkSubmissions", "checkSubmissions"],
    ["useRating", "useRating"],
    ["dailyButton", "dailyButton"],
    ["dailyMark", "dailyMark"],
    ["skipSeen_label", "skipSeen"],
    ["shareLink", "share"],
    ["shareSet", "share"],
    ["setLimit_label", "setLimit"],
    ["setShape_label", "setShape"],
    ["shapeRising", "shapeRising"],
    ["shapeFlat", "shapeFlat"],
    ["startSession", "startTimer"],
]) {
    byId(id).textContent = text[key]
}
byId("copyLink").title = text.copyHint
if (!nameEl.querySelector("a")) nameEl.textContent = text.intro
byId("handles").placeholder = text.handlesPlaceholder
byId("start").title = text.generateHint
for (const link of document.querySelectorAll("#langs a[data-lang]")) {
    if (link.dataset.lang === lang) link.setAttribute("aria-current", "true")
}

// One checkbox per topic, so several can be combined. The list is in Russian
// alphabetical order; English gets its own.
const topicOrder = lang === "ru" ? tags : [...tags].sort((a, b) => a.value.localeCompare(b.value))
for (const tag of topicOrder) {
    const box = document.createElement("input")
    box.type = "checkbox"
    box.value = tag.value
    const label = document.createElement("label")
    label.className = "topic"
    label.title = lang === "ru" ? tag.title : tag.titleEn
    label.append(box, " ", lang === "ru" ? tag.name : tag.value)
    chooseEl.append(label)
}

// One checkbox per division of a round; none ticked leaves them all in.
for (const division of DIVISIONS) {
    const box = document.createElement("input")
    box.type = "checkbox"
    box.value = division
    const label = document.createElement("label")
    label.className = "topic"
    label.append(box, " ", division === "edu" ? text.educational : fill(text.divisionN, { n: division }))
    byId("divisions").append(label)
}

const chosenDivisions = () =>
    [...byId("divisions").querySelectorAll("input:checked")].map((box) => box.value)

const chosenLetters = () => letters(byId("letters").value)

const chosenTags = () =>
    [...chooseEl.querySelectorAll("input:checked")].map((box) => box.value)
const tagMode = () => byId("form").elements.mode.value

// The summary line names the chosen topics, joined by "and" or "or" as
// the mode says, or the ones left out.
function showTopicsSummary() {
    const chosen = chosenTags().map((tag) => localize_tags(tag, lang))
    const mode = tagMode()
    const list = new Intl.ListFormat(lang, { type: mode === "any" ? "disjunction" : "conjunction" }).format(chosen)
    byId("topicsSummary").textContent = !chosen.length ? text.anyTopic
        : mode === "none" ? fill(text.allBut, { topics: list })
        : list
}

byId("clearTopics").addEventListener("click", () => {
    for (const box of chooseEl.querySelectorAll("input:checked")) box.checked = false
    showTopicsSummary()
    showMatching()
    saveSettings()
})


let problemset = null
let loading = null
// A page opened again (a phone drops background tabs) shows the problem drawn
// last, once the list is in, unless a draw has started.
let drawStarted = false

function showLastDrawn(problems) {
    if (dailyOn || drawStarted || shownProblem || !recent.length) return
    const key = problemKey(recent[0])
    const last = problems.find((problem) => problemKey(problem) === key)
    if (last) showProblem(last)
}

// The name of each problem in the list, so the recent draws read in the
// page's language whichever one they were drawn in.
let namesByKey = new Map()

async function openCache() {
    try {
        // Missing outside secure contexts, and throws in some private modes.
        return await caches.open(CACHE_NAME)
    } catch {
        return null
    }
}

async function readSaved() {
    const cache = await openCache()
    if (!cache) return null
    try {
        const response = await cache.match(CACHE_KEY)
        return response ? unpackSaved(await response.json()) : null
    } catch {
        return null
    }
}


async function waitForTurn() {
    const now = Date.now()
    const at = Math.max(now, nextCallAt)
    nextCallAt = at + API_GAP
    if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now))
    return true
}

// A call refused for the rate limit takes the next turn and goes out again.
async function politeFetch(url) {
    await waitForTurn()
    return fetchApi(url, { again: waitForTurn })
}

// The saved copy, and the request when there is none or it is a day old.
async function startList() {
    const saved = await readSaved()
    const pending = !saved || isStale(saved.savedAt, Date.now(), FRESH_FOR) ? politeFetch(PROBLEMSET_URL) : null
    pending?.catch(() => {})
    return { saved, pending }
}

async function fetchProblemset(pending = politeFetch(PROBLEMSET_URL)) {
    const { response, json } = await pending
    // A failure comes as {status: "FAILED", comment: ...}, and not always
    // with an error status, so the body is checked as well.
    if (!response.ok || !json || json.status !== "OK" || !json.result || !json.result.problems) {
        throw apiFailure(response.status, json, text)
    }
    const packed = packProblemset(json.result)
    const fresh = { savedAt: Date.now(), problems: unpackProblemset(packed) }
    const cache = await openCache()
    if (cache) {
        const body = JSON.stringify({ savedAt: fresh.savedAt, problems: packed })
        cache.put(CACHE_KEY, new Response(body, { headers: { "Content-Type": "application/json" } }))
            .catch(() => {})
    }
    return fresh
}

function useProblemset(loaded) {
    problemset = loaded
    namesByKey = new Map(loaded.problems.map((problem) => [problemKey(problem), problem.name]))
    tellDivisions()
    showLastDrawn(loaded.problems)
    showDataStatus()
    showRecent()
    practice?.then((panel) => panel.render())
    // The handles can finish loading first; their count waits for the list.
    if (skipState.summaries.length) showSkipStatus()
    showMatching()
    return loaded
}

function loadProblemset({ refresh = false } = {}) {
    if (loading && !refresh) return loading
    const attempt = (async () => {
        const started = earlyList
        earlyList = null
        const { saved, pending } = !refresh && started ? await started : { saved: null, pending: undefined }
        if (!saved) return useProblemset(await fetchProblemset(pending))
        useProblemset(saved)
        if (pending) {
            listRefreshedAt = Date.now()
            fetchProblemset(pending).then(useProblemset, showListFailure)
        } else {
            refreshIfStale()
        }
        return saved
    })()
    loading = attempt
    // A failed load is not remembered, so the next draw tries again, unless a
    // newer load has started since and is still in flight.
    attempt.catch(() => {
        if (loading === attempt) loading = null
    })
    return attempt
}

// A list older than a day is replaced behind the scenes: one read from the
// cache at once, and in a tab left open that long, on the next draw. While
// Codeforces keeps failing it is asked once a minute at most.
let listRefreshedAt = 0

function refreshIfStale() {
    const now = Date.now()
    if (!problemset || !isStale(problemset.savedAt, now, FRESH_FOR) || now - listRefreshedAt < RETRY_AFTER) return
    listRefreshedAt = now
    fetchProblemset().then(useProblemset, showListFailure)
}

const errorText = (error) => errorMessage(error, text)

const statusEl = byId("dataStatus")
const ago = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })
const countFormat = new Intl.NumberFormat(lang)

function listSummary() {
    const minutes = Math.floor((Date.now() - problemset.savedAt) / 60000)
    const when = minutes < 1 ? text.justNow
        : minutes < 60 ? ago.format(-minutes, "minute")
        : minutes < 1440 ? ago.format(-Math.floor(minutes / 60), "hour")
        : ago.format(-Math.floor(minutes / 1440), "day")
    return fill(countText(text, "listSummary", problemset.problems.length, lang), { count: countFormat.format(problemset.problems.length), ago: when })
}

function showDataStatus() {
    if (!problemset) return
    byId("dataSummary").textContent = listSummary()
    statusEl.hidden = false
}

// A list that could not be loaded or renewed says so at the bottom, with
// Refresh to try again, rather than only on the console: the copy in use, if
// there is one, is shown with its age next to the reason.
function showListFailure(error) {
    console.error(error)
    byId("dataSummary").textContent = problemset ? `${errorText(error)} ${listSummary()}` : errorText(error)
    statusEl.hidden = false
}

byId("refreshData").addEventListener("click", async () => {
    const button = byId("refreshData")
    button.disabled = true
    byId("dataSummary").textContent = text.refreshing
    try {
        await loadProblemset({ refresh: true })
    } catch (error) {
        console.error(error)
        byId("dataSummary").textContent = errorText(error)
    } finally {
        button.disabled = false
    }
})

loadProblemset().catch(showListFailure)

async function showDaily() {
    dailyOn = true
    drawStarted = true
    showMessage(text.searching)
    try {
        const { todaysProblem, streakAfter } = await import("./modules/daily.js")
        await todaysProblem({
            prepare: () => readyProblems(showMessage),
            filter: readFilter,
            none: (settings) => showMessage(noneText(settings)),
            show: (problem, day) => {
                const streak = streakAfter(readStored(DAILY_KEY), day)
                saveStored(DAILY_KEY, streak)
                showProblem(problem, day, streak.count)
            },
        })
    } catch (error) {
        console.error(error)
        showMessage(errorText(error))
    } finally {
        saveSettings()
    }
}

byId("dailyButton").addEventListener("click", showDaily)

// The handle-skip code is in its own module, loaded with the first handle
// that is skipped; a visit without one never downloads it. Nothing reads
// skipLib before loadSkips has awaited it.
let skipLib = null
let skipModule = null
const loadSkipModule = () => {
    skipModule ??= import("./modules/skip.js").then((lib) => {
        skipLib = lib
        pruneSolved().catch(() => {})
        return lib
    }, (error) => {
        // A download that failed is tried again by the next call.
        skipModule = null
        throw error
    })
    return skipModule
}

// What the handles in "Skip solved by" have solved. user.status returns
// every submission a handle ever made - 3.2 MB for tourist - so only a
// summary is kept, in the Cache API next to the problemset, for ten
// minutes; an older one is used at once and refreshed behind it. The
// summary names problems as the problemset does, in the page's language.
const SOLVED_FRESH_FOR = 10 * 60 * 1000
const solvedInMemory = new Map()
// Handles being refreshed behind the scenes. Each one that finishes loads
// the handles again, and the others, still on their old copy, must not be
// fetched a second time.
const refreshingSolved = new Set()

const solvedCacheKey = (handle) =>
    new URL(`${inLanguage("solved.v3")}/${encodeURIComponent(handle.toLowerCase())}.json`, window.location.href).href

// A summary is kept while its handle is used, since each refresh restamps it,
// and for no longer than this, or beyond the newest of this many.
const SOLVED_KEPT_FOR = 30 * 24 * 60 * 60 * 1000
const SOLVED_KEPT_MAX = 20

async function savedAtOf(cache, request) {
    try {
        const response = await cache.match(request)
        const stamp = Number(response.headers.get("X-Saved-At"))
        // Summaries stored before the stamp was added carry it in the body.
        return stamp > 0 ? stamp : (await response.json()).savedAt ?? 0
    } catch {
        return 0
    }
}

// Summaries kept in an older shape are never read again, and the rest are
// pruned, so the cache does not grow with every handle ever typed.
async function pruneSolved() {
    const cache = await openCache()
    if (!cache) return
    const prefix = new URL(`${inLanguage("solved.v3")}/`, window.location.href).href
    const entries = []
    for (const request of await cache.keys()) {
        if (/\/solved\.v[12]\//.test(request.url)) cache.delete(request).catch(() => {})
        else if (request.url.startsWith(prefix)) entries.push({ request, savedAt: await savedAtOf(cache, request) })
    }
    for (const { request } of skipLib.staleSummaries(entries, Date.now(), { maxAge: SOLVED_KEPT_FOR, maxCount: SOLVED_KEPT_MAX })) {
        cache.delete(request).catch(() => {})
    }
}


async function readSolved(handle) {
    const remembered = solvedInMemory.get(handle.toLowerCase())
    if (remembered) return remembered
    const cache = await openCache()
    if (!cache) return null
    try {
        const response = await cache.match(solvedCacheKey(handle))
        const entry = response && await response.json()
        if (!entry || !Number.isFinite(entry.savedAt) || !Array.isArray(entry.summary?.solved)) return null
        // A digest that does not look like one is dropped, and everything is read next time.
        const digest = entry.digest
        const sound = Number.isFinite(digest?.cutoff) && Number.isFinite(digest.builtAt) && Number.isFinite(digest.count) &&
            ["solved", "tried", "problems", "starts"].every((field) => Array.isArray(digest.state?.[field]))
        return sound ? entry : { ...entry, digest: undefined }
    } catch {
        return null
    }
}

// `newest` asks for that many of the latest submissions rather than all of
// them: jiangly's 11000 come to 499 KB over the wire, the newest 300 to 16 KB.
async function fetchSubmissions(handle, newest) {
    const { response, json } = await politeFetch(
        `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&lang=${lang}` +
        (newest ? `&from=1&count=${newest}` : ""))
    if (!response.ok || !json || json.status !== "OK" || !Array.isArray(json.result)) {
        throw handleFailure(response.status, json, handle, text)
    }
    return json.result
}

// A summary replaced by a fresh one adds the newest submissions to what the
// older ones came to (the digest kept with it, see advance() in skip.js)
// rather than reading the whole history again. That is not possible with no
// digest, when it is a few days old, or when the newest 300 do not reach back
// to the part it has; then everything is read.
async function fetchSolved(handle, previous) {
    const now = () => Math.floor(Date.now() / 1000)
    let digest = skipLib.isUsableDigest(previous?.digest, now()) ? previous.digest : null
    let submissions = null
    if (digest) {
        const newest = await fetchSubmissions(handle, skipLib.NEWEST_COUNT)
        if (skipLib.reachesDigest(digest, newest, skipLib.NEWEST_COUNT)) submissions = newest
    }
    if (!submissions) {
        digest = skipLib.emptyDigest(now())
        submissions = await fetchSubmissions(handle)
    }
    const result = skipLib.advance(digest, submissions, now())
    const entry = { savedAt: Date.now(), summary: result.summary, digest: result.digest }
    solvedInMemory.set(handle.toLowerCase(), entry)
    const cache = await openCache()
    if (cache) {
        cache.put(solvedCacheKey(handle), new Response(JSON.stringify(entry), {
            headers: { "Content-Type": "application/json", "X-Saved-At": String(entry.savedAt) },
        })).then(pruneSolved).catch(() => {})
    }
    return entry
}

async function loadSolved(handle) {
    const saved = await readSolved(handle)
    if (!saved) return fetchSolved(handle)
    const key = handle.toLowerCase()
    solvedInMemory.set(key, saved)
    if (isStale(saved.savedAt, Date.now(), SOLVED_FRESH_FOR) && !refreshingSolved.has(key)) {
        refreshingSolved.add(key)
        fetchSolved(handle, saved).then(() => {
            if (skipState.handles.some((h) => h.toLowerCase() === key)) loadSkips()
        }, (error) => console.error(error)).finally(() => refreshingSolved.delete(key))
    }
    return saved
}

// When each contest started, so a problem solved in a parallel round is
// recognised however far apart the two are numbered (see makeSkip), and
// problems can be drawn from recent contests only. Only needed for either;
// contest.list is 410 KB of JSON, of which the start times are kept for a
// day. An older copy is used for this visit and replaced for the next one.
const CONTESTS_URL = "https://codeforces.com/api/contest.list"
const STARTS_KEY = new URL("starts.v3.json", window.location.href).href
let startsLoading = null
let contestStarts = null
// Which divisions a contest counts for depends on the problem list as well
// (see unpackContestDivisions), so they are told again when either arrives.
let packedContests = null
let divisionsOfContest = null

// The contest code is in its own module, loaded with the first contest read.
// Nothing reads it before loadContestStarts() has awaited it.
let contestsLib = null
let contestsModule = null
const loadContestsModule = () => {
    contestsModule ??= import("./modules/contests.js").then((lib) => {
        contestsLib = lib
        return lib
    })
    return contestsModule
}

function tellDivisions() {
    divisionsOfContest = packedContests && contestsLib.unpackContestDivisions(packedContests, problemset?.problems)
}
// The last failed attempt. Edits to the form do not each ask again within a
// minute of it; a draw always does.
let startsFailure = null

async function fetchContestStarts() {
    const { response, json } = await politeFetch(CONTESTS_URL)
    if (!response.ok || !json || json.status !== "OK" || !Array.isArray(json.result)) {
        throw apiFailure(response.status, json, text)
    }
    const packed = contestsLib.packContestStarts(json.result)
    const cache = await openCache()
    if (cache) {
        cache.put(STARTS_KEY, new Response(JSON.stringify({ savedAt: Date.now(), starts: packed }), {
            headers: { "Content-Type": "application/json" },
        })).catch(() => {})
    }
    packedContests = packed
    tellDivisions()
    return contestsLib.unpackContestStarts(packed)
}

function loadContestStarts() {
    if (startsLoading) return startsLoading
    startsLoading = (async () => {
        await loadContestsModule()
        const cache = await openCache()
        try {
            const response = cache && await cache.match(STARTS_KEY)
            const data = response && await response.json()
            const starts = data && contestsLib.unpackContestStarts(data.starts)
            if (starts && contestsLib.unpackContestDivisions(data.starts) && Number.isFinite(data.savedAt)) {
                packedContests = data.starts
                tellDivisions()
                if (isStale(data.savedAt, Date.now(), FRESH_FOR)) fetchContestStarts().catch((error) => console.error(error))
                return starts
            }
        } catch {
            // Unreadable; fetched again below.
        }
        return fetchContestStarts()
    })()
    // A failed load is not remembered, so the next one tries again.
    startsLoading.then((starts) => {
        contestStarts = starts
        skipPredicate = null
        if (skipState.summaries.length) showSkipStatus(), showRecent()
        showMatching()
    }, (error) => {
        startsLoading = null
        startsFailure = { error, at: Date.now() }
    })
    return startsLoading
}

let skipState = { key: "", handles: [], loaded: [], summaries: [], errors: [], retry: false, failures: 0, loadedAt: 0 }
let skipLoading = null
let skipLoadingKey = ""
let skipPredicate = null

const handlesKey = (handles) => handles.map((h) => h.toLowerCase()).join(",")

function loadSkips() {
    const { handles, dropped } = parseHandles(byId("handles").value)
    const key = handlesKey(handles)
    const status = byId("handlesStatus")
    if (handles.length) status.textContent = fill(text.loadingHandles, { handles: handles.join(", ") })
    const loadingNow = (async () => {
        if (handles.length) await loadSkipModule()
        const summaries = []
        const loaded = []
        const errors = dropped ? [text.tooManyHandles] : []
        // Set when a handle failed for a reason that may pass, such as the
        // rate limit or a lost connection, so the next draw tries it again.
        let retry = false
        for (const handle of handles) {
            try {
                summaries.push((await loadSolved(handle)).summary)
                loaded.push(handle)
            } catch (error) {
                console.error(error)
                errors.push(error instanceof HandleError ? error.message : errorText(error))
                if (!(error instanceof BadHandleError)) retry = true
            }
        }
        // Without the start times only the numbering tells parallel rounds
        // apart, which is still most of them.
        if (summaries.length) await loadContestStarts().catch((error) => console.error(error))
        // How many loads of these handles in a row have failed, so draws
        // stop waiting on a Codeforces that keeps failing.
        const failures = retry ? (skipState.key === key ? skipState.failures : 0) + 1 : 0
        return { key, handles, loaded, summaries, errors, retry, failures, loadedAt: Date.now() }
    })()
    skipLoading = loadingNow
    skipLoadingKey = key
    loadingNow.then((loaded) => {
        // A newer list of handles may have been typed in the meantime.
        if (skipLoading !== loadingNow) return
        skipState = loaded
        skipPredicate = null
        showSkipStatus()
        showMatching()
        showRecent()
    }, (error) => {
        if (skipLoading !== loadingNow) return
        skipLoading = null
        skipLoadingKey = ""
        status.textContent = errorText(error)
    })
    return loadingNow
}

function currentSkip() {
    if (!skipState.summaries.length) return undefined
    const includeTried = byId("skipTried").checked
    if (!skipPredicate || skipPredicate.includeTried !== includeTried) {
        skipPredicate = { includeTried, skip: skipLib.makeSkip(skipState.summaries, { includeTried, starts: contestStarts ?? undefined }) }
    }
    return skipPredicate.skip
}

function showSkipStatus() {
    const status = byId("handlesStatus")
    const parts = [...skipState.errors]
    const skip = currentSkip()
    if (skip && problemset) {
        const count = problemset.problems.filter(skip).length
        const tried = byId("skipTried").checked
        const template = countText(text, tried ? "skippingTried" : "skipping", count, lang)
        parts.unshift(fill(template, {
            count: countFormat.format(count),
            handles: skipState.loaded.join(", "),
        }))
    }
    status.textContent = parts.join(" ")
}

byId("handles").addEventListener("change", () => loadSkips())
byId("handles").addEventListener("input", () => practice?.then((panel) => panel.showControls()))

byId("handles").addEventListener("input", () => {
    byId("useRating").hidden = !parseHandles(byId("handles").value).handles.length
})

const ratingKey = (handle) =>
    new URL(`${inLanguage("rating.v1")}/${encodeURIComponent(handle.toLowerCase())}.json`, window.location.href).href

byId("useRating").addEventListener("click", async () => {
    const handle = parseHandles(byId("handles").value).handles[0]
    if (!handle) return
    const button = byId("useRating")
    button.disabled = true
    const lib = await loadSkipModule().catch((error) => {
        console.error(error)
        byId("handlesStatus").textContent = errorText(error)
    })
    if (lib) {
        await lib.applyRating({
            handle,
            request: politeFetch,
            cache: await openCache(),
            key: ratingKey(handle),
            failure: (response, json) => handleFailure(response.status, json, handle, text),
            text,
            setRange: (min, max) => {
                byId("min_num").value = String(min)
                byId("max_num").value = String(max)
                saveSettings()
                showMatching()
            },
            say: (message) => { byId("handlesStatus").textContent = message },
            fail: (error) => {
                console.error(error)
                byId("handlesStatus").textContent = errorText(error)
            },
        })
    }
    button.disabled = false
})
byId("setLimit").addEventListener("input", () => practice?.then((panel) => panel.showControls()))
byId("setShape").value = readShape(window.location.search)
byId("skipTried").addEventListener("change", () => {
    showSkipStatus()
})


function problemLink(problem) {
    // Built as nodes rather than markup: the name comes from the API and may
    // contain & or <.
    const link = document.createElement("a")
    link.href = problemUrl(problem)
    link.target = "_blank"
    // A _blank target without noopener hands the opened page a handle back
    // to this one.
    link.rel = "noopener noreferrer"
    link.textContent = `${problem.contestId}${problem.index}. ${problem.name}`
    // Sighted users see the new tab; a screen reader is told as well.
    const newTab = document.createElement("span")
    newTab.className = "visually-hidden"
    newTab.textContent = text.newTab
    link.append(newTab)
    return link
}

// The rating in the colour of its Codeforces rank.
function ratingBadge(problem) {
    const rating = document.createElement("span")
    rating.className = `rated ${rankClass(problem.rating)}`
    rating.textContent = problem.rating === undefined ? text.unknown : problem.rating
    return rating
}

// The problem on screen, so the topics box can show or hide its topics.
let shownProblem = null

function showTopics(problem) {
    if (!problem.tags.length) tagsEl.textContent = text.noTopics
    else if (!byId("doNotShowTags").checked) {
        tagsEl.textContent = text.topicsLine + problem.tags.map((tag) => localize_tags(tag, lang)).join(", ")
    } else tagsEl.textContent = text.topicsHidden
}

byId("doNotShowTags").addEventListener("change", () => {
    if (shownProblem) showTopics(shownProblem)
})

function showProblem(problem, day = "", streak = 0) {
    shownProblem = problem
    byId("dailyMark").textContent = day
        ? `${fill(text.dailyMark, { date: day })} · ${fill(countText(text, "dailyStreak", streak, lang), { count: countFormat.format(streak) })}`
        : ""
    byId("dailyMark").hidden = !day
    byId("copyLink").hidden = false
    byId("shareLink").hidden = !canShare(navigator)
    byId("copyStatus").textContent = ""
    const link = problemLink(problem)
    link.title = text.openHint
    link.setAttribute("aria-keyshortcuts", "o")
    nameEl.replaceChildren(link)

    // How many people solved the problem says more about it than the rating
    // alone.
    ratingEl.replaceChildren(text.ratingLine, ratingBadge(problem))
    if (problem.solvedCount !== undefined) {
        ratingEl.append(fill(countText(text, "solvedBy", problem.solvedCount, lang), { count: countFormat.format(problem.solvedCount) }))
    }

    showTopics(problem)
}

// The link goes to the clipboard. Where the clipboard API is refused or missing,
// the link is put in a hidden field, selected and copied with the copy command.
async function copyText(value) {
    try {
        await navigator.clipboard.writeText(value)
        return true
    } catch {
        // Not allowed here: the copy command below may still work.
    }
    const box = document.createElement("textarea")
    box.value = value
    box.readOnly = true
    box.style.position = "fixed"
    box.style.opacity = "0"
    document.body.append(box)
    box.select()
    let copied = false
    try {
        copied = document.execCommand("copy")
    } catch {
        // Nothing was copied.
    }
    box.remove()
    return copied
}

byId("shareLink").addEventListener("click", () => {
    if (shownProblem) share(navigator, sharePayload(problemTitle(shownProblem), problemUrl(shownProblem)))
})

function problemTitle(problem) {
    return `${problem.contestId}${problem.index}. ${problem.name}`
}

byId("copyLink").addEventListener("click", async () => {
    if (!shownProblem) return
    byId("copyStatus").textContent = await copyText(problemUrl(shownProblem)) ? text.copied : text.copyFailed
})

// The last draws, newest first, so a problem rolled past by accident can be
// found again. A round of draws (see drawFromRound) keeps the same problem
// from coming up twice until every problem the settings leave has.
const RECENT_KEY = "random-cf-problem:recent"
const DAILY_KEY = "random-cf-problem:daily"
const ROUND_KEY = "random-cf-problem:round"

// Storage that is missing or unreadable is simply no history.
function readStored(key) {
    try {
        return JSON.parse(localStorage.getItem(key))
    } catch {
        return null
    }
}

function saveStored(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // See LANG_KEY.
    }
}

let recent = unpackHistory(readStored(RECENT_KEY))
let round = unpackRound(readStored(ROUND_KEY))

const whenFormat = new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" })

// With handles to skip, the draws they have solved since are marked.
function showRecent() {
    const solved = skipState.summaries.length ? skipLib.makeSkip(skipState.summaries, { starts: contestStarts ?? undefined }) : null
    byId("recent").hidden = !recent.length
    byId("recentList").replaceChildren(...recent.map((drawn) => {
        const problem = { ...drawn, name: namesByKey.get(problemKey(drawn)) ?? drawn.name }
        const item = document.createElement("li")
        item.append(problemLink(problem), " ", ratingBadge(problem))
        if (drawn.at !== undefined) {
            const when = document.createElement("time")
            when.dateTime = new Date(drawn.at).toISOString()
            when.textContent = ` · ${whenFormat.format(drawn.at)}`
            item.append(when)
        }
        if (solved?.(problem)) {
            const mark = document.createElement("span")
            mark.className = "solved"
            mark.textContent = text.solvedMark
            item.append(mark)
        }
        const tick = document.createElement("input")
        tick.type = "checkbox"
        tick.checked = drawn.done
        tick.addEventListener("change", () => {
            recent = markDone(recent, drawn, tick.checked)
            saveStored(RECENT_KEY, recent)
        })
        const tickLabel = document.createElement("label")
        tickLabel.append(" ", tick, " ", text.solvedTick)
        item.append(tickLabel)
        return item
    }))
}

byId("copyRecent").addEventListener("click", async () => {
    byId("recentStatus").textContent = await copyText(historyMarkdown(recent)) ? text.copied : text.copyListFailed
})

byId("clearRecent").addEventListener("click", () => {
    recent = []
    round = new Set()
    saveStored(RECENT_KEY, recent)
    saveStored(ROUND_KEY, [])
    showRecent()
})

function remember(problem) {
    recent = addDraw(recent, problem, Date.now())
    saveStored(RECENT_KEY, recent)
    showRecent()
}

showRecent()

function showMessage(message) {
    shownProblem = null
    byId("dailyMark").hidden = true
    byId("copyLink").hidden = true
    byId("shareLink").hidden = true
    byId("copyStatus").textContent = ""
    nameEl.textContent = message
    ratingEl.textContent = ""
    tagsEl.textContent = ""
}

function readFilter() {
    // The fields hold strings; an empty one means "no bound".
    const minRaw = byId("min_num").value,
        maxRaw = byId("max_num").value
    let min = minRaw === "" ? 0 : Number(minRaw),
        max = maxRaw === "" ? 3800 : Number(maxRaw)
    if (!Number.isFinite(min) || min < 0) min = 0
    if (!Number.isFinite(max) || max > 3800) max = 3800
    const year = Number(byId("since").value)
    const lastYear = Number(byId("until").value)
    return {
        min,
        max,
        since: year > 0 ? yearStart(year) : undefined,
        until: lastYear > 0 ? yearStart(lastYear + 1) : undefined,
        minSolved: Number(byId("min_solved").value) || 0,
        divisions: chosenDivisions(),
        letters: chosenLetters(),
        contestDivisions: divisionsOfContest ?? undefined,
        starts: contestStarts ?? undefined,
        tags: chosenTags(),
        mode: tagMode(),
        special: !byId("skipSpecial").checked,
        skip: currentSkip(),
    }
}

// The contest dates and names are only needed to date the contests or to tell
// their divisions.
const needsContests = (filter) => filter.since !== undefined || filter.until !== undefined || filter.divisions.length > 0

// What to say when the settings leave no problem. When the handles' skips are
// what empties them, it says so, rather than blaming the settings.
function noneText(filter) {
    if (!emptiedBySkips(problemset.problems, filter)) return text.noMatch
    const handles = skipState.loaded.join(", ")
    return fill(byId("skipTried").checked ? text.allSolvedOrTried : text.allSolved, { handles })
}

// How many problems the current settings leave, kept up to date as they
// change, so an empty combination shows before anything is drawn.
// The count is shown at once but read out only once the settings settle, so
// typing a rating does not read out every digit (see createSettle).
const matchingAnnounce = createSettle((message) => {
    byId("matchingAnnounce").textContent = message
})

function showMatching() {
    const filter = readFilter()
    const matching = byId("matching")
    if (!problemset) matching.textContent = ""
    else if (filter.min > filter.max) matching.textContent = text.minAboveMax
    else if (needsContests(filter) && !contestStarts) {
        if (startsFailure && Date.now() - startsFailure.at < RETRY_AFTER) {
            matching.textContent = errorText(startsFailure.error)
        } else {
            matching.textContent = text.loadingContests
            loadContestStarts().catch((error) => {
                console.error(error)
                matching.textContent = errorText(error)
            })
        }
    } else {
        const count = matchingProblems(problemset.problems, filter).length
        matching.textContent = !count ? noneText(filter)
            : fill(countText(text, "matching", count, lang), { count: countFormat.format(count) })
    }
    matchingAnnounce.update(matching.textContent)
}

byId("form").addEventListener("input", () => {
    showTopicsSummary()
    showMatching()
    saveSettings()
})
byId("form").addEventListener("change", () => {
    matchingAnnounce.commit(byId("matching").textContent)
    saveSettings()
})
byId("form").addEventListener("focusout", () => matchingAnnounce.commit(byId("matching").textContent))

// The settings live in the address, so a link reproduces them, and in
// localStorage, so the next visit starts where this one stopped. A link's
// settings win over the remembered ones.
const SETTINGS_KEY = "random-cf-problem:settings"

function currentSettings() {
    return {
        min: byId("min_num").value,
        max: byId("max_num").value,
        since: byId("since").value,
        until: byId("until").value,
        minSolved: byId("min_solved").value,
        divisions: chosenDivisions(),
        letters: chosenLetters(),
        tags: chosenTags(),
        mode: tagMode(),
        nospecial: byId("skipSpecial").checked,
        handles: byId("handles").value,
        tried: byId("skipTried").checked,
        hide: byId("doNotShowTags").checked,
    }
}

function applySettings(settings) {
    byId("min_num").value = settings.min
    byId("max_num").value = settings.max
    byId("since").value = settings.since
    byId("until").value = settings.until
    byId("min_solved").value = settings.minSolved
    for (const box of byId("divisions").querySelectorAll("input")) box.checked = settings.divisions.includes(box.value)
    byId("letters").value = settings.letters.join(" ")
    for (const box of chooseEl.querySelectorAll("input")) box.checked = settings.tags.includes(box.value)
    byId("form").elements.mode.value = settings.mode
    byId("skipSpecial").checked = settings.nospecial
    byId("handles").value = settings.handles
    byId("skipTried").checked = settings.tried
    byId("doNotShowTags").checked = settings.hide
}

function storedSettings() {
    try {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY))
        if (!stored || typeof stored !== "object") return null
        // Anything missing or of the wrong type falls back to its default.
        const settings = { ...DEFAULTS }
        for (const [name, fallback] of Object.entries(DEFAULTS)) {
            const value = stored[name]
            if (Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback) {
                settings[name] = value
            }
        }
        return settings
    } catch {
        return null
    }
}

// Rewriting history on every keystroke gets a page throttled by the
// browser, so this waits for a pause.
let saveTimer = 0
function saveSettings() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
        const settings = currentSettings()
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
        } catch {
            // See LANG_KEY.
        }
        const practice = { set: practiceSet, shape: shapeValue(), daily: dailyOn }
        const search = writeParams(settings, lang, practice)
        history.replaceState(history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`)
        for (const link of document.querySelectorAll("#langs a[data-lang]")) {
            link.href = `?${writeParams(settings, link.dataset.lang, practice)}`
        }
    }, 250)
}

applySettings(readParams(window.location.search) ?? storedSettings() ?? DEFAULTS)
showTopicsSummary()
saveSettings()
if (byId("handles").value.trim()) loadSkips()

// On a phone the card is above the form and the button below it, so a draw
// from the button lands out of sight. Scrolled to only when it is not already
// in view.
function revealResult() {
    const card = byId("result")
    const { top, bottom } = card.getBoundingClientRect()
    if (top >= 0 && bottom <= window.innerHeight) return
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    card.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" })
}

// The list, ready to draw from: loaded if need be, with the handles' skips
// and the contest dates the settings need. `report` shows what is awaited.
async function readyProblems(report) {
    if (!problemset) report(text.loadingList)
    const { problems: all } = problemset ?? await loadProblemset()
    refreshIfStale()
    showDataStatus()
    // Handles typed but not yet loaded (Enter pressed straight from the
    // field), or that failed to load last time, are loaded before
    // drawing, so nobody gets a solved problem. When trying again fails
    // too, draws go ahead without them and try once a minute, rather
    // than each waiting up to 30 seconds for Codeforces.
    const { handles } = parseHandles(byId("handles").value)
    const key = handlesKey(handles)
    const retry = skipState.retry &&
        (skipState.failures < 2 || Date.now() - skipState.loadedAt > RETRY_AFTER)
    if (key !== skipState.key || retry) {
        report(fill(text.loadingHandles, { handles: handles.join(", ") }))
        await (key !== skipState.key && skipLoadingKey === key ? skipLoading : loadSkips())
    } else if (skipState.summaries.length && Date.now() - skipState.loadedAt > SOLVED_FRESH_FOR) {
        // In a tab left open, what the handles have solved since is
        // fetched behind this draw, in time for the next one.
        loadSkips()
    }
    // Contest dates are only fetched once a year or a division is asked for. A
    // skip that went without them retries them, and a failure does not stop the draw.
    if (needsContests(readFilter()) && !contestStarts) {
        report(text.loadingContests)
        await loadContestStarts()
    } else if (skipState.summaries.length && !contestStarts && !(startsFailure && Date.now() - startsFailure.at < RETRY_AFTER)) {
        await loadContestStarts().catch(() => {})
    }
    return all
}

// A real form, so Enter in any field draws too.
byId("form").addEventListener("submit", async (event) => {
    event.preventDefault()
    // Disabling the focused field or button drops the focus to the page
    // when the draw has to wait, so it is put back afterwards.
    const focused = document.activeElement
    drawStarted = true
    disableAll()
    showMessage(text.searching)

    if (readFilter().min > readFilter().max) {
        showMessage(text.minAboveMax)
        enableAll()
        return
    }

    try {
        const all = await readyProblems(showMessage)
        const filter = readFilter()
        const problems = matchingProblems(all, filter)

        if (!problems.length) {
            showMessage(noneText(filter))
            return
        }

        const drawn = drawFromRound(problems, round)
        round = drawn.drawn
        saveStored(ROUND_KEY, [...round])
        showProblem(drawn.problem)
        remember(drawn.problem)
        dailyOn = false
        saveSettings()
    } catch (error) {
        // fetch rejects outright on a network failure; the card says what
        // went wrong rather than staying on "Looking for a problem...".
        console.error(error)
        showMessage(errorText(error))
    } finally {
        revealResult()
        // Whatever happened on the way, the form is usable again.
        enableAll()
        if (document.activeElement === document.body) focused?.focus()
    }
})

// The practice set is built and shown by modules/practice-panel.js, which is
// loaded the first time the section is touched or the address names a set.
// Until then the set's ids are only kept, as the address has them.
let practiceSet = new URLSearchParams(window.location.search).get("set") ?? ""
let practice = null

const setLinkFor = (ids) => `${window.location.origin}${window.location.pathname}?${writeParams(DEFAULTS, lang, { set: ids, shape: shapeValue() })}`

const shapeValue = () => byId("setShape").value === "flat" ? "flat" : "rising"

const practiceHost = {
    text,
    lang,
    initialSet: practiceSet,
    problems: () => problemset?.problems ?? null,
    prepare: (report) => readyProblems(report),
    filter: () => readFilter(),
    handles: () => byId("handles").value,
    solvedByHandles: async () => skipLib.makeSkip((await loadSkips()).summaries, { starts: contestStarts ?? undefined }),
    noneText,
    problemLink,
    ratingBadge,
    copyText,
    errorText,
    setLink: setLinkFor,
    recent: () => recent,
    setChanged(ids) {
        practiceSet = ids
        saveSettings()
    },
}

function openPractice() {
    practice ??= import("./modules/practice-panel.js").then((panel) => panel.mountPractice(practiceHost))
    return practice
}

for (const type of ["pointerdown", "focusin"]) {
    byId("practice").addEventListener(type, openPractice, { once: true })
}
byId("setForm").addEventListener("submit", (event) => {
    event.preventDefault()
    openPractice().then((panel) => panel.build())
})
if (practiceSet) openPractice()

// Last, so that every binding the page can reach from here is declared.
if (dailyOn) showDaily()

// R, Space or Enter draws another problem, O opens the one on screen and C
// copies its link, from anywhere but a field being typed in (see shortcutFor).
document.addEventListener("keydown", (event) => {
    const action = shortcutFor(event)
    if (!action) return
    if (action === "draw") {
        if (byId("start").disabled) return
        event.preventDefault()
        byId("form").requestSubmit()
        return
    }
    if (!shownProblem) return
    event.preventDefault()
    if (action === "open") window.open(problemUrl(shownProblem), "_blank", "noopener,noreferrer")
    else byId("copyLink").click()
})
