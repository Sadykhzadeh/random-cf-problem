import {
    tags,
    localize_tags
} from "./modules/tags.js"
import {
    disableAll,
    enableAll,
    isDrawKey
} from "./modules/ui.js"
import {
    isStale,
    makeSkip,
    matchingProblems,
    packContestStarts,
    packProblemset,
    parseHandles,
    pickOne,
    problemKey,
    REQUEST_TIMEOUT_MS,
    rankClass,
    staleSummaries,
    summarizeSubmissions,
    unpackContestStarts,
    unpackProblemset,
    yearStart
} from "./modules/problems.js"
import {
    fill,
    pickLanguage,
    strings
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
    readParams,
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
const text = strings[lang]

try {
    localStorage.setItem(LANG_KEY, lang)
} catch {
    // Remembering the language is a convenience, not a requirement.
}

// The page is written in English; Russian is swapped in here.
document.documentElement.lang = lang
document.title = text.documentTitle
for (const [id, key] of [
    ["heading", "heading"],
    ["rating_label", "rating"],
    ["min_num_text", "minRating"],
    ["max_num_text", "maxRating"],
    ["since_label", "since"],
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
]) {
    byId(id).textContent = text[key]
}
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

let problemset = null
let loading = null
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
        if (!response) return null
        const data = await response.json()
        const problems = unpackProblemset(data.problems)
        return problems && Number.isFinite(data.savedAt) ? { savedAt: data.savedAt, problems } : null
    } catch {
        return null
    }
}

// Codeforces asks for no more than one API call every two seconds, and
// answers "Call limit exceeded" past that. Calls from this page queue up
// to keep to it.
const API_GAP = 2000
let nextCallAt = 0

async function politeFetch(url) {
    const now = Date.now()
    const at = Math.max(now, nextCallAt)
    nextCallAt = at + API_GAP
    if (at > now) await new Promise((resolve) => setTimeout(resolve, at - now))
    return fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
}

async function fetchProblemset() {
    const response = await politeFetch(PROBLEMSET_URL)
    const json = await response.json().catch(() => null)
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
    showDataStatus()
    showRecent()
    // The handles can finish loading first; their count waits for the list.
    if (skipState.summaries.length) showSkipStatus()
    showMatching()
    return loaded
}

function loadProblemset({ refresh = false } = {}) {
    if (loading && !refresh) return loading
    loading = (async () => {
        const saved = refresh ? null : await readSaved()
        if (!saved) return useProblemset(await fetchProblemset())
        useProblemset(saved)
        refreshIfStale()
        return saved
    })()
    // A failed load is not remembered, so the next draw tries again.
    loading.catch(() => {
        loading = null
    })
    return loading
}

// A list older than a day is replaced behind the scenes: one read from the
// cache at once, and in a tab left open that long, on the next draw. While
// Codeforces keeps failing it is asked once a minute at most.
let listRefreshedAt = 0

function refreshIfStale() {
    const now = Date.now()
    if (!problemset || !isStale(problemset.savedAt, now, FRESH_FOR) || now - listRefreshedAt < RETRY_AFTER) return
    listRefreshedAt = now
    fetchProblemset().then(useProblemset, (error) => console.error(error))
}

const errorText = (error) => errorMessage(error, text)

const statusEl = byId("dataStatus")
const ago = new Intl.RelativeTimeFormat(lang, { numeric: "auto" })
const countFormat = new Intl.NumberFormat(lang)

function showDataStatus() {
    if (!problemset) return
    const minutes = Math.floor((Date.now() - problemset.savedAt) / 60000)
    const when = minutes < 1 ? text.justNow
        : minutes < 60 ? ago.format(-minutes, "minute")
        : minutes < 1440 ? ago.format(-Math.floor(minutes / 60), "hour")
        : ago.format(-Math.floor(minutes / 1440), "day")
    byId("dataSummary").textContent =
        fill(text.listSummary, { count: countFormat.format(problemset.problems.length), ago: when })
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

loadProblemset().catch((error) => console.error(error))

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
    for (const { request } of staleSummaries(entries, Date.now(), { maxAge: SOLVED_KEPT_FOR, maxCount: SOLVED_KEPT_MAX })) {
        cache.delete(request).catch(() => {})
    }
}

pruneSolved().catch(() => {})

async function readSolved(handle) {
    const remembered = solvedInMemory.get(handle.toLowerCase())
    if (remembered) return remembered
    const cache = await openCache()
    if (!cache) return null
    try {
        const response = await cache.match(solvedCacheKey(handle))
        const entry = response && await response.json()
        return entry && Number.isFinite(entry.savedAt) && Array.isArray(entry.summary?.solved) ? entry : null
    } catch {
        return null
    }
}

