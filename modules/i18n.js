// Interface text in English and Russian. The page used to be Russian only.

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

export const strings = {
    en: {
        documentTitle: "Random Codeforces Problem",
        heading: "Random Codeforces problem",
        intro: "Pick a rating range and a topic, or just press \"Generate!\"",
        rating: "Rating",
        minRating: "Minimum rating",
        maxRating: "Maximum rating",
        topic: "Topics",
        anyTopic: "Any topic",
        modeAll: "all of them",
        modeAny: "any of them",
        clearTopics: "Clear",
        matching: "{count} problems match.",
        hideTopics: "Hide the problem's topics",
        generate: "Generate!",
        searching: "Looking for a problem...",
        loadingList: "Loading the problem list from Codeforces...",
        minAboveMax: "The minimum cannot be above the maximum.",
        noMatch: "No problem matches these settings.",
        ratingLine: "Rating: ",
        unknown: "unknown",
        solvedBy: " · solved by {count}",
        noTopics: "This problem has no topics.",
        topicsLine: "Topics: ",
        topicsHidden: "Topics are hidden :D",
        listSummary: "{count} problems in the list, updated {ago}.",
        justNow: "just now",
        refreshing: "Refreshing the problem list...",
        refresh: "Refresh",
        apiError: "Codeforces returned an error: {detail}",
        networkError: "Could not reach Codeforces. Check your connection and try again.",
        source: "Source",
    },
    ru: {
        documentTitle: "Случайная задача Codeforces",
        heading: "Случайная задача с Codeforces",
        intro: "Выберите сложность задачи, её тему. Или просто нажмите \"Сгенерировать!\"",
        rating: "Рейтинг",
        minRating: "Минимальный рейтинг",
        maxRating: "Максимальный рейтинг",
        topic: "Темы",
        anyTopic: "Любая тема",
        modeAll: "все сразу",
        modeAny: "любая из них",
        clearTopics: "Сбросить",
        matching: "Подходящих задач: {count}.",
        hideTopics: "Не показывать темы задач",
        generate: "Сгенерировать!",
        searching: "Идёт поиск задач...",
        loadingList: "Загружаю список задач с Codeforces...",
        minAboveMax: "Минимум не может быть больше максимума.",
        noMatch: "Нет задачи по Вашим параметрам.",
        ratingLine: "Рейтинг задачи: ",
        unknown: "Неизвестно",
        solvedBy: " · решили {count}",
        noTopics: "Не найдено тем этой задачи",
        topicsLine: "Темы: ",
        topicsHidden: "Темы мы не показываем :D",
        listSummary: "Задач в списке: {count}, обновлён {ago}.",
        justNow: "только что",
        refreshing: "Обновляю список задач...",
        refresh: "Обновить",
        apiError: "Codeforces вернул ошибку: {detail}",
        networkError: "Не удалось связаться с Codeforces. Проверьте соединение и попробуйте снова.",
        source: "Исходный код",
    },
}
