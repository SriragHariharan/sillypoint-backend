import sanitizeHtml from "sanitize-html"
import { db } from "../../db/postgres.js"
import { ConflictError, ForbiddenError, BadRequestError, NotFoundError } from "../../shared/http/errors.js"
import { deleteImage, uploadImage, type UploadedImage } from "../../shared/storage/cloudinary.js"
import { todayInTimezone } from "../../shared/utils/date.js"
import { getMe } from "../auth/auth.service.js"
import { assertManagesTeams } from "../teams/teams.service.js"
import {
    DESCRIPTION_ALLOWED_TAGS,
    DESCRIPTION_MAX_TEXT_LENGTH,
    DESCRIPTION_TOO_LONG,
    LOGO_FOLDER,
    NOT_ALLOWED_TO_REMOVE_TEAM,
    NOT_ORGANIZER,
    ORGANIZER_CANNOT_ADD_TEAMS,
    REGISTRATION_CLOSED,
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
    findTournamentBasics,
    findTournamentDetails,
    insertTournament,
    insertTournamentTeams,
    listTournamentTeams,
    listTournamentTeamsForOrganizer,
    listTournaments,
    type TournamentSummaryRow,
} from "./tournaments.repository.js"
import { type CreateTournamentInput, type ListTournamentsQuery } from "./tournaments.schema.js"

type TournamentStatus = "upcoming" | "live" | "completed"

// The status is never stored: it comes from the dates
const deriveStatus = (row: { startDate: string; endDate: string }, today: string): TournamentStatus => {
    if (row.startDate > today) return "upcoming"
    if (row.endDate < today) return "completed"
    return "live"
}

// Registration stays open through the last registration date itself
const toSummary = (row: TournamentSummaryRow, today: string) => ({
    ...row,
    status: deriveStatus(row, today),
    registrationClosed: row.lastRegistrationDate < today,
})

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
            lastRegistrationDate: input.lastRegistrationDate,
            registrationFee: input.registrationFee,
            prizeMoney: input.prizeMoney,
            playersPerSide: input.playersPerSide,
            substitutesPerSide: input.substitutesPerSide,
        })
        if (!row) throw new Error("Failed to create tournament")
        return toSummary(row, todayInTimezone(TOURNAMENT_TIMEZONE))
    } catch (err) {
        // The row was not saved, so do not leave the image behind
        if (logo) await deleteImage(logo.publicId)
        throw err
    }
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

// Add teams the user manages to a tournament that is not finished. All teams are added, or none.
export const addTeamsToTournament = async (userId: number, tournamentId: number, teamIds: number[]) => {
    await getMe(userId)

    const tournament = await findTournamentBasics(tournamentId)
    if (!tournament) throw new NotFoundError(TOURNAMENT_NOT_FOUND)
    if (tournament.organizerId === userId) throw new ForbiddenError(ORGANIZER_CANNOT_ADD_TEAMS)
    const today = todayInTimezone(TOURNAMENT_TIMEZONE)
    if (tournament.endDate < today) throw new ConflictError(TOURNAMENT_NOT_OPEN)
    if (tournament.lastRegistrationDate < today) throw new ConflictError(REGISTRATION_CLOSED)

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

// List of the teams in a tournament. Public, but the manager mobiles go only to the tournament's organizer.
export const listTeamsInTournament = async (tournamentId: number, viewerId?: number) => {
    const tournament = await findTournamentBasics(tournamentId)
    if (!tournament) throw new NotFoundError(TOURNAMENT_NOT_FOUND)

    return viewerId !== undefined && viewerId === tournament.organizerId
        ? listTournamentTeamsForOrganizer(tournamentId)
        : listTournamentTeams(tournamentId)
}

// Remove a team from a tournament. Only the organizer or the user who added it can; the team itself stays.
export const removeTeamFromTournament = async (userId: number, tournamentId: number, teamId: number) => {
    const tournament = await findTournamentBasics(tournamentId)
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

// True if every one of these teams is enrolled in the tournament
export const areTeamsEnrolled = async (tournamentId: number, teamIds: number[]) => {
    const unique = [...new Set(teamIds)]
    const enrolled = await listTournamentTeams(tournamentId, unique)
    return enrolled.length === unique.length
}
