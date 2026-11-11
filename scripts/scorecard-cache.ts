// Checks the public scorecard cache with fake dependencies (no database). Run with: npm run check:scorecard-cache
import assert from "node:assert/strict"
import { createScorecardCache, type ScorecardFingerprint } from "../src/modules/scoring/scorecard-cache.js"
import {
    SCORECARD_CACHE_MAX_ENTRIES,
    SCORECARD_CACHE_TTL_MS,
    SCORECARD_COMPLETED_CACHE_TTL_MS,
} from "../src/modules/scoring/scoring.constants.js"

const notStarted: ScorecardFingerprint = { scoringStarted: false, completed: false, innings: [] }
const live = (version: number): ScorecardFingerprint => ({
    scoringStarted: true,
    completed: false,
    innings: [{ id: 1, version, status: "in_progress" }],
})
const finished: ScorecardFingerprint = {
    scoringStarted: true,
    completed: true,
    innings: [{ id: 1, version: 9, status: "completed" }],
}

const setup = (start: ScorecardFingerprint) => {
    let time = 0
    const state = { fingerprint: start, toss: "none", today: "2026-01-01", failNextBuild: false }
    const calls = { fingerprint: 0, build: 0 }
    const cache = createScorecardCache({
        readFingerprint: async () => {
            calls.fingerprint += 1
            return state.fingerprint
        },
        build: async (matchId) => {
            calls.build += 1
            if (state.failNextBuild) {
                state.failNextBuild = false
                throw new Error("database down")
            }
            return { matchId, version: state.fingerprint.innings[0]?.version ?? 0, toss: state.toss }
        },
        today: () => state.today,
        now: () => time,
    })
    return { cache, calls, state, advance: (ms: number) => void (time += ms) }
}

// 1. Inside the TTL nothing touches the database
{
    const { cache, calls, advance } = setup(live(1))
    await cache.get(1)
    advance(SCORECARD_CACHE_TTL_MS - 1)
    await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 1, build: 1 })
}

// 2. 100 viewers arriving together cause one refresh, and all get the same scorecard
{
    const { cache, calls } = setup(live(1))
    const snapshots = await Promise.all(Array.from({ length: 100 }, () => cache.get(1)))
    assert.deepEqual(calls, { fingerprint: 1, build: 1 })
    assert.equal(new Set(snapshots.map((snapshot) => snapshot.etag)).size, 1)
}

// 3. After the TTL, an unchanged match costs only the cheap fingerprint query and keeps its etag
{
    const { cache, calls, advance } = setup(live(1))
    const first = await cache.get(1)
    advance(SCORECARD_CACHE_TTL_MS + 1)
    const second = await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 2, build: 1 })
    assert.equal(second.etag, first.etag)
    // and the extended entry is served again without any query
    await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 2, build: 1 })
}

// 4. A new innings version rebuilds the scorecard and changes the etag
{
    const { cache, calls, state, advance } = setup(live(1))
    const first = await cache.get(1)
    state.fingerprint = live(2)
    advance(SCORECARD_CACHE_TTL_MS + 1)
    const second = await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 2, build: 2 })
    assert.notEqual(second.etag, first.etag)
    assert.equal((second.body as { version: number }).version, 2)
}

// 5. Before scoring starts nothing is reused (the toss can change without a version) and the etag follows the body
{
    const { cache, calls, state, advance } = setup(notStarted)
    const first = await cache.get(1)
    advance(SCORECARD_CACHE_TTL_MS + 1)
    const same = await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 2, build: 2 })
    assert.equal(same.etag, first.etag)
    state.toss = "Royals bat"
    advance(SCORECARD_CACHE_TTL_MS + 1)
    const changed = await cache.get(1)
    assert.notEqual(changed.etag, first.etag)
}

// 6. A finished match is kept for the long TTL, then only re-checked
{
    const { cache, calls, advance } = setup(finished)
    const first = await cache.get(1)
    assert.equal(first.completed, true)
    advance(SCORECARD_COMPLETED_CACHE_TTL_MS - 1)
    await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 1, build: 1 })
    advance(2)
    await cache.get(1)
    assert.deepEqual(calls, { fingerprint: 2, build: 1 })
}

// 7. The date is part of the etag (the body carries the tournament status), so a new day rebuilds
{
    const { cache, calls, state, advance } = setup(live(1))
    const first = await cache.get(1)
    state.today = "2026-01-02"
    advance(SCORECARD_CACHE_TTL_MS + 1)
    const second = await cache.get(1)
    assert.equal(calls.build, 2)
    assert.notEqual(second.etag, first.etag)
}

// 8. A failed build is not cached: the next request tries again at once
{
    const { cache, calls, state } = setup(live(1))
    state.failNextBuild = true
    await assert.rejects(cache.get(1), /database down/)
    const snapshot = await cache.get(1)
    assert.equal(calls.build, 2)
    assert.equal((snapshot.body as { matchId: number }).matchId, 1)
}

// 9. The cache is bounded: the oldest match is dropped first
{
    const { cache, calls } = setup(live(1))
    for (let matchId = 1; matchId <= SCORECARD_CACHE_MAX_ENTRIES + 1; matchId += 1) await cache.get(matchId)
    const builds = calls.build
    await cache.get(SCORECARD_CACHE_MAX_ENTRIES + 1)
    assert.equal(calls.build, builds, "the newest match is still cached")
    await cache.get(1)
    assert.equal(calls.build, builds + 1, "the oldest match was evicted")
}

console.log("scorecard cache: all checks passed")
