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

const getNarratedSentenceIndex = (narration: string, characterIndex: number) => {
  const sentences = narration.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [narration]
  let sentenceEnd = 0

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index]
    sentenceEnd += sentence.length

    if (characterIndex < sentenceEnd) {
      return index
    }
  }

  return sentences.length - 1
}

const splitNarrationIntoSentences = (narration: string) => (
  narration.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [narration]
)

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
  const [subtitleCharacterIndex, setSubtitleCharacterIndex] = useState(0)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const segmentIndexRef = useRef(0)
  const segmentElapsedRef = useRef(0)
  const segmentStartedAtRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastElapsedCommitRef = useRef(0)
  const isPlayingRef = useRef(false)
  const progressBarRef = useRef<HTMLDivElement>(null)
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

  const paintProgress = useCallback((completedSeconds: number, currentSeconds: number) => {
    const progress = totalDuration
      ? Math.min(1, (completedSeconds + currentSeconds) / totalDuration)
      : 0

    if (progressBarRef.current) {
      progressBarRef.current.style.transform = `scaleX(${progress})`
    }
  }, [totalDuration])

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
      paintProgress(completedDuration, segmentElapsedRef.current)
    }
    stopProgressTimer()
  }, [completedDuration, currentSegment?.durationSeconds, paintProgress, stopProgressTimer])

  const startProgressTimer = useCallback((durationSeconds: number, completedSeconds: number) => {
    stopProgressTimer()
    segmentStartedAtRef.current = performance.now()
    const baseElapsed = segmentElapsedRef.current

    const tick = (now: number) => {
      if (!isPlayingRef.current || segmentStartedAtRef.current === null) return

      const elapsedSinceStart = (now - segmentStartedAtRef.current) / 1000
      const nextElapsed = Math.min(durationSeconds, baseElapsed + elapsedSinceStart)
      paintProgress(completedSeconds, nextElapsed)

      if (now - lastElapsedCommitRef.current >= 120 || nextElapsed === durationSeconds) {
        lastElapsedCommitRef.current = now
        setSegmentElapsed(nextElapsed)
      }

      if (nextElapsed < durationSeconds) {
        animationFrameRef.current = window.requestAnimationFrame(tick)
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)
  }, [paintProgress, stopProgressTimer])

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
    lastElapsedCommitRef.current = performance.now()
    setSegmentElapsed(0)
    setSubtitleCharacterIndex(0)
    setCurrentSegmentIndex(index)
    isPlayingRef.current = true
    const completedBeforeSegment = payload.segments
      .slice(0, index)
      .reduce((total, previousSegment) => total + previousSegment.durationSeconds, 0)
    paintProgress(completedBeforeSegment, 0)

    const utterance = new SpeechSynthesisUtterance(segment.narration_text)
    const selectedVoice = narratorVoiceRef.current
    utterance.lang = selectedVoice?.lang ?? 'en-US'
    utterance.rate = 0.94
    utterance.pitch = 1
    utterance.volume = 1

    if (selectedVoice) {
      utterance.voice = selectedVoice
    }
    utterance.onstart = () => {
      setSubtitleCharacterIndex(0)
    }
    utterance.onboundary = (event) => {
      if (event.name !== 'word') return

      const fallbackWordEnd = segment.narration_text.indexOf(' ', event.charIndex)
      const wordEnd = event.charLength > 0
        ? event.charIndex + event.charLength
        : fallbackWordEnd === -1 ? segment.narration_text.length : fallbackWordEnd
      setSubtitleCharacterIndex(Math.min(segment.narration_text.length, wordEnd))
    }
    utterance.onend = () => {
      if (segmentIndexRef.current === index && !finishedRef.current) {
        segmentElapsedRef.current = segment.durationSeconds
        setSegmentElapsed(segment.durationSeconds)
        setSubtitleCharacterIndex(segment.narration_text.length)
        stopProgressTimer()
        paintProgress(completedBeforeSegment, segment.durationSeconds)
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
    startProgressTimer(segment.durationSeconds, completedBeforeSegment)
    setIsPlaying(true)
  }, [paintProgress, payload.segments, startProgressTimer, stopProgressTimer])

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
      startProgressTimer(currentSegment.durationSeconds, completedDuration)
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

  const diagramItems = currentSegment.visual.type === 'diagram'
    ? currentSegment.visual.content.split('->').map((item) => item.trim()).filter(Boolean)
    : []
  const narrationSentences = splitNarrationIntoSentences(currentSegment.narration_text)
  const activeSentenceIndex = getNarratedSentenceIndex(
    currentSegment.narration_text,
    Math.min(subtitleCharacterIndex, currentSegment.narration_text.length),
  )
  const visibleCaptions = narrationSentences.slice(activeSentenceIndex, activeSentenceIndex + 3)
  const captionContent = (
    <div aria-live="polite" className="subtitle-sentences" key={`${currentSegment.id}-${activeSentenceIndex}`}>
      {visibleCaptions.map((sentence, index) => (
        <p className={`subtitle-sentence m-0 ${index === 0 ? 'subtitle-sentence-active' : ''}`} key={`${currentSegment.id}-${activeSentenceIndex + index}`}>
          {sentence}
        </p>
      ))}
    </div>
  )
  const visualSubtitle = (
    <div className="visual-subtitle mt-3 rounded-xl px-4 py-2.5 text-left text-sm leading-5 sm:px-5 sm:py-3 sm:leading-6">
      {captionContent}
    </div>
  )
  const hasRenderableVisual = currentSegment.visual.type === 'code'
    || currentSegment.visual.type === 'diagram'
    || Boolean(currentSegment.imageDataUrl)

  return (
    <section className="lesson-page flex min-h-screen flex-col px-3 py-3 sm:px-5 sm:py-4">
      <div className="lesson-frame mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="lesson-hero relative px-5 pt-5 pb-14 sm:px-7 sm:pt-6">
          <div className="lesson-hero-orb lesson-hero-orb-left" />
          <div className="lesson-hero-orb lesson-hero-orb-right" />
          <div className="relative flex items-center justify-between text-xs font-semibold tracking-[0.16em] text-cyan-100/80 uppercase">
            <span>Logictab lesson</span>
            <span>Slide {currentSegmentIndex + 1} / {payload.segments.length}</span>
          </div>
          <h1 className="relative mt-5 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-4xl">{payload.topic}</h1>
        </div>

        <div className="lesson-content relative z-10 mx-2 -mt-7 flex flex-1 flex-col rounded-2xl border border-white/10 bg-[#08121d]/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:mx-6 sm:p-4">
          {currentSegment.visual.type === 'code' && (
            <div className="visual-canvas code-visual relative min-h-56 overflow-hidden rounded-xl border border-slate-500/30 p-4 sm:min-h-72 sm:p-5">
              <div className="visual-grid" />
              <div className="relative z-10 mx-auto max-w-3xl overflow-auto rounded-xl border border-sky-300/15 bg-slate-950/90 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <span className="size-2 rounded-full bg-rose-400" />
                  <span className="size-2 rounded-full bg-amber-300" />
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-semibold tracking-[0.12em] text-slate-400 uppercase">{currentSegment.visual.title}</span>
                </div>
                <pre className="m-0 p-4 text-left text-sm leading-6 text-sky-100 sm:p-5"><code>{currentSegment.visual.content}</code></pre>
              </div>
            </div>
          )}

          {currentSegment.visual.type === 'diagram' && (
            <div className="visual-canvas relative flex min-h-56 items-center overflow-hidden rounded-xl border border-slate-500/30 p-4 sm:min-h-72 sm:p-5">
              <div className="visual-grid" />
              <div className="diagram-flow relative z-10 mx-auto flex w-full flex-wrap items-center justify-center gap-3">
                {diagramItems.map((item, index) => (
                  <div className="flex items-center gap-3" key={`${item}-${index}`}>
                    {index > 0 && <span aria-hidden="true" className="text-2xl text-sky-400">→</span>}
                    <span className="diagram-node rounded-xl px-4 py-3 text-center text-sm font-semibold text-sky-50 sm:px-5 sm:py-4">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(currentSegment.visual.type === 'image' || currentSegment.visual.type === 'analogy') && currentSegment.imageDataUrl && (
            <div className="visual-canvas relative flex min-h-56 flex-1 overflow-hidden rounded-xl border border-slate-500/30 sm:min-h-72">
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

          {hasRenderableVisual && visualSubtitle}

          {!hasRenderableVisual && (
            <div className="lesson-narration mx-auto flex w-full max-w-3xl items-center rounded-2xl px-5 py-5 sm:px-7 sm:py-6">
              {captionContent}
            </div>
          )}
        </div>

        <div className="player-controls mx-2 mt-3 rounded-2xl p-3 sm:mx-6 sm:p-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="playback-progress-indicator h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" ref={progressBarRef} />
        </div>
        <div className="mt-3 flex items-center justify-between">
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
