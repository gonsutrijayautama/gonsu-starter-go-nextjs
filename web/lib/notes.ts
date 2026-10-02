import { api } from "@/lib/api"

/** Satu catatan, seperti dijawab /v1/notes. */
export type Note = {
  id: string
  title: string
  body: string
  created_by_name: string
  created_at: string
  updated_at: string
}

export type NoteInput = { title: string; body: string }

export const notesPath = "/v1/notes"

export function createNote(input: NoteInput, idempotencyKey: string) {
  return api<Note>(notesPath, { method: "POST", body: input, idempotencyKey })
}

export function updateNote(id: string, input: NoteInput) {
  return api<Note>(`${notesPath}/${id}`, { method: "PUT", body: input })
}

export function deleteNote(id: string) {
  return api<void>(`${notesPath}/${id}`, { method: "DELETE" })
}
