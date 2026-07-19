interface ResultsViewProps { score: number; totalQuestions: number; onReset: () => void }

export function ResultsView({ score, totalQuestions, onReset }: ResultsViewProps) {
  const percentage = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0

  return (
    <section className="results-page flex min-h-screen items-center justify-center p-6 text-center">
      <div className="results-card w-full max-w-md rounded-3xl p-7 sm:p-9">
        <span className="eyebrow">Lesson complete</span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">Knowledge check</h1>
        <p className="mt-3 text-slate-300">You have completed this Deep Dive lesson.</p>
        <div className="score-orb mx-auto mt-8 grid size-40 place-items-center rounded-full">
          <div>
            <p className="text-4xl font-bold text-white">{percentage}%</p>
            <p className="mt-1 text-sm text-slate-300">{score} of {totalQuestions} correct</p>
          </div>
        </div>
        <button className="mt-8 w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:brightness-110" onClick={onReset} type="button">Start another lesson</button>
      </div>
    </section>
  )
}
