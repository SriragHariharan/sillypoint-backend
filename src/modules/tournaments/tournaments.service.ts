import sanitizeHtml from "sanitize-html"
import { db } from "../../db/postgres.js"
import { ConflictError, ForbiddenError, BadRequestError, NotFoundError } from "../../shared/http/errors.js"
import { deleteImage, uploadImage, type UploadedImage } from "../../shared/storage/cloudinary.js"
import { todayInTimezone } from "../../shared/utils/date.js"
import { getMe } from "../auth/auth.service.js"
import { assertManagesTeams } from "../teams/teams.service.js"
import {
    ALREADY_CANCELLED,
    ALREADY_COMPLETED,
    CANCELLED_CANNOT_RESCHEDULE,
    COMPLETED_CANNOT_RESCHEDULE,
    DESCRIPTION_ALLOWED_TAGS,
    DESCRIPTION_MAX_TEXT_LENGTH,
    DESCRIPTION_TOO_LONG,
    LOGO_FOLDER,
    NOT_ALLOWED_TO_REMOVE_TEAM,
    NOT_ORGANIZER,
    NOT_OPEN_FOR_UPDATE,
    ORGANIZER_CANNOT_ADD_TEAMS,
    TEAM_ALREADY_ENROLLED,
    TEAM_NOT_ENROLLED,
    TOURNAMENT_NOT_FOUND,
    TOURNAMENT_NOT_OPEN,
    TOURNAMENT_TIMEZONE,
} from "./tournaments.constants.js"
import {
    deleteEnrollment,
    findEnrolledTeamIds,
    findEnrollmentForUpdate,
    findTournamentDetails,
    findTournamentForCancel,
    insertTournament,
    insertTournamentTeams,
    listTournamentTeams,
    listTournaments,
    markCancelled,
    markPrizeMoneyUpdated,
    markRescheduled,
    type TournamentSummaryRow,
} from "./tournaments.repository.js"
import { type CreateTournamentInput, type ListTournamentsQuery, type RescheduleTournamentInput, type UpdateTournamentInput } from "./tournaments.schema.js"

type TournamentStatus = "upcoming" | "live" | "completed" | "cancelled"

// upcoming / live / completed come from the dates; cancelled is the only saved state
const deriveStatus = (
    row: { startDate: string; endDate: string; cancelledAt: Date | null },
    today: string,
): TournamentStatus => {
    if (row.cancelledAt) return "cancelled"
    if (row.startDate > today) return "upcoming"
    if (row.endDate < today) return "completed"
    return "live"
}

const toSummary = (row: TournamentSummaryRow, today: string) => {
    const { cancelledAt, ...rest } = row
    return { ...rest, cancelledAt, status: deriveStatus(row, today) }
}

// Keep only the tags the editor can make, so stored HTML is safe to render
const sanitizeDescription = (html: string) => {
    const clean = sanitizeHtml(html, { allowedTags: DESCRIPTION_ALLOWED_TAGS, allowedAttributes: {} }).trim()
    const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} })
    if (text.length > DESCRIPTION_MAX_TEXT_LENGTH) throw new BadRequestError(DESCRIPTION_TOO_LONG)
    return clean
}

// Create a tournament. The organizer is the logged in user, so only a real, active user can organize.
export const createTournament = async (organizerId: number, input: CreateTournamentInput, logoFile?: Express.Multer.File) => {
    await getMe(organizerId)
    const description = sanitizeDescription(input.description)

    let logo: UploadedImage | undefined
    if (logoFile) logo = await uploadImage(logoFile.buffer, LOGO_FOLDER)

    try {
        const row = await insertTournament({
            organizerId,
            name: input.name,
            description,
            logoUrl: logo?.url ?? null,
            logoPublicId: logo?.publicId ?? null,
            location: input.location,
            startDate: input.startDate,
            endDate: input.endDate,
            registrationFee: input.registrationFee,
            prizeMoney: input.prizeMoney,
        })
        if (!row) throw new Error("Failed to create tournament")
        return toSummary(row, todayInTimezone(TOURNAMENT_TIMEZONE))
    } catch (err) {
        // The row was not saved, so do not leave the image behind
        if (logo) await deleteImage(logo.publicId)
        throw err
    }
}

// Cancel a tournament. Only its organizer can, and only while it is not cancelled or finished.
export const cancelTournament = async (userId: number, id: number) => {
    const today = todayInTimezone(TOURNAMENT_TIMEZONE)
    const existing = await findTournamentForCancel(id)

    if (!existing) throw new NotFoundError(TOURNAMENT_NOT_FOUND)
    if (existing.organizerId !== userId) throw new ForbiddenError(NOT_ORGANIZER)
    if (existing.cancelledAt) throw new ConflictError(ALREADY_CANCELLED)
    if (existing.endDate < today) throw new ConflictError(ALREADY_COMPLETED)

    const row = await markCancelled(id)
    // Cancelled by a parallel request between the check and the update
    if (!row) throw new ConflictError(ALREADY_CANCELLED)

    return toSummary(row, today)
}

