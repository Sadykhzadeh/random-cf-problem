# Random Codeforces problem Generator

A random Codeforces problem in the rating range and topics you choose,
skipping the ones you have already solved.

**Live:** https://azer.is-a.dev/random-cf-problem/

## What it does

- Draws a rated problem between a minimum and a maximum rating.
- Narrows by topics: all of the chosen ones, or any of them. A line above
  the button says how many problems the settings leave.
- Optionally leaves out the problems Codeforces tags `*special`: April
  Fools contests, Kotlin Heroes, Q# and unknown-language rounds, olympiad
  mirrors.
- Skips problems solved by one or more handles (up to five, separated by
  commas or spaces), and optionally the ones they tried too. A problem
  solved in the parallel Div. 1 or Div. 2 round counts as solved.
- Shows the problem's rating in its Codeforces rank colour and how many
  people solved it; the topics can be hidden, and shown again for the
  problem on screen when you get stuck.
- Lists the last ten draws and avoids repeating them while anything else
  matches.
- Remembers the settings, and keeps them in the address so a link
  reproduces them.
- `R` draws again; Enter in any field does too.
- English and Russian; follows the system's light or dark theme; fits a
  phone.

## Link parameters

| Parameter | Example | Meaning |
| --- | --- | --- |
| `min`, `max` | `min=1400&max=1900` | rating range, inclusive |
| `tags` | `tags=dp,graphs` | topics, as Codeforces names them |
| `any` | `any=1` | any of the topics rather than all of them |
| `nospecial` | `nospecial=1` | leave out special rounds |
| `skip` | `skip=tourist,jiangly` | skip what these handles solved |
| `tried` | `tried=1` | also skip what they tried |
| `hide` | `hide=1` | hide the drawn problem's topics |
| `lang` | `lang=ru` | `en` or `ru`; remembered |

## How it works

Everything runs in the browser against the public Codeforces API. The
whole problemset (`problemset.problems`) is fetched once and kept in the
browser's Cache Storage for a day; an older copy is used straight away
while a fresh one loads, and "Refresh" at the bottom fetches it on demand.
For each handle to skip, `user.status` is boiled down to the problems it
solved and tried, and kept for ten minutes; the start times from
`contest.list`, which tell parallel rounds apart, are kept for a day.
Calls to the API are spaced two seconds apart, as Codeforces asks.

## Running it locally

Any static file server will do; the page loads ES modules, which browsers
refuse to do from `file://`:

```sh
npx http-server -p 4341
```

The logic that does not touch the page lives in `modules/` and is tested
with Node's built-in runner, no dependencies needed:

```sh
npm test
```

## Important point
The code has NOT been polished and is provided "as is". There's a lot of code that is redundant and there are tons of improvements that can be made.

### Author - [Azer Sadykhzadeh](https://github.com/sadykhzadeh).
