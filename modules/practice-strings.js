// Messages only the practice set uses. They load with the practice panel, not
// with the page, so a visit that does not use the set does not download them.

export const practiceMessages = {
    en: {
        allSeen: "Every problem in the range was drawn or ticked before. Untick the option above to include them.",
        setCountText: "{count} problems.",
        setShort: "Only {count} of the {wanted} rungs had a problem to take.",
        setShortFlat: "Only {count} of the {wanted} problems fit the range.",
        setMissing: "{count} problems of this set are no longer in the list.",
        progress: "{done} of {total} done",
        doneBox: "Done: {name}",
        checkedAccepted: "Ticked {count} the handles have solved.",
        timeUp: "Time is up.",
        badLimit: "The time limit is from 1 to 600 minutes.",
    },
    ru: {
        allSeen: "Все задачи диапазона уже выпадали или отмечены. Снимите галочку выше, чтобы включить их.",
        setCountText: "Задач в наборе: {count}.",
        setShort: "Нашлось задач: {count} из {wanted}.",
        setShortFlat: "Подходят только {count} из {wanted} задач.",
        setMissing: "Задач из набора уже нет в списке: {count}.",
        progress: "Сделано: {done} из {total}",
        doneBox: "Решена: {name}",
        checkedAccepted: "Отмечено решённых хендлами: {count}.",
        timeUp: "Время вышло.",
        badLimit: "Лимит времени — от 1 до 600 минут.",
    },
}
