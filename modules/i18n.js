// Interface text in English and Russian.

export const LANGUAGES = ["en", "ru"]

// A ?lang= in the address wins, then the choice remembered from last time,
// then the browser's own preference; English for anyone else.
export const pickLanguage = (search, stored, preferred = []) => {
    const fromUrl = new URLSearchParams(search).get("lang")
    if (LANGUAGES.includes(fromUrl)) return fromUrl
    if (LANGUAGES.includes(stored)) return stored
    for (const tag of preferred) {
        const base = String(tag).toLowerCase().split("-")[0]
        if (LANGUAGES.includes(base)) return base
    }
    return "en"
}

export const fill = (template, values) =>
    template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match)

// The text for a count: `key` with the suffix of the count's form ("One" for 1,
// and in Russian "Few" for 2 to 4 except 12 to 14, where the noun takes another
// ending), or the bare key when the language has no such form.
export const countText = (strings, key, count, lang) => {
    let form = ""
    if (lang === "ru") {
        const rest = count % 100
        if (rest < 11 || rest > 19) {
            if (count % 10 === 1) form = "One"
            else if (count % 10 >= 2 && count % 10 <= 4) form = "Few"
        }
    } else if (count === 1) {
        form = "One"
    }
    return strings[key + form] ?? strings[key]
}


// The interface text for `lang`. Each language is a module of its own, so a
// visit fetches only the language it reads.
export const loadStrings = (lang) =>
    import(lang === "ru" ? "./strings-ru.js" : "./strings-en.js").then((module) => module.default)
