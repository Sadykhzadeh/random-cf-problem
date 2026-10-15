// The form's settings as a query string, so a link can carry them, and
// back. Settings at their defaults are left out.

export const DEFAULTS = Object.freeze({
    min: "",
    max: "",
    since: "",
    tags: [],
    mode: "all",
    nospecial: false,
    handles: "",
    tried: false,
    hide: false,
})

const KNOWN = ["min", "max", "since", "tags", "any", "none", "nospecial", "skip", "tried", "hide"]

const rating = (value) => {
    const text = String(value ?? "").trim()
    return /^\d{1,4}$/.test(text) ? String(Number(text)) : ""
}

const year = (value) => {
    const text = String(value ?? "").trim()
    return /^\d{4}$/.test(text) ? text : ""
}

// null when the address says nothing about the settings, so the caller can
// fall back to the ones remembered from last time.
export const readParams = (search) => {
    const params = new URLSearchParams(search)
    if (!KNOWN.some((name) => params.has(name))) return null
    return {
        min: rating(params.get("min")),
        max: rating(params.get("max")),
        since: year(params.get("since")),
        tags: (params.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        mode: params.get("any") === "1" ? "any" : params.get("none") === "1" ? "none" : "all",
        nospecial: params.get("nospecial") === "1",
        handles: (params.get("skip") ?? "").trim(),
        tried: params.get("tried") === "1",
        hide: params.get("hide") === "1",
    }
}

export const writeParams = (settings, lang) => {
    const params = new URLSearchParams()
    if (lang) params.set("lang", lang)
    if (rating(settings.min)) params.set("min", rating(settings.min))
    if (rating(settings.max)) params.set("max", rating(settings.max))
    if (year(settings.since)) params.set("since", year(settings.since))
    if (settings.tags?.length) params.set("tags", settings.tags.join(","))
    if (settings.mode === "any" && settings.tags?.length) params.set("any", "1")
    if (settings.mode === "none" && settings.tags?.length) params.set("none", "1")
    if (settings.nospecial) params.set("nospecial", "1")
    if (settings.handles?.trim()) params.set("skip", settings.handles.trim())
    if (settings.tried && settings.handles?.trim()) params.set("tried", "1")
    if (settings.hide) params.set("hide", "1")
    // Commas are safe in a query and far easier to read in a shared link.
    return params.toString().replace(/%2C/g, ",")
}
