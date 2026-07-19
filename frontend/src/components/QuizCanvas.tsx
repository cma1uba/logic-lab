import { useState } from 'react'
import type { LogictabPayload } from '../types'

interface QuizCanvasProps {
  questions: LogictabPayload['quiz']
  onComplete: (score: number) => void
}

export function QuizCanvas({ questions, onComplete }: QuizCanvasProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0)

  const currentQuestion = questions[currentQuestionIndex]

  const selectAnswer = (answer: string) => {
    if (selectedAnswer) return

    setSelectedAnswer(answer)
    if (answer === currentQuestion.correct_answer) {
      setCorrectAnswersCount((count) => count + 1)
    }
  }

  const moveForward = () => {
    if (currentQuestionIndex === questions.length - 1) {
      onComplete(correctAnswersCount)
      return
    }

    setCurrentQuestionIndex((index) => index + 1)
    setSelectedAnswer(null)
  }

  if (!currentQuestion) {
    return (
      <section className="flex min-h-screen items-center justify-center p-6 text-slate-300">
        No quiz questions are available.
      </section>
    )
  }

  const isLastQuestion = currentQuestionIndex === questions.length - 1

  return (
    <section className="assessment-page flex min-h-screen flex-col justify-center p-5">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">
          <span>Knowledge check</span>
          <span>{currentQuestionIndex + 1} / {questions.length}</span>
        </div>

        <article className="assessment-card rounded-2xl p-5 sm:p-7">
          <h1 className="text-xl leading-snug font-semibold text-slate-100">
            {currentQuestion.question}
          </h1>

          <div className="mt-6 space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === option
              const isCorrect = option === currentQuestion.correct_answer
              const hasAnswered = selectedAnswer !== null
              const feedbackClass = hasAnswered && isCorrect
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                : hasAnswered && isSelected
                  ? 'border-rose-400/60 bg-rose-500/15 text-rose-100'
                  : 'border-white/5 bg-white/[0.03] text-slate-200 hover:border-blue-400/50 hover:bg-blue-500/10'

              return (
                <button
                  className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left text-base transition ${feedbackClass}`}
                  disabled={hasAnswered}
                  key={option}
                  onClick={() => selectAnswer(option)}
                  type="button"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-current/30 text-xs font-bold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                  {hasAnswered && isCorrect && <span className="ml-auto text-sm">✓</span>}
                  {hasAnswered && isSelected && !isCorrect && <span className="ml-auto text-sm">×</span>}
                </button>
              )
            })}
          </div>

          {selectedAnswer && (
            <div className="mt-5 rounded-xl border border-blue-400/20 bg-blue-500/10 p-4 shadow-[0_0_28px_rgba(59,130,246,0.14)]">
              <p className="text-xs font-bold tracking-wider text-blue-300 uppercase">Explanation</p>
              <p className="mt-2 leading-relaxed text-slate-200">{currentQuestion.explanation}</p>
            </div>
          )}

          <button
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectedAnswer}
            onClick={moveForward}
            type="button"
          >
            {isLastQuestion ? 'Show Results' : 'Next'}
          </button>
        </article>
      </div>
    </section>
  )
}
