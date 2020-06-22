function putToCache(elem, cache) {
    if (cache.indexOf(elem) != -1)
        return;
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

export { shuffle }