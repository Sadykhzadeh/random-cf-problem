import {
    tags,
    localize_tags
} from "./modules/tags.js"
import {
    disableAll,
    enableAll
} from "./modules/ui.js"
import {
    makeSkip,
    matchingProblems,
    packProblemset,
    parseHandles,
    pickOne,
    problemKey,
    isTimeout,
    REQUEST_TIMEOUT_MS,
    rankClass,
    summarizeSubmissions,
    unpackProblemset
} from "./modules/problems.js"
import {
    fill,
    pickLanguage,
    strings
} from "./modules/i18n.js"
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
    ["choose_label", "topic"],
    ["topicsSummary", "anyTopic"],
    ["modeAll", "modeAll"],
    ["modeAny", "modeAny"],
    ["clearTopics", "clearTopics"],
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
// the mode says.
function showTopicsSummary() {
    const chosen = chosenTags().map((tag) => localize_tags(tag, lang))
    const type = tagMode() === "any" ? "disjunction" : "conjunction"
    byId("topicsSummary").textContent = chosen.length
        ? new Intl.ListFormat(lang, { type }).format(chosen)
        : text.anyTopic
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
// draw rarely waits.
const PROBLEMSET_URL = "https://codeforces.com/api/problemset.problems"
const CACHE_NAME = "random-cf-problem"
const CACHE_KEY = new URL("problemset.v1.json", window.location.href).href
const FRESH_FOR = 24 * 60 * 60 * 1000

let problemset = null
let loading = null

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
    // The API answers 200 with {status: "FAILED", comment: ...}. json.result
    // was read regardless, so that ended as a TypeError on a dead page.
    if (!response.ok || !json || json.status !== "OK" || !json.result || !json.result.problems) {
        throw new Error(fill(text.apiError, { detail: (json && json.comment) || "HTTP " + response.status }))
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
    showDataStatus()
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
        if (Date.now() - saved.savedAt > FRESH_FOR) {
            fetchProblemset().then(useProblemset, (error) => console.error(error))
        }
        return useProblemset(saved)
    })()
    // A failed load is not remembered, so the next draw tries again.
    loading.catch(() => {
        loading = null
    })
    return loading
}

// fetch rejects with a TypeError when the request never got an answer.
const errorText = (error) =>
    isTimeout(error) ? text.timeout
        : error instanceof TypeError ? text.networkError
        : (error.message || String(error))

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
// minutes; an older one is used at once and refreshed behind it.
const SOLVED_FRESH_FOR = 10 * 60 * 1000
const solvedInMemory = new Map()

class HandleError extends Error {}
class NoSuchUserError extends HandleError {}

const solvedCacheKey = (handle) =>
    new URL(`solved.v1/${encodeURIComponent(handle.toLowerCase())}.json`, window.location.href).href

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
        `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`)
    const json = await response.json().catch(() => null)
    if (!response.ok || !json || json.status !== "OK" || !Array.isArray(json.result)) {
        const comment = (json && json.comment) || ""
        if (/not found/i.test(comment)) throw new NoSuchUserError(fill(text.noSuchUser, { handle }))
        if (/call limit/i.test(comment) || response.status === 429) throw new HandleError(text.rateLimited)
        throw new HandleError(fill(text.apiError, { detail: comment || "HTTP " + response.status }))
    }
    const entry = { savedAt: Date.now(), summary: summarizeSubmissions(json.result) }
    solvedInMemory.set(handle.toLowerCase(), entry)
    const cache = await openCache()
    if (cache) {
        cache.put(solvedCacheKey(handle), new Response(JSON.stringify(entry), {
            headers: { "Content-Type": "application/json" },
        })).catch(() => {})
    }
    return entry
}

async function loadSolved(handle) {
    const saved = await readSolved(handle)
    if (!saved) return fetchSolved(handle)
    solvedInMemory.set(handle.toLowerCase(), saved)
    if (Date.now() - saved.savedAt > SOLVED_FRESH_FOR) {
        fetchSolved(handle).then(() => {
            if (skipState.handles.some((h) => h.toLowerCase() === handle.toLowerCase())) loadSkips()
        }, (error) => console.error(error))
    }
    return saved
}

let skipState = { key: "", handles: [], loaded: [], summaries: [], errors: [], retry: false }
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
                if (!(error instanceof NoSuchUserError)) retry = true
            }
        }
        return { key, handles, loaded, summaries, errors, retry }
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
    })
    return loadingNow
}

function currentSkip() {
    if (!skipState.summaries.length) return undefined
    const includeTried = byId("skipTried").checked
    if (!skipPredicate || skipPredicate.includeTried !== includeTried) {
        skipPredicate = { includeTried, skip: makeSkip(skipState.summaries, { includeTried }) }
    }
    return skipPredicate.skip
}

