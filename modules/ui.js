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

export { disableAll, enableAll, isDrawKey, isOpenKey }