async function fetchSolved(handle) {
    const response = await politeFetch(
        `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&lang=${lang}`)
    const json = await response.json().catch(() => null)
    if (!response.ok || !json || json.status !== "OK" || !Array.isArray(json.result)) {
        throw handleFailure(response.status, json, handle, text)
    }
    const entry = { savedAt: Date.now(), summary: summarizeSubmissions(json.result) }
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
        fetchSolved(handle).then(() => {
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
const STARTS_KEY = new URL("starts.v1.json", window.location.href).href
let startsLoading = null
let contestStarts = null
// The last failed attempt. Edits to the form do not each ask again within a
// minute of it; a draw always does.
let startsFailure = null

async function fetchContestStarts() {
    const response = await politeFetch(CONTESTS_URL)
    const json = await response.json().catch(() => null)
    if (!response.ok || !json || json.status !== "OK" || !Array.isArray(json.result)) {
        throw apiFailure(response.status, json, text)
    }
    const packed = packContestStarts(json.result)
    const cache = await openCache()
    if (cache) {
        cache.put(STARTS_KEY, new Response(JSON.stringify({ savedAt: Date.now(), starts: packed }), {
            headers: { "Content-Type": "application/json" },
        })).catch(() => {})
    }
    return unpackContestStarts(packed)
}

function loadContestStarts() {
    if (startsLoading) return startsLoading
    startsLoading = (async () => {
        const cache = await openCache()
        try {
            const response = cache && await cache.match(STARTS_KEY)
            const data = response && await response.json()
            const starts = data && unpackContestStarts(data.starts)
            if (starts && Number.isFinite(data.savedAt)) {
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
        const starts = summaries.length
            ? await loadContestStarts().catch((error) => console.error(error))
            : undefined
        // How many loads of these handles in a row have failed, so draws
        // stop waiting on a Codeforces that keeps failing.
        const failures = retry ? (skipState.key === key ? skipState.failures : 0) + 1 : 0
        return { key, handles, loaded, summaries, errors, retry, starts, failures, loadedAt: Date.now() }
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
    })
    return loadingNow
}

function currentSkip() {
    if (!skipState.summaries.length) return undefined
    const includeTried = byId("skipTried").checked
    if (!skipPredicate || skipPredicate.includeTried !== includeTried) {
        skipPredicate = { includeTried, skip: makeSkip(skipState.summaries, { includeTried, starts: skipState.starts }) }
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
        const template = count === 1 ? (tried ? text.skippingTriedOne : text.skippingOne)
            : (tried ? text.skippingTried : text.skipping)
        parts.unshift(fill(template, {
            count: countFormat.format(count),
            handles: skipState.loaded.join(", "),
        }))
    }
    status.textContent = parts.join(" ")
}

byId("handles").addEventListener("change", () => loadSkips())
byId("skipTried").addEventListener("change", () => {
    showSkipStatus()
})


function problemLink(problem) {
    // Built as nodes rather than markup: the name comes from the API and may
    // contain & or <.
    const link = document.createElement("a")
    link.href =
        `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
    link.target = "_blank"
    // A _blank target without noopener hands the opened page a handle back
    // to this one.
    link.rel = "noopener noreferrer"
    link.textContent = `${problem.contestId}${problem.index}. ${problem.name}`
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

function showProblem(problem) {
    shownProblem = problem
    nameEl.replaceChildren(problemLink(problem))

    // How many people solved the problem says more about it than the rating
    // alone.
    ratingEl.replaceChildren(text.ratingLine, ratingBadge(problem))
    if (problem.solvedCount !== undefined) {
        ratingEl.append(fill(text.solvedBy, { count: countFormat.format(problem.solvedCount) }))
    }

    showTopics(problem)
}

// The last few draws, newest first, so a problem rolled past by accident
// can be found again. They are also passed over by the next draws while
// anything else matches, so a small pool does not keep repeating itself.
const RECENT_KEY = "random-cf-problem:recent"
const RECENT_COUNT = 10

function readRecent() {
    try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY))
        return Array.isArray(stored)
            ? stored.filter((p) => p && Number.isFinite(p.contestId) && typeof p.index === "string" &&
                typeof p.name === "string").slice(0, RECENT_COUNT)
            : []
    } catch {
        return []
    }
}

let recent = readRecent()

// With handles to skip, the draws they have solved since are marked.
function showRecent() {
    const solved = skipState.summaries.length ? makeSkip(skipState.summaries, { starts: skipState.starts }) : null
    byId("recent").hidden = !recent.length
    byId("recentList").replaceChildren(...recent.map((drawn) => {
        const problem = { ...drawn, name: namesByKey.get(problemKey(drawn)) ?? drawn.name }
        const item = document.createElement("li")
        item.append(problemLink(problem), " ", ratingBadge(problem))
        if (solved?.(problem)) {
            const mark = document.createElement("span")
            mark.className = "solved"
            mark.textContent = text.solvedMark
            item.append(mark)
        }
        return item
    }))
}

function remember(problem) {
    const { contestId, index, name, rating } = problem
    recent = [{ contestId, index, name, rating },
        ...recent.filter((p) => problemKey(p) !== problemKey(problem))].slice(0, RECENT_COUNT)
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    } catch {
        // See LANG_KEY.
    }
    showRecent()
}

showRecent()

function showMessage(message) {
    shownProblem = null
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
    return {
        min,
        max,
        since: year > 0 ? yearStart(year) : undefined,
        starts: contestStarts ?? undefined,
        tags: chosenTags(),
        mode: tagMode(),
        special: !byId("skipSpecial").checked,
        skip: currentSkip(),
    }
}

// How many problems the current settings leave, kept up to date as they
// change, so an empty combination shows before anything is drawn.
function showMatching() {
    const filter = readFilter()
    const matching = byId("matching")
    if (!problemset) matching.textContent = ""
    else if (filter.min > filter.max) matching.textContent = text.minAboveMax
    else if (filter.since !== undefined && !contestStarts) {
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
        matching.textContent = !count ? text.noMatch
            : fill(count === 1 ? text.matchingOne : text.matching, { count: countFormat.format(count) })
    }
}

byId("form").addEventListener("input", () => {
    showTopicsSummary()
    showMatching()
    saveSettings()
})
byId("form").addEventListener("change", () => saveSettings())

// The settings live in the address, so a link reproduces them, and in
// localStorage, so the next visit starts where this one stopped. A link's
// settings win over the remembered ones.
const SETTINGS_KEY = "random-cf-problem:settings"

function currentSettings() {
    return {
        min: byId("min_num").value,
        max: byId("max_num").value,
        since: byId("since").value,
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
        const search = writeParams(settings, lang)
        history.replaceState(history.state, "", `${window.location.pathname}${search ? `?${search}` : ""}`)
        for (const link of document.querySelectorAll("#langs a[data-lang]")) {
            link.href = `?${writeParams(settings, link.dataset.lang)}`
        }
    }, 250)
}

applySettings(readParams(window.location.search) ?? storedSettings() ?? DEFAULTS)
showTopicsSummary()
saveSettings()
if (byId("handles").value.trim()) loadSkips()

// A real form, so Enter in any field draws too.
byId("form").addEventListener("submit", async (event) => {
    event.preventDefault()
    // Disabling the focused field or button drops the focus to the page
    // when the draw has to wait, so it is put back afterwards.
    const focused = document.activeElement
    disableAll()
    showMessage(text.searching)

    if (readFilter().min > readFilter().max) {
        showMessage(text.minAboveMax)
        enableAll()
        return
    }

    try {
        if (!problemset) showMessage(text.loadingList)
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
            showMessage(fill(text.loadingHandles, { handles: handles.join(", ") }))
            await (key !== skipState.key && skipLoadingKey === key ? skipLoading : loadSkips())
        } else if (skipState.summaries.length && Date.now() - skipState.loadedAt > SOLVED_FRESH_FOR) {
            // In a tab left open, what the handles have solved since is
            // fetched behind this draw, in time for the next one.
            loadSkips()
        }
        // Contest dates are only fetched once a year is asked for.
        if (readFilter().since !== undefined && !contestStarts) {
            showMessage(text.loadingContests)
            await loadContestStarts()
        }
        const problems = matchingProblems(all, readFilter())

        if (!problems.length) {
            showMessage(text.noMatch)
            return
        }

        const problem = pickOne(problems, Math.random, new Set(recent.map(problemKey)))
        showProblem(problem)
        remember(problem)
    } catch (error) {
        // fetch rejects outright on a network failure; the card says what
        // went wrong rather than staying on "Looking for a problem...".
        console.error(error)
        showMessage(errorText(error))
    } finally {
        // Whatever happened on the way, the form is usable again.
        enableAll()
        if (document.activeElement === document.body) focused?.focus()
    }
})

// R draws another problem from anywhere but a field being typed in.
document.addEventListener("keydown", (event) => {
    if (!isDrawKey(event.key, event.code)) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    const target = event.target
    if (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio") return
    if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return
    if (byId("start").disabled) return
    event.preventDefault()
    byId("form").requestSubmit()
})
