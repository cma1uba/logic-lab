import { FormEvent, useState } from 'react'

type ModelType = 'openai' | 'claude' | 'gemini'

interface IdleViewProps {
  apiKey: string
  error: string | null
  modelType: ModelType
  onApiKeyChange: (apiKey: string) => void
  onGenerate: (query: string, tone: string) => void
  onModelTypeChange: (modelType: ModelType) => void
}

const suggestions = [
  'How do loops work in JS?',
  'What is inflation?',
  'Explain quantum computing simply',
]

const modelOptions: Array<{ value: ModelType, label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
]

export function IdleView({
  apiKey,
  error,
  modelType,
  onApiKeyChange,
  onGenerate,
  onModelTypeChange,
}: IdleViewProps) {
  const [query, setQuery] = useState('')
  const [tone, setTone] = useState('Standard')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (query.trim()) {
      onGenerate(query.trim(), tone)
    }
  }

  return (
    <section className="idle-page flex min-h-screen flex-col justify-center px-5 py-10">
      <div className="idle-content mx-auto w-full max-w-4xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow">Logictab · visual learning</span>
          <h1 className="idle-title mt-4 bg-gradient-to-r from-sky-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
          Learn anything
          </h1>
          <p className="idle-subtitle mx-auto mt-5 max-w-2xl text-slate-300">
            Type a question and get a focused video explainer with visuals, narration, and a knowledge check.
          </p>
        </div>

        {error && (
          <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 shadow-[0_0_32px_rgba(244,63,94,0.09)]" role="alert">
            {error}
          </p>
        )}

        <div className="provider-panel mx-auto mt-8 max-w-2xl rounded-2xl px-3 py-3 sm:px-4" aria-label="AI provider settings">
          <div className="provider-tabs grid grid-cols-3 rounded-xl p-1" role="tablist" aria-label="AI provider">
            {modelOptions.map((option) => (
              <button
                aria-selected={modelType === option.value}
                className={`provider-tab rounded-lg px-3 py-2 text-sm font-semibold transition ${modelType === option.value ? 'provider-tab-active' : ''}`}
                key={option.value}
                onClick={() => onModelTypeChange(option.value)}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="provider-key-field mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs text-sky-200">⌁</span>
            <input
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder={`Enter your ${modelOptions.find((option) => option.value === modelType)?.label} API Key (Optional)…`}
              spellCheck="false"
              type="password"
              value={apiKey}
            />
          </label>
        </div>

        <form className="mt-10" onSubmit={handleSubmit}>
          <div className="prompt-composer relative rounded-2xl p-1 focus-within:border-blue-400/60">
            <textarea
              className="min-h-40 w-full resize-none rounded-xl bg-transparent px-6 pt-5 pb-20 text-lg leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Explain how my code works…"
              value={query}
            />

            <div className="absolute right-4 bottom-4 left-4 flex items-center justify-end gap-3">
              <span className="mr-auto hidden text-sm text-slate-500 sm:inline">Choose a learning style</span>
              <label className="sr-only" htmlFor="tone">Tone</label>
              <select
                className="rounded-xl border border-white/10 bg-[#08121d] px-4 py-3 text-sm font-medium text-slate-200 outline-none transition focus:border-blue-400/60"
                id="tone"
                onChange={(event) => setTone(event.target.value)}
                value={tone}
              >
                <option>Standard</option>
                <option>Deep Dive</option>
              </select>
              <button
                aria-label="Generate lesson"
                className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-xl text-white shadow-[0_10px_28px_rgba(37,99,235,0.3)] transition hover:scale-[1.03] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!query.trim()}
                type="submit"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </form>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {suggestions.map((suggestion) => (
            <button
              className="suggestion-chip rounded-full px-5 py-3 text-sm font-medium text-blue-200 transition"
              key={suggestion}
              onClick={() => setQuery(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
