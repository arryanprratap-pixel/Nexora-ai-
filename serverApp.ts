import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const TEXT_MODEL = 'gemini-4-hydrogen';
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.'
    ) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorInfo(err: unknown): { status: number; message: string } {
  const anyErr = err as { status?: number; code?: number; message?: string };
  let status =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.code === 'number' && anyErr.code >= 400 && anyErr.code < 600
        ? anyErr.code
        : 500;
  let message = (anyErr?.message || 'An unexpected server error occurred.').trim();

  for (let i = 0; i < 3; i++) {
    if (message.startsWith('{')) {
      try {
        const parsed = JSON.parse(message) as {
          error?: { message?: string; code?: number };
          message?: string;
        };
        if (typeof parsed?.error?.code === 'number') {
          status = parsed.error.code;
        }
        const inner = parsed?.error?.message || parsed?.message;
        if (typeof inner === 'string' && inner.trim()) {
          message = inner.trim();
          continue;
        }
      } catch {
        break;
      }
    }
    break;
  }

  return { status, message };
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1100): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const { status, message } = extractErrorInfo(err);
    if (
      retries > 0 &&
      (status === 429 || status >= 500 || message.includes('UNAVAILABLE') || message.includes('high demand'))
    ) {
      await new Promise((r) => setTimeout(r, delayMs));
      return withRetry(fn, retries - 1, delayMs * 1.8);
    }
    throw err;
  }
}

async function generateContentWithFallback<T>(
  runner: (modelName: string) => Promise<T>,
  preferredModel: string = TEXT_MODEL
): Promise<T> {
  const candidates =
    preferredModel === 'gemini-3.1-flash-lite'
      ? ['gemini-3.1-flash-lite', TEXT_MODEL]
      : [preferredModel, 'gemini-3.1-flash-lite'];

  let lastErr: unknown;
  for (const modelName of candidates) {
    try {
      return await withRetry(() => runner(modelName), 1);
    } catch (err) {
      lastErr = err;
      const { status } = extractErrorInfo(err);
      if (status === 401 || status === 403) {
        throw err;
      }
    }
  }
  throw lastErr;
}

export const app = express();
const jsonParser = express.json({ limit: '25mb' });
app.use((req, res, next) => {
  if (req.body !== undefined && typeof req.body === 'object') {
    next();
    return;
  }
  jsonParser(req, res, next);
});

app.get('/api/health', (_req, res) => {
  const hasKey = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  res.json({ ok: true, model: TEXT_MODEL, configured: hasKey });
});

app.get('/api/providers', (_req, res) => {
  const isSet = (name: string, placeholder?: string) => {
    const val = (process.env[name] || '').trim();
    return Boolean(val && val !== placeholder);
  };
  res.json({
    providers: [
      { id: 'gemini', name: 'Google Gemini', envVar: 'GEMINI_API_KEY', configured: isSet('GEMINI_API_KEY', 'MY_GEMINI_API_KEY') },
      { id: 'openai', name: 'OpenAI ChatGPT', envVar: 'OPENAI_API_KEY', configured: isSet('OPENAI_API_KEY') },
      { id: 'anthropic', name: 'Anthropic Claude', envVar: 'ANTHROPIC_API_KEY', configured: isSet('ANTHROPIC_API_KEY') },
      { id: 'deepseek', name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', configured: isSet('DEEPSEEK_API_KEY') },
      { id: 'openrouter', name: 'OpenRouter (Grok · Llama · Mistral · Qwen)', envVar: 'OPENROUTER_API_KEY', configured: isSet('OPENROUTER_API_KEY') },
      { id: 'elevenlabs', name: 'ElevenLabs Voice AI', envVar: 'ELEVENLABS_API_KEY', configured: isSet('ELEVENLABS_API_KEY') },
    ],
  });
});

async function streamOpenAICompatibleChat(params: {
  url: string;
  apiKey: string;
  model: string;
  systemInstruction: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    attachments?: Array<{ name: string; mimeType: string; dataBase64?: string; textContent?: string }>;
  }>;
  extraHeaders?: Record<string, string>;
  onToken: (text: string) => void;
}) {
  const formattedMessages = [
    ...(params.systemInstruction
      ? [{ role: 'system', content: params.systemInstruction }]
      : []),
    ...params.messages.map((m) => {
      const textBlocks: string[] = [];
      const imageBlocks: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.textContent) {
            textBlocks.push(`[Attached file: ${att.name}]\n${att.textContent}`);
          } else if (att.dataBase64 && att.mimeType.startsWith('image/')) {
            imageBlocks.push({
              type: 'image_url',
              image_url: { url: `data:${att.mimeType};base64,${att.dataBase64}` },
            });
          }
        }
      }
      if (m.content) textBlocks.push(m.content);
      const joinedText = textBlocks.join('\n\n') || 'Analyze the attached file.';
      if (imageBlocks.length > 0 && m.role === 'user') {
        return {
          role: m.role,
          content: [{ type: 'text', text: joinedText }, ...imageBlocks],
        };
      }
      return { role: m.role, content: joinedText };
    }),
  ];

  const resp = await fetch(params.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: params.model,
      messages: formattedMessages,
      stream: true,
    }),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => '');
    const err = new Error(errText || `Provider returned HTTP ${resp.status}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) params.onToken(delta);
      } catch {
        // ignore partial keepalive frames
      }
    }
  }
}

async function streamAnthropicChat(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    attachments?: Array<{ name: string; mimeType: string; dataBase64?: string; textContent?: string }>;
  }>;
  onToken: (text: string) => void;
}) {
  const formattedMessages = params.messages.map((m) => {
    const parts: string[] = [];
    if (m.attachments) {
      for (const att of m.attachments) {
        if (att.textContent) parts.push(`[Attached file: ${att.name}]\n${att.textContent}`);
      }
    }
    if (m.content) parts.push(m.content);
    return {
      role: m.role,
      content: parts.join('\n\n') || 'Analyze the attached file.',
    };
  });

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 4096,
      system: params.systemInstruction || 'You are NEXORA AI.',
      messages: formattedMessages,
      stream: true,
    }),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => '');
    const err = new Error(errText || `Anthropic returned HTTP ${resp.status}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          params.onToken(parsed.delta.text);
        }
      } catch {
        // ignore keepalives
      }
    }
  }
}

