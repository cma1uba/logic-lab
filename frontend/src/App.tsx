import { useEffect, useState } from 'react'
import { IdleView } from './components/IdleView'
import { GeneratingLoader } from './components/GeneratingLoader'
import { QuizCanvas } from './components/QuizCanvas'
import { ResultsView } from './components/ResultsView'
import { VideoPlayerCanvas } from './components/VideoPlayerCanvas'
import { useExplainQuery } from './hooks/useExplainQuery'
import type { LogictabPayload } from './types'

type AppState = 'idle' | 'generating' | 'playing' | 'quiz' | 'results'
type ModelType = 'openai' | 'claude' | 'gemini'
type ApiKeys = Record<ModelType, string>

const emptyApiKeys: ApiKeys = { openai: '', claude: '', gemini: '' }

const isLogictabPayload = (value: unknown): value is LogictabPayload => {
  if (!value || typeof value !== 'object') return false

  const payload = value as Partial<LogictabPayload>
  return typeof payload.topic === 'string'
    && Array.isArray(payload.segments)
    && payload.segments.every((segment) => (
      typeof segment.id === 'number'
      && typeof segment.narration_text === 'string'
      && typeof segment.visual_prompt === 'string'
      && typeof segment.durationSeconds === 'number'
    ))
    && Array.isArray(payload.quiz)
    && payload.quiz.every((question) => (
      typeof question.question === 'string'
      && Array.isArray(question.options)
      && question.options.every((option) => typeof option === 'string')
      && typeof question.correct_answer === 'string'
      && question.options.includes(question.correct_answer)
      && typeof question.explanation === 'string'
    ))
}

function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [currentTone, setCurrentTone] = useState('ELI5')
  const [payload, setPayload] = useState<LogictabPayload | null>(null)
  const [score, setScore] = useState(0)
  const [modelType, setModelType] = useState<ModelType>('openai')
  const [apiKeys, setApiKeys] = useState<ApiKeys>(emptyApiKeys)
  const [hasLoadedApiKeys, setHasLoadedApiKeys] = useState(false)
  const { explainTopic, loading, error, data } = useExplainQuery()

  useEffect(() => {
    try {
      setApiKeys({
        openai: localStorage.getItem('logictab_key_openai') ?? '',
        claude: localStorage.getItem('logictab_key_claude') ?? '',
        gemini: localStorage.getItem('logictab_key_gemini') ?? '',
      })
    } catch {
      // The extension remains usable with server-side provider keys if storage is unavailable.
    } finally {
      setHasLoadedApiKeys(true)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedApiKeys) return

    try {
      localStorage.setItem('logictab_key_openai', apiKeys.openai)
      localStorage.setItem('logictab_key_claude', apiKeys.claude)
      localStorage.setItem('logictab_key_gemini', apiKeys.gemini)
    } catch {
      // Keep the value in memory when browser storage is unavailable.
    }
  }, [apiKeys, hasLoadedApiKeys])

  useEffect(() => {
    if (loading) {
      setAppState('generating')
      return
    }

    if (error) {
      setAppState('idle')
      return
    }

    if (isLogictabPayload(data)) {
      setPayload(data)
      setAppState('playing')
    }
  }, [data, error, loading])

  const handleGenerate = (query: string, tone: string) => {
    setCurrentTone(tone)
    setPayload(null)
    setScore(0)
    void explainTopic(query, tone, modelType, apiKeys[modelType])
  }

  const handleApiKeyChange = (key: string) => {
    setApiKeys((currentKeys) => ({ ...currentKeys, [modelType]: key }))
  }

  const handleReset = () => {
    setPayload(null)
    setScore(0)
    setCurrentTone('ELI5')
    setAppState('idle')
  }

  return (
    <main className="app-shell min-h-screen min-h-[100vh] text-slate-100">
      {appState === 'idle' && (
        <IdleView
          error={error}
          modelType={modelType}
          apiKey={apiKeys[modelType]}
          onApiKeyChange={handleApiKeyChange}
          onGenerate={(query, tone) => {
            handleGenerate(query, tone)
          }}
          onModelTypeChange={setModelType}
        />
      )}

      {appState === 'generating' && <GeneratingLoader tone={currentTone} />}

      {appState === 'playing' && payload && (
        <VideoPlayerCanvas payload={payload} onFinished={() => setAppState('quiz')} />
      )}

      {appState === 'quiz' && payload && (
        <QuizCanvas
          questions={payload.quiz}
          onComplete={(finalScore) => {
            setScore(finalScore)
            setAppState('results')
          }}
        />
      )}

      {appState === 'results' && payload && (
        <ResultsView
          score={score}
          totalQuestions={payload.quiz.length}
          onReset={handleReset}
        />
      )}
    </main>
  )
}

export default App
