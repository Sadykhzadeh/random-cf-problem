import { test } from "node:test"
import assert from "node:assert/strict"

import { DEFAULTS, DIVISIONS, letters, readParams, readSetForm, readShape, writeParams } from "../modules/params.js"
import { read } from "./support/walk.js"

test("settings survive a round trip through the address", () => {
    const settings = {
        min: "1200",
        max: "1600",
        since: "2019",
        until: "2021",
        minSolved: "5000",
        divisions: ["2", "edu"],
        letters: ["A", "C"],
        tags: ["dp", "binary search"],
        mode: "any",
        nospecial: true,
        handles: "tourist, jiangly",
        tried: true,
        hide: true,
    }
    const search = writeParams(settings)
    assert.equal(search, "min=1200&max=1600&since=2019&until=2021&solved=5000&div=2,edu&letter=A,C&tags=dp,binary+search&any=1&nospecial=1&skip=tourist,+jiangly&tried=1&hide=1")
    assert.deepEqual(readParams(`?${search}`), settings)
})

test("the last year of the contests is kept beside the first", () => {
    assert.equal(writeParams({ ...DEFAULTS, until: "2021" }), "until=2021")
    assert.equal(readParams("?until=2021").until, "2021")
    for (const until of ["19", "20210", "abcd"]) assert.equal(readParams(`?until=${until}`).until, "", until)
})

test("a contest year of three digits is refused", () => {
    for (const year of ["999", "100"]) {
        assert.equal(readParams(`?since=${year}`).since, "", year)
        assert.equal(readParams(`?until=${year}`).until, "", year)
    }
})

test("an address with only handles to skip carries settings", () => {
    assert.deepEqual(readParams("?skip=tourist"), { ...DEFAULTS, handles: "tourist" })
})

test("a switch in the address is on only when it reads 1", () => {
    for (const value of ["0", "true", "yes"]) {
        assert.equal(readParams(`?nospecial=${value}&min=1200`).nospecial, false, value)
        assert.equal(readParams(`?hide=${value}&min=1200`).hide, false, value)
    }
})

test("handles to skip are read without the spaces around them", () => {
    assert.equal(readParams("?skip=%20tourist,+jiangly%20").handles, "tourist, jiangly")
    assert.equal(readParams("?skip=%20%20").handles, "")
})

test("problem letters are read from commas, spaces or a list, in capitals, once each", () => {
    assert.deepEqual(letters("b, a B  c ?"), ["A", "B", "C"])
    assert.deepEqual(letters(["d", "D"]), ["D"])
    assert.deepEqual(letters(""), [])
    assert.deepEqual(readParams("?letter=c,a,AB").letters, ["A", "C"])
    assert.equal(writeParams({ ...DEFAULTS, letters: ["a", "b"] }), "letter=A,B")
})

test("defaults are left out of the link", () => {
    assert.equal(writeParams(DEFAULTS), "")
    assert.equal(writeParams(DEFAULTS, "ru"), "lang=ru")
    assert.equal(writeParams({ ...DEFAULTS, mode: "any", tried: true }), "", "neither means anything alone")
})

test("a rating or year the form cannot read is left out of the link", () => {
    assert.equal(writeParams({ ...DEFAULTS, min: "12x", since: "20x1" }), "")
    assert.equal(writeParams(DEFAULTS, "", { form: { from: "x", to: "9x" } }), "")
})

test("an address without settings says so, and bad values are dropped", () => {
    assert.equal(readParams("?lang=ru"), null)
    assert.equal(readParams(""), null)
    assert.deepEqual(readParams("?min=abc&max=99999&tags=,dp,,&hide=yes"), {
        ...DEFAULTS,
        tags: ["dp"],
    })
    assert.equal(readParams("?min=0800").min, "800")
    for (const since of ["19", "20190", "2019.5", "abcd"]) assert.equal(readParams(`?since=${since}`).since, "")
})

test("a practice set rides along in the address without counting as a setting", () => {
    assert.equal(writeParams(DEFAULTS, "en", { set: "1520F2,4A" }), "lang=en&set=1520F2,4A")
    assert.equal(writeParams(DEFAULTS, "en", { set: "1520F2", shape: "flat" }), "lang=en&set=1520F2&shape=flat")
    assert.equal(writeParams(DEFAULTS, "en", { set: "1520F2", shape: "rising" }), "lang=en&set=1520F2", "rising is the default")
    assert.equal(readShape("?shape=flat"), "flat")
    assert.equal(readShape("?set=1520F2"), "rising")
    assert.equal(readParams("?shape=flat"), null, "the shape alone leaves the remembered settings in place")
    assert.equal(readParams("?set=1520F2,4A"), null, "the set alone leaves the remembered settings in place")
    assert.deepEqual(readParams("?set=1520F2&tags=dp").tags, ["dp"])
})

