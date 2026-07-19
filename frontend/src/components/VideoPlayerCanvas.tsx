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

const selectNarratorVoice = (voices: SpeechSynthesisVoice[]) => {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  const candidates = englishVoices.length ? englishVoices : voices
  const preferredVoice = /aria|jenny|ava|samantha|daniel|zira|google us english|microsoft (ryan|guy)/i

  return candidates.reduce<SpeechSynthesisVoice | null>((bestVoice, voice) => {
    if (!bestVoice) return voice

    const score = (candidate: SpeechSynthesisVoice) => (
      Number(preferredVoice.test(candidate.name)) * 4
      + Number(candidate.localService) * 2
      + Number(candidate.lang.toLowerCase() === 'en-us')
    )

    return score(voice) > score(bestVoice) ? voice : bestVoice
  }, null)
}

export function VideoPlayerCanvas({ payload, onFinished }: VideoPlayerCanvasProps) {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [segmentElapsed, setSegmentElapsed] = useState(0)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const segmentIndexRef = useRef(0)
  const segmentElapsedRef = useRef(0)
  const segmentStartedAtRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const finishedRef = useRef(false)
  const onFinishedRef = useRef(onFinished)
  const narratorVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined

    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices())

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const narratorVoice = useMemo(() => selectNarratorVoice(availableVoices), [availableVoices])

  useEffect(() => {
    narratorVoiceRef.current = narratorVoice
  }, [narratorVoice])

  const totalDuration = useMemo(
    () => payload.segments.reduce((total, segment) => total + segment.durationSeconds, 0),
    [payload.segments],
  )
  const completedDuration = useMemo(
    () => payload.segments
      .slice(0, currentSegmentIndex)
      .reduce((total, segment) => total + segment.durationSeconds, 0),
    [currentSegmentIndex, payload.segments],
  )
  const currentSegment = payload.segments[currentSegmentIndex]
  const elapsedDuration = Math.min(totalDuration, completedDuration + segmentElapsed)
  const progress = totalDuration
    ? (elapsedDuration / totalDuration) * 100
    : 0

  const stopProgressTimer = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    segmentStartedAtRef.current = null
  }, [])

  const pauseProgressTimer = useCallback(() => {
    if (segmentStartedAtRef.current !== null) {
      const elapsedSinceStart = (performance.now() - segmentStartedAtRef.current) / 1000
      segmentElapsedRef.current = Math.min(
        currentSegment?.durationSeconds ?? 0,
        segmentElapsedRef.current + elapsedSinceStart,
      )
      setSegmentElapsed(segmentElapsedRef.current)
    }
    stopProgressTimer()
  }, [currentSegment?.durationSeconds, stopProgressTimer])

  const startProgressTimer = useCallback((durationSeconds: number) => {
    stopProgressTimer()
    segmentStartedAtRef.current = performance.now()
    const baseElapsed = segmentElapsedRef.current

    const tick = (now: number) => {
      if (!isPlayingRef.current || segmentStartedAtRef.current === null) return

      const elapsedSinceStart = (now - segmentStartedAtRef.current) / 1000
      const nextElapsed = Math.min(durationSeconds, baseElapsed + elapsedSinceStart)
      setSegmentElapsed(nextElapsed)

      if (nextElapsed < durationSeconds) {
        animationFrameRef.current = window.requestAnimationFrame(tick)
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)
  }, [stopProgressTimer])

  useEffect(() => {
    const nextImage = payload.segments[currentSegmentIndex + 1]?.imageDataUrl
    if (!nextImage) return

    const image = new Image()
    image.decoding = 'async'
    image.src = nextImage
  }, [currentSegmentIndex, payload.segments])

  const speakSegment = useCallback((index: number) => {
    const segment = payload.segments[index]

    if (!segment) {
      if (!finishedRef.current) {
        finishedRef.current = true
        stopProgressTimer()
        isPlayingRef.current = false
        setIsPlaying(false)
        onFinishedRef.current()
      }
      return
    }

    segmentIndexRef.current = index
    segmentElapsedRef.current = 0
    setSegmentElapsed(0)
    setCurrentSegmentIndex(index)
    isPlayingRef.current = true

    const utterance = new SpeechSynthesisUtterance(segment.narration_text)
    const selectedVoice = narratorVoiceRef.current
    utterance.lang = selectedVoice?.lang ?? 'en-US'
    utterance.rate = 0.94
    utterance.pitch = 1
    utterance.volume = 1

    if (selectedVoice) {
      utterance.voice = selectedVoice
    }
    utterance.onend = () => {
      if (segmentIndexRef.current === index && !finishedRef.current) {
        segmentElapsedRef.current = segment.durationSeconds
        setSegmentElapsed(segment.durationSeconds)
        stopProgressTimer()
        speakSegment(index + 1)
      }
    }
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && !finishedRef.current) {
        stopProgressTimer()
        speakSegment(index + 1)
      }
    }

    window.speechSynthesis.speak(utterance)
    startProgressTimer(segment.durationSeconds)
    setIsPlaying(true)
  }, [payload.segments, startProgressTimer, stopProgressTimer])

  useEffect(() => {
    if (!('speechSynthesis' in window) || payload.segments.length === 0) {
      onFinishedRef.current()
      return undefined
    }

    finishedRef.current = false
    speakSegment(0)

    return () => {
      isPlayingRef.current = false
      stopProgressTimer()
      window.speechSynthesis.cancel()
    }
  }, [payload.segments, speakSegment, stopProgressTimer])

  const togglePlayback = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      isPlayingRef.current = true
      startProgressTimer(currentSegment.durationSeconds)
      setIsPlaying(true)
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
      isPlayingRef.current = false
      pauseProgressTimer()
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
                decoding="async"
                key={currentSegment.id}
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