// 1. Streaming AI Chat (Multi-provider: Gemini, ChatGPT, Claude, DeepSeek, OpenRouter)
app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const {
      messages = [],
      systemInstruction = '',
      provider = 'gemini',
      modelId = TEXT_MODEL,
    } = req.body as {
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        attachments?: Array<{
          name: string;
          mimeType: string;
          dataBase64?: string;
          textContent?: string;
        }>;
      }>;
      systemInstruction?: string;
      provider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter';
      modelId?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'Messages array is required.' })}\n\n`);
      res.end();
      return;
    }

    const safeSystem =
      systemInstruction ||
      'You are NEXORA AI, an intelligent, helpful, friendly AI assistant capable of understanding English, Hindi, and Hinglish.';

    if (provider === 'openai') {
      const key = (process.env.OPENAI_API_KEY || '').trim();
      if (!key) {
        res.write(
          `data: ${JSON.stringify({
            status: 403,
            error:
              'OPENAI_API_KEY is not configured in Settings > Secrets. Switch to Google Gemini (Ready) or add OPENAI_API_KEY to use ChatGPT models.',
          })}\n\n`
        );
        res.end();
        return;
      }
      await streamOpenAICompatibleChat({
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: key,
        model: modelId || 'gpt-4o',
        systemInstruction: safeSystem,
        messages,
        onToken: (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    if (provider === 'anthropic') {
      const key = (process.env.ANTHROPIC_API_KEY || '').trim();
      if (!key) {
        res.write(
          `data: ${JSON.stringify({
            status: 403,
            error:
              'ANTHROPIC_API_KEY is not configured in Settings > Secrets. Switch to Google Gemini (Ready) or add ANTHROPIC_API_KEY to use Claude models.',
          })}\n\n`
        );
        res.end();
        return;
      }
      await streamAnthropicChat({
        apiKey: key,
        model: modelId || 'claude-sonnet-4-20250514',
        systemInstruction: safeSystem,
        messages,
        onToken: (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    if (provider === 'deepseek') {
      const key = (process.env.DEEPSEEK_API_KEY || '').trim();
      if (!key) {
        res.write(
          `data: ${JSON.stringify({
            status: 403,
            error:
              'DEEPSEEK_API_KEY is not configured in Settings > Secrets. Switch to Google Gemini (Ready) or add DEEPSEEK_API_KEY to use DeepSeek models.',
          })}\n\n`
        );
        res.end();
        return;
      }
      await streamOpenAICompatibleChat({
        url: 'https://api.deepseek.com/chat/completions',
        apiKey: key,
        model: modelId || 'deepseek-chat',
        systemInstruction: safeSystem,
        messages,
        onToken: (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    if (provider === 'openrouter') {
      const key = (process.env.OPENROUTER_API_KEY || '').trim();
      if (!key) {
        res.write(
          `data: ${JSON.stringify({
            status: 403,
            error:
              'OPENROUTER_API_KEY is not configured in Settings > Secrets. Switch to Google Gemini (Ready) or add OPENROUTER_API_KEY to use Grok, Llama, Mistral & Qwen.',
          })}\n\n`
        );
        res.end();
        return;
      }
      await streamOpenAICompatibleChat({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: key,
        model: modelId || 'meta-llama/llama-3.3-70b-instruct',
        systemInstruction: safeSystem,
        messages,
        extraHeaders: { 'X-Title': 'NEXORA AI' },
        onToken: (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`),
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // Default: Google Gemini (with automatic fallback between gemini-4-hydrogen and gemini-3.1-flash-lite)
    const ai = getGeminiClient();
    const geminiModel =
      modelId === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : TEXT_MODEL;
    const geminiCandidates =
      geminiModel === 'gemini-3.1-flash-lite'
        ? ['gemini-3.1-flash-lite', TEXT_MODEL]
        : [TEXT_MODEL, 'gemini-3.1-flash-lite'];

    const contents = messages.map((msg) => {
      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.dataBase64 && att.mimeType) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.dataBase64,
              },
            });
          } else if (att.textContent) {
            parts.push({
              text: `[Attached file: ${att.name}]\n${att.textContent}`,
            });
          }
        }
      }

      if (msg.content) {
        parts.push({ text: msg.content });
      } else if (parts.length === 0) {
        parts.push({ text: 'Please analyze the attached file.' });
      }

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    let sentAnyChunk = false;
    let streamErr: unknown = null;
    for (const candidateModel of geminiCandidates) {
      try {
        const stream = await withRetry(
          () =>
            ai.models.generateContentStream({
              model: candidateModel,
              contents,
              config: {
                systemInstruction: safeSystem,
                ...(candidateModel === TEXT_MODEL
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
              },
            }),
          1
        );

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            sentAnyChunk = true;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
        streamErr = null;
        break;
      } catch (err) {
        streamErr = err;
        const { status } = extractErrorInfo(err);
        if (sentAnyChunk || status === 401 || status === 403) {
          throw err;
        }
      }
    }

    if (streamErr) {
      throw streamErr;
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const info = extractErrorInfo(err);
    res.write(
      `data: ${JSON.stringify({ error: info.message, status: info.status })}\n\n`
    );
    res.end();
  }
});

