import {
    tags,
    localize_tags
} from "./modules/tags.js"
import {
    disableAll,
    enableAll
} from "./modules/ui.js"
import {
    matchingProblems,
    packProblemset,
    pickOne,
    rankClass,
    unpackProblemset
} from "./modules/problems.js"
import {
    fill,
    pickLanguage,
    strings
} from "./modules/i18n.js"

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
    ["choose-child", "anyTopic"],
    ["doNotShowTags-label", "hideTopics"],
    ["start", "generate"],
    ["refreshData", "refresh"],
    ["sourceLink", "source"],
]) {
    byId(id).textContent = text[key]
}
if (!nameEl.querySelector("a")) nameEl.textContent = text.intro
for (const link of document.querySelectorAll("#langs a[data-lang]")) {
    if (link.dataset.lang === lang) link.setAttribute("aria-current", "true")
}

// The option list was appended onto innerHTML, which reparses the whole
// select and pastes tag text straight into markup.
for (const tag of tags) {
    const option = document.createElement("option")
    option.value = tag.value
    option.title = lang === "ru" ? tag.title : tag.titleEn
    option.textContent = lang === "ru" ? `${tag.name} | ${tag.value}` : tag.value
    chooseEl.append(option)
}

// The whole archive is fetched once, without a tag, and filtered here: every
// new tag used to cost another request and every visit started from nothing.
// It is kept in the Cache API (a localStorage-sized copy would not fit) for a
// day; an older copy is still used at once while a fresh one loads for next
// time. Loading starts with the page, so the first draw rarely waits.
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

async function fetchProblemset() {
    const response = await fetch(PROBLEMSET_URL)
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
    error instanceof TypeError ? text.networkError : (error.message || String(error))

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

function showProblem(problem, showTags) {
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
    nameEl.replaceChildren(link)

    // The rating in the colour of its Codeforces rank, and how many people
    // solved the problem, which says more about it than the rating alone.
    const rating = document.createElement("span")
    rating.className = `rated ${rankClass(problem.rating)}`
    rating.textContent = problem.rating === undefined ? text.unknown : problem.rating
    ratingEl.replaceChildren(text.ratingLine, rating)
    if (problem.solvedCount !== undefined) {
        ratingEl.append(fill(text.solvedBy, { count: countFormat.format(problem.solvedCount) }))
    }

    if (!problem.tags.length) tagsEl.textContent = text.noTopics
    else if (showTags) {
        tagsEl.textContent = text.topicsLine + problem.tags.map((tag) => localize_tags(tag, lang)).join(", ")
    } else tagsEl.textContent = text.topicsHidden
}

function showMessage(message) {
    nameEl.textContent = message
    ratingEl.textContent = ""
    tagsEl.textContent = ""
}

// A real form, so Enter in any field draws too.
byId("form").addEventListener("submit", async (event) => {
    event.preventDefault()
    disableAll()
    showMessage(text.searching)

    // These arrived as strings and were compared against a numeric rating by
    // coercion. An empty field still means "no bound".
    const minRaw = byId("min_num").value,
        maxRaw = byId("max_num").value
    let min = minRaw === "" ? 0 : Number(minRaw),
        max = maxRaw === "" ? 3800 : Number(maxRaw)
    if (!Number.isFinite(min) || min < 0) min = 0
    if (!Number.isFinite(max) || max > 3800) max = 3800

    if (min > max) {
        showMessage(text.minAboveMax)
        enableAll()
        return
    }

    const tagValue = chooseEl.value

    try {
        if (!problemset) showMessage(text.loadingList)
        const { problems: all } = problemset ?? await loadProblemset()
        const problems = matchingProblems(all, { min, max, tag: tagValue })

        if (!problems.length) {
            showMessage(text.noMatch)
            return
        }

        // The whole filtered list used to be run through Array#sort with a
        // side-effecting comparator, only for element [0] to be read: 225 ms
        // of blocked main thread on the 9000-entry archive to choose one
        // problem. A single random index picks just as evenly.
        showProblem(pickOne(problems), !byId("doNotShowTags").checked)
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
