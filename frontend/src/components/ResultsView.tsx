interface ResultsViewProps { score: number; totalQuestions: number; onReset: () => void }

export function ResultsView({ score, totalQuestions, onReset }: ResultsViewProps) {
  return <section className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-slate-300">Your score</p><p className="text-4xl font-bold">{score} / {totalQuestions}</p><button className="rounded-lg bg-blue-500 px-4 py-3" onClick={onReset} type="button">Start another lesson</button></section>
}
