# Random Codeforces problem Generator

A random Codeforces problem in the rating range and topics you choose,
skipping the ones you have already solved.

**Live:** https://azer.is-a.dev/random-cf-problem/

## What it does

- Draws a rated problem between a minimum and a maximum rating.
- Optionally only from contests held in a given year or later, and optionally
  only up to a given year; both together give a range of years.
- Optionally only problems that at least a given number of people have solved,
  which leaves out the ones too obscure to have a settled rating.
- Optionally only from rounds for chosen divisions: Div. 1 to 4, Educational
  and Global, taken from the contest names. A problem the Div. 1 and Div. 2 rounds share
  counts for both.
- Optionally only problems with the chosen letters, as they are indexed: `B`
  takes 1000B and 1000B1 alike, and `A B` takes both letters. Empty means any.
- Narrows by topics: all of the chosen ones, any of them, or none of them.
  A line above the button says how many problems the settings leave.
- Optionally leaves out the problems Codeforces tags `*special`: April
  Fools contests, Kotlin Heroes, Q# and unknown-language rounds, olympiad
  mirrors.
- Skips problems solved by one or more handles (up to five, separated by
  commas or spaces; a link to a profile or submissions page will do), and
  optionally the ones they tried too. A problem solved or tried in the
  parallel Div. 1 or Div. 2 round counts as solved or tried. When the
  skips leave nothing to draw, the line says that rather than "No problem
  matches".
- Shows the problem's rating in its Codeforces rank colour and how many
  people solved it; the topics can be hidden, and shown again for the
  problem on screen when you get stuck.
- "Today's problem" draws one problem for the UTC day from the settings'
  pool, so everyone gets the same one that day; `?daily=1` in the address
  opens it. It does not change the draws, which keep their own rounds.
- Counts the UTC days in a row the problem of the day was opened, shown beside
  its date. The count is kept in this browser only; a day missed starts it
  again at one.
- "Use my rating" appears once a handle is typed: it sets the rating range to
  from 100 below the handle's rating to 300 above, rounded to hundreds and kept
  between 800 and 3500; a handle with no rating gets 800 to 1200.
- Shows the problem drawn last again when the page is opened or reloaded.
- Lists the last twenty draws with the time of each, marking the ones the
  handles have solved, and a "Solved" box on each to tick the ones you solved
  yourself (kept with the draw, and kept when the problem is drawn again).
  "Copy as Markdown" copies the list as a task list with the ticks, "Remove"
  takes one draw out of it, and "Clear history" empties the list. A draw does not
  repeat a problem until every problem the settings leave has come up once;
  the round then starts again.
- Builds a practice set: a number of problems on a rating ladder from one
  rating to another in equal steps, one problem per rung and no two from
  the same contest. The topics, divisions and skipped handles of the form
  apply too. The set is in the address as the problem ids, so the link
  brings back exactly the same problems; it copies as a Markdown task list,
  with the ticks. A problem that does not suit can be replaced with the one
  nearest its rating that the set does not have, from a contest the rest of
  the set does not use and from the same settings; the ticks and the timer
  stay with the set. The form's count, rating range, time limit and history
  box are in the address too, so the link brings back the form as well as the
  set.
- "Skip problems from my history" (on by default) leaves out the problems drawn
  lately and the ones ticked done in any set when a set is built.
- Ticks the problems of a set as done, kept per set in the browser; "Check
  my submissions" ticks the ones the typed handles have solved.
- The set is rising (one problem per rung, the default) or flat (all problems
  from the range at random, one per contest); flat is in the address as
  shape=flat, and the rest of the form in its own parameters, listed below.
- A time limit in minutes starts a timer on the set: the deadline is kept, so
  the countdown survives a reload, the time left is in the tab's title, and
  "Time is up" is read out once.
- Remembers the settings, and keeps them in the address so a link
  reproduces them.
- `R`, Space or Enter draws again (outside a field and outside buttons and
  boxes, which Space and Enter already work; while a box or radio button has the
  focus the letters do nothing), `O` opens the problem on screen
  and `C` copies its link; the keys in their place on a Russian layout. Enter
  in any field draws too. The hint under the button lists them.
- On a device with its own share sheet, a Share button beside Copy link sends
  the drawn problem or the practice set through it; elsewhere it is not shown.
- English and Russian, problem names included where Codeforces has them
  translated; follows the system's light or dark theme; fits a phone.

## Link parameters

| Parameter | Example | Meaning |
| --- | --- | --- |
| `min`, `max` | `min=1400&max=1900` | rating range, inclusive |
| `since` | `since=2019` | contests held in that year or later |
| `until` | `until=2021` | contests held in that year or earlier |
| `solved` | `solved=5000` | problems solved by at least this many people |
| `div` | `div=2,edu` | rounds for these divisions: `1`, `2`, `3`, `4`, `edu` or `global` |
| `letter` | `letter=A,C` | problems indexed with these letters |
| `tags` | `tags=dp,graphs` | topics, as Codeforces names them |
| `any` | `any=1` | any of the topics rather than all of them |
| `none` | `none=1` | none of the topics |
| `nospecial` | `nospecial=1` | leave out special rounds |
| `skip` | `skip=tourist,jiangly` | skip what these handles solved |
| `tried` | `tried=1` | also skip what they tried |
| `hide` | `hide=1` | hide the drawn problem's topics |
| `lang` | `lang=ru` | `en` or `ru`; remembered |
| `set` | `set=1520F2,4A` | the problems of a practice set, by contest and letter; a numbered index is joined by a dash, as in `set=921-14` |
| `shape` | `shape=flat` | the practice set is flat (problems at random from the range) rather than rising |
| `count` | `count=8` | problems in a practice set, from 1 to 20; five when left out |
| `from`, `to` | `from=1000&to=1600` | the practice set's rating range, from 0 to 3800 |
| `minutes` | `minutes=45` | the practice set's time limit, from 1 to 600 minutes |
| `noseen` | `noseen=1` | the practice set does not skip the problems from the history |

## How it works

Everything runs in the browser against the public Codeforces API. The
whole problemset (`problemset.problems`) is fetched once, in the page's
language, and kept in the browser's Cache Storage for a day; an older
copy is used straight away while a fresh one loads, and "Refresh" at the
bottom fetches it on demand. A copy that does not read back, or holds no
problems, is fetched again. For each handle to skip, `user.status`, in
the same language, is boiled down to the problems it solved and tried,
and kept for ten minutes. What the submissions older than a day add up to is
kept with it, so a refresh asks for the 300 newest submissions only (about
15 KB instead of 240 to 500 KB) and adds them; the whole history is read again
when nothing is kept, when the newest 300 do not reach back to the part that
was, and every three days. In a tab left open longer, either is fetched
again behind the next draw. The start times and divisions from `contest.list`, which
date the contests and tell parallel rounds apart, are fetched once a year,
a division or a handle is given, and kept for a day.
Calls to the API are spaced two seconds apart, as Codeforces asks. A call
refused for the rate limit, or by a busy gateway, is made once more after the
next two seconds.

## Running it locally

Any static file server will do; the page loads ES modules, which browsers
refuse to do from `file://`:

```sh
npx http-server -p 4341
```

Then open http://localhost:4341/ in the browser. The problems come from
codeforces.com, so the page needs that site reachable to draw anything.

The logic that does not touch the page lives in `modules/` and is tested
with Node's built-in runner, no dependencies needed:

```sh
npm test
```

## Important point
The code has NOT been polished and is provided "as is". There's a lot of code that is redundant and there are tons of improvements that can be made.

### Author - [Azer Sadykhzadeh](https://github.com/sadykhzadeh).
