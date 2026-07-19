import { useEffect, useState } from 'react'

interface GeneratingLoaderProps {
  tone: string
}

const generationQuotes = [
  'Building a focused lesson timeline…',
  'Synthesizing high-fidelity segments…',
  'Designing visual learning prompts…',
  'Preparing your guided explanation…',
]

export function GeneratingLoader({ tone }: GeneratingLoaderProps) {
  const [quoteIndex, setQuoteIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setQuoteIndex((index) => (index + 1) % generationQuotes.length)
    }, 2_400)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="flex min-h-screen flex-col justify-center p-6">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/5 bg-[#111c2a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="h-3 w-24 animate-pulse rounded-full bg-blue-500/30" />
        <div className="mt-6 h-8 w-3/4 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-3 h-5 w-full animate-pulse rounded-lg bg-white/5" />
        <div className="mt-2 h-5 w-5/6 animate-pulse rounded-lg bg-white/5" />
        <div className="mt-8 aspect-video animate-pulse rounded-2xl bg-gradient-to-br from-blue-500/20 via-white/5 to-violet-500/20" />
        <div className="mt-8 flex items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-blue-400" />
          <p className="text-sm text-slate-300">{generationQuotes[quoteIndex]}</p>
        </div>
        <p className="mt-2 text-xs text-slate-500">Tone: {tone}</p>
      </div>
    </section>
  )
}
