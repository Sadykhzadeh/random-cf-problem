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
const codeforces = "http://codeforces.com/api/"
const func_with_tags = (arg) => `<option value="${arg.value}" title="${arg.title}">${arg.name} | ${arg.value}</option>`
let html = tags.map(qwe => func_with_tags(qwe)).join('')
document.getElementById('choose').innerHTML += html

/*
function randomInteger(min, max) {
    let rand = min + Math.random() * (max + 1 - min);
    return Math.floor(rand);
}
*/

function putToCache(elem, cache) {
    if (cache.indexOf(elem) != -1) {
        return;
    }
    cache.splice(Math.floor(Math.random() * (cache.length + 1)), 0, elem);
}

function bezumiye() {
    var cache = [];
    return function(a, b) {
        putToCache(a, cache);
        putToCache(b, cache);
        return cache.indexOf(b) - cache.indexOf(a);
    }
}

const shuffle = (arr) => arr.sort(bezumiye())

function localize_tags(arg) {
    for (let i = 0; i < tags.length - 1; i++) {
        if (tags[i].value == arg) {
            return tags[i].name;
        }
    }
}

start.onclick = async function() {
    document.getElementById("name").innerHTML = "Поиск задачи по параметрам..."
    let min_value = document.getElementById('min_num').value,
        max_value = document.getElementById('max_num').value,
        tag_value = document.getElementById('choose').value;
    if (+(min_value) < 0 || min_value == "") {
        min_value = 0;
    }
    if (+(max_value) > 3800 || max_value == "") {
        max_value = 3800;
    }
    if (+min_value > +max_value) {
        document.getElementById("name").innerHTML = ("Минимум не может быть больше максимума.")
        return ""
    }
    let json
    let tag = document.getElementById("choose").value
    let link = codeforces + "problemset.problems?tags="
    if (tag != "Choose tag") {
        link += tag;
    }
    let response = await fetch(link)
    if (response.ok) {
        json = await response.json();
        let problems = []
        for (let i = json.result.problems.length - 1; i >= 0; i--) {
            let qwe = json.result.problems[i].rating;
            if (qwe >= min_value && max_value >= qwe) {
                problems.push(json.result.problems[i])
            }
        }
        problems = shuffle(problems)
        if (!problems.length) {
            document.getElementById("user-res").innerHTML = ":(";
            document.getElementById("name").innerHTML = "Нет задачи по Вашим параметрам"
            document.getElementById("rating").innerHTML = "Рейтинг задачи: :("
            document.getElementById("points").innerHTML = "Очки: Неизвестно"
            document.getElementById("tags").innerHTML = "Темы: :("
        } else {
            let res = problems[0],
                username = document.getElementById("user").value,
                qwe = false;
            console.log(res)
            if (username) {
                link = codeforces + 'user.status?handle=' + username
                response = await fetch(link)
                json = await response.json()
                if (json.status == "OK") {
                    for (let i = 0; i < json.result; i++) {
                        if ((json.result[i].contestId) == res.contestId && json.result[i].index == res.index) {
                            qwe = true;
                            break;
                        }
                    }
                } else {
                    document.getElementById("user-res").innerHTML = response.comment;
                }
            } else {
                document.getElementById("user-res").innerHTML = "Вы не ввели свой юзернейм."
            }
            if (qwe && response.ok && username) {
                document.getElementById("user-res").innerHTML = "Вы решили эту задачу."
            } else if (response.ok && username) {
                document.getElementById("user-res").innerHTML = "Вы не решили эту задачу."
            }
            link = "https://codeforces.com/problemset/problem/" + res.contestId + "/" + res.index
            document.getElementById("name").innerHTML = `<a href="${link}"target="_blank">${res.name}</a>`
            document.getElementById("rating").innerHTML = "Рейтинг задачи: " + res.rating
            document.getElementById("points").innerHTML = "Очки: " + ((res.points != undefined) ? res.points : "Неизвестно")
            document.getElementById("tags").innerHTML = "Темы: " + res.tags.map((arg) => localize_tags(arg)).join(", ")
        }
    }
    else {
            document.getElementById("name").innerHTML = "Ошибка HTTP: " + response.status
        } 
}