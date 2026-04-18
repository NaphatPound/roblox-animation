# Report 03: Ollama Cloud API Review

This handoff focuses on bugs introduced or exposed by the new Ollama Cloud integration.

## Validation Run

- `npm test -- --runInBand`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: skipped

These findings come from reviewing the current cloud/local Ollama path in `lib/ollama.ts`, the API routes, and the UI consumers.

## 1. Upstream Ollama failures are converted into successful 200 responses, which can silently write fake poses

Severity: High

### Symptoms

If Ollama Cloud rejects the request because of:

- invalid API key
- unsupported model
- quota / rate limit
- cloud outage

the app still returns HTTP 200 from `/api/ai-text` and `/api/ai-vision`, because the server code converts that failure into a fallback pose.

This is especially dangerous for image import:

- `generatePoseFromImage` falls back to `fallbackPoseFromPrompt(prompt || 'idle')`
- `ImageUploader` does not inspect `source` or `error`
- failed cloud calls can therefore import a sequence of idle poses while looking like success

### Repro

1. Set `OLLAMA_API_KEY` to an invalid value, or set a cloud model that the account cannot use
2. Upload multiple images through `ImageUploader`
3. Observe that the request path still succeeds at the HTTP level
4. Observe that keyframes are added anyway, but the poses can be fallback/idle rather than real vision output

### Root Cause

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:137>) catches all text-call errors and returns `{ pose, source: 'fallback', error }`
- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:169>) does the same for image calls
- [app/api/ai-text/route.ts](</G:/project/roblox-animation/app/api/ai-text/route.ts:14>) always returns the result as JSON with status 200
- [app/api/ai-vision/route.ts](</G:/project/roblox-animation/app/api/ai-vision/route.ts:15>) also always returns status 200
- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:61>) treats any 200 response as valid AI output and writes `data.pose` directly into the timeline

### Expected Fix

Do not silently convert transport/model failures into a successful AI result for the route caller.

Safe options:

1. Return non-200 from the API routes when the upstream call failed
2. Keep the fallback payload, but mark it explicitly and make the frontend refuse to auto-import it
3. At minimum, make image import stop and surface the upstream error when `source === 'fallback'`

### Likely Fix Area

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:119>)
- [app/api/ai-text/route.ts](</G:/project/roblox-animation/app/api/ai-text/route.ts:4>)
- [app/api/ai-vision/route.ts](</G:/project/roblox-animation/app/api/ai-vision/route.ts:4>)
- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:40>)

### Suggested Regression Test

Add route- or helper-level tests that simulate:

- cloud 403
- invalid key
- model unavailable

and assert that image import does not silently write fallback poses as if they were real AI results.

## 2. Cloud mode still defaults to local model names, so setting only `OLLAMA_API_KEY` is misconfigured

Severity: High

### Symptoms

The new feature routes requests to Ollama Cloud whenever `OLLAMA_API_KEY` is set, but the default model names are still:

- `llama3.2`
- `gemma3`

Those are local-style defaults, not cloud-specific defaults.

So a developer can follow the intended setup pattern:

1. add `OLLAMA_API_KEY`
2. leave model env vars unset

and the app will route to cloud using model names that are not the committed cloud examples.

### Root Cause

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:10>) defaults text model to `llama3.2`
- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:11>) defaults vision model to `gemma3`
- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:89>) switches to cloud mode solely based on `OLLAMA_API_KEY`
- [\.env.example](</G:/project/roblox-animation/.env.example:10>) documents cloud-tagged model names, which do not match the runtime defaults

### Expected Fix

Make model defaults consistent with the selected backend.

Options:

1. Use cloud-safe defaults when `OLLAMA_API_KEY` is set
2. Require explicit cloud model env vars and fail fast if they are missing
3. Add an explicit backend mode env var and validate model/backend compatibility

### Likely Fix Area

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:4>)
- [\.env.example](</G:/project/roblox-animation/.env.example:4>)

### Suggested Regression Test

Add tests for backend/model selection so that:

- cloud mode with no explicit model env does not use local-only defaults
- invalid backend/model combinations fail clearly instead of falling through silently

## 3. Presence of `OLLAMA_API_KEY` disables any attempt to use the local daemon, even when local is healthy

Severity: Medium

### Symptoms

If `OLLAMA_API_KEY` is present in the environment, the app always chooses cloud. That means:

- a valid local daemon at `OLLAMA_URL` is ignored
- a temporary cloud outage or 403 never falls back to local
- the code jumps straight from cloud failure to keyword fallback

This makes the system much less reliable than necessary in mixed dev environments.

### Repro

1. Run a working local Ollama instance
2. Set `OLLAMA_URL` correctly
3. Also set `OLLAMA_API_KEY`
4. Trigger a cloud-side failure
5. Observe that the code never tries the local daemon and instead returns `source: 'fallback'`

### Root Cause

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:89>) uses `Boolean(OLLAMA_API_KEY)` as the full routing decision
- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:90>) picks exactly one base URL
- there is no retry chain like cloud -> local -> heuristic fallback

### Expected Fix

Separate backend preference from backend fallback.

Reasonable options:

1. Try cloud first, then local, then heuristic fallback
2. Add `OLLAMA_BACKEND=cloud|local|auto` and implement `auto` as cloud-then-local
3. At minimum, log or surface clearly that local was skipped because cloud mode was forced

### Likely Fix Area

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:86>)

### Suggested Regression Test

Mock:

- cloud failure
- local success

and assert that `callOllama` or its wrapper uses local instead of returning `fallback`.

## 4. The new `source` / `error` response contract is not integrated into the image UI or shared types

Severity: Medium

### Symptoms

The cloud feature added extra response metadata:

- `source: 'cloud' | 'local' | 'fallback'`
- `error?: string`

But only the text UI handles it. The image UI and shared types still treat the response as plain `AIPoseResponse`.

Effects:

- image import gives no indication whether frames came from cloud, local, or fallback
- image import cannot react differently to fallback failures
- the route/consumer contract is now inconsistent across the app

### Root Cause

- [types/index.ts](</G:/project/roblox-animation/types/index.ts:61>) `AIPoseResponse` does not include `source` or `error`
- [components/ui/PromptInput.tsx](</G:/project/roblox-animation/components/ui/PromptInput.tsx:8>) defines a local `Result` type to work around that mismatch
- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:7>) still types the response as plain `AIPoseResponse`
- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:61>) ignores the metadata completely

### Expected Fix

Promote the real API response shape into shared types and make both UIs respect it.

Minimum acceptable fix:

1. Add a shared AI response type with `source` and optional `error`
2. Update `ImageUploader` to detect `source === 'fallback'`
3. Surface cloud/local/fallback status consistently in both text and image flows

### Likely Fix Area

- [types/index.ts](</G:/project/roblox-animation/types/index.ts:61>)
- [components/ui/PromptInput.tsx](</G:/project/roblox-animation/components/ui/PromptInput.tsx:8>)
- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:7>)

### Suggested Regression Test

Add UI-facing tests or route-contract tests that verify:

- text and image routes return the same typed metadata
- image import surfaces fallback/cloud/local state instead of silently discarding it

## Suggested Fix Order

1. Stop silent 200-success fallback behavior from corrupting image imports
2. Fix cloud model defaults so cloud mode is not misconfigured by default
3. Add cloud -> local fallback logic or explicit backend selection
4. Unify the AI response contract across shared types and both UIs
