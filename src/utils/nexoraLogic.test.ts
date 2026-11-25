import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  ELEVENLABS_PRESET_VOICES,
  GEMINI_VOICE_CATALOG,
  TTS_STYLE_PRESETS,
  AI_MODEL_CATALOG,
  appendMessageToSession,
  buildSystemPrompt,
  calculateAudioStagePercent,
  cleanTextForTts,
  computeLipSyncAperture,
  createChatSession,
  deriveSessionTitle,
  enforceCharacterConsistency,
  extractStoryboardPayload,
  formatApiErrorMessage,
  formatDurationMMSS,
  getModelSpec,
  groundHeightAt,
  inferBiomeFromText,
  inferVideoFormatFromText,
  inferWeatherFromText,
  interpolateActorTransform,
  normalizeStoryboardDurations,
  parseDialogueLines,
  resolveCameraTransform,
  resolveExportDimensions,
  resolveImageExportSize,
  resolveTimelineFrame,
  sanitizeGeneratedScenes,
  sanitizePhotoRemixRecipe,
  sanitizeSvgMarkup,
  validateVideoStoryboardQuality,
} from './nexoraLogic';
import type { VideoScene, VideoStoryboard } from '../types/nexora';

function makeMockScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: 's1',
    title: 'Scene 1',
    narration: 'Narration',
    subtitle: 'Subtitle',
    durationSeconds: 10,
    biome: 'forest',
    mood: 'daylight',
    cameraShot: 'establish-orbit',
    cameraMotion: 'zoom-in',
    transition: 'crossfade',
    background: {
      topColor: '#38BDF8',
      bottomColor: '#BAE6FD',
      accentColor: '#22D3EE',
      atmosphere: 'minimal',
    },
    actors: [],
    props: [],
    elements: [],
    ...overrides,
  };
}

test('deriveSessionTitle truncates long prompts cleanly', () => {
  assert.equal(deriveSessionTitle('   Hello   world  '), 'Hello world');
  const long = 'Explain quantum entanglement and Bell inequalities in simple Hinglish for beginners';
  const derived = deriveSessionTitle(long);
  assert.ok(derived.length <= 46);
  assert.ok(derived.endsWith('...'));
});

test('appendMessageToSession updates title on first user message', () => {
  const session = createChatSession();
  const updated = appendMessageToSession(session, {
    id: 'm1',
    role: 'user',
    content: 'Build a Python snake game',
    createdAt: 1000,
  });
  assert.equal(updated.title, 'Build a Python snake game');
  assert.equal(updated.messages.length, 1);

  const afterAssistant = appendMessageToSession(updated, {
    id: 'm2',
    role: 'assistant',
    content: 'Here is a Python snake game...',
    createdAt: 2000,
  });
  assert.equal(afterAssistant.title, 'Build a Python snake game');
  assert.equal(afterAssistant.messages.length, 2);
});

test('buildSystemPrompt adapts to Hindi and Hinglish languages', () => {
  const hinglish = buildSystemPrompt('Hinglish', 'Simple & Easy');
  assert.match(hinglish, /Hinglish/i);
  assert.match(hinglish, /simple/i);

  const hindi = buildSystemPrompt('Hindi', 'Friendly Tutor');
  assert.match(hindi, /Devanagari/i);
  assert.match(hindi, /mentor/i);
});

test('normalizeStoryboardDurations scales scenes to exact multi-minute target', () => {
  const rawScenes = Array.from({ length: 6 }, (_, i) =>
    makeMockScene({ id: `s${i + 1}`, title: `Scene ${i + 1}` })
  );

  const normalized180 = normalizeStoryboardDurations(rawScenes, 180);
  const sum = normalized180.reduce((acc, s) => acc + s.durationSeconds, 0);
  assert.equal(sum, 180);
  assert.equal(normalized180[0].durationSeconds, 30);
});

