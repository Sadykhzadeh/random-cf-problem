import { test } from "node:test"
import assert from "node:assert/strict"

import { DIVISIONS } from "../modules/params.js"
import { HISTORY_COUNT, parseHandles } from "../modules/problems.js"
import { KEPT_SETS, MAX_SET, SESSION_MAX_MINUTES } from "../modules/practice.js"
import { NEWEST_COUNT } from "../modules/skip.js"
import strings from "../modules/strings-en.js"
import russian from "../modules/strings-ru.js"
import { read } from "./support/walk.js"

const WORDS = { five: 5, twenty: 20, "пять": 5 }

const fieldMax = (id) => read("index.html").match(new RegExp(`<input[^>]*id="${id}"[^>]*\\smax="(\\d+)"`))[1]

const readmeRow = (name) => read("README.md").split("\n").find((line) => line.startsWith(`| \`${name}\``))

test("the practice set's form in the page has the limits the code keeps", () => {
    const count = read("index.html").match(/<input[^>]*id="setCount"[^>]*>/)[0]
    assert.match(count, new RegExp(` value="5"`))
    assert.equal(fieldMax("setCount"), String(MAX_SET))
    assert.equal(fieldMax("setLimit"), String(SESSION_MAX_MINUTES))
})

test("the README's limits are the ones the code keeps", () => {
    const count = readmeRow("count")
    assert.ok(count.includes(`from 1 to ${MAX_SET};`), "the count's range")
    assert.ok(count.includes("five when left out"), "the count's default")
    assert.ok(readmeRow("minutes").includes(`from 1 to ${SESSION_MAX_MINUTES} minutes`), "the time limit")
    const rating = readmeRow("from`, `to").match(/from 0 to (\d+)/)[1]
    assert.equal(rating, fieldMax("setFrom"))
    assert.equal(rating, fieldMax("setTo"))
    const divisions = readmeRow("div").split("|")[3].match(/`[^`]+`/g).map((value) => value.slice(1, -1))
    assert.deepEqual(divisions, DIVISIONS)
})

test("the README's counts in prose are the ones the code keeps", () => {
    const readme = read("README.md")
    assert.equal(WORDS[readme.match(/last (\w+) draws/)[1]], HISTORY_COUNT)
    assert.equal(WORDS[readme.match(/last (\w+) sets/)[1]], KEPT_SETS)
    assert.equal(WORDS[readme.match(/up to (\w+), separated/)[1]], parseHandles("a b c d e f g").handles.length)
    assert.equal(Number(readme.match(/the (\d+) newest submissions/)[1]), NEWEST_COUNT)
})

test("the message for too many handles names the number the code keeps", () => {
    const limit = parseHandles("a b c d e f g").handles.length
    assert.equal(WORDS[strings.tooManyHandles.match(/first (\w+) handles/)[1]], limit)
    assert.equal(WORDS[russian.tooManyHandles.match(/первые (\S+) хендлов/)[1]], limit)
})
