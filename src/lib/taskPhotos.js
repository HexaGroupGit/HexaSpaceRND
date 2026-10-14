// Photos on task-board tasks. Files live in the private `task-photos` bucket
// (admins only — migrations/task-photos-storage.sql); the task row keeps just
// { path, name, addedAt } and the board reads them back via signed URLs.
//
// Every photo is redrawn in the browser first (long edge ≤ 2000px, JPEG) so a
// 12 MB phone shot uploads as a few hundred KB.
import { supabase } from './supabase.js'
import { loadImage, drawJpeg } from './useAssistant.js'

export const TASK_PHOTO_BUCKET = 'task-photos'
export const MAX_TASK_PHOTOS = 10
const MAX_EDGE = 2000

export async function uploadTaskPhoto(file) {
  if (!/^image\//.test(file?.type ?? '')) throw new Error(`${file?.name || 'That file'} isn't an image.`)
  const img = await loadImage(file)
  const blob = await (await fetch(drawJpeg(img, MAX_EDGE, 0.85))).blob()
  const path = `tasks/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from(TASK_PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(`Couldn't upload ${file.name || 'the photo'}: ${error.message}`)
  return { path, name: file.name || 'photo.jpg', addedAt: new Date().toISOString() }
}

/** { [path]: signedUrl } for the given paths, valid for an hour. */
export async function signTaskPhotos(paths = []) {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(TASK_PHOTO_BUCKET).createSignedUrls(paths, 3600)
  if (error) return {}
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
}

export async function removeTaskPhotos(paths = []) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(TASK_PHOTO_BUCKET).remove(paths)
  if (error) console.error('Task photo cleanup failed:', error.message)
}