// 2. Homework Helper (multimodal image reading + 4 modes)
app.post('/api/homework', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      subject = 'Maths',
      mode = 'Solve',
      question = '',
      studentAnswer = '',
      language = 'English',
      imageBase64,
      imageMimeType,
    } = req.body as {
      subject: string;
      mode: string;
      question: string;
      studentAnswer?: string;
      language?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!question.trim() && !imageBase64) {
      res.status(400).json({ error: 'Please provide a question or upload an image.' });
      return;
    }

    const modeInstructions: Record<string, string> = {
      Explain:
        'Explain the underlying concept clearly from scratch in simple language, then walk through how it applies to this question.',
      Solve:
        'First state the exact question (transcribing it accurately if an image is attached), then solve it step-by-step with clear formulas and a final highlighted answer.',
      'Give Hint':
        'Do NOT reveal the final answer yet. Provide 2-3 progressive, encouraging hints and the starting formula/approach so the student can solve it themselves.',
      'Check My Answer':
        'Carefully inspect the student’s proposed answer, identify whether it is right or where the first mistake happened, and walk through the correct steps kindly.',
    };

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64,
        },
      });
    }

    const promptText = [
      `Subject: ${subject}`,
      `Mode: ${mode} — ${modeInstructions[mode] || modeInstructions.Solve}`,
      `Preferred Output Language: ${language}`,
      question.trim() ? `Question text: ${question.trim()}` : 'Please read the question directly from the attached image.',
      mode === 'Check My Answer' && studentAnswer?.trim()
        ? `Student's Answer to Check: ${studentAnswer.trim()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    parts.push({ text: promptText });

    const response = await generateContentWithFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          systemInstruction:
            'You are NEXORA AI Homework Tutor. Be accurate, crystal clear, encouraging, and format math/science steps cleanly with Markdown.',
          ...(modelName === TEXT_MODEL
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } }
            : {}),
        },
      })
    );

    res.json({ result: response.text || '' });
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 3. YouTube SEO Generator (structured JSON)
app.post('/api/youtube', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      topic = '',
      category = 'Educational',
      language = 'English',
    } = req.body as {
      topic: string;
      category: string;
      language: string;
    };

    if (!topic.trim()) {
      res.status(400).json({ error: 'Please enter a video topic or idea.' });
      return;
    }

    const response = await generateContentWithFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: `Generate a complete YouTube SEO growth package for a ${category} video about: "${topic.trim()}". Output language: ${language}. Make titles high-CTR, description rich with timestamps/hook/CTA, 15 relevant SEO tags, 8 hashtags, 3 punchy thumbnail text concepts, and an engaging 15-second intro hook script.`,
        config: {
          systemInstruction:
            'You are a top-performing YouTube growth strategist and SEO copywriter.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '5 catchy, high-CTR video title options.',
              },
              description: {
                type: Type.STRING,
                description: 'Long, well-formatted SEO YouTube description with hook, summary, chapters placeholder, and CTA.',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '12-18 comma-ready YouTube search tags.',
              },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '6-10 hashtags starting with #.',
              },
              thumbnailIdeas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    headlineText: { type: Type.STRING },
                    visualConcept: { type: Type.STRING },
                  },
                },
              },
              hookScript: {
                type: Type.STRING,
                description: 'First 15-second spoken hook script.',
              },
            },
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    res.json(parsed);
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 4. Coding Assistant
app.post('/api/coding', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      language = 'Python',
      mode = 'Generate Code',
      prompt = '',
      code = '',
      outputLanguage = 'English',
    } = req.body as {
      language: string;
      mode: string;
      prompt: string;
      code?: string;
      outputLanguage?: string;
    };

    if (!prompt.trim() && !code.trim()) {
      res.status(400).json({ error: 'Please describe what to build or paste code to inspect.' });
      return;
    }

    const fullPrompt = [
      `Target Language / Stack: ${language}`,
      `Task Mode: ${mode}`,
      `Explanation Language: ${outputLanguage}`,
      prompt.trim() ? `Instructions: ${prompt.trim()}` : '',
      code.trim() ? `Existing Code:\n\`\`\`\n${code.trim()}\n\`\`\`` : '',
      mode === 'Complete Website' || language === 'HTML/CSS/JS'
        ? 'If generating a webpage or interactive browser app, include a complete self-contained single-file HTML document in an ```html code block so it can be previewed live.'
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await generateContentWithFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
          systemInstruction:
            'You are NEXORA AI Principal Software & Game Engineer. Write clean, bug-free, production-quality code with clear explanations and fenced Markdown code blocks.',
          ...(modelName === TEXT_MODEL
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } }
            : {}),
        },
      })
    );

    res.json({ result: response.text || '' });
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 5. General Utility Tool Endpoint (Story, Translator, Summarizer, Brainstorming, Voice)
app.post('/api/utility', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { tool, payload } = req.body as {
      tool: 'story' | 'translator' | 'summarizer' | 'brainstorming' | 'voice';
      payload: Record<string, string>;
    };

    if (tool === 'brainstorming') {
      const response = await generateContentWithFallback((modelName) =>
        ai.models.generateContent({
          model: modelName,
          contents: `Brainstorm creative, practical ideas for topic: "${payload.topic}" in category "${payload.category || 'General'}". Output language: ${payload.language || 'English'}.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                summary: { type: Type.STRING },
                pillars: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: { type: Type.STRING },
                      ideas: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            actionStep: { type: Type.STRING },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })
      );
      res.json(JSON.parse((response.text || '{}').trim()));
      return;
    }

    let prompt = '';
    let systemInstruction = 'You are NEXORA AI.';

    if (tool === 'story') {
      systemInstruction =
        'You are an imaginative fiction writer and storyteller. Craft vivid, engaging stories with natural pacing.';
      prompt = `Write a ${payload.length || 'Medium'} ${payload.genre || 'Sci-Fi'} story with a ${payload.tone || 'Inspiring'} tone in ${payload.language || 'English'}.\nPrompt / Premise: ${payload.prompt}`;
    } else if (tool === 'translator') {
      systemInstruction =
        'You are a fluent multilingual translator specializing in English, Hindi, Hinglish, and global languages. Return accurate, natural-sounding translations with brief nuance notes if helpful.';
      prompt = `Translate the following text from ${payload.sourceLang || 'Auto-detect'} to ${payload.targetLang || 'Hindi'} using a ${payload.tone || 'Natural'} tone:\n\n${payload.text}`;
    } else if (tool === 'summarizer') {
      systemInstruction =
        'You are an executive analyst. Distill dense text into clear, accurate takeaways without losing critical facts.';
      prompt = `Summarize the following content in "${payload.format || 'Bullet Points'}" format in ${payload.language || 'English'}:\n\n${payload.text}`;
    } else if (tool === 'voice') {
      systemInstruction = `You are NEXORA Voice Assistant. Respond in ${payload.language || 'English'} in a natural, conversational spoken style (2 to 4 clear sentences, avoiding complex markdown symbols so it sounds great when read aloud).`;
      prompt = payload.prompt || '';
    } else {
      res.status(400).json({ error: 'Unknown utility tool.' });
      return;
    }

    const response = await generateContentWithFallback((modelName) =>
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { systemInstruction },
      })
    );

    res.json({ result: response.text || '' });
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 6. AI Image, Photo Remix & Vector Illustration Generator (supports text + user-uploaded reference images)
function extractVectorArtworkPayload(
  rawText: string,
  fallbackTitle: string
): { title: string; svgMarkup: string; palette: string[]; artDirectionNotes: string } {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json|svg|xml)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryJson = (str: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(str);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  let obj = tryJson(cleaned);
  if (!obj) {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      obj = tryJson(cleaned.slice(first, last + 1));
    }
  }

  if (obj && typeof obj.svgMarkup === 'string' && obj.svgMarkup.includes('<svg')) {
    return {
      title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : fallbackTitle,
      svgMarkup: obj.svgMarkup,
      palette: Array.isArray(obj.palette)
        ? obj.palette.filter((p): p is string => typeof p === 'string')
        : [],
      artDirectionNotes:
        typeof obj.artDirectionNotes === 'string' ? obj.artDirectionNotes : '',
    };
  }

  // Recover inline <svg>...</svg> even when JSON quotes inside SVG attributes broke JSON.parse
  const unescaped = cleaned.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  const svgMatch = unescaped.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    const titleMatch = unescaped.match(/"title"\s*:\s*"([^"]+)"/);
    return {
      title: titleMatch?.[1] || fallbackTitle,
      svgMarkup: svgMatch[0],
      palette: [],
      artDirectionNotes: 'Recovered layered vector illustration.',
    };
  }

  return { title: fallbackTitle, svgMarkup: '', palette: [], artDirectionNotes: '' };
}

app.post('/api/image', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      prompt = '',
      style = 'Futuristic Illustration',
      aspectRatio = '1:1',
      previousSvg = '',
      previousImageBase64 = '',
      previousImageMimeType = 'image/png',
      mode = 'vector',
      referenceImages = [],
    } = req.body as {
      prompt?: string;
      style?: string;
      aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
      previousSvg?: string;
      previousImageBase64?: string;
      previousImageMimeType?: string;
      mode?: 'remix' | 'vector' | 'pixel';
      referenceImages?: Array<{
        name?: string;
        mimeType?: string;
        dataBase64?: string;
      }>;
    };

    const validRefs = (Array.isArray(referenceImages) ? referenceImages : [])
      .filter(
        (img) =>
          img &&
          typeof img.dataBase64 === 'string' &&
          img.dataBase64.length > 0 &&
          typeof img.mimeType === 'string' &&
          img.mimeType.startsWith('image/')
      )
      .slice(0, 3);

    const cleanPrompt = (prompt || '').trim();
    if (!cleanPrompt && validRefs.length === 0) {
      res.status(400).json({
        error: 'Please describe your image or upload a reference image.',
      });
      return;
    }

    const effectivePrompt =
      cleanPrompt ||
      `Transform and reimagine the uploaded reference image(s) in a cohesive ${style} visual style.`;

    // Mode 1: Photo Remix (analyzes real uploaded photo(s) with gemini-4-hydrogen & returns shader/lighting/particle recipe)
    if (mode === 'remix') {
      if (validRefs.length === 0) {
        res.status(400).json({
          error: 'Photo Remix requires at least one uploaded reference image.',
        });
        return;
      }

      const remixPrompt = `Examine the uploaded reference photo(s) carefully. Design a cinematic color-grading, lighting, atmosphere, and particle remix recipe for the user's request: "${effectivePrompt}" in visual style "${style}".
Respond ONLY with JSON matching this schema so our high-resolution canvas compositor transforms the user's real photograph cleanly without destroying the real subject:
- brightness: 0.65..1.45
- contrast: 0.75..1.65
- saturate: 0.2..2.2
- hueRotate: -180..180
- sepia: 0..0.85
- bloom: 0..0.6
- vignette: 0..0.85
- tintTopColor & tintBottomColor: vivid hex colors matching the requested mood
- tintOpacity: 0..0.65
- blendMode: "screen" | "overlay" | "soft-light" | "color" | "multiply"
- particleEffect: "none" | "rain" | "neon-sparks" | "bokeh" | "sunbeams" | "grain"
- edgeStyle: "natural" | "cyber-scan" | "comic-ink" | "dream-glow" | "film-noir"
- palette: 4 hex colors
- title: short creative title
- artDirectionNotes: 1 sentence describing the exact relighting/grade applied to their photo.`;

      let recipeObj: Record<string, unknown> = {};
      try {
        const remixResp = await generateContentWithFallback((modelName) =>
          ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                ...validRefs.map((img) => ({
                  inlineData: {
                    mimeType: img.mimeType || 'image/jpeg',
                    data: img.dataBase64!,
                  },
                })),
                { text: remixPrompt },
              ],
            },
            config: {
              abortSignal: AbortSignal.timeout(18000),
              ...(modelName === TEXT_MODEL
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                required: ['title', 'brightness', 'contrast', 'saturate', 'tintTopColor', 'tintBottomColor'],
                properties: {
                  title: { type: Type.STRING },
                  brightness: { type: Type.NUMBER },
                  contrast: { type: Type.NUMBER },
                  saturate: { type: Type.NUMBER },
                  hueRotate: { type: Type.NUMBER },
                  sepia: { type: Type.NUMBER },
                  bloom: { type: Type.NUMBER },
                  vignette: { type: Type.NUMBER },
                  tintTopColor: { type: Type.STRING },
                  tintBottomColor: { type: Type.STRING },
                  tintOpacity: { type: Type.NUMBER },
                  blendMode: { type: Type.STRING },
                  particleEffect: { type: Type.STRING },
                  edgeStyle: { type: Type.STRING },
                  palette: { type: Type.ARRAY, items: { type: Type.STRING } },
                  artDirectionNotes: { type: Type.STRING },
                },
              },
            },
          })
        );
        recipeObj = JSON.parse((remixResp.text || '{}').trim()) as Record<string, unknown>;
      } catch {
        // Safe empty fallback lets client apply smart prompt-matched defaults
        recipeObj = {};
      }

      res.json({
        mode: 'remix',
        title:
          typeof recipeObj.title === 'string' && recipeObj.title.trim()
            ? recipeObj.title.trim()
            : cleanPrompt || `${style} Photo Remix`,
        svgMarkup: '',
        remixRecipe: recipeObj,
        palette: Array.isArray(recipeObj.palette) ? recipeObj.palette : [],
        artDirectionNotes:
          typeof recipeObj.artDirectionNotes === 'string'
            ? recipeObj.artDirectionNotes
            : 'Applied AI lighting, atmosphere, and color grading directly to your photo.',
      });
      return;
    }

    // Mode 2: Pixel Image AI (gemini-3.1-flash-lite-image with optional OpenAI gpt-image-1 fallback if OPENAI_API_KEY is set)
    if (mode === 'pixel') {
      const pixelParts: Array<
        { inlineData: { mimeType: string; data: string } } | { text: string }
      > = validRefs.map((img) => ({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.dataBase64!,
        },
      }));

      if (previousImageBase64) {
        pixelParts.push({
          inlineData: {
            mimeType: previousImageMimeType || 'image/png',
            data: previousImageBase64,
          },
        });
      }

      pixelParts.push({
        text:
          validRefs.length > 0 || previousImageBase64
            ? `Using the provided reference image(s), ${effectivePrompt} Style direction: ${style}.`
            : `${effectivePrompt}. Style direction: ${style}.`,
      });

      try {
        const pixelResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: { parts: pixelParts },
          config: {
            imageConfig: {
              aspectRatio,
            },
          },
        });

        let generatedBase64 = '';
        let generatedMime = 'image/png';
        let notes = '';

        for (const part of pixelResponse.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data && !generatedBase64) {
            generatedBase64 = part.inlineData.data;
            generatedMime = part.inlineData.mimeType || 'image/png';
          } else if (part.text) {
            notes += `${part.text} `;
          }
        }

        if (!generatedBase64) {
          res.status(502).json({
            error:
              'Pixel Image AI returned no image pixels. Switch to Photo Remix (for uploaded photos) or Vector Studio.',
          });
          return;
        }

        res.json({
          mode: 'pixel',
          title: cleanPrompt ? cleanPrompt.slice(0, 48) : `${style} Edit`,
          svgMarkup: '',
          imageUrl: `data:${generatedMime};base64,${generatedBase64}`,
          palette: [],
          artDirectionNotes: notes.trim(),
        });
        return;
      } catch (pixelErr) {
        const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
        if (openaiKey && validRefs.length === 0) {
          try {
            const sizeMap: Record<string, string> = {
              '1:1': '1024x1024',
              '16:9': '1536x1024',
              '9:16': '1024x1536',
              '4:3': '1536x1024',
            };
            const oaResp = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: `${effectivePrompt}. Visual style: ${style}.`,
                size: sizeMap[aspectRatio] || '1024x1024',
              }),
            });
            if (oaResp.ok) {
              const oaData = (await oaResp.json()) as {
                data?: Array<{ b64_json?: string; url?: string }>;
              };
              const b64 = oaData.data?.[0]?.b64_json;
              const url = oaData.data?.[0]?.url;
              if (b64 || url) {
                res.json({
                  mode: 'pixel',
                  title: cleanPrompt ? cleanPrompt.slice(0, 48) : `${style} Render`,
                  svgMarkup: '',
                  imageUrl: b64 ? `data:image/png;base64,${b64}` : url,
                  palette: [],
                  artDirectionNotes: 'Generated using OpenAI gpt-image-1.',
                });
                return;
              }
            }
          } catch {
            // Fall through to structured Gemini quota guidance
          }
        }

        const info = extractErrorInfo(pixelErr);
        const lower = info.message.toLowerCase();
        const isBillingOrQuota =
          info.status === 401 ||
          info.status === 402 ||
          info.status === 403 ||
          info.status === 429 ||
          /billing|paid|tier|quota|permission|not enabled|found|unavailable/.test(lower);

        if (isBillingOrQuota) {
          res.status(info.status >= 400 ? info.status : 402).json({
            error: `Pixel Image AI (gemini-3.1-flash-lite-image) requires a billing-enabled paid Gemini API key or OPENAI_API_KEY in Settings > Secrets. Use Photo Remix for your uploaded photos or Vector Studio for text illustrations right away.`,
          });
          return;
        }
        throw pixelErr;
      }
    }

    // Mode 3: Detailed Layered Vector Studio (SVG)
    const viewBoxMap: Record<string, string> = {
      '1:1': '0 0 800 800',
      '16:9': '0 0 1280 720',
      '9:16': '0 0 720 1280',
      '4:3': '0 0 960 720',
    };
    const viewBox = viewBoxMap[aspectRatio] || '0 0 800 800';

    let instruction: string;
    if (previousSvg && validRefs.length > 0) {
      instruction = `Analyze the uploaded reference image(s) AND edit the existing SVG illustration according to: "${effectivePrompt}". Preserve recognizable subjects, poses, and colors while adding rich layered SVG detail (${style} style, viewBox="${viewBox}").\nExisting SVG:\n${previousSvg.slice(0, 6000)}`;
    } else if (previousSvg) {
      instruction = `Edit the existing SVG illustration according to this instruction: "${effectivePrompt}". Maintain viewBox="${viewBox}" and rich multi-layered gradients, lighting, and foreground detail.\nExisting SVG:\n${previousSvg.slice(0, 6000)}`;
    } else if (validRefs.length > 0) {
      instruction = `Examine the uploaded reference image(s) carefully — preserve the exact main subject(s), pose, composition, proportions, and colors — and craft a richly detailed, multi-layered vector illustration (<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">) with at least 25+ distinct SVG paths/shapes/gradients across sky/backdrop, midground, recognizable hero subject(s), highlights, and atmospheric lighting. User instruction: "${effectivePrompt}". Style: ${style}. Never output just 2-3 basic circles! Avoid <script> or external URLs.`;
    } else {
      instruction = `Create a richly detailed, museum-grade multi-layered vector illustration as valid standalone SVG markup (<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">) for: "${effectivePrompt}". Visual Style: ${style}. Build depth with at least 25+ distinct SVG shapes/paths: <defs> linear/radial gradients and soft glow filters, sky/backdrop layer, midground architecture/landscape silhouettes, detailed foreground focal subject(s), rim lighting, and atmospheric particles. Never return a sparse 2-circle placeholder. Avoid <script> or external URLs.`;
    }

    const contents =
      validRefs.length > 0
        ? {
            parts: [
              ...validRefs.map((img) => ({
                inlineData: {
                  mimeType: img.mimeType || 'image/jpeg',
                  data: img.dataBase64!,
                },
              })),
              { text: instruction },
            ],
          }
        : instruction;

    const runVectorGen = (modelName: string, timeoutMs: number) =>
      ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          abortSignal: AbortSignal.timeout(timeoutMs),
          systemInstruction:
            'You are a master vector illustrator and SVG technical artist. Always produce intricate, recognizable, layered scenes with rich gradients, shadows, highlights, and clear composition — never crude 2-shape placeholders.',
          ...(modelName === TEXT_MODEL
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            required: ['title', 'svgMarkup'],
            properties: {
              title: { type: Type.STRING },
              svgMarkup: {
                type: Type.STRING,
                description: `Complete valid <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">...</svg> code with 25+ layered shapes, rich gradients, lighting, and recognizable subject detail.`,
              },
              palette: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '4 to 6 hex color codes used in the artwork.',
              },
              artDirectionNotes: { type: Type.STRING },
            },
          },
        },
      });

    let extracted = {
      title: cleanPrompt || `${style} Illustration`,
      svgMarkup: '',
      palette: [] as string[],
      artDirectionNotes: '',
    };
    let lastErr: unknown = null;

    for (const candidateModel of [TEXT_MODEL, 'gemini-3.1-flash-lite']) {
      try {
        const resp = await withRetry(() => runVectorGen(candidateModel, 26000), 1);
        const parsed = extractVectorArtworkPayload(
          resp.text || '',
          cleanPrompt || `${style} Illustration`
        );
        if (parsed.svgMarkup.includes('<svg')) {
          extracted = parsed;
          break;
        }
      } catch (err) {
        lastErr = err;
        const { status } = extractErrorInfo(err);
        if (status === 401 || status === 403) throw err;
      }
    }

    if (!extracted.svgMarkup.includes('<svg')) {
      if (lastErr) throw lastErr;
      res.status(502).json({
        error: 'Vector generator could not build a valid SVG illustration. Please try a clearer description.',
      });
      return;
    }

    res.json({ ...extracted, mode: 'vector' });
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

function extractStoryboardJson(rawText: string, fallbackTitle: string): { title: string; scenes: unknown[] } {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  let parsed: unknown = tryParse(cleaned);
  if (!parsed) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      parsed = tryParse(cleaned.slice(start, end + 1));
    }
  }
  if (!parsed) {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      parsed = tryParse(cleaned.slice(start, end + 1));
    }
  }
  if (!parsed) {
    const idx = cleaned.indexOf('"scenes"');
    const arrStart = idx >= 0 ? cleaned.indexOf('[', idx) : cleaned.indexOf('[');
    if (arrStart >= 0) {
      const frag = cleaned.slice(arrStart);
      const lastBrace = frag.lastIndexOf('}');
      if (lastBrace > 0) {
        const arr = tryParse(`${frag.slice(0, lastBrace + 1)}]`);
        if (Array.isArray(arr) && arr.length > 0) {
          parsed = { title: fallbackTitle, scenes: arr };
        }
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { title: fallbackTitle, scenes: [] };
  }
  if (Array.isArray(parsed)) {
    return { title: fallbackTitle, scenes: parsed.filter((x) => x && typeof x === 'object') };
  }
  const obj = parsed as Record<string, unknown>;
  const nested =
    (obj.storyboard && typeof obj.storyboard === 'object' ? (obj.storyboard as Record<string, unknown>) : null) ||
    (obj.video && typeof obj.video === 'object' ? (obj.video as Record<string, unknown>) : null);
  const title =
    (typeof obj.title === 'string' && obj.title.trim()) ||
    (nested && typeof nested.title === 'string' && nested.title.trim()) ||
    fallbackTitle;
  const candidate =
    obj.scenes ??
    obj.chapters ??
    obj.segments ??
    (Array.isArray(obj.storyboard) ? obj.storyboard : undefined) ??
    nested?.scenes ??
    nested?.chapters;

  let scenes: unknown[] = [];
  if (Array.isArray(candidate)) {
    scenes = candidate.filter((x) => x && typeof x === 'object');
  } else if (candidate && typeof candidate === 'object') {
    scenes = Object.values(candidate).filter((x) => x && typeof x === 'object');
  }
  return { title, scenes };
}

// 7. Multi-Minute Multi-Format Animated Video Storyboard Generator (powered by gemini-4-hydrogen + fast fallback)
app.post('/api/video/storyboard', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      topic = '',
      durationSeconds = 120,
      videoType = 'auto',
      style = 'Auto (AI Decides)',
      aspectRatio = '16:9',
      language = 'English',
      animationIntensity = 'dynamic',
      cameraOverride = 'auto',
    } = req.body as {
      topic: string;
      durationSeconds: number;
      videoType?: string;
      style: string;
      aspectRatio: string;
      language: string;
      animationIntensity?: string;
      cameraOverride?: string;
    };

    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      res.status(400).json({ error: 'Please describe your video topic or script.' });
      return;
    }

    const sceneCount = durationSeconds <= 45 ? 4 : durationSeconds <= 120 ? 5 : 6;
    const perScene = Math.max(5, Math.round(durationSeconds / sceneCount));

    const formatDirective =
      videoType === 'whiteboard_explainer'
        ? 'Format: Whiteboard Explainer Video — focus on crisp educational breakdown with 2-3 short punchy "keyPoints" per scene for on-screen diagram callouts plus supporting characters.'
        : videoType === '2d_motion'
          ? 'Format: 2D Motion Graphics Video — crisp visual storytelling with 2 short "keyPoints" callouts per scene, dynamic vector characters, and vibrant color palettes.'
          : videoType === 'cinematic_story'
            ? 'Format: Cinematic Story / Documentary — dramatic film-grade storytelling, moody lighting moods ("golden_hour", "dramatic", "stormy"), wide camera framing, and poignant keyPoints.'
            : videoType === '3d_animation'
              ? 'Format: Real-Time 3D Animated Movie — dynamic 3D world biomes, moving articulated 3D actors, vehicles/animals, and expressive camera cinematography.'
              : 'Format: Auto — decide the best format ("3d_animation", "2d_motion", "whiteboard_explainer", or "cinematic_story") for this exact topic.';

    const cameraRule =
      cameraOverride && cameraOverride !== 'auto'
        ? `3. Use "${cameraOverride}" for cameraShot across scenes to honor the user's requested camera direction.`
        : '3. Vary dynamic "cameraShot" across scenes for genuine cinematography: choose from "dolly-in", "tracking", "orbit", "low-angle", "aerial", "first-person", "handheld", or "zoom-sweep". Never repeat the same shot twice in a row.';

    const prompt = `Direct a continuous ${durationSeconds}-second (${Math.round((durationSeconds / 60) * 10) / 10} minute) animated video about: "${cleanTopic}".
${formatDirective}
Direction Style: ${style}
Animation Intensity: ${animationIntensity}
Aspect Ratio: ${aspectRatio}
Language for title, narration, keyPoints, and subtitles: ${language}

CRITICAL SITUATIONAL & CONTINUITY RULES:
1. Choose the world "biome" for EACH scene dynamically to match the exact situation of the story:
   - Allowed biomes: "forest" (parks, meadows, villages, sports fields, nature), "city" (streets, racing cars, buildings, vlogs), "classroom" (school, math, science, homework), "indoor_studio" (coding, YouTube, podcast, music, stage, home), "ocean" (beach, island, sea, pirates, boats), "desert" (dunes, pyramids, safari), "mountain" (snow peaks, valley, winter), "fantasy_kingdom" (castles, magic, dragons, wizards), "cyber_arena" (esports, robots, sci-fi arena), "space" (ONLY if the prompt explicitly asks about planets, stars, rockets, astronauts, or outer space!).
   - NEVER use "space" as a default for everyday stories, comedy, sports, cars, coding, school, or animals!
2. Choose scene "mood": "daylight", "golden_hour", "night_neon", "stormy", "cozy", or "dramatic".
   Also choose "weather": "clear", "rain", "snow", "embers", or "wind" fitting the biome and mood.
${cameraRule}
4. CHARACTER CONSISTENCY & REAL MOTION:
   - Keep the main hero actor (same "role", same "color", same "accentColor") consistent across every scene in the story so viewers follow one unified protagonist.
   - Create ${sceneCount} progressive scenes (~${perScene}s each, summing to ${durationSeconds}s) that advance the story smoothly:
   - Keep narration to 1-2 vivid spoken sentences (~14-24 words) and subtitle under 78 characters.
   - Include "keyPoints": 2 to 3 crisp, informative 3-to-6 word bullet takeaways for each scene.
   - Each scene MUST include 1 to 3 actively moving "actors" with:
     - role: one of "human", "student", "wizard", "robot", "cat", "dog", "car", "drone", "bird", "dragon", "rocket"
     - action: one of "walk", "run", "jump", "fly", "drive", "cast-spell", "dance", "wave", "talk" (avoid static "idle")
     - expression: one of "neutral", "happy", "excited", "focused", "surprised"
     - startPos: [x, z] where x is -8..8, z is -6..6
     - endPos: [x, z] at least 4 units away from startPos so every actor travels across the scene!
     - color & accentColor (vivid hex colors), scale (0.85..1.35)
   - Each scene MUST include 4 to 7 environment "props":
     - kind: one of "tree", "pine", "house", "building", "desk", "bookshelf", "mountain", "rock", "boat", "streetlamp", "stage", "portal", "chest", "flower", "fountain", "goalpost", "ball"
     - x (-12..12), z (-12..10), scale (0.8..1.8), hex color.`;

    const storyboardSchema = {
      type: Type.OBJECT,
      required: ['title', 'scenes'],
      properties: {
        title: { type: Type.STRING },
        scenes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ['title', 'narration', 'durationSeconds', 'biome', 'mood', 'cameraShot', 'actors', 'props'],
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              narration: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              keyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              durationSeconds: { type: Type.INTEGER },
              biome: { type: Type.STRING },
              mood: { type: Type.STRING },
              weather: { type: Type.STRING },
              cameraShot: { type: Type.STRING },
              transition: { type: Type.STRING },
              actors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ['role', 'action', 'color', 'startPos', 'endPos'],
                  properties: {
                    id: { type: Type.STRING },
                    role: { type: Type.STRING },
                    action: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    color: { type: Type.STRING },
                    accentColor: { type: Type.STRING },
                    startPos: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    endPos: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    scale: { type: Type.NUMBER },
                  },
                },
              },
              props: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ['kind', 'x', 'z', 'color'],
                  properties: {
                    kind: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    z: { type: Type.NUMBER },
                    scale: { type: Type.NUMBER },
                    color: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    };

    const runStoryboard = (modelName: string, timeoutMs: number, useSchema: boolean) =>
      ai.models.generateContent({
        model: modelName,
        contents: useSchema
          ? prompt
          : `${prompt}\n\nReturn ONLY a valid JSON object: {"title":"...","scenes":[{"id":"s1","title":"...","narration":"...","subtitle":"...","keyPoints":["Point 1","Point 2"],"durationSeconds":${perScene},"biome":"forest","mood":"daylight","cameraShot":"follow-hero","actors":[{"role":"human","action":"walk","color":"#2563EB","accentColor":"#F59E0B","startPos":[-5,1],"endPos":[5,0],"scale":1.0}],"props":[{"kind":"tree","x":-6,"z":-5,"scale":1.2,"color":"#16A34A"}]}]}`,
        config: {
          abortSignal: AbortSignal.timeout(timeoutMs),
          systemInstruction:
            'You are an award-winning animation & video director skilled in 3D animation, 2D motion graphics, whiteboard explainers, and cinematic storytelling. Dynamically pick the right environment biome, mood, moving characters, vehicles, animals, keyPoints, and camera shots for each scene. Avoid space unless explicitly requested.',
          ...(modelName === TEXT_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          responseMimeType: 'application/json',
          ...(useSchema ? { responseSchema: storyboardSchema } : {}),
        },
      });

    let extracted: { title: string; scenes: unknown[] } = { title: cleanTopic, scenes: [] };
    let lastErr: unknown = null;

    const attempts: Array<{ model: string; timeoutMs: number; useSchema: boolean }> = [
      { model: TEXT_MODEL, timeoutMs: 22000, useSchema: true },
      { model: 'gemini-3.1-flash-lite', timeoutMs: 22000, useSchema: true },
      { model: 'gemini-3.1-flash-lite', timeoutMs: 22000, useSchema: false },
    ];

    for (const attempt of attempts) {
      try {
        const resp = await runStoryboard(attempt.model, attempt.timeoutMs, attempt.useSchema);
        const candidate = extractStoryboardJson(resp.text || '', cleanTopic);
        if (candidate.scenes.length > 0) {
          extracted = candidate;
          break;
        }
      } catch (err) {
        lastErr = err;
        const { status } = extractErrorInfo(err);
        if (status === 401 || status === 403) {
          throw err;
        }
      }
    }

    if (extracted.scenes.length === 0) {
      if (lastErr) throw lastErr;
      res.status(502).json({
        error: 'Video model returned an empty storyboard. Please try again in a moment.',
      });
      return;
    }

    res.json(extracted);
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 8. ElevenLabs Voices Catalog & Multi-Engine Text-to-Speech (Gemini TTS + ElevenLabs)
const ELEVENLABS_FALLBACK_VOICES = [
  { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', category: 'premade', description: 'Warm, calm, expressive narration' },
  { voice_id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew', category: 'premade', description: 'Clear, balanced, well-rounded' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', category: 'premade', description: 'Soft, articulate, friendly' },
  { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', category: 'premade', description: 'Crisp, upbeat, conversational' },
  { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', category: 'premade', description: 'Deep, confident, storytelling' },
  { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', category: 'premade', description: 'Deep, authoritative, cinematic' },
  { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', category: 'premade', description: 'Energetic, bold, expressive' },
  { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', category: 'premade', description: 'Bright, youthful, clear' },
];

app.get('/api/elevenlabs/voices', async (_req, res) => {
  const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim();
  if (!apiKey) {
    res.json({ configured: false, voices: ELEVENLABS_FALLBACK_VOICES });
    return;
  }

  try {
    const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      res.json({ configured: true, voices: ELEVENLABS_FALLBACK_VOICES });
      return;
    }
    const data = (await resp.json()) as {
      voices?: Array<{ voice_id: string; name: string; category?: string; description?: string }>;
    };
    const live = Array.isArray(data.voices) && data.voices.length > 0
      ? data.voices.map((v) => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category || 'custom',
          description: v.description || '',
        }))
      : ELEVENLABS_FALLBACK_VOICES;
    res.json({ configured: true, voices: live });
  } catch {
    res.json({ configured: true, voices: ELEVENLABS_FALLBACK_VOICES });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const {
      text = '',
      voiceName = 'Kore',
      style = 'Clear, warm, articulate assistant',
      provider = 'gemini',
      elevenLabsVoiceId = '21m00Tcm4TlvDq8ikWAM',
      mode = 'single',
      secondaryVoiceName = 'Puck',
      speakerAName = 'Alex',
      speakerBName = 'Sam',
      dialogueLines = [],
      stability = 0.48,
      similarityBoost = 0.78,
    } = req.body as {
      text: string;
      voiceName?: string;
      style?: string;
      provider?: 'gemini' | 'elevenlabs';
      elevenLabsVoiceId?: string;
      mode?: 'single' | 'dialogue';
      secondaryVoiceName?: string;
      speakerAName?: string;
      speakerBName?: string;
      dialogueLines?: Array<{ speaker: string; text: string }>;
      stability?: number;
      similarityBoost?: number;
    };

    const cleanText = String(text || '')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_~>]/g, '')
      .trim()
      .slice(0, 2500);

    const validDialogue = Array.isArray(dialogueLines)
      ? dialogueLines
          .filter((d) => d && typeof d.text === 'string' && d.text.trim())
          .slice(0, 14)
      : [];

    if (!cleanText && validDialogue.length === 0) {
      res.status(400).json({ error: 'No speakable text provided.' });
      return;
    }

    if (provider === 'elevenlabs') {
      const elKey = (process.env.ELEVENLABS_API_KEY || '').trim();
      if (!elKey) {
        res.status(403).json({
          error:
            'ELEVENLABS_API_KEY is not configured. Add ELEVENLABS_API_KEY in Settings > Secrets to synthesize ElevenLabs voices, or switch Voice Engine to Gemini TTS.',
        });
        return;
      }

      const safeStability = Math.max(0, Math.min(1, Number.isFinite(Number(stability)) ? Number(stability) : 0.48));
      const safeSimilarity = Math.max(0, Math.min(1, Number.isFinite(Number(similarityBoost)) ? Number(similarityBoost) : 0.78));
      const elScript =
        cleanText ||
        validDialogue.map((d) => `${d.speaker}: ${d.text}`).join('\n').slice(0, 2500);

      const safeVoiceId = encodeURIComponent(
        (elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM').trim()
      );
      const elResp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${safeVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
            'xi-api-key': elKey,
          },
          body: JSON.stringify({
            text: elScript,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: safeStability,
              similarity_boost: safeSimilarity,
            },
          }),
          signal: AbortSignal.timeout(25000),
        }
      );

      if (!elResp.ok) {
        const errBody = await elResp.text().catch(() => '');
        let detail = `ElevenLabs API returned HTTP ${elResp.status}.`;
        try {
          const parsed = JSON.parse(errBody) as { detail?: { message?: string } | string };
          if (typeof parsed.detail === 'string') detail = parsed.detail;
          else if (parsed.detail?.message) detail = parsed.detail.message;
        } catch {
          if (errBody) detail = errBody.slice(0, 200);
        }
        res.status(elResp.status).json({
          error: `ElevenLabs TTS failed: ${detail}`,
        });
        return;
      }

      const arrayBuf = await elResp.arrayBuffer();
      const audioBase64 = Buffer.from(arrayBuf).toString('base64');
      res.json({
        audioBase64,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
      });
      return;
    }

    // Default: Google Gemini TTS
    getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY!;

    const makeClient = (apiVersion?: string) =>
      new GoogleGenAI({
        apiKey,
        ...(apiVersion ? { apiVersion } : {}),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

    // Dual-speaker dialogue mode (gemini-3.8-flash-tts with automatic fallback to single-speaker TTS_MODEL)
    if (mode === 'dialogue' && validDialogue.length > 0) {
      const spkA = (speakerAName || 'Alex').trim() || 'Alex';
      const spkB = (speakerBName || 'Sam').trim() || 'Sam';
      const voiceA = voiceName || 'Kore';
      const voiceB = secondaryVoiceName || 'Puck';

      const callMultiTts = async (apiVersion?: string) => {
        const client = makeClient(apiVersion);
        return client.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: validDialogue.map((turn) => ({
                text: `${turn.speaker}: ${turn.text}`,
                speechMetadata: {
                  speaker: turn.speaker === spkB ? spkB : spkA,
                  style: style || 'Expressive, natural conversational dialogue',
                },
              })),
            },
          ],
          config: {
            abortSignal: AbortSignal.timeout(24000),
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  {
                    speaker: spkA,
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } },
                  },
                  {
                    speaker: spkB,
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } },
                  },
                ],
              },
            },
          },
        });
      };

      let multiAudio = '';
      for (const apiVer of ['v1alpha', undefined] as const) {
        try {
          const multiResponse = await withRetry(() => callMultiTts(apiVer), 1);
          multiAudio =
            multiResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
          if (multiAudio) break;
        } catch (multiErr) {
          const { status } = extractErrorInfo(multiErr);
          if (status === 401 || status === 403 || status === 429) {
            throw multiErr;
          }
        }
      }

      if (multiAudio) {
        res.json({ audioBase64: multiAudio, mimeType: 'audio/wav', provider: 'gemini' });
        return;
      }
      // Graceful fall-through to single-speaker TTS_MODEL below if dual-speaker model is unavailable
    }

    const effectiveSingleText =
      cleanText ||
      validDialogue
        .map((d) => `${d.speaker}: ${d.text}`)
        .join('. ')
        .slice(0, 2500);

    // Single speaker (gemini-3.8-flash-lite-tts)
    const callTts = async (apiVersion: string | undefined, includeMetadata: boolean, includeSpeechConfig: boolean) => {
      const client = makeClient(apiVersion);
      return client.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              includeMetadata
                ? { text: effectiveSingleText, speechMetadata: { style } }
                : { text: effectiveSingleText },
            ],
          },
        ],
        config: {
          abortSignal: AbortSignal.timeout(22000),
          responseModalities: ['AUDIO'],
          ...(includeSpeechConfig
            ? {
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              }
            : {}),
        },
      });
    };

    let response;
    try {
      response = await withRetry(() => callTts('v1alpha', false, true), 1);
    } catch (primaryTtsErr) {
      const { status, message } = extractErrorInfo(primaryTtsErr);
      if (status === 429 || status === 401 || status === 403 || message.includes('quota')) {
        throw primaryTtsErr;
      }
      try {
        response = await withRetry(() => callTts(undefined, true, true), 1);
      } catch {
        response = await callTts('v1alpha', false, false);
      }
    }

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      res.status(502).json({ error: 'Voice model returned empty audio.' });
      return;
    }

    res.json({ audioBase64: base64Audio, mimeType: 'audio/wav', provider: 'gemini' });
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 9. Audio Transcription (gemini-3.5-transcribe with multimodal fallback)
app.post('/api/transcribe', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY!;
    const { audioBase64, mimeType = 'audio/webm' } = req.body as {
      audioBase64: string;
      mimeType?: string;
    };

    if (!audioBase64) {
      res.status(400).json({ error: 'Audio data is required for transcription.' });
      return;
    }

    const transcribeContents = {
      parts: [
        {
          inlineData: {
            mimeType,
            data: audioBase64,
          },
        },
        {
          text: 'Transcribe this spoken audio accurately. Return only the transcribed words verbatim, preserving English, Hindi, or Hinglish phrases naturally without adding commentary.',
        },
      ],
    };

    const attempts: Array<{ model: string; apiVersion?: string }> = [
      { model: TRANSCRIBE_MODEL, apiVersion: 'v1alpha' },
      { model: TRANSCRIBE_MODEL },
      { model: TEXT_MODEL },
      { model: 'gemini-3.1-flash-lite' },
    ];

    let transcriptText = '';
    let lastErr: unknown = null;

    for (const attempt of attempts) {
      try {
        const client = attempt.apiVersion
          ? new GoogleGenAI({
              apiKey,
              apiVersion: attempt.apiVersion,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
            })
          : ai;
        const response = await withRetry(
          () =>
            client.models.generateContent({
              model: attempt.model,
              contents: transcribeContents,
            }),
          1
        );
        transcriptText = (response.text || '').trim();
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const { status } = extractErrorInfo(err);
        if (status === 401 || status === 403) {
          throw err;
        }
      }
    }

    if (lastErr) {
      throw lastErr;
    }

    res.json({ text: transcriptText });
  } catch (err) {
    const info = extractErrorInfo(err);
    res.status(info.status).json({ error: info.message });
  }
});

