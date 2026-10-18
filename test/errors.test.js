import { test } from "node:test"
import assert from "node:assert/strict"

import { BadHandleError, HandleError, errorMessage, handleFailure } from "../modules/errors.js"
import { strings } from "../modules/i18n.js"

const text = strings.en

test("a call that fails says why, with the wording for a timeout or a lost connection", () => {
    assert.equal(errorMessage(new TypeError("Failed to fetch"), text), text.networkError)
    assert.equal(errorMessage(Object.assign(new Error("aborted"), { name: "TimeoutError" }), text), text.timeout)
    assert.equal(errorMessage(new Error("Codeforces returned an error: x")), "Codeforces returned an error: x")
    assert.equal(errorMessage("plain string"), "plain string")
})

test("a handle Codeforces does not know is a bad handle, so it is not retried", () => {
    const missing = handleFailure(400, { status: "FAILED", comment: "user: User with handle tourist2 not found" }, "tourist2", text)
    assert.ok(missing instanceof BadHandleError)
    assert.equal(missing.message, text.noSuchUser.replace("{handle}", "tourist2"))

    const short = handleFailure(400, { status: "FAILED", comment: "handle: Field should contain between 3 and 24 characters" }, "ab", text)
    assert.ok(short instanceof BadHandleError)
    assert.equal(short.message, text.notAHandle.replace("{handle}", "ab"))
})

test("a rate limit is retried; any other failure says what Codeforces answered", () => {
    const limited = handleFailure(200, { status: "FAILED", comment: "Call limit exceeded" }, "tourist", text)
    assert.ok(limited instanceof HandleError)
    assert.ok(!(limited instanceof BadHandleError))
    assert.equal(limited.message, text.rateLimited)

    assert.equal(handleFailure(429, null, "tourist", text).message, text.rateLimited, "an HTTP 429 with no body")

    const other = handleFailure(500, { status: "FAILED", comment: "internal error" }, "tourist", text)
    assert.ok(other instanceof HandleError)
    assert.ok(!(other instanceof BadHandleError))
    assert.equal(other.message, text.apiError.replace("{detail}", "internal error"))

    assert.equal(handleFailure(503, null, "tourist", text).message, text.apiError.replace("{detail}", "HTTP 503"))
})
