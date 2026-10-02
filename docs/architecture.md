# Architecture

The code documents the coordinate frames and the sign of each angle. Start at `toSolverSpace` in `src/lib/solver/pose-solver.ts` and at the `boneSign` field of `TrackingBridge` in `src/lib/vrm/tracking-bridge.ts`.

## Library choices

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js App Router | VRM Studio, an open-source web VTubing app that this project used as a reference, uses the same stack. |
| 3D | Three.js and @pixiv/three-vrm | three-vrm loads VRM 0.x and 1.x, and Three.js is lighter than Babylon.js. |
| Tracking | @mediapipe/tasks-vision | One Holistic Landmarker returns face, pose, and hand landmarks. |
| Bone rotations | Own solver | KalidoKit's README declares it deprecated. The solver follows KalidoKit's approach: it computes bone rotations from landmark directions, without inverse kinematics. |
| State | Zustand | Its persist middleware stores the settings in `localStorage`. |

## Left and right

The avatar does not use one left-right convention:

- **Same side**: arms, head roll, and horizontal gaze. When the user raises their left arm, the avatar raises its left arm.
- **Mirrored**: head yaw, spine yaw, spine roll, and blinks. When the user turns their head to their left, the avatar turns its head to its right. When the user closes their left eye, the avatar closes its right eye.

As a result, when the user turns their head and eyes to the same side, the avatar turns them to opposite sides. The author has not chosen one convention yet. Ask the author before you change any of these signs.

## Performance profile

Measured on 2026-02-06 on an M4 Max, with 640x480 camera input. At that time, MediaPipe and the solver ran on the main thread:

| Stage | Time per frame |
|-------|----------------|
| MediaPipe inference | About 14 ms, over 99% of the tracking time |
| Solver and TrackingBridge | Under 0.1 ms |
| Render (OrbitControls update, VRM update, and Three.js) | About 0.6 ms, with 8-10 draw calls and about 42K triangles |

Inference sometimes spiked to 40 ms and blocked the main thread, so MediaPipe and the solver moved to a Web Worker. In worker mode, the performance overlay's `mediapipe` stage covers the whole round trip, including the solver, so it does not compare with the first row.
