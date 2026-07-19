import { useCallback, useState } from 'react'
import type { LogictabPayload } from '../types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://logic-lab-production.up.railway.app').replace(/\/$/, '')
const GENERATE_API_URL = `${apiBaseUrl}/api/generate`

type ModelType = 'openai' | 'claude' | 'gemini'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const isLogictabPayload = (value: unknown): value is LogictabPayload => {
  if (!isRecord(value) || typeof value.topic !== 'string'
    || !Array.isArray(value.segments) || !Array.isArray(value.quiz)) {
    return false
  }

  return value.segments.every((segment) => (
    isRecord(segment)
    && typeof segment.id === 'number'
    && typeof segment.narration_text === 'string'
    && typeof segment.visual_prompt === 'string'
    && typeof segment.durationSeconds === 'number'
    && (segment.imageDataUrl === undefined || typeof segment.imageDataUrl === 'string')
    && isRecord(segment.visual)
    && ['image', 'code', 'diagram', 'analogy'].includes(segment.visual.type as string)
    && typeof segment.visual.title === 'string'
    && typeof segment.visual.content === 'string'
    && ['left', 'center', 'right'].includes(segment.visual.focusPosition as string)
  )) && value.quiz.every((question) => (
    isRecord(question)
    && typeof question.question === 'string'
    && Array.isArray(question.options)
    && question.options.every((option) => typeof option === 'string')
    && typeof question.correct_answer === 'string'
    && question.options.includes(question.correct_answer)
    && typeof question.explanation === 'string'
  ))
}

export function useExplainQuery() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any | null>(null)

  const explainTopic = useCallback(async (
    query: string,
    tone: string,
    modelType: ModelType,
    apiKey: string,
  ) => {
    if (!query.trim()) {
      setError('Enter a topic before generating a lesson.')
      return null
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const response = await fetch(GENERATE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query.trim(),
          tone,
          modelType,
          apiKey,
        }),
      })

      const isJsonResponse = response.headers.get('content-type')?.includes('application/json')
      const responseBody: unknown = isJsonResponse ? await response.json() : null

      if (!response.ok) {
        const message = response.status === 502
          ? 'The lesson server is unavailable. Redeploy the backend, then try again.'
          : isRecord(responseBody) && typeof responseBody.error === 'string'
            ? responseBody.error
            : 'Unable to generate a lesson right now.'
        throw new Error(message)
      }

      const videoSteps = isRecord(responseBody) ? responseBody.video_steps : undefined
      const quiz = isRecord(responseBody) ? responseBody.quiz : undefined

      const payload = {
        topic: query.trim(),
        segments: videoSteps,
        quiz,
      }

      if (!isLogictabPayload(payload)) {
        throw new Error('The selected provider returned an invalid lesson payload.')
      }

      setData(payload)
      return payload
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'An unexpected error occurred while generating the lesson.'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { explainTopic, loading, error, data }
}
