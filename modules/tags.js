const tags = [{
        name: "2-sat",
        value: "2-sat",
        title: "2-SAT (2-satisfiability)",
        titleEn: "2-SAT (2-satisfiability)"
    },
    {
        name: "meet-in-the-middle",
        value: "meet-in-the-middle",
        title: "Meet-in-the-middle",
        titleEn: "Meet-in-the-middle"
    }, {
        name: "бинарный поиск",
        value: "binary search",
        title: "Бинарный поиск",
        titleEn: "Binary search"

    }, {
        name: "битмаски",
        value: "bitmasks",
        title: "Битовые маски",
        titleEn: "Bitmasks"
    }, {
        name: "бпф",
        value: "fft",
        title: "Быстрое преобразование Фурье",
        titleEn: "Fast Fourier transform"

    }, {
        name: "геометрия",
        value: "geometry",
        title: "Геометрия",
        titleEn: "Geometry"
    }, {
        name: "графы",
        value: "graphs",
        title: "Графы",
        titleEn: "Graphs"
    }, {
        name: "два указателя",
        value: "two pointers",
        title: "Два указателя",
        titleEn: "Two pointers"
    }, {
        name: "деревья",
        value: "trees",
        title: "Деревья",
        titleEn: "Trees"
    }, {
        name: "дп",
        value: "dp",
        title: "Динамическое программирование",
        titleEn: "Dynamic programming"

    }, {
        name: "жадные алгоритмы",
        value: "greedy",
        title: "Жадные алгоритмы",
        titleEn: "Greedy algorithms"
    }, {
        name: "игры",
        value: "games",
        title: "Игры, функция Шпрага-Гранди",
        titleEn: "Games, Sprague-Grundy theorem"
    }, {
        name: "интерактив",
        value: "interactive",
        title: "Интерактивная задача",
        titleEn: "Interactive problem"
    }, {
        name: "китайская теорема об остатках",
        value: "chinese remainder theorem",
        title: "Китайская теорема об остатках, алгоритм Гарнера",
        titleEn: "Chinese remainder theorem, Garner's algorithm"

    }, {
        name: "комбинаторика",
        value: "combinatorics",
        title: "Комбинаторика",
        titleEn: "Combinatorics"

    }, {
        name: "коммуникация",
        value: "communication",
        title: "Коммуникационная задача",
        titleEn: "Communication problem"
    }, {
        name: "конструктив",
        value: "constructive algorithms",
        title: "Конструктивные алгоритмы",
        titleEn: "Constructive algorithms"

    }, {
        name: "кратчайшие пути",
        value: "shortest paths",
        title: "Кратчайшие пути на графах",
        titleEn: "Shortest paths in graphs"

    }, {
        name: "математика",
        value: "math",
        title: "Интегрирование, диффуры и др.",
        titleEn: "Mathematics: integration, differential equations and more"

    }, {
        name: "матрицы",
        value: "matrices",
        title: "Произведение матриц, определитель, правило Крамера, системы линейных уравнений",
        titleEn: "Matrices"
    }, {
        name: "паросочетания",
        value: "graph matchings",
        title: "Паросочетания, теорема Кёнига, вершинные и реберные покрытия в двудольных графах",
        titleEn: "Graph matchings"

    }, {
        name: "перебор",
        value: "brute force",
        title: "Перебор",
        titleEn: "Brute force"

    }, {
        name: "поиск в глубину и подобное",
        value: "dfs and similar",
        title: "Поиск в глубину и подобные алгоритмы",
        titleEn: "Depth-first search and similar"
    }, {
        name: "потоки",
        value: "flows",
        title: "Потоки в графах",
        titleEn: "Network flows"
    }, {
        name: "разбор выражений",
        value: "expression parsing",
        title: "Разбор выражений",
        titleEn: "Expression parsing"

    }, {
        name: "разделяй и властвуй",
        value: "divide and conquer",
        title: "Разделяй и властвуй",
        titleEn: "Divide and conquer"

    }, {
        name: "расписания",
        value: "schedules",
        title: "Алгоритмы теории расписаний",
        titleEn: "Scheduling"
    }, {
        name: "реализация",
        value: "implementation",
        title: "Реализация, техника программирования, симуляция",
        titleEn: "Implementation"
    }, {
        name: "снм",
        value: "dsu",
        title: "Система непересекающихся множеств",
        titleEn: "Disjoint set union"
    }, {
        name: "сортировки",
        value: "sortings",
        title: "Сортировки, упорядочения",
        titleEn: "Sorting"
    }, {
        name: "строки",
        value: "strings",
        title: "Префикс- и Z-функции, суффиксные структуры, алгоритм Кнута-Морриса-Пратта и др.",
        titleEn: "Strings"

    }, {
        name: "строковые суфф.структуры",
        value: "string suffix structures",
        title: "Суффиксные массивы, деревья и автоматы",
        titleEn: "Suffix structures"

    }, {
        name: "структуры данных",
        value: "data structures",
        title: "Кучи, деревья отрезков, деревья поиска и др.",
        titleEn: "Data structures"

    }, {
        name: "теория вероятностей",
        value: "probabilities",
        title: "Вероятности, мат. ожидания, случайные величины и др.",
        titleEn: "Probabilities"

    }, {
        name: "теория чисел",
        value: "number theory",
        title: "Теория чисел: функция Эйлера, НОД, делимость и др.",
        titleEn: "Number theory"

    }, {
        name: "тернарный поиск",
        value: "ternary search",
        title: "Тернарный поиск",
        titleEn: "Ternary search"

    }, {
        name: "хэши",
        value: "hashing",
        title: "Хэши, хэш-таблицы",
        titleEn: "Hashing"

    }
]

const tagNames = new Map(tags.map((tag) => [tag.value, tag.name]))

// A value that is not in the list used to fall out of the loop and return
// undefined, which the page then rendered as "Темы: undefined". Codeforces
// adds tags over time, so that is reachable without touching this file.
// Codeforces' own tag names are English, so only Russian needs a lookup.
const localize_tags = (arg, lang = "ru") => (lang === "ru" && tagNames.get(arg)) || arg

export { tags, localize_tags }