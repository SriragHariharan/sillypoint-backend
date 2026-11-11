import { createHash } from "node:crypto"
import {
    SCORECARD_CACHE_MAX_ENTRIES,
    SCORECARD_CACHE_TTL_MS,
    SCORECARD_COMPLETED_CACHE_TTL_MS,
} from "./scoring.constants.js"

// What a scorecard depends on once scoring has started: the innings and their versions, and whether the match is decided.
// Every change of an innings bumps its version, so the same fingerprint means the same scorecard.
export type ScorecardFingerprint = {
    scoringStarted: boolean
    completed: boolean
    innings: { id: number; version: number; status: string }[]
}

export type ScorecardSnapshot<T> = {
    // Weak validator for If-None-Match: same etag means the same scorecard
    etag: string
    body: T
    completed: boolean
}

type Entry<T> = ScorecardSnapshot<T> & { scoringStarted: boolean; checkedAt: number }

type Dependencies<T> = {
    readFingerprint: (matchId: number) => Promise<ScorecardFingerprint>
    build: (matchId: number) => Promise<T>
    // Today in the tournament time zone: the body carries the tournament status, which changes with the date
    today: () => string
    now?: () => number
}

const tagOf = (value: unknown) => `W/"${createHash("sha1").update(JSON.stringify(value)).digest("base64url").slice(0, 22)}"`

// A small in-memory cache of public scorecards. Many viewers polling one match cost the database one cheap query
// per TTL (and a full rebuild only when something changed), not one rebuild per viewer.
export const createScorecardCache = <T>(dependencies: Dependencies<T>) => {
    const { readFingerprint, build, today, now = Date.now } = dependencies
    const entries = new Map<number, Entry<T>>()
    const inFlight = new Map<number, Promise<Entry<T>>>()

    const ttlOf = (entry: Entry<T>) => (entry.completed ? SCORECARD_COMPLETED_CACHE_TTL_MS : SCORECARD_CACHE_TTL_MS)

    // Most recently checked entries stay; the oldest go when the cache is full
    const store = (matchId: number, entry: Entry<T>) => {
        entries.delete(matchId)
        entries.set(matchId, entry)
        while (entries.size > SCORECARD_CACHE_MAX_ENTRIES) {
            const oldest = entries.keys().next().value
            if (oldest === undefined) break
            entries.delete(oldest)
        }
        return entry
    }

    const refresh = async (matchId: number, previous: Entry<T> | undefined) => {
        // Read before building, so the body is never older than its etag
        const fingerprint = await readFingerprint(matchId)
        const fingerprintTag = tagOf({ fingerprint, today: today() })

        // Unchanged since scoring started: keep the body and only extend its life
        if (previous?.scoringStarted && fingerprint.scoringStarted && previous.etag === fingerprintTag) {
            return store(matchId, { ...previous, checkedAt: now() })
        }

        const body = await build(matchId)
        // Before scoring starts the toss, overs and players can change without a version, so the etag follows the body
        const etag = fingerprint.scoringStarted ? fingerprintTag : tagOf(body)
        return store(matchId, {
            etag,
            body,
            completed: fingerprint.completed,
            scoringStarted: fingerprint.scoringStarted,
            checkedAt: now(),
        })
    }

    const get = async (matchId: number): Promise<ScorecardSnapshot<T>> => {
        const entry = entries.get(matchId)
        if (entry && now() - entry.checkedAt < ttlOf(entry)) return entry

        // Everyone who arrives while a refresh is running waits for that one refresh
        let pending = inFlight.get(matchId)
        if (!pending) {
            pending = refresh(matchId, entry).finally(() => inFlight.delete(matchId))
            inFlight.set(matchId, pending)
        }
        return pending
    }

    return { get }
}
