import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import cors from 'cors'
import express from 'express'
import OpenAI from 'openai'

const port = process.env.PORT || 5000
const openAiApiKey = process.env.OPENAI_API_KEY
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000)
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 20)
const requestBuckets = new Map()

const app = express()

const instructions = "You are Logictab AI, an elite educational agent. Analyze the user's topic and output a single, minified JSON object matching the 'LogictabPayload' type. Divide the explanation into 3 distinct, chronologically sequential segments (each around 20-30 seconds of narration text when spoken). Standard should be concise and accessible, while Deep Dive should use technical terms and fuller detail."
const payloadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'segments', 'quiz'],
  properties: {
    topic: { type: 'string' },
    segments: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'narration_text', 'visual_prompt', 'durationSeconds'],
        properties: {
          id: { type: 'integer' },
          narration_text: { type: 'string' },
          visual_prompt: { type: 'string' },
          durationSeconds: { type: 'number' },
        },
      },
    },
    quiz: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'options', 'correct_answer', 'explanation'],
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correct_answer: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
  },
}

const generatePayloadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['video_steps', 'quiz'],
  properties: {
    video_steps: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'narration_text', 'visual_prompt', 'durationSeconds'],
        properties: {
          id: { type: 'integer' },
          narration_text: { type: 'string' },
          visual_prompt: { type: 'string' },
          durationSeconds: { type: 'number' },
        },
      },
    },
    quiz: payloadSchema.properties.quiz,
  },
}

const passiveGeneratePayloadSchema = {
  ...generatePayloadSchema,
  properties: {
    ...generatePayloadSchema.properties,
    quiz: { type: 'array', maxItems: 0, items: payloadSchema.properties.quiz.items },
  },
}

const generateInstructions = `You are Logictab AI, an expert learning-experience designer and teaching assistant.

Before producing the response, privately plan the best explanation for the learner's question:
1. Identify the direct answer and any prerequisite ideas needed to understand it.
2. Order the lesson from intuition, to mechanism, to a concrete application or takeaway.
3. Choose one focused visual concept per step that makes the narration easier to understand.
4. Match the requested learning style: Standard is concise and passive; Deep Dive is more technical and thorough.

Then generate a cohesive video script timeline. Every video step must have narration that naturally leads into the next step, plus a detailed visual_prompt for a standalone educational illustration. The visual_prompt must describe the subject, composition, important relationships, and visual style; it must not rely on labels or written text inside the image.

For Deep Dive lessons, also create a knowledge-check quiz that tests only facts taught in the narration. For Standard lessons, return an empty quiz array.

Respond ONLY with a valid JSON object fitting the LogictabPayload schema: { video_steps: [...], quiz: [...] }. Do not reveal the private planning process or include markdown.`
const supportedModelTypes = new Set(['openai', 'claude', 'gemini'])
const supportedTones = new Set(['Standard', 'Deep Dive'])

const getTextBlock = (content) => content.find((block) => block.type === 'text')?.text

const parseGeneratedPayload = (content) => {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('The model returned an empty response.')
  }

  const json = content.trim().replace(/^```json\s*|\s*```$/g, '')
  const payload = JSON.parse(json)

  if (!payload || typeof payload !== 'object'
    || !Array.isArray(payload.video_steps)
    || !Array.isArray(payload.quiz)) {
    throw new Error('The model returned an invalid lesson payload.')
  }

  return payload
}

const createVisualPrompt = (visualPrompt) => (
  `Create a polished educational illustration for a lesson. ${visualPrompt} `
  + 'Use a clean, modern editorial style with clear visual storytelling. Do not include any words, labels, letters, or watermarks.'
)

const asDataUrl = (mimeType, base64Data) => (
  typeof base64Data === 'string' && base64Data
    ? `data:${mimeType ?? 'image/png'};base64,${base64Data}`
    : undefined
)

const generateSegmentVisuals = async (modelType, activeKey, videoSteps) => {
  if (modelType === 'claude') {
    return videoSteps
  }

  const generateOne = async (step) => {
    try {
      if (modelType === 'openai') {
        const client = new OpenAI({ apiKey: activeKey })
        const image = await client.images.generate({
          model: 'gpt-image-1',
          prompt: createVisualPrompt(step.visual_prompt),
          size: '1024x1024',
          quality: 'low',
          output_format: 'webp',
        })
        return { ...step, imageDataUrl: asDataUrl('image/webp', image.data?.[0]?.b64_json) }
      }

      const client = new GoogleGenAI({ apiKey: activeKey })
      const image = await client.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: createVisualPrompt(step.visual_prompt),
        config: {
          responseModalities: ['IMAGE'],
          responseFormat: { image: { aspectRatio: '16:9' } },
        },
      })
      const imagePart = image.candidates?.flatMap((candidate) => candidate.content?.parts ?? [])
        .find((part) => part.inlineData?.data)
      return {
        ...step,
        imageDataUrl: asDataUrl(imagePart?.inlineData?.mimeType, imagePart?.inlineData?.data),
      }
    } catch (error) {
      console.warn(`Logictab ${modelType} visual generation failed for step ${step.id}:`, error)
      return step
    }
  }

  return Promise.all(videoSteps.map(generateOne))
}

