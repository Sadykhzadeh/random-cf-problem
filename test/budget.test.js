import { test } from "node:test"
import assert from "node:assert/strict"
import { gzipSync } from "node:zlib"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { firstLoad, root } from "./support/walk.js"

// The first visit's weight, measured with gzip at level 9 per file: the page,
// its stylesheet, its script, the modules the script imports statically, and
// the one language file the visit reads. A larger first load fails here and
// has to be argued for. The limits are the final round-4 figures. Round 4 put
// on the first load the parallel startup (startup.js and its wiring), the
// "Use my rating" button, the problem-of-the-day link and the history
// checkbox, with their markup and strings: about 4.7 KB raw and 1.2 KB gzip
// over the round-3 first visit, mostly the rating and daily wiring. The
// parallel-round skip that picks up the contest start times once a failed
// fetch of them succeeds adds about 270 bytes raw and 40 gzip on top, and the
// practice set's check of submissions reads the same skip adds about 20 more
// raw. The draw's retry of those dates, at most once a minute while they fail,
// adds about 70 more. The skip module's failed download, which is tried again
// by the next call, and the status and button that say so add about 510 raw and
// 90 gzip. The count forms (countText and the One and Few strings of counts in
// Russian, where a noun takes three endings) add about 670 raw and 260 gzip in
// English and 1,250 raw and 340 gzip in Russian. The problem letter filter (its
// field and strings, the parsing in params.js and the match) adds about 1.3 KB
// raw and 320 gzip to both. The contests-until field (its field, strings, the
// filter and the parsing) adds about 1 KB raw and 180 gzip to both. The daily
// streak (its line in the script and its strings; the counting is in daily.js,
// which loads with the button) adds about 450 raw and 150 gzip in English and
// 540 raw and 170 gzip in Russian. The solved tick in the drawn-lately list (a
// box and its label for each draw, and markDone) adds about 1 KB raw and 270
// gzip to both. The copy of the drawn-lately list as Markdown (its button and
// status, the wiring and historyMarkdown) adds about 750 raw and 250 gzip. The
// practice set's form in the address (the four fields and the skip box, read
// and written in params.js, with their listeners) adds about 2 KB raw and 490
// gzip to both. The practice set's check of submissions, which now reports a
// handle that is not found rather than ticking nothing, adds about 150 raw and
// 35 gzip to the script. The time-limit label and the Share button take their
// text from the language files, which the two strings add to by about 60 raw
// in English and 90 raw in Russian. The Remove button on each draw of the
// drawn-lately list, with its handler and its string, adds about 560 raw and 120
// gzip in English and 570 raw and 130 gzip in Russian. The Content-Security-Policy
// meta in index.html adds about 260 raw and 80 gzip to both. The overflow-wrap on
// the drawn name and the two lists, so a name without a space breaks at a phone
// width instead of widening the page, adds about 130 raw and 30 gzip to both.
// Keeping the keyboard focus on the drawn-lately list after a Remove (the draw
// that moves into the place of the removed one, or Generate) adds about 450 raw
// and 140 gzip to both. The name in the Remove button and the Solved box of each
// draw (their labels in the language files, and the labels set in showRecent)
// adds about 270 raw and 60 gzip to both. Raise these only with a reason of the
// same kind.
const LIMITS = {
    en: { raw: 108820, gzip: 33620 },
    ru: { raw: 111380, gzip: 34350 },
}

const firstVisit = (language) => {
    const files = ["index.html", "styles/styles.css", "script.js", ...firstLoad("script.js"), `modules/strings-${language}.js`]
    let raw = 0
    let gzip = 0
    for (const file of files) {
        const bytes = readFileSync(join(root, file))
        raw += bytes.length
        gzip += gzipSync(bytes, { level: 9 }).length
    }
    return { raw, gzip, files }
}

for (const language of ["en", "ru"]) {
    test(`the first visit in ${language} stays within its byte budget`, () => {
        const visit = firstVisit(language)
        assert.ok(visit.files.includes(`modules/strings-${language}.js`))
        assert.ok(visit.raw <= LIMITS[language].raw, `raw ${visit.raw} over ${LIMITS[language].raw}`)
        assert.ok(visit.gzip <= LIMITS[language].gzip, `gzip ${visit.gzip} over ${LIMITS[language].gzip}`)
    })
}

test("the budget counts the files the first visit reads and no others", () => {
    const visit = firstVisit("en")
    assert.ok(!visit.files.includes("modules/strings-ru.js"))
    assert.ok(!visit.files.some((file) => /practice-panel|practice\.js|skip\.js|contests\.js/.test(file)))
})
