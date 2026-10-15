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

// Whether a key press is R, the key that draws again. On a layout without
// Latin letters, such as Russian, the key where R sits counts: it types "к"
// there. On one that has R elsewhere, such as Dvorak, R itself does.
const isDrawKey = (key, code) =>
    /^[a-z]$/i.test(key) ? key.toLowerCase() === "r" : code === "KeyR"

export { disableAll, enableAll, isDrawKey }