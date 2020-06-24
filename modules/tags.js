const tags = [{
        name: "2-sat",
        value: "2 - sat",
        title: "2-SAT (2-satisfiability)"
    },
    {
        name: "meet-in-the-middle",
        value: "meet-in-the-middle",
        title: "Meet-in-the-middle"
    }, {
        name: "бинарный поиск",
        value: "binary search",
        title: "Бинарный поиск"

    }, {
        name: "битмаски",
        value: "bitmasks",
        title: "Битовые маски"
    }, {
        name: "бпф",
        value: "fft",
        title: "Быстрое преобразование Фурье"

    }, {
        name: "геометрия",
        value: "geometry",
        title: "Геометрия"
    }, {
        name: "графы",
        value: "graphs",
        title: "Графы"
    }, {
        name: "два указателя",
        value: "two pointers",
        title: "Два указателя"
    }, {
        name: "деревья",
        value: "trees",
        title: "Деревья"
    }, {
        name: "дп",
        value: "dp",
        title: "Динамическое программирование"

    }, {
        name: "жадные алгоритмы",
        value: "greedy",
        title: "Жадные алгоритмы"
    }, {
        name: "игры",
        value: "games",
        title: "Игры, функция Шпрага-Гранди"
    }, {
        name: "интерактив",
        value: "interactive",
        title: "Интерактивная задача"
    }, {
        name: "китайская теорема об остатках",
        value: "chinese remainder theorem",
        title: "Китайская теорема об остатках, алгоритм Гарнера"

    }, {
        name: "комбинаторика",
        value: "combinatorics",
        title: "Комбинаторика"

    }, {
        name: "конструктив",
        value: "constructive algorithms",
        title: "Конструктивные алгоритмы"

    }, {
        name: "кратчайшие пути",
        value: "shortest paths",
        title: "Кратчайшие пути на графах"

    }, {
        name: "математика",
        value: "math",
        title: "Интегрирование, диффуры и др."

    }, {
        name: "матрицы",
        value: "matrices",
        title: "Произведение матриц, определитель, правило Крамера, системы линейных уравнений"
    }, {
        name: "паросочетания",
        value: "graph matchings",
        title: "Паросочетания, теорема Кёнига, вершинные и реберные покрытия в двудольных графах"

    }, {
        name: "перебор",
        value: "brute force",
        title: "Перебор"

    }, {
        name: "поиск в глубину и подобное",
        value: "dfs and similar ",
        title: "Поиск в глубину и подобные алгоритмы"
    }, {
        name: "потоки",
        value: "flows",
        title: "Потоки в графах"
    }, {
        name: "разбор выражений",
        value: "expression parsing",
        title: "Разбор выражений"

    }, {
        name: "разделяй и властвуй",
        value: "divide and conquer",
        title: "Разделяй и властвуй"

    }, {
        name: "расписания",
        value: "schedules",
        title: "Алгоритмы теории расписаний"
    }, {
        name: "реализация",
        value: "implementation",
        title: "Реализация, техника программирования, симуляция"
    }, {
        name: "снм",
        value: "dsu",
        title: "Система непересекающихся множеств"
    }, {
        name: "сортировки",
        value: "sortings",
        title: "Сортировки, упорядочения"
    }, {
        name: "строки",
        value: "strings",
        title: "Префикс- и Z-функции, суффиксные структуры, алгоритм Кнута-Морриса-Пратта и др."

    }, {
        name: "строковые суфф.структуры",
        value: "string suffix structures",
        title: "Суффиксные массивы, деревья и автоматы"

    }, {
        name: "структуры данных",
        value: "data structures",
        title: "Кучи, деревья отрезков, деревья поиска и др."

    }, {
        name: "теория вероятностей",
        value: "probabilities",
        title: "Вероятности, мат. ожидания, случайные величины и др."

    }, {
        name: "теория чисел",
        value: "number theory",
        title: "Теория чисел: функция Эйлера, НОД, делимость и др."

    }, {
        name: "тернарный поиск",
        value: "ternary search",
        title: "Тернарный поиск"

    }, {
        name: "хэши",
        value: "hashing",
        title: "Хэши, хэш-таблицы"

    }
]

let localize_tags = (arg) => {
    for (let i = 0; i < tags.length - 1; i++) {
        if (tags[i].value == arg) {
            return tags[i].name
        }
    }
}

export { tags, localize_tags }