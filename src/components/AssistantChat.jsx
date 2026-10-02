import { useRef, useEffect } from 'react'
import { Send, Check, Loader2, AlertCircle, ImagePlus, X } from 'lucide-react'
import { QUICK_PROMPTS, MAX_IMAGES } from '../lib/useAssistant.js'

// The conversation itself — message list, quick prompts and composer. Rendered
// both in the /assistant page's left pane and inside the floating widget, so the
// two surfaces can never drift apart. `compact` just tightens it for the bubble.
export default function AssistantChat({ chat, compact = false, onOpenBoard }) {
  const { thread, draft, setDraft, send, sending, error, images = [], addImages, removeImage } = chat
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const canSend = !sending && (draft.trim() || images.length)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread, sending])

  const input = 'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

  return (
    <>
      <div ref={scrollRef} className={`flex-1 overflow-y-auto space-y-3 ${compact ? 'px-4 py-3.5' : 'px-5 py-4'}`}>
        {thread.length === 0 && (
          <div className="text-sm text-muted-foreground space-y-3 py-1">
            <p>
              {compact
                ? "Dump what's on your mind and I'll split it into tickets."
                : 'Dump whatever\'s in your head — "chase Azlan about the shared card, J&H parking invoice falls due January, book the lift for Saturday\'s function" — and it\'ll split that into separate tickets on the board.'}
            </p>
            {!compact && <p>Or ask it what's outstanding and it'll read the portal for you:</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {(compact ? QUICK_PROMPTS.slice(0, 2) : QUICK_PROMPTS).map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="text-xs border border-border rounded-full px-3 py-1.5 hover:bg-muted text-foreground text-left">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {thread.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            }`}>
              {m.thumbs?.length > 0 && (
                <div className={`flex flex-wrap gap-1.5 ${m.content ? 'mb-2' : ''}`}>
                  {m.thumbs.map((src, j) => (
                    <img key={j} src={src} alt="" className="h-16 w-16 object-cover rounded-md border border-white/20" />
                  ))}
                </div>
              )}
              {m.content}
              {m.role === 'assistant' && (m.added > 0 || m.ticked > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
                  <Check size={12} />
                  {m.added > 0 && <span>{m.added} task{m.added === 1 ? '' : 's'} added</span>}
                  {m.added > 0 && m.ticked > 0 && <span>·</span>}
                  {m.ticked > 0 && <span>{m.ticked} ticked off</span>}
                  {onOpenBoard && m.added > 0 && (
                    <button onClick={onOpenBoard} className="text-blue-600 hover:underline ml-0.5">View board</button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Thinking…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3 shrink-0">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((im, i) => (
              <div key={i} className="relative">
                <img src={im.thumb} alt={im.name} className="h-14 w-14 object-cover rounded-md border border-border" />
                <button onClick={() => removeImage?.(i)} aria-label={`Remove ${im.name}`}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 grid place-items-center rounded-full bg-foreground text-background hover:opacity-80">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { addImages?.(e.target.files); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={sending || images.length >= MAX_IMAGES}
            title={images.length >= MAX_IMAGES ? `Up to ${MAX_IMAGES} images per message` : 'Upload an image or photo'}
            aria-label="Upload image"
            className="h-9 w-9 shrink-0 grid place-items-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
            <ImagePlus size={15} />
          </button>
          <textarea
            value={draft}
            rows={compact ? 1 : 2}
            onChange={(e) => setDraft(e.target.value)}
            // A screenshot pasted straight from the clipboard attaches like an upload.
            onPaste={(e) => {
              const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
              if (files.length) { e.preventDefault(); addImages?.(files) }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft) }
            }}
            placeholder={compact ? 'What needs doing?' : 'What needs doing? (Enter to send, Shift+Enter for a new line)'}
            className={`${input} resize-none`}
          />
          <button onClick={() => send(draft)} disabled={!canSend}
            className="h-9 w-9 shrink-0 grid place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  )
}