test('resolveTimelineFrame finds active scene and progress at arbitrary timestamps', () => {
  const storyboard: VideoStoryboard = {
    id: 'vid_1',
    title: 'City & Park Adventure',
    videoType: '3d_animation',
    style: 'Auto (AI Decides)',
    aspectRatio: '16:9',
    totalDurationSeconds: 120,
    createdAt: 1000,
    scenes: [
      makeMockScene({
        id: 's1',
        title: 'Sunny Park',
        biome: 'forest',
        durationSeconds: 40,
      }),
      makeMockScene({
        id: 's2',
        title: 'Downtown Race',
        biome: 'city',
        durationSeconds: 80,
      }),
    ],
  };

  const f1 = resolveTimelineFrame(storyboard, 20);
  assert.ok(f1);
  assert.equal(f1.sceneIndex, 0);
  assert.equal(f1.sceneProgress, 0.5);

  const f2 = resolveTimelineFrame(storyboard, 80);
  assert.ok(f2);
  assert.equal(f2.sceneIndex, 1);
  assert.equal(f2.sceneElapsed, 40);
  assert.equal(f2.sceneProgress, 0.5);
});

test('formatDurationMMSS formats timestamps with leading zeros', () => {
  assert.equal(formatDurationMMSS(0), '00:00');
  assert.equal(formatDurationMMSS(65), '01:05');
  assert.equal(formatDurationMMSS(300), '05:00');
});