// Move a tournament to new dates. Only its organizer can, and only while it is not cancelled or finished.
export const rescheduleTournament = async (userId: number, id: number, input: RescheduleTournamentInput) => {
    const today = todayInTimezone(TOURNAMENT_TIMEZONE)
    const existing = await findTournamentForCancel(id)

    if (!existing) throw new NotFoundError(TOURNAMENT_NOT_FOUND)
    if (existing.organizerId !== userId) throw new ForbiddenError(NOT_ORGANIZER)
    if (existing.cancelledAt) throw new ConflictError(CANCELLED_CANNOT_RESCHEDULE)
    if (existing.endDate < today) throw new ConflictError(COMPLETED_CANNOT_RESCHEDULE)

    const row = await markRescheduled(id, input.startDate, input.endDate)
    // Cancelled by a parallel request between the check and the update
    if (!row) throw new ConflictError(CANCELLED_CANNOT_RESCHEDULE)

    return toSummary(row, today)
}

// Change the prize money. Only the organizer can, and only while the tournament is not cancelled or finished.
export const updateTournament = async (userId: number, id: number, input: UpdateTournamentInput) => {
    const today = todayInTimezone(TOURNAMENT_TIMEZONE)
    const existing = await findTournamentForCancel(id)

    if (!existing) throw new NotFoundError(TOURNAMENT_NOT_FOUND)
    if (existing.organizerId !== userId) throw new ForbiddenError(NOT_ORGANIZER)
    if (existing.cancelledAt || existing.endDate < today) throw new ConflictError(NOT_OPEN_FOR_UPDATE)

    const row = await markPrizeMoneyUpdated(id, input.prizeMoney)
    // Cancelled by a parallel request between the check and the update
    if (!row) throw new ConflictError(NOT_OPEN_FOR_UPDATE)

    return toSummary(row, today)
}

// Public list with filters and paging
export const listAllTournaments = async (query: ListTournamentsQuery) => {
    const today = todayInTimezone(TOURNAMENT_TIMEZONE)
    const { rows, total } = await listTournaments(query, today)

    return {
        tournaments: rows.map((row) => toSummary(row, today)),
        page: query.page,
        limit: query.limit,
        total,
    }
}

// Public details of one tournament, with its organizer
export const getTournament = async (id: number) => {
    const row = await findTournamentDetails(id)
    if (!row) throw new NotFoundError(TOURNAMENT_NOT_FOUND)

    return { ...toSummary(row, todayInTimezone(TOURNAMENT_TIMEZONE)), description: row.description, organizer: row.organizer }
}

// True if the database says this team is already in the tournament
const isDuplicateEnrollment = (err: unknown) => {
    const cause = err instanceof Error ? (err.cause ?? err) : err
    return (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        cause.code === "23505" &&
        "table_name" in cause &&
        cause.table_name === "tournament_teams"
    )
}

// Add teams the user manages to a tournament that is not cancelled or finished. All teams are added, or none.
export const addTeamsToTournament = async (userId: number, tournamentId: number, teamIds: number[]) => {
    await getMe(userId)

    const tournament = await findTournamentForCancel(tournamentId)
    if (!tournament) throw new NotFoundError(TOURNAMENT_NOT_FOUND)
    if (tournament.organizerId === userId) throw new ForbiddenError(ORGANIZER_CANNOT_ADD_TEAMS)
    if (tournament.cancelledAt || tournament.endDate < todayInTimezone(TOURNAMENT_TIMEZONE)) {
        throw new ConflictError(TOURNAMENT_NOT_OPEN)
    }

    await assertManagesTeams(userId, teamIds)

    try {
        await db.transaction(async (tx) => {
            const already = await findEnrolledTeamIds(tx, tournamentId, teamIds)
            if (already.length > 0) throw new ConflictError(TEAM_ALREADY_ENROLLED)

            await insertTournamentTeams(
                tx,
                teamIds.map((teamId) => ({ tournamentId, teamId, addedBy: userId })),
            )
        })
    } catch (err) {
        // Added by a parallel request between the check and the insert
        if (isDuplicateEnrollment(err)) throw new ConflictError(TEAM_ALREADY_ENROLLED)
        throw err
    }

    return listTournamentTeams(tournamentId, teamIds)
}

// Public list of the teams in a tournament
export const listTeamsInTournament = async (tournamentId: number) => {
    const tournament = await findTournamentForCancel(tournamentId)
    if (!tournament) throw new NotFoundError(TOURNAMENT_NOT_FOUND)

    return listTournamentTeams(tournamentId)
}

// Remove a team from a tournament. Only the organizer or the user who added it can; the team itself stays.
export const removeTeamFromTournament = async (userId: number, tournamentId: number, teamId: number) => {
    const tournament = await findTournamentForCancel(tournamentId)
    if (!tournament) throw new NotFoundError(TOURNAMENT_NOT_FOUND)

    await db.transaction(async (tx) => {
        const enrollment = await findEnrollmentForUpdate(tx, tournamentId, teamId)
        if (!enrollment) throw new NotFoundError(TEAM_NOT_ENROLLED)
        if (userId !== tournament.organizerId && userId !== enrollment.addedBy) {
            throw new ForbiddenError(NOT_ALLOWED_TO_REMOVE_TEAM)
        }

        await deleteEnrollment(tx, enrollment.id)
    })
}