function showSkipStatus() {
    const status = byId("handlesStatus")
    const parts = [...skipState.errors]
    const skip = currentSkip()
    if (skip && problemset) {
        const count = problemset.problems.filter(skip).length
        parts.unshift(fill(byId("skipTried").checked ? text.skippingTried : text.skipping, {
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
    // Built as nodes instead of an innerHTML string: the name comes from the
    // API and may contain & or <, which used to land in markup as-is.
    const link = document.createElement("a")
    link.href =
        `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
    link.target = "_blank"
    // The old markup read `"target="_blank"` with no space before the
    // attribute, and carried no rel - a _blank target without noopener hands
    // the opened page a handle back to this one.
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

function showProblem(problem, showTags) {
    nameEl.replaceChildren(problemLink(problem))

    // How many people solved the problem says more about it than the rating
    // alone.
    ratingEl.replaceChildren(text.ratingLine, ratingBadge(problem))
    if (problem.solvedCount !== undefined) {
        ratingEl.append(fill(text.solvedBy, { count: countFormat.format(problem.solvedCount) }))
    }

    if (!problem.tags.length) tagsEl.textContent = text.noTopics
    else if (showTags) {
        tagsEl.textContent = text.topicsLine + problem.tags.map((tag) => localize_tags(tag, lang)).join(", ")
    } else tagsEl.textContent = text.topicsHidden
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

function showRecent() {
    byId("recent").hidden = !recent.length
    byId("recentList").replaceChildren(...recent.map((problem) => {
        const item = document.createElement("li")
        item.append(problemLink(problem), " ", ratingBadge(problem))
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
    nameEl.textContent = message
    ratingEl.textContent = ""
    tagsEl.textContent = ""
}

function readFilter() {
    // These arrived as strings and were compared against a numeric rating by
    // coercion. An empty field still means "no bound".
    const minRaw = byId("min_num").value,
        maxRaw = byId("max_num").value
    let min = minRaw === "" ? 0 : Number(minRaw),
        max = maxRaw === "" ? 3800 : Number(maxRaw)
    if (!Number.isFinite(min) || min < 0) min = 0
    if (!Number.isFinite(max) || max > 3800) max = 3800
    return { min, max, tags: chosenTags(), mode: tagMode(), skip: currentSkip() }
}

// How many problems the current settings leave, kept up to date as they
// change, so an empty combination shows before anything is drawn.
function showMatching() {
    const filter = readFilter()
    const matching = byId("matching")
    if (!problemset) matching.textContent = ""
    else if (filter.min > filter.max) matching.textContent = text.minAboveMax
    else {
        const count = matchingProblems(problemset.problems, filter).length
        matching.textContent = count ? fill(text.matching, { count: countFormat.format(count) }) : text.noMatch
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
        tags: chosenTags(),
        mode: tagMode(),
        handles: byId("handles").value,
        tried: byId("skipTried").checked,
        hide: byId("doNotShowTags").checked,
    }
}

function applySettings(settings) {
    byId("min_num").value = settings.min
    byId("max_num").value = settings.max
    for (const box of chooseEl.querySelectorAll("input")) box.checked = settings.tags.includes(box.value)
    byId("form").elements.mode.value = settings.mode
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
        const search = writeParams(settings)
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
        // Handles typed but not yet loaded (Enter pressed straight from the
        // field), or that failed to load last time, are loaded before
        // drawing, so nobody gets a solved problem.
        const { handles } = parseHandles(byId("handles").value)
        const key = handlesKey(handles)
        if (key !== skipState.key || skipState.retry) {
            showMessage(fill(text.loadingHandles, { handles: handles.join(", ") }))
            await (key !== skipState.key && skipLoadingKey === key ? skipLoading : loadSkips())
        }
        const problems = matchingProblems(all, readFilter())

        if (!problems.length) {
            showMessage(text.noMatch)
            return
        }

        // The whole filtered list used to be run through Array#sort with a
        // side-effecting comparator, only for element [0] to be read: 225 ms
        // of blocked main thread on the 9000-entry archive to choose one
        // problem. A single random index picks just as evenly.
        const problem = pickOne(problems, Math.random, new Set(recent.map(problemKey)))
        showProblem(problem, !byId("doNotShowTags").checked)
        remember(problem)
    } catch (error) {
        // fetch rejects outright on a network failure. Nothing caught that, so
        // the page sat on "Идёт поиск задач..." with every control disabled.
        console.error(error)
        showMessage(errorText(error))
    } finally {
        // enableAll() used to be the last statement of the handler, so any
        // throw on the way left the form permanently dead.
        enableAll()
    }
})

// R draws another problem from anywhere but a field being typed in.
document.addEventListener("keydown", (event) => {
    if (event.key !== "r" && event.key !== "R") return
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
    const target = event.target
    if (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio") return
    if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return
    if (byId("start").disabled) return
    event.preventDefault()
    byId("form").requestSubmit()
})
