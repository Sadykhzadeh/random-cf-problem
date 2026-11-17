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
// adds about 70 more. Raise these only with a reason of the same kind.
const LIMITS = {
    en: { raw: 98940, gzip: 31015 },
    ru: { raw: 100735, gzip: 31611 },
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
