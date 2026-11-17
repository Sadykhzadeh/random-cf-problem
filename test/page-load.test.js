import { test } from "node:test"
import assert from "node:assert/strict"

// Loads script.js the way a browser does, against a small stub of the page, and
// asserts that the start of the page throws nothing. A call made at the top of
// the script that reaches a binding declared further down fails here with a
// temporal-dead-zone error, as it would in a browser, without one.

const problemset = {
    status: "OK",
    result: {
        problems: [
            { contestId: 4, index: "A", name: "Watermelon", rating: 800, tags: ["math"] },
            { contestId: 10, index: "B", name: "Mid", rating: 1500, tags: ["dp"] },
            { contestId: 1520, index: "F2", name: "Guess", rating: 2200, tags: ["binary search"] },
        ],
        problemStatistics: [],
    },
}

const elements = new Map()

// Any element: properties are kept as set, and anything else answers with a
// harmless default, so the script's DOM use does not need a real page.
const makeElement = (id) => {
    const own = {
        id, value: "", checked: false, hidden: false, disabled: false, textContent: "", title: "", type: "",
        placeholder: "", min: "", max: "", style: {}, dataset: {}, options: [],
        elements: { mode: { value: "all" } },
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    }
    return new Proxy(own, {
        get(target, key) {
            if (key in target || typeof key === "symbol" || key === "then") return target[key]
            if (key === "querySelector") return () => null
            if (key === "replaceChildren") return (...nodes) => { target.children = nodes }
            if (key === "querySelectorAll") return () => []
            return () => undefined
        },
        set(target, key, value) {
            target[key] = value
            return true
        },
    })
}

const byId = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id))
    return elements.get(id)
}

const installStubs = (search, remembered = {}) => {
    const location = { search, href: `http://localhost/${search}`, origin: "http://localhost", pathname: "/" }
    const store = new Map(Object.entries(remembered))
    const set = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    set("window", globalThis)
    set("location", location)
    set("navigator", { languages: ["en-US"] })
    set("localStorage", {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
    })
    set("history", { state: null, replaceState() {} })
    set("matchMedia", () => ({ matches: false }))
    set("document", {
        getElementById: byId,
        createElement: () => makeElement(""),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        documentElement: makeElement("html"),
        body: makeElement("body"),
        activeElement: makeElement("body"),
    })
    set("fetch", async (url) => {
        const answer = String(url).includes("problemset.problems") ? problemset : { status: "FAILED", comment: "stub" }
        return new Response(JSON.stringify(answer), { status: answer.status === "OK" ? 200 : 400 })
    })
}

// Loads the page at `search` and lets its first loads settle. Returns what the
// load raised: unhandled rejections, and console errors. Each load gets a URL
// of its own, since a module is evaluated once per URL.
let loads = 0
const loadPage = async (search, remembered = {}) => {
    elements.clear()
    installStubs(search, remembered)
    const page = `${search}${search ? "&" : "?"}run=${loads++}`
    const raised = []
    const logged = []
    const onRejection = (error) => raised.push(error)
    const logError = console.error
    process.on("unhandledRejection", onRejection)
    console.error = (...args) => logged.push(args.map(String).join(" "))
    try {
        await import(`../script.js?page=${encodeURIComponent(page)}`)
        await new Promise((resolve) => setTimeout(resolve, 300))
    } finally {
        process.off("unhandledRejection", onRejection)
        console.error = logError
    }
    return { raised, logged }
}

const isScriptError = (text) => /before initialization|is not defined|is not a function|Cannot read/.test(text)

for (const search of ["", "?daily=1", "?lang=en&daily=1", "?set=1520F2,4A", "?skip=tourist"]) {
    test(`the page starts without an error at "${search || "/"}"`, async () => {
        const { raised, logged } = await loadPage(search)
        assert.deepEqual(raised.map(String), [], "no unhandled rejection")
        assert.deepEqual(logged.filter(isScriptError), [], "no error from the script")
    })
}

test("a visit with saved draws shows the last one again, once the list is in", async () => {
    const recent = JSON.stringify([{ contestId: 10, index: "B", name: "Mid", rating: 1500, at: 1 }])
    const { raised, logged } = await loadPage("", { "random-cf-problem:recent": recent })
    assert.deepEqual(raised.map(String), [])
    assert.deepEqual(logged.filter(isScriptError), [])
    const [link] = byId("name").children ?? []
    assert.match(String(link?.textContent), /Mid/, "the card shows the last draw")
})

test("a link with daily=1 shows the problem of the day, marked with its date", async () => {
    await loadPage("?daily=1")
    assert.equal(byId("dailyMark").hidden, false)
    assert.match(byId("dailyMark").textContent, /^Today's problem, \d{4}-\d{2}-\d{2}$/)
})
