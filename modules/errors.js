// What a failed call says on the page, and which failures a retry can
// help with. Kept off the page so it can be tested under Node.

import { fill } from "./i18n.js"
import { isTimeout } from "./problems.js"

export class HandleError extends Error {}
// The handle itself is wrong, so asking again will not help.
export class BadHandleError extends HandleError {}

// fetch rejects with a TypeError when the request never got an answer.
export const errorMessage = (error, text) =>
    isTimeout(error) ? text.timeout
        : error instanceof TypeError ? text.networkError
        : (error?.message || String(error))

// The error for a call that did not come back OK. A rate limit is told
// apart, as it passes within seconds; anything else says what Codeforces
// answered.
export const apiFailure = (status, json, text) => {
    const comment = (json && json.comment) || ""
    if (/call limit/i.test(comment) || status === 429) return new HandleError(text.rateLimited)
    return new HandleError(fill(text.apiError, { detail: comment || "HTTP " + status }))
}

// The error for a user.status call that did not come back OK. Codeforces
// says why in a comment, and the reason decides whether a retry can help.
export const handleFailure = (status, json, handle, text) => {
    const comment = (json && json.comment) || ""
    if (/not found/i.test(comment)) return new BadHandleError(fill(text.noSuchUser, { handle }))
    // A handle no user can have, such as "ab", is refused with a reason
    // like "handle: Field should contain between 3 and 24 characters".
    if (/^handle:/i.test(comment)) return new BadHandleError(fill(text.notAHandle, { handle }))
    return apiFailure(status, json, text)
}