test('sanitizeSvgMarkup strips scripts and inline event handlers', () => {
  const dirty = '<svg viewBox="0 0 100 100" onclick="alert(1)"><script>evil()</script><circle cx="50" cy="50" r="20"/></svg>';
  const clean = sanitizeSvgMarkup(dirty);
  assert.ok(!clean.includes('<script>'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(clean.includes('<circle'));
});

test('formatApiErrorMessage maps status codes and unwraps nested JSON cleanly', () => {
  assert.match(formatApiErrorMessage(403), /Settings > Secrets/);
  assert.match(formatApiErrorMessage(429), /quota/i);
  assert.equal(formatApiErrorMessage(500, 'Upstream failure'), 'Upstream failure');
  const nested503 = JSON.stringify({
    error: {
      message: JSON.stringify({
        error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' },
      }),
      code: 503,
    },
  });
  assert.match(formatApiErrorMessage(503, nested503), /temporary high demand/i);
  assert.match(
    formatApiErrorMessage(403, 'ELEVENLABS_API_KEY is not configured. Add ELEVENLABS_API_KEY in Settings > Secrets.'),
    /ELEVENLABS_API_KEY/
  );
  assert.equal(
    formatApiErrorMessage(404),
    'Requested Gemini model was not found. Please check the server model configuration.'
  );
  assert.equal(
    formatApiErrorMessage(404, 'NOT_FOUND'),
    'Requested Gemini model was not found. Please check the server model configuration.'
  );
  assert.equal(
    formatApiErrorMessage(404, 'models/custom-model is not found'),
    'Model or endpoint unavailable: models/custom-model is not found'
  );
});

test('inferBiomeFromText chooses situational 3D biomes and avoids space unless requested', () => {
  assert.equal(inferBiomeFromText('A sports car racing down the city street'), 'city');
  assert.equal(inferBiomeFromText('A student solving algebra in school classroom'), 'classroom');
  assert.equal(inferBiomeFromText('A friendly dragon flying over an enchanted castle'), 'fantasy_kingdom');
  assert.equal(inferBiomeFromText('Pirates sailing across tropical ocean waves'), 'ocean');
  assert.equal(inferBiomeFromText('A happy dog playing in the park'), 'forest');
  assert.equal(inferBiomeFromText('Voyage across Mars and deep space cosmos'), 'space');
});

test('interpolateActorTransform moves actors smoothly between startPos and endPos grounded on terrain', () => {
  const actor = {
    id: 'a1',
    role: 'human' as const,
    color: '#2563EB',
    accentColor: '#F59E0B',
    action: 'idle' as const,
    startPos: [-4, 0] as [number, number],
    endPos: [4, 0] as [number, number],
    scale: 1,
  };
  const mid = interpolateActorTransform(actor, 0.5, 'city', 1.0);
  assert.equal(Math.round(mid.x * 100), 0);
  assert.equal(mid.y, groundHeightAt('city', 0, 0));
  assert.ok(Math.abs(mid.yaw - Math.PI / 2) < 0.01);
});

test('sanitizeGeneratedScenes repairs missing 3D actors/props, prevents accidental space default, and scales durations', () => {
  const repaired = sanitizeGeneratedScenes(
    [
      {
        title: 'Street Sprint',
        voiceover: 'A bright red car races through the city',
        biome: 'space', // Model mistakenly picked space for a car street topic!
        duration: 20,
        elements: [{ kind: 'game_controller' as never, x: 200, y: -10, scale: 5, color: 'bad', motion: 'weird' as never }],
      },
      { name: 'Park Celebration', narration: 'Friends celebrate in a sunny meadow' },
    ],
    120,
    'Car racing in downtown city'
  );
  assert.equal(repaired.length, 2);
  assert.equal(repaired[0].biome, 'city');
  assert.ok(repaired[0].actors.length >= 1);
  assert.ok(repaired[0].props.length >= 3);
  assert.equal(repaired[0].narration, 'A bright red car races through the city');
  assert.equal(repaired[1].biome, 'forest');
  assert.equal(repaired[0].durationSeconds + repaired[1].durationSeconds, 120);
});

test('extractStoryboardPayload handles nested wrappers, top-level arrays, and truncated JSON', () => {
  const wrapped = extractStoryboardPayload('Here is JSON:\n```json\n{"storyboard":{"title":"Game Quest","chapters":[{"title":"Start","narration":"Go!"}]}}\n```');
  assert.equal(wrapped.title, 'Game Quest');
  assert.equal(wrapped.scenes.length, 1);

  const arrOnly = extractStoryboardPayload('[{"title":"Scene A"},{"title":"Scene B"}]', 'Fallback');
  assert.equal(arrOnly.title, 'Fallback');
  assert.equal(arrOnly.scenes.length, 2);

  const truncated = extractStoryboardPayload('{"title":"CutOff","scenes":[{"title":"One","narration":"First"},{"title":"Two","narration":"Second"},{"title":"Three","narr', 'CutOff');
  assert.equal(truncated.scenes.length, 2);
});

test('calculateAudioStagePercent scales smoothly between 50 and 95 percent', () => {
  assert.equal(calculateAudioStagePercent(0, 4), 50);
  assert.equal(calculateAudioStagePercent(2, 4), 73);
  assert.equal(calculateAudioStagePercent(4, 4), 95);
});

test('inferVideoFormatFromText honors explicit choice and auto-infers appropriate video types', () => {
  assert.equal(inferVideoFormatFromText('How photosynthesis works', '3d_animation'), '3d_animation');
  assert.equal(inferVideoFormatFromText('Racing car', 'whiteboard_explainer'), 'whiteboard_explainer');
  assert.equal(inferVideoFormatFromText('Explain photosynthesis step by step for biology homework', 'auto'), 'whiteboard_explainer');
  assert.equal(inferVideoFormatFromText('Ancient Roman Empire documentary film', 'auto'), 'cinematic_story');
  assert.equal(inferVideoFormatFromText('Top 5 startup marketing facts for YouTube', 'auto'), '2d_motion');
  assert.equal(inferVideoFormatFromText('A dog chasing a ball in the park', 'auto'), '3d_animation');
});

test('sanitizeGeneratedScenes derives clean keyPoints when omitted by model', () => {
  const scenes = sanitizeGeneratedScenes(
    [
      {
        title: 'Solar Leaf Absorption',
        narration: 'Chlorophyll captures sunlight inside leaf cells. Water travels upward through the roots.',
      },
    ],
    30,
    'Photosynthesis explained',
    'Auto (AI Decides)'
  );
  assert.ok(Array.isArray(scenes[0].keyPoints));
  assert.equal(scenes[0].keyPoints?.length, 2);
});

test('getModelSpec resolves Gemini, ChatGPT, Claude, DeepSeek, and OpenRouter models cleanly', () => {
  assert.ok(AI_MODEL_CATALOG.length >= 10);
  assert.equal(getModelSpec('gpt-4o').provider, 'openai');
  assert.equal(getModelSpec('claude-sonnet-4-20250514').provider, 'anthropic');
  assert.equal(getModelSpec('deepseek-chat').provider, 'deepseek');
  assert.equal(getModelSpec('x-ai/grok-3-mini').provider, 'openrouter');
  assert.equal(getModelSpec('unknown-id').id, 'gemini-4-hydrogen');
});

test('resolveExportDimensions computes even dimensions for 16:9, 9:16, and 1:1 across resolutions', () => {
  assert.deepEqual(resolveExportDimensions('16:9', '1080p'), { width: 1920, height: 1080 });
  assert.deepEqual(resolveExportDimensions('9:16', '720p'), { width: 720, height: 1280 });
  assert.deepEqual(resolveExportDimensions('1:1', '720p'), { width: 720, height: 720 });
  assert.deepEqual(resolveExportDimensions('1:1', '540p'), { width: 640, height: 640 });
});

test('computeLipSyncAperture returns 0 when silent and oscillates dynamically while speaking', () => {
  assert.equal(computeLipSyncAperture(1.2, false, 'dynamic'), 0);
  const s1 = computeLipSyncAperture(0.15, true, 'dynamic');
  const s2 = computeLipSyncAperture(0.45, true, 'cinematic');
  assert.ok(s1 > 0 && s1 <= 1);
  assert.ok(s2 > 0 && s2 <= 1);
});

test('resolveCameraTransform computes distinct camera paths including first-person, dolly-in, and handheld', () => {
  const hero = { x: 2, y: 0, z: 1, yaw: Math.PI / 2 };
  const fpv = resolveCameraTransform('first-person', 0.5, 1.2, hero, 'dynamic', '16:9');
  assert.ok(fpv.lookX > hero.x + 5);
  assert.ok(fpv.camY > 1.5);

  const dollyStart = resolveCameraTransform('dolly-in', 0, 0, hero, 'dynamic', '16:9');
  const dollyEnd = resolveCameraTransform('dolly-in', 1, 5, hero, 'dynamic', '16:9');
  assert.ok(dollyEnd.camZ < dollyStart.camZ - 3);

  const handheld = resolveCameraTransform('handheld', 0.5, 2.3, hero, 'cinematic', '16:9');
  assert.ok(handheld.rollZ !== 0);
});

test('inferWeatherFromText detects rain, snow, embers, wind, and clear defaults', () => {
  assert.equal(inferWeatherFromText('Thunderstorm over dark avenue', 'city', 'stormy'), 'rain');
  assert.equal(inferWeatherFromText('Blizzard on snowy peak', 'mountain', 'dramatic'), 'snow');
  assert.equal(inferWeatherFromText('Dragon breathes fire over castle', 'fantasy_kingdom', 'dramatic'), 'embers');
  assert.equal(inferWeatherFromText('Strong wind across desert dunes', 'desert', 'golden_hour'), 'wind');
  assert.equal(inferWeatherFromText('Sunny walk in the park', 'forest', 'daylight'), 'clear');
});

test('enforceCharacterConsistency and validateVideoStoryboardQuality ensure consistent moving scenes', () => {
  const scenes = sanitizeGeneratedScenes(
    [
      {
        title: 'Part 1',
        narration: 'Hero walks through meadow.',
        actors: [{ role: 'human', action: 'walk', color: '#2563EB', accentColor: '#F59E0B', startPos: [0, 0], endPos: [0, 0] }],
      },
      {
        title: 'Part 2',
        narration: 'Hero runs down street.',
        actors: [{ role: 'human', action: 'run', color: '#EC4899', accentColor: '#10B981', startPos: [-5, 0], endPos: [5, 0] }],
      },
    ],
    40,
    'Adventure story'
  );

  const locked = enforceCharacterConsistency(scenes);
  assert.equal(locked[0].actors[0].color, locked[1].actors[0].color);
  assert.ok(
    Math.hypot(
      locked[0].actors[0].endPos[0] - locked[0].actors[0].startPos[0],
      locked[0].actors[0].endPos[1] - locked[0].actors[0].startPos[1]
    ) >= 2.0
  );

  const report = validateVideoStoryboardQuality({
    id: 'qc_test',
    title: 'QC Story',
    videoType: '3d_animation',
    style: 'Realistic 3D',
    aspectRatio: '16:9',
    totalDurationSeconds: 40,
    createdAt: Date.now(),
    scenes: locked,
  });
  assert.equal(report.passed, true);
  assert.equal(report.characterConsistent, true);
  assert.equal(report.movingSceneCount, 2);
});

test('sanitizeSvgMarkup recovers fenced XML SVG and injects viewBox if missing', () => {
  const fenced = '```svg\n<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#111"/></svg>\n```';
  const clean = sanitizeSvgMarkup(fenced, '16:9');
  assert.ok(clean.startsWith('<svg'));
  assert.ok(clean.includes('viewBox="0 0 1280 720"'));
  assert.ok(!clean.includes('<?xml'));
});

test('resolveImageExportSize returns exact dimensions for 1:1, 16:9, 9:16, and 4:3', () => {
  assert.deepEqual(resolveImageExportSize('1:1'), [1024, 1024]);
  assert.deepEqual(resolveImageExportSize('16:9'), [1280, 720]);
  assert.deepEqual(resolveImageExportSize('9:16'), [720, 1280]);
  assert.deepEqual(resolveImageExportSize('4:3'), [1024, 768]);
});

test('sanitizePhotoRemixRecipe clamps out-of-range values and falls back cleanly', () => {
  const recipe = sanitizePhotoRemixRecipe(
    {
      brightness: 99,
      contrast: 0.1,
      saturate: 5,
      tintTopColor: 'not-a-hex',
      blendMode: 'screen',
      particleEffect: 'rain',
    },
    'Neon rain cyberpunk portrait',
    'Cyberpunk Neon Minimal'
  );
  assert.equal(recipe.brightness, 1.45);
  assert.equal(recipe.contrast, 0.75);
  assert.equal(recipe.saturate, 2.2);
  assert.match(recipe.tintTopColor, /^#/);
  assert.equal(recipe.blendMode, 'screen');
  assert.equal(recipe.particleEffect, 'rain');
});

test('ELEVENLABS_PRESET_VOICES includes default Rachel and curated catalog', () => {
  assert.ok(ELEVENLABS_PRESET_VOICES.length >= 6);
  assert.ok(ELEVENLABS_PRESET_VOICES.some((v) => v.voice_id === DEFAULT_ELEVENLABS_VOICE_ID));
  assert.equal(GEMINI_VOICE_CATALOG.length, 5);
  assert.ok(TTS_STYLE_PRESETS.length >= 4);
});

test('cleanTextForTts strips markdown formatting and respects character limits', () => {
  const md = '# Breaking News\nHere is **bold** text with [a link](https://example.com) and ```js\nconsole.log(1);\n```';
  const cleaned = cleanTextForTts(md, 200);
  assert.ok(!cleaned.includes('**'));
  assert.ok(!cleaned.includes('https://example.com'));
  assert.ok(cleaned.includes('Breaking News'));
  assert.ok(cleaned.includes('bold text with a link'));
  assert.ok(cleaned.includes('Code block omitted.'));
  assert.ok(cleanTextForTts('a'.repeat(500), 120).length <= 120);
});

test('parseDialogueLines assigns alternating speakers and preserves explicit speaker prefixes', () => {
  const labeled = parseDialogueLines('Alex: Welcome back!\nSam: Glad to be here.\nAlex: Let us begin.', 'Alex', 'Sam');
  assert.equal(labeled.length, 3);
  assert.equal(labeled[0].speaker, 'Alex');
  assert.equal(labeled[0].text, 'Welcome back!');
  assert.equal(labeled[1].speaker, 'Sam');
  assert.equal(labeled[2].speaker, 'Alex');

  const unlabeled = parseDialogueLines('First line\nSecond line', 'Host', 'Guest');
  assert.equal(unlabeled.length, 2);
  assert.equal(unlabeled[0].speaker, 'Host');
  assert.equal(unlabeled[1].speaker, 'Guest');
});




