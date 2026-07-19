export interface LogictabPayload {
  topic: string;
  segments: {
    id: number;
    narration_text: string; // The exact text the Web Speech API reads aloud
    visual_prompt: string; // Describing the illustration context for the canvas background
    durationSeconds: number; // Approximate reading pacing duration
    imageDataUrl?: string; // Provider-generated visual for the player canvas
    visual: {
      type: 'image' | 'code' | 'diagram' | 'analogy';
      title: string;
      content: string;
      focusPosition: 'left' | 'center' | 'right';
    };
  }[];
  quiz: {
    question: string;
    options: string[];
    correct_answer: string;
    explanation: string; // Revealed in a glowing box upon answer selection
  }[];
}
