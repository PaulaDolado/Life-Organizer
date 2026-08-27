import { prisma } from "../config/database";
import { ForbiddenError, NotFoundError } from "../utils/errorHandler";
import { recordTombstone } from "./tombstoneService";

export async function listNotes(userId: number) {
  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return { notes };
}

export async function createNote(userId: number, content: string) {
  return prisma.note.create({ data: { userId, content } });
}

async function findOwnedNote(userId: number, noteId: number) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) throw new NotFoundError("Nota no encontrada");
  if (note.userId !== userId) throw new ForbiddenError("No autorizado");
  return note;
}

interface UpdateNoteInput {
  content?: string;
  checked?: boolean;
}

export async function updateNote(userId: number, noteId: number, input: UpdateNoteInput) {
  await findOwnedNote(userId, noteId);

  return prisma.note.update({
    where: { id: noteId },
    data: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.checked !== undefined ? { checked: input.checked } : {}),
    },
  });
}

export async function deleteNote(userId: number, noteId: number) {
  await findOwnedNote(userId, noteId);
  await prisma.$transaction([
    prisma.note.delete({ where: { id: noteId } }),
    recordTombstone(prisma, userId, "note", noteId),
  ]);
}
