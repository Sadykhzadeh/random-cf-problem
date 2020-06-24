const disableAll = () => {
        document.getElementById('doNotShowTags').disabled = true
        document.getElementById("start").disabled = true
        document.getElementById("choose").disabled = true
        document.getElementById("min_num").disabled = true
        document.getElementById("max_num").disabled = true
    },
    enableAll = () => {
        document.getElementById('doNotShowTags').disabled = false
        document.getElementById("start").disabled = false
        document.getElementById("choose").disabled = false
        document.getElementById("min_num").disabled = false
        document.getElementById("max_num").disabled = false
    }

export { disableAll, enableAll }