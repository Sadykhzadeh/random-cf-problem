import {tags, codeforces} from "./tags.js"

const func_with_tags = (arg) => `<option value="${arg.value}" title="${arg.title}">${arg.name} | ${arg.value}</option>`
document.getElementById('choose').innerHTML += tags.map(qwe => func_with_tags(qwe)).join('')

function putToCache(elem, cache) {
    if (cache.indexOf(elem) != -1) return;
    cache.splice(Math.floor(Math.random() * (cache.length + 1)), 0, elem)
}

function bezumiye() {
    let cache = [];
    return function(a, b) {
        putToCache(a, cache)
        putToCache(b, cache)
        return cache.indexOf(b) - cache.indexOf(a)
    }
}

const shuffle = (arr) => arr.sort(bezumiye())

function localize_tags(arg) {
    for (let i = 0; i < tags.length - 1; i++) {
        if (tags[i].value == arg) {
            return tags[i].name
        }
    }
}

start.onclick = async function() {
    document.getElementById("name").innerHTML = "Идёт поиск задач..."
    document.getElementById("rating").innerHTML = "Рейтинг задачи: [загрузка]"
    document.getElementById("points").innerHTML = "Очки: [загрузка]"
    document.getElementById("tags").innerHTML = "Темы: [загрузка]"
    let min_value = document.getElementById('min_num').value,
        max_value = document.getElementById('max_num').value,
        tag_value = document.getElementById('choose').value
    if (+(min_value) < 0 || min_value == "") {
        min_value = 0
    }
    if (+(max_value) > 3800 || max_value == "") {
        max_value = 3800
    }
    if (+min_value > +max_value) {
        document.getElementById("name").innerHTML = ("Минимум не может быть больше максимума.")
        return ""
    }
    let json,
        link = codeforces + "problemset.problems?tags="
    if (tag_value != "Choose tag") {
        link += tag_value
    }
    let response = await fetch(link)
    if (response.ok) {
        document.getElementById("name").innerHTML = "Осталось совсем немного..."
        json = await response.json()
        let problems = []
        for (let i = json.result.problems.length - 1; i >= 0; i--) {
            let qwe = json.result.problems[i].rating
            if (qwe >= min_value && max_value >= qwe) {
                problems.push(json.result.problems[i])
            }
        }
        problems = shuffle(problems)
        if (!problems.length) {
            document.getElementById("name").innerHTML = "Нет задачи по Вашим параметрам."
            document.getElementById("rating").innerHTML = "Рейтинг задачи: :("
            document.getElementById("points").innerHTML = "Очки: Неизвестно"
            document.getElementById("tags").innerHTML = "Темы: :("
        } else {
            let res = problems[0]
            console.log(res)
            link = "https://codeforces.com/problemset/problem/" + res.contestId + "/" + res.index
            document.getElementById("name").innerHTML = `<a href="${link}"target="_blank">${res.name}</a>`
            document.getElementById("rating").innerHTML = "Рейтинг задачи: " + res.rating
            document.getElementById("points").innerHTML = "Очки: " + ((res.points != undefined) ? res.points : "Неизвестно")
            if(!document.querySelector('#doNotShowTags').checked){
            	document.getElementById("tags").innerHTML = "Темы: " + res.tags.map((arg) => localize_tags(arg)).join(", ")
            } else {
            	document.getElementById("tags").innerHTML = "Темы мы не показываем :D";
            }
        }
    } else {
        document.getElementById("name").innerHTML = "Ошибка HTTP: " + response.status
    }
}