test("the practice set's form rides along in the address, and its defaults are left out", () => {
    const form = { count: "8", from: "1200", to: "1900", minutes: "45", noSeen: true }
    const search = writeParams(DEFAULTS, "en", { set: "1520F2", form })
    assert.equal(search, "lang=en&set=1520F2&count=8&from=1200&to=1900&minutes=45&noseen=1")
    assert.deepEqual(readSetForm(`?${search}`), form)
    assert.equal(readParams(`?${search}`), null, "the form alone leaves the remembered settings in place")
    assert.equal(writeParams(DEFAULTS, "en", { set: "1520F2", form: { count: "5", from: "", to: "", minutes: "", noSeen: false } }), "lang=en&set=1520F2", "five problems and the box ticked are the page's own")
    assert.deepEqual(readSetForm("?set=1520F2"), { count: "", from: "", to: "", minutes: "", noSeen: false })
})

test("the practice set's form drops what the form would not take", () => {
    assert.deepEqual(readSetForm("?count=0&from=abc&to=99999&minutes=-3&noseen=0"),
        { count: "", from: "", to: "", minutes: "", noSeen: false })
    assert.deepEqual(readSetForm("?count=20&from=0800&minutes=1000"), { count: "20", from: "800", to: "", minutes: "", noSeen: false })
    assert.equal(writeParams(DEFAULTS, "en", { form: { count: "3.5", minutes: "x" } }), "lang=en")
})

test("the divisions are kept in the order of the page, and unknown ones are dropped", () => {
    assert.deepEqual(readParams("?div=edu,3,x,3,").divisions, ["3", "edu"])
    assert.deepEqual(readParams("?div=global,1").divisions, ["1", "global"])
    assert.deepEqual(readParams("?div=").divisions, [])
    assert.equal(writeParams({ ...DEFAULTS, divisions: ["edu", "1"] }), "div=1,edu")
    assert.equal(readParams("?div=1,2") === null, false, "a link with only divisions carries settings")
})

test("leaving the topics out survives a round trip", () => {
    const settings = { ...DEFAULTS, tags: ["interactive", "geometry"], mode: "none" }
    assert.equal(writeParams(settings), "tags=interactive,geometry&none=1")
    assert.deepEqual(readParams("?tags=interactive,geometry&none=1"), settings)
    assert.equal(writeParams({ ...DEFAULTS, mode: "none" }), "", "nothing to leave out")
})

test("the problem of the day is marked in the link as daily=1", () => {
    assert.equal(writeParams(DEFAULTS, "en", { daily: true }), "lang=en&daily=1")
    assert.equal(writeParams(DEFAULTS, "en", { daily: false }), "lang=en")
})

test("a count past the form's twenty is read, so the set is clamped to twenty when it is built", () => {
    assert.equal(readSetForm("?count=100").count, "100")
    assert.equal(readSetForm("?count=1000").count, "")
    assert.equal(writeParams(DEFAULTS, "en", { form: { count: "100" } }), "lang=en&count=100")
})

test("a practice set's time limit of zero minutes is no limit", () => {
    assert.equal(readSetForm("?minutes=0").minutes, "")
    assert.equal(readSetForm("?minutes=00").minutes, "")
    assert.equal(writeParams(DEFAULTS, "en", { form: { minutes: "0" } }), "lang=en")
})

test("settings, the practice form and the shape read back from any link they are written to, over 2000 seeded cases", () => {
    let seed = 20260424
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    const below = (n) => Math.floor(random() * n)
    const pick = (list) => list[below(list.length)]
    const flag = () => random() < 0.5
    const rating = () => random() < 0.3 ? "" : String(1 + below(3800))
    const year = () => random() < 0.3 ? "" : String(1000 + below(9000))
    const TAGS = ["dp", "binary search", "2-sat", "*special"]
    const LETTERS = ["A", "B", "C", "D"]
    for (let c = 0; c < 2000; c++) {
        const tags = TAGS.filter(() => random() < 0.3)
        const handles = pick(["", "tourist", "tourist, jiangly", "a b&c"])
        const settings = {
            min: rating(), max: rating(), since: year(), until: year(),
            minSolved: random() < 0.3 ? "" : String(1 + below(1000000)),
            divisions: DIVISIONS.filter(() => random() < 0.3),
            letters: LETTERS.filter(() => random() < 0.3),
            tags,
            mode: tags.length ? pick(["all", "any", "none"]) : "all",
            nospecial: flag(), handles, tried: handles !== "" && flag(), hide: flag(),
        }
        // Five is the default count, left out of the link, so it is not drawn.
        const form = { count: pick(["", "1", "8", "20"]), from: rating(), to: rating(), minutes: pick(["", "1", "45", "600"]), noSeen: flag() }
        const shape = pick(["rising", "flat"])
        const search = writeParams(settings, pick(["", "en", "ru"]), { set: pick(["", "1520F2,4A"]), shape, form })
        assert.deepEqual(readParams(`?${search}`) ?? DEFAULTS, settings, `case ${c}: ${search}`)
        assert.deepEqual(readSetForm(`?${search}`), form, `case ${c}: ${search}`)
        assert.equal(readShape(`?${search}`), shape, `case ${c}: ${search}`)
    }
})

