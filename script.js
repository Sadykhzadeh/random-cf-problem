import {
    tags
} from "./modules/tags.js"
import {
    shuffle
} from "./modules/shuffle.js"

const func_with_tags = (arg) => `<option value="${arg.value}" title="${arg.title}">${arg.name} | ${arg.value}</option>`
document.getElementById('choose').innerHTML += tags.map(qwe => func_with_tags(qwe)).join('')

function localize_tags(arg) {
    for (let i = 0; i < tags.length - 1; i++) {
        if (tags[i].value == arg) {
            return tags[i].name
        }
    }
}

const disableAll = () => {
    document.getElementById('doNotShowTags').disabled = true
    document.getElementById("start").disabled = true
    document.getElementById("choose").disabled = true
    document.getElementById("min_num").disabled = true
    document.getElementById("max_num").disabled = true
}

const enableAll = () => {
    document.getElementById('doNotShowTags').disabled = false
    document.getElementById("start").disabled = false
    document.getElementById("choose").disabled = false
    document.getElementById("min_num").disabled = false
    document.getElementById("max_num").disabled = false
}

start.onclick = async function() {
    disableAll()
    document.getElementById("name").innerHTML = "Идёт поиск задач..."
    document.getElementById("rating").innerHTML = "Рейтинг задачи: [загрузка]"
    document.getElementById("points").innerHTML = "Очки: [загрузка]"
    document.getElementById("tags").innerHTML = "Темы: [загрузка]"
    console.log("Check inputs...")
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
        document.getElementById("rating").innerHTML = "-____-"
        document.getElementById("points").innerHTML = "-____-"
        document.getElementById("tags").innerHTML = "-____-"
        console.log("Min > Max? :hmm:")
        enableAll()
        return -1
    }
    let json, link = "https://codeforces.com/api/problemset.problems?tags="
    if (tag_value != "Choose tag") {
        link += tag_value
    }
    let response = await fetch(link)
    if (response.ok) {
        console.log("Yeah, Codeforces is working...")
        document.getElementById("name").innerHTML = "Осталось совсем немного..."
        json = await response.json()
        let problems = []
        for (let i = json.result.problems.length - 1; i >= 0; i--) {
            if (min_value <= json.result.problems[i].rating && json.result.problems[i].rating <= max_value) {
                problems.push(json.result.problems[i])
            }
        }
        problems = shuffle(problems)
        if (!problems.length) {
            document.getElementById("name").innerHTML = "Нет задачи по Вашим параметрам."
            document.getElementById("rating").innerHTML = "Рейтинг задачи: :("
            document.getElementById("points").innerHTML = "Очки: :("
            document.getElementById("tags").innerHTML = "Темы: :("
            console.log("Nothing... :sob:")
        } else {
            let res = problems[0]
            console.log(res)
            document.getElementById("name").innerHTML = `<a href="${"https://codeforces.com/problemset/problem/" + res.contestId + "/" + res.index}"target="_blank">${res.name}</a>`
            document.getElementById("rating").innerHTML = "Рейтинг задачи: " + ((res.rating != undefined) ? res.rating : "Неизвестно")
            document.getElementById("points").innerHTML = "Очки: " + ((res.points != undefined) ? res.points : "Неизвестно")
            if (!document.getElementById('doNotShowTags').checked && res.tags.length) {
                document.getElementById("tags").innerHTML = "Темы: " + res.tags.map((arg) => localize_tags(arg)).join(", ")
            } else if (!res.tags.length) {
                document.getElementById("tags").innerHTML = "Не найдено тем этой задачи"
            } else {
                document.getElementById("tags").innerHTML = "Темы мы не показываем :D"
            }
            console.log("We did it!!!")
        }
    } else {
        document.getElementById("name").innerHTML = "Ошибка HTTP: " + response.status
        console.log("Codeforces is down... F")
    }
    enableAll()
}