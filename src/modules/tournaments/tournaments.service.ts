import sanitizeHtml from "sanitize-html"
import { ConflictError, ForbiddenError, BadRequestError, NotFoundError } from "../../shared/http/errors.js"
import { deleteImage, uploadImage, type UploadedImage } from "../../shared/storage/cloudinary.js"
import { todayInTimezone } from "../../shared/utils/date.js"
import { getMe } from "../auth/auth.service.js"
import {
    ALREADY_CANCELLED,
    ALREADY_COMPLETED,
    DESCRIPTION_ALLOWED_TAGS,
    DESCRIPTION_MAX_TEXT_LENGTH,
    DESCRIPTION_TOO_LONG,
    LOGO_FOLDER,
    NOT_ORGANIZER,
    TOURNAMENT_NOT_FOUND,
    TOURNAMENT_TIMEZONE,
} from "./tournaments.constants.js"
import {
    findTournamentDetails,
    findTournamentForCancel,
    insertTournament,
    listTournaments,
    markCancelled,
    type TournamentSummaryRow,
} from "./tournaments.repository.js"
import { type CreateTournamentInput, type ListTournamentsQuery } from "./tournaments.schema.js"

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