test("the least number of solvers is kept only when it asks for something", () => {
    assert.equal(writeParams({ ...DEFAULTS, minSolved: "2500" }), "solved=2500")
    assert.equal(writeParams({ ...DEFAULTS, minSolved: "0" }), "")
    assert.equal(readParams("?solved=02500").minSolved, "2500")
    for (const solved of ["0", "-5", "many", "12345678", "1.5"]) assert.equal(readParams(`?solved=${solved}`).minSolved, "", solved)
    assert.equal(readParams("?solved=300") === null, false, "a link with only this carries settings")
})

test("the rating ceiling of the form is the same in its fields and in the code that clamps to it", () => {
    const ceilings = [
        ...[...read("index.html").matchAll(/<input[^>]*id="(?:min_num|max_num|setFrom|setTo)"[^>]*\smax="(\d+)"/g)].map((match) => match[1]),
        read("script.js").match(/maxRaw === "" \? (\d+) :/)[1],
        read("script.js").match(/max > (\d+)\) max = /)[1],
        read("modules/practice-panel.js").match(/Math\.min\((\d+), Math\.max\(0, value\)\)/)[1],
    ]
    assert.equal(ceilings.length, 7)
    assert.deepEqual([...new Set(ceilings)], ["3800"])
})

test("each address parameter has one row in the README's table", () => {
    const names = read("README.md").split("\n")
        .filter((line) => line.startsWith("| `"))
        .flatMap((line) => line.split("|")[1].match(/`[^`]+`/g).map((name) => name.slice(1, -1)))
    assert.deepEqual(names.filter((name, i) => names.indexOf(name) !== i), [])
})

test("every parameter the page writes has a row in the README's link table", () => {
    const rows = read("README.md").split("\n").filter((line) => line.startsWith("| `"))
    const documented = rows.flatMap((line) => line.split("|")[1].match(/`[^`]+`/g).map((name) => name.slice(1, -1)))
    const written = [
        writeParams({ min: "1", max: "2", since: "2019", until: "2021", minSolved: "5", divisions: ["1"], letters: ["A"], tags: ["dp"], mode: "any", nospecial: true, handles: "tourist", tried: true, hide: true }, "ru", { set: "1520F2", shape: "flat", daily: true, form: { count: "8", from: "1", to: "2", minutes: "3", noSeen: true } }),
        writeParams({ ...DEFAULTS, tags: ["dp"], mode: "none" }),
    ].flatMap((search) => [...new URLSearchParams(search).keys()])
    assert.deepEqual([...new Set(written)].filter((name) => !documented.includes(name)), [])
})

test("the examples in the README's link table read back as the table says", () => {
    assert.deepEqual(readParams("?min=1400&max=1900"), { ...DEFAULTS, min: "1400", max: "1900" })
    const listed = readParams("?div=2,edu&letter=A,C&tags=dp,graphs&any=1")
    assert.deepEqual([listed.divisions, listed.letters, listed.tags, listed.mode], [["2", "edu"], ["A", "C"], ["dp", "graphs"], "any"])
    assert.equal(readParams("?none=1&tags=dp").mode, "none")
    assert.equal(readParams("?skip=tourist,jiangly").handles, "tourist,jiangly")
    assert.equal(readParams("?since=2019&solved=5000&hide=1").minSolved, "5000")
    assert.deepEqual(readSetForm("?count=8&from=1000&to=1600&minutes=45&noseen=1"), { count: "8", from: "1000", to: "1600", minutes: "45", noSeen: true })
    assert.equal(readShape("?shape=flat"), "flat")
    assert.equal(readParams("?tried=1&skip=tourist").tried, true)
})
