import { useCallback, useState } from 'react'
import type { LogictabPayload } from '../types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://logictab-2.onrender.com').replace(/\/$/, '')
const GENERATE_API_URL = `${apiBaseUrl}/api/generate`

type ModelType = 'openai' | 'claude' | 'gemini'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

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
        const message = isRecord(responseBody) && typeof responseBody.error === 'string'
          ? responseBody.error
          : 'Unable to generate a lesson right now.'
        throw new Error(message)
      }

      const videoSteps = isRecord(responseBody) ? responseBody.video_steps : undefined
      const quiz = isRecord(responseBody) ? responseBody.quiz : undefined

      if (!Array.isArray(videoSteps) || !Array.isArray(quiz)) {
        throw new Error('The selected provider returned an invalid lesson payload.')
      }

      const payload: LogictabPayload = {
        topic: query.trim(),
        segments: videoSteps as LogictabPayload['segments'],
        quiz: quiz as LogictabPayload['quiz'],
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