const enforceRateLimit = (req, res, next) => {
  const now = Date.now()
  const key = req.ip
  const bucket = requestBuckets.get(key)

  if (!bucket || now - bucket.startedAt >= rateLimitWindowMs) {
    requestBuckets.set(key, { startedAt: now, count: 1 })
    next()
    return
  }

  if (bucket.count >= rateLimitMaxRequests) {
    res.status(429).json({ error: 'Too many requests. Please try again in a minute.' })
    return
  }

  bucket.count += 1
  next()
}

app.use(cors({
  methods: ['POST'],
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      callback(null, true)
      return
    }

    callback(new Error('Origin is not allowed by CORS.'))
  },
}))
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' })
})

app.use(enforceRateLimit)

app.post('/api/generate', async (req, res) => {
  const { prompt, tone, modelType, apiKey } = req.body ?? {}

  if (typeof prompt !== 'string' || !prompt.trim() || typeof tone !== 'string' || !supportedTones.has(tone)) {
    return res.status(400).json({ error: 'prompt is required and tone must be Standard or Deep Dive.' })
  }

  if (typeof modelType !== 'string' || !supportedModelTypes.has(modelType)) {
    return res.status(400).json({ error: 'modelType must be one of: openai, claude, or gemini.' })
  }

  if (apiKey !== undefined && typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'apiKey must be a non-empty string when provided.' })
  }

  const environmentKey = {
    openai: process.env.OPENAI_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }[modelType]
  const activeKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : environmentKey

  if (!activeKey) {
    return res.status(400).json({ error: `An API key is required for ${modelType}.` })
  }

  const isDeepDive = tone === 'Deep Dive'
  const userInput = `Topic: ${prompt.trim()}\nTone: ${tone}\n\nReturn exactly three video_steps. Every step must contain id (number), narration_text (string), visual_prompt (string), and durationSeconds (number). ${isDeepDive
    ? 'Return exactly three quiz questions. Every question must contain question (string), options (string[]), correct_answer (one of the options), and explanation (string).'
    : 'This is a passive Standard lesson: return quiz as an empty array.'}`

  try {
    let generatedText

    switch (modelType) {
      case 'openai': {
        const client = new OpenAI({ apiKey: activeKey })
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: generateInstructions },
            { role: 'user', content: userInput },
          ],
        })
        generatedText = response.choices[0]?.message?.content
        break
      }

      case 'claude': {
        const client = new Anthropic({ apiKey: activeKey })
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2_400,
          system: generateInstructions,
          messages: [{ role: 'user', content: userInput }],
        })
        generatedText = getTextBlock(response.content)
        break
      }

      case 'gemini': {
        const client = new GoogleGenAI({ apiKey: activeKey })
        const response = await client.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: userInput,
          config: {
            systemInstruction: generateInstructions,
            responseMimeType: 'application/json',
            responseSchema: isDeepDive ? generatePayloadSchema : passiveGeneratePayloadSchema,
          },
        })
        generatedText = response.text
        break
      }
    }

    const payload = parseGeneratedPayload(generatedText)
    const videoSteps = await generateSegmentVisuals(modelType, activeKey, payload.video_steps)
    return res.json({ ...payload, video_steps: videoSteps })
  } catch (error) {
    console.error(`Logictab ${modelType} generation failed:`, error)
    return res.status(502).json({ error: 'The selected AI provider could not generate a lesson.' })
  }
})

app.post('/api/explain', async (req, res) => {
  const { query, tone } = req.body ?? {}

  if (typeof query !== 'string' || !query.trim() || typeof tone !== 'string' || !tone.trim()) {
    return res.status(400).json({ error: 'Both query and tone are required.' })
  }

  if (!openAiApiKey) {
    return res.status(400).json({ error: 'OPENAI_API_KEY is not configured on this server.' })
  }

  try {
    const client = new OpenAI({ apiKey: openAiApiKey })
    const response = await client.responses.create({
      model: 'gpt-5.6',
      reasoning: { effort: 'medium' },
      text: {
        format: {
          type: 'json_schema',
          name: 'logictab_payload',
          strict: true,
          schema: payloadSchema,
        },
      },
      instructions,
      input: `Topic: ${query.trim()}\nTone: ${tone.trim()}`,
    })

    return res.json({ outputText: response.output_text })
  } catch (error) {
    console.error('Logictab generation failed:', error)
    return res.status(500).json({ error: 'Unable to generate a lesson right now.' })
  }
})

app.use((error, _req, res, next) => {
  if (error.message === 'Origin is not allowed by CORS.') {
    res.status(403).json({ error: error.message })
    return
  }

  next(error)
})

app.listen(port, () => {
  console.log(`Logictab API server listening on port ${port}`)
})
