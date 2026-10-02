# Browser testing

How to check animovi in a real browser with the [agent-browser](https://github.com/vercel-labs/agent-browser) CLI.

## Feed a video instead of the camera

A headless browser has no camera. The `?footage=` query parameter plays a looping video in place of the camera, and the tracking pipeline reads it like camera input. The repository contains no video and no VRM, so bring your own.

1. Copy a video of a person to `public/`, with a name that matches `public/__perf_footage.*`. Git and Docker ignore that pattern.
2. Run `npm run dev`, open http://localhost:3000, and import a VRM with the Import VRM button. In agent-browser, run `agent-browser upload '[data-testid="vrm-file-input"]' <path to the .vrm file>`.
3. Open `/?footage=/<file name>`, for example `/?footage=/__perf_footage.mp4`. The app loads the last-used VRM on startup, so the avatar from step 2 is still there. `/?footage=1` is short for `/?footage=/__perf_footage.webm`.

The same video gives the same input on every run, so the stage timings in the performance overlay (P key) are comparable between runs.

## Read rotations, not pixels

To check the avatar's pose, press S to open the stick-figure overlay. Its table lists the shoulder, elbow, spine, and head bones, in degrees. For each axis, the `raw` column shows the solver output, and the `app` column shows the rotation written to the bone after smoothing and the VRM-version sign correction. agent-browser can read the table as page text.

The D key shows the tracking debug overlay: which landmark sets MediaPipe detected, and the solver output. It shows the raw wrist landmarks only when tracking runs on the main thread.

## Tabs stuck at about:blank

If every agent-browser tab resets to `about:blank`, the daemon version does not match the CLI. Run `agent-browser doctor`, which removes stale daemon files. If the tabs still reset, run `agent-browser doctor --fix`. It also runs destructive repairs, such as a Chrome reinstall.
