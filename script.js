import {
    tags,
    localize_tags
} from "./modules/tags.js"
import {
    disableAll,
    enableAll
} from "./modules/ui.js"

const byId = (id) => document.getElementById(id)

const nameEl = byId("name"),
    ratingEl = byId("rating"),
    tagsEl = byId("tags"),
    chooseEl = byId("choose")

// The option list was appended onto innerHTML, which reparses the whole
// select and pastes tag text straight into markup.
for (const tag of tags) {
    const option = document.createElement("option")
    option.value = tag.value
    option.title = tag.title
    option.textContent = `${tag.name} | ${tag.value}`
    chooseEl.append(option)
}

// problemset.problems returns the entire archive - a few megabytes - and it
// was refetched on every single click. Keyed by tag, so a second draw with the
// same filter needs no request at all.
const problemsetCache = new Map()

async function loadProblems(tag) {
    if (problemsetCache.has(tag)) return problemsetCache.get(tag)
    const response = await fetch(
        "https://codeforces.com/api/problemset.problems?tags=" + encodeURIComponent(tag))
    if (!response.ok) throw new Error("Ошибка HTTP: " + response.status)
    const json = await response.json()
    // The API answers 200 with {status: "FAILED", comment: ...}. json.result
    // was read regardless, so that ended as a TypeError on a dead page.
    if (json.status !== "OK" || !json.result || !json.result.problems) {
        throw new Error("Codeforces вернул ошибку: " + (json.comment || json.status))
    }
    problemsetCache.set(tag, json.result.problems)
    return json.result.problems
}

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
    link.textContent = problem.name
    nameEl.replaceChildren(link)

    ratingEl.textContent = "Рейтинг задачи: " +
        (problem.rating === undefined ? "Неизвестно" : problem.rating)

    if (!problem.tags.length) tagsEl.textContent = "Не найдено тем этой задачи"
    else if (showTags) {
        tagsEl.textContent = "Темы: " + problem.tags.map(localize_tags).join(", ")
    } else tagsEl.textContent = "Темы мы не показываем :D"
}

byId("start").addEventListener("click", async () => {
    disableAll()
    nameEl.textContent = "Идёт поиск задач..."
    ratingEl.textContent = "Рейтинг задачи: [загрузка]"
    tagsEl.textContent = "Темы: [загрузка]"

    // These arrived as strings and were compared against a numeric rating by
    // coercion. An empty field still means "no bound".
    const minRaw = byId("min_num").value,
        maxRaw = byId("max_num").value
    let min = minRaw === "" ? 0 : Number(minRaw),
        max = maxRaw === "" ? 3800 : Number(maxRaw)
    if (!Number.isFinite(min) || min < 0) min = 0
    if (!Number.isFinite(max) || max > 3800) max = 3800

    if (min > max) {
        nameEl.textContent = "Минимум не может быть больше максимума."
        ratingEl.textContent = "-____-"
        tagsEl.textContent = "-____-"
        enableAll()
        return
    }

    const tagValue = chooseEl.value === "Choose tag" ? "" : chooseEl.value

    try {
        const all = await loadProblems(tagValue)
        nameEl.textContent = "Осталось совсем немного..."
        const problems = all.filter((problem) =>
            typeof problem.rating === "number" &&
            min <= problem.rating && problem.rating <= max)

        if (!problems.length) {
            nameEl.textContent = "Нет задачи по Вашим параметрам."
            ratingEl.textContent = "Рейтинг задачи: :("
            tagsEl.textContent = "Темы: :("
            return
        }

        // The whole filtered list used to be run through Array#sort with a
        // side-effecting comparator, only for element [0] to be read: 225 ms
        // of blocked main thread on the 9000-entry archive to choose one
        // problem. A single random index picks just as evenly.
        const problem = problems[Math.floor(Math.random() * problems.length)]
        showProblem(problem, !byId("doNotShowTags").checked)
    } catch (error) {
        // fetch rejects outright on a network failure. Nothing caught that, so
        // the page sat on "Идёт поиск задач..." with every control disabled.
        console.error(error)
        nameEl.textContent = error.message || String(error)
        ratingEl.textContent = "Рейтинг задачи: :("
        tagsEl.textContent = "Темы: :("
    } finally {
        // enableAll() used to be the last statement of the handler, so any
        // throw on the way left the form permanently dead.
        enableAll()
    }
})
