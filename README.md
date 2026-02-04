# VRM-Tuber

A lightweight, web-based VTubing application that tracks users via camera and animates VRM avatars.

## Features (Planned)

- Camera-based face, pose, and hand tracking
- VRM avatar animation with smooth motion
- Adjustable tracking sensitivity and smoothing
- Green screen / transparent background support
- Drag-and-drop VRM model loading
- Low resource usage compared to alternatives

## Tech Stack

- **Framework**: Next.js + TypeScript
- **3D**: Three.js + @pixiv/three-vrm
- **Tracking**: MediaPipe Tasks Vision (HolisticLandmarker)
- **State**: Zustand
- **Testing**: Vitest + React Testing Library

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Status

See [PLAN.md](./PLAN.md) for detailed implementation plan and progress.

## License

MIT
