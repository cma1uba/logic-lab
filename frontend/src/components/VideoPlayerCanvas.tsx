import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LogictabPayload } from '../types'

interface VideoPlayerCanvasProps {
  payload: LogictabPayload
  onFinished: () => void
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function VideoPlayerCanvas({ payload, onFinished }: VideoPlayerCanvasProps) {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const segmentIndexRef = useRef(0)
  const finishedRef = useRef(false)
  const onFinishedRef = useRef(onFinished)

  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  const totalDuration = useMemo(
    () => payload.segments.reduce((total, segment) => total + segment.durationSeconds, 0),
    [payload.segments],
  )
  const elapsedDuration = useMemo(
    () => payload.segments
      .slice(0, currentSegmentIndex)
      .reduce((total, segment) => total + segment.durationSeconds, 0),
    [currentSegmentIndex, payload.segments],
  )
  const currentSegment = payload.segments[currentSegmentIndex]
  const progress = payload.segments.length
    ? ((currentSegmentIndex + Number(isPlaying)) / payload.segments.length) * 100
    : 0

  const speakSegment = useCallback((index: number) => {
    const segment = payload.segments[index]

    if (!segment) {
      if (!finishedRef.current) {
        finishedRef.current = true
        setIsPlaying(false)
        onFinishedRef.current()
      }
      return
    }

    segmentIndexRef.current = index
    setCurrentSegmentIndex(index)

    const utterance = new SpeechSynthesisUtterance(segment.narration_text)
    utterance.onend = () => {
      if (segmentIndexRef.current === index && !finishedRef.current) {
        speakSegment(index + 1)
      }
    }
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && !finishedRef.current) {
        speakSegment(index + 1)
      }
    }

    window.speechSynthesis.speak(utterance)
    setIsPlaying(true)
  }, [payload.segments])

  useEffect(() => {
    if (!('speechSynthesis' in window) || payload.segments.length === 0) {
      onFinishedRef.current()
      return undefined
    }

    finishedRef.current = false
    speakSegment(0)

    return () => {
      window.speechSynthesis.cancel()
    }
  }, [payload.segments, speakSegment])

  const togglePlayback = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setIsPlaying(true)
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
      setIsPlaying(false)
    } else if (!finishedRef.current) {
      speakSegment(segmentIndexRef.current)
    }
  }

  if (!currentSegment) return null

  return (
    <section className="lesson-page flex min-h-screen flex-col px-4 py-5 sm:px-7 sm:py-7">
      <div className="lesson-frame mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="lesson-hero relative px-6 pt-7 pb-20 sm:px-10 sm:pt-10">
          <div className="lesson-hero-orb lesson-hero-orb-left" />
          <div className="lesson-hero-orb lesson-hero-orb-right" />
          <div className="relative flex items-center justify-between text-xs font-semibold tracking-[0.16em] text-cyan-100/80 uppercase">
            <span>Logictab lesson</span>
            <span>Slide {currentSegmentIndex + 1} / {payload.segments.length}</span>
          </div>
          <h1 className="relative mt-8 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">{payload.topic}</h1>
        </div>

        <div className="lesson-content relative z-10 mx-3 -mt-10 flex flex-1 flex-col rounded-2xl border border-white/10 bg-[#08121d]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:mx-10 sm:p-7">
          {currentSegment.imageDataUrl && (
            <div className="visual-canvas relative flex min-h-72 flex-1 overflow-hidden rounded-xl border border-slate-500/30 sm:min-h-96">
              <div className="visual-grid" />
              <img
                alt={`Lesson illustration for step ${currentSegmentIndex + 1}`}
                className="generated-visual absolute inset-0 size-full object-cover"
                src={currentSegment.imageDataUrl}
              />
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#06111c]/70 to-transparent" />
              <div className="absolute top-4 left-4 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.14em] text-sky-200 uppercase backdrop-blur">
                Visual {currentSegmentIndex + 1}
              </div>
            </div>
          )}

          <div aria-live="polite" className="lesson-caption mt-4 rounded-xl px-5 py-4 text-center text-sm leading-7 text-white sm:px-7 sm:py-5 sm:text-base">
            <span className="mb-1 block text-[0.65rem] font-bold tracking-[0.16em] text-sky-300 uppercase">
              Now explaining
            </span>
            <p>{currentSegment.narration_text}</p>
          </div>
        </div>

        <div className="mx-3 mt-4 rounded-2xl border border-white/5 bg-[#0b131e]/90 p-4 sm:mx-10 sm:mt-5 sm:p-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button aria-label={isPlaying ? 'Pause narration' : 'Play narration'} className="grid size-10 place-items-center rounded-full bg-blue-500 text-white transition hover:bg-blue-400" onClick={togglePlayback} type="button">
            {isPlaying ? 'Ⅱ' : '▶'}
          </button>
          <span className="font-mono text-sm text-slate-300">{formatTime(elapsedDuration)} / {formatTime(totalDuration)}</span>
        </div>
        </div>
      </div>
    </section>
  )
}
