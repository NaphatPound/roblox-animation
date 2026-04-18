# Report 04: Ollama Cloud Image-to-Animation Review

This handoff focuses on the current image-to-animation flow after the Ollama Cloud feature was added.

## Validation Run

- `npm test -- --runInBand`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: skipped

The issues below are runtime and workflow bugs in the current image-analysis path.

## 1. Image batch import is non-atomic, so a mid-batch cloud failure leaves partial animation data behind

Severity: High

### Symptoms

If an image batch partially succeeds and then one later frame fails, the earlier analyzed frames are already written into the timeline. The import aborts, but the project is left in a half-imported state.

This is especially likely in cloud mode when:

- quota is exhausted partway through a batch
- one frame triggers an upstream model error
- cloud succeeds for some frames and then starts failing

The same failure also leaves `totalFrames` extended even if the batch never finishes.

### Repro

1. Upload a multi-frame image sequence
2. Let the first few `/api/ai-vision` calls succeed
3. Make a later frame fail, for example with a temporary upstream cloud error
4. Observe that:
   - some keyframes were already inserted
   - the batch aborts with an error
   - `totalFrames` may already have been extended

### Root Cause

- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:57>) computes the frame plan and may extend `totalFrames` before any frame is guaranteed to succeed
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:62>) loops frame-by-frame
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:79>) writes each successful frame immediately with `addKeyframe(...)`
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:84>) aborts on error, but there is no rollback of already-added keyframes or restored timeline length

### Expected Fix

Make image import transactional at the batch level.

Safe options:

1. Collect all analyzed poses first, then commit them only if the whole batch succeeds
2. Snapshot existing state and roll back if any frame fails
3. Delay `setTotalFrames(...)` until the batch has fully succeeded

### Likely Fix Area

- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:49>)
- possibly add a batch helper in `lib/imageImport.ts`

### Suggested Regression Test

Add a component- or store-level test that simulates:

- frame 1 success
- frame 2 success
- frame 3 failure

and asserts that no new keyframes remain after the batch fails.

## 2. Auto cloud-to-local failover is repeated for every frame, so one bad cloud config makes large imports much slower than necessary

Severity: Medium

### Symptoms

In `auto` mode, each frame analysis request independently tries:

1. cloud
2. local

So if cloud is misconfigured or temporarily unavailable but local is healthy, the system still pays for one failed cloud request per frame before local succeeds.

For a long image sequence, this multiplies latency badly.

### Repro

1. Run a healthy local Ollama daemon
2. Set cloud mode to `auto` with an invalid or rate-limited cloud setup
3. Import a large image sequence
4. Observe that every frame waits for a cloud failure before falling back to local

### Root Cause

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:163>) resolves attempts per request
- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:174>) retries cloud/local for that single request only
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:62>) sends one `/api/ai-vision` request per frame

There is no:

- batch-level backend health cache
- temporary circuit breaker
- "cloud already failed, use local for the rest of this batch" behavior

### Expected Fix

Cache backend failure state for the current batch, or at least for a short window.

Reasonable options:

1. Once cloud fails during a batch, use local for the remaining frames
2. Add a short-lived in-memory cloud health cache server-side
3. Expose an explicit backend selector in the UI for image import

### Likely Fix Area

- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:163>)
- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:49>)

### Suggested Regression Test

Mock a batch where:

- cloud fails on the first frame
- local succeeds

and assert that subsequent frames do not keep retrying cloud during the same batch.

## 3. Batch source reporting is misleading when frames come from mixed backends

Severity: Medium

### Symptoms

The UI shows a single final source label:

- `via Ollama Cloud`
- `via local Ollama`

but a real batch can mix sources frame-by-frame in `auto` mode. For example:

- frame 1 from cloud
- frame 2 from local
- frame 3 from cloud

The current UI only reports the source of the last successful frame, which can mislead users about what actually produced the imported animation.

### Repro

1. Run in `auto` mode
2. Trigger a batch where some frames use cloud and others fall back to local
3. Observe that the uploader still shows a single final source label based only on the last completed frame

### Root Cause

- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:61>) tracks `sawSource`
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:80>) overwrites it for every frame
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:83>) stores only the final value in `lastSource`

There is no batch summary such as:

- all cloud
- all local
- mixed cloud/local

### Expected Fix

Track batch source composition instead of only the last frame source.

Simple options:

1. Collect a `Set<AISource>` during the batch and render:
   - `cloud`
   - `local`
   - `mixed`
2. Persist source metadata per imported frame if auditability matters

### Likely Fix Area

- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:23>)

### Suggested Regression Test

Simulate a batch with mixed `cloud` and `local` frame results and assert that the UI reports `mixed`, not whichever source happened last.

## 4. The vision prompt capability exists in the API but is unreachable from the image UI

Severity: Medium

### Symptoms

The route and backend support a `prompt` field for image analysis, but the image uploader never sends one and provides no UI for it. That means users cannot steer the cloud vision model when:

- the frame is ambiguous
- the model confuses left/right limbs
- the user wants a combat or motion-specific interpretation

This is a mismatch between the server contract and the actual feature surface.

### Root Cause

- [app/api/ai-vision/route.ts](</G:/project/roblox-animation/app/api/ai-vision/route.ts:14>) accepts `prompt`
- [lib/ollama.ts](</G:/project/roblox-animation/lib/ollama.ts:216>) supports `prompt?` for `generatePoseFromImage`
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:64>) only sends `{ imageBase64 }`
- there is no prompt input in the image import UI

### Expected Fix

Expose optional prompt guidance in the image uploader and forward it to `/api/ai-vision`.

Minimum acceptable fix:

1. Add a small optional prompt textarea to `ImageUploader`
2. Send it in the request body
3. Include it in any retry / batch plan logic

### Likely Fix Area

- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:17>)
- [app/api/ai-vision/route.ts](</G:/project/roblox-animation/app/api/ai-vision/route.ts:14>)

### Suggested Regression Test

Add a UI or route test that verifies the image uploader passes a user-specified prompt through to `/api/ai-vision`.

## Suggested Fix Order

1. Make image batch import atomic
2. Prevent repeated cloud failures from slowing every frame in a batch
3. Fix misleading source reporting for mixed batches
4. Expose vision prompt support in the image uploader