// 10. Genuine Pixel Video Generation (Veo / gemini-omni-1.2-flash via Interactions API — requires billing-enabled API key)
app.post('/api/video/veo', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const {
      prompt = '',
      durationSeconds = 8,
      aspectRatio = '16:9',
      resolution = '720p',
      style = 'Realistic 3D',
      cameraOverride = 'auto',
    } = req.body as {
      prompt: string;
      durationSeconds?: number;
      aspectRatio?: string;
      resolution?: string;
      style?: string;
      cameraOverride?: string;
    };

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Please describe your video prompt.' });
      return;
    }

    const clampedSecs = Math.max(3, Math.min(15, Math.round(Number(durationSeconds) || 8)));
    const veoRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    const veoRes = resolution === '1080p' ? '1080p' : '720p';
    const camDirective =
      cameraOverride && cameraOverride !== 'auto'
        ? ` Use ${cameraOverride} cinematography.`
        : ' Use dynamic continuous camera motion (tracking, dolly, or orbit).';
    const directedPrompt = `${cleanPrompt}. Style: ${style}.${camDirective} Continuous fluid action, natural lighting, no static slideshow cuts.`;

    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.2-flash',
        input: directedPrompt,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: veoRatio,
          duration: `${clampedSecs}s`,
          resolution: veoRes,
        },
      },
      { timeout: 300000 }
    );

    const videoPart = interaction.output_video;
    if (!videoPart || !videoPart.data) {
      res.status(502).json({
        error:
          'Veo pixel video generation returned empty video data. Try again or switch to NEXORA 3D Cinema Engine.',
      });
      return;
    }

    res.json({
      videoBase64: videoPart.data,
      mimeType: videoPart.mime_type || 'video/mp4',
      model: 'gemini-omni-1.2-flash',
      durationSeconds: clampedSecs,
      aspectRatio: veoRatio,
      resolution: veoRes,
    });
  } catch (err) {
    const info = extractErrorInfo(err);
    const lower = info.message.toLowerCase();
    const isBillingOrQuota =
      info.status === 401 ||
      info.status === 402 ||
      info.status === 403 ||
      info.status === 429 ||
      /billing|paid|tier|quota|permission|not enabled|found|unavailable/.test(lower);

    if (isBillingOrQuota) {
      res.status(info.status >= 400 ? info.status : 402).json({
        error: `Veo Pixel AI (gemini-omni-1.2-flash) requires a billing-enabled paid Gemini API key in Settings > Secrets (${info.message}). Switch back to NEXORA 3D Cinema Engine for instant real-time 3D/2D motion video.`,
      });
      return;
    }
    res.status(info.status).json({ error: info.message });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});
