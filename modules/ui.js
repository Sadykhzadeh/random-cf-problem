const disableAll = () => {
        document.getElementById('doNotShowTags').disabled = true
        document.getElementById("start").disabled = true
        document.getElementById("choose").disabled = true
        document.getElementById("min_num").disabled = true
        document.getElementById("max_num").disabled = true
        document.getElementById("since").disabled = true
    },
    enableAll = () => {
        document.getElementById('doNotShowTags').disabled = false
        document.getElementById("start").disabled = false
        document.getElementById("choose").disabled = false
        document.getElementById("min_num").disabled = false
        document.getElementById("max_num").disabled = false
        document.getElementById("since").disabled = false
    }

// Whether a key press is the letter given, the one that draws again (R) or
// opens the problem (O). On a layout without Latin letters, such as Russian,
// the key where the letter sits counts: it types "к" there. On one that has
// the letter elsewhere, such as Dvorak, the letter itself does.
const isLetterKey = (letter) => (key, code) =>
    /^[a-z]$/i.test(key) ? key.toLowerCase() === letter : code === `Key${letter.toUpperCase()}`

const isDrawKey = isLetterKey("r")
const isOpenKey = isLetterKey("o")
const isCopyKey = isLetterKey("c")

// Fields take typing. A checkbox or a radio button does not.
const isTyping = (target) => target.tagName === "TEXTAREA" || target.tagName === "SELECT" ||
    target.isContentEditable === true ||
    (target.tagName === "INPUT" && target.type !== "checkbox" && target.type !== "radio")

// Space and Enter already do something on these, such as press a button or
// tick a box, so they draw only where nothing else takes them.
const TAKES_SPACE_AND_ENTER = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY", "OPTION"])

// What a key press does as a shortcut: "draw", "open", "copy", or null for
// nothing. `event` is a keydown event, or a plain description of one.
export const shortcutFor = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return null
    const target = event.target ?? {}
    if (isTyping(target)) return null
    if (isDrawKey(event.key, event.code)) return "draw"
    if (isOpenKey(event.key, event.code)) return "open"
    if (isCopyKey(event.key, event.code)) return "copy"
    const spaceOrEnter = event.key === " " || event.key === "Spacebar" || event.key === "Enter"
    return spaceOrEnter && !TAKES_SPACE_AND_ENTER.has(target.tagName) ? "draw" : null
}

export { disableAll, enableAll }
// Announces a value once it has settled. `update` waits `delay` ms after the
// last change before publishing; `commit` publishes at once, for a change or
// a blur, and drops the wait. The timers are injectable so the timing can be
// checked without waiting.
export const createSettle = (publish, { delay = 600, setTimer = setTimeout, clearTimer = clearTimeout } = {}) => {
    let timer = 0
    let latest = ""
    const flush = () => {
        clearTimer(timer)
        timer = 0
        publish(latest)
    }
    return {
        update(value) {
            latest = value
            clearTimer(timer)
            timer = setTimer(flush, delay)
        },
        commit(value) {
            latest = value
            flush()
        },
    }
}

// Whether the device has its own share sheet, given the navigator (none in
// a test, and none on a desktop browser without the feature).
export const canShare = (nav) => typeof nav?.share === "function"

// What a share sends: a title and the link. Nothing is shared without a link.
export const sharePayload = (title, url) => url ? { title: String(title ?? "").trim(), url } : null

// Hands the payload to the device's share sheet. Dismissing the sheet is not
// an error; anything else is logged.
export const share = async (nav, payload) => {
    try {
        await nav.share(payload)
    } catch (error) {
        if (error?.name !== "AbortError") console.error(error)
    }
}
