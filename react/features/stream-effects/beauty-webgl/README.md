# WebGL Beauty Filter for Jitsi Meet

This directory contains the implementation of a WebGL-based beauty filter effect for Jitsi Meet video streams.

## Overview

The beauty filter provides real-time video enhancement with edge-aware, skin-aware smoothing. It uses WebGL shaders to process video frames and applies bilateral-like filtering to smooth skin while preserving important facial features.

## Features

- **4 Intensity Levels**: Off (0), Subtle (1), Medium (2), High (3)
- **Skin Detection**: Uses YCbCr color space for accurate skin tone detection
- **Edge Preservation**: Sobel gradient detection to maintain sharp facial features
- **Bilateral Filtering**: 9-tap sampling with spatial and range components
- **Real-time Processing**: WebGL-based for optimal performance
- **External Control**: PostMessage API for parent application control

## Architecture

### Core Components

1. **BeautyEffectWebGL.ts** - Main effect class implementing the Jitsi effect interface
2. **shaders.ts** - GLSL vertex and fragment shaders for video processing
3. **glUtils.ts** - WebGL utility functions for shader compilation and management
4. **toggleBeauty.ts** - Integration helper for applying/removing effects
5. **beauty-iframe-bridge.js** - PostMessage bridge for external control

### Integration Points

- **Redux State**: Beauty effect state managed in `features/beauty/`
- **Toolbox**: Beauty button integrated into main toolbar
- **Track Effects**: Applied via `localVideoTrack.setEffect()`
- **External API**: PostMessage interface for parent applications

## Usage

### Internal UI Control

The beauty filter can be controlled through the Jitsi Meet toolbar:

1. Click the beauty filter button in the toolbar
2. Select from 4 intensity levels: Off, Subtle, Medium, High
3. The effect is applied in real-time to your video stream

### External Control via PostMessage

Parent applications can control the beauty filter using postMessage:

```javascript
// Set beauty level (0-3)
window.postMessage({
    type: 'beauty:set',
    level: 2
}, '*');

// Get current beauty state
window.postMessage({
    type: 'beauty:get'
}, '*');

// Toggle beauty effect
window.postMessage({
    type: 'beauty:toggle'
}, '*');
```

### External Control via Config

The beauty level can also be set via configuration:

```javascript
// In config.js
const config = {
    beautyLevel: 2 // 0 = off, 1 = subtle, 2 = medium, 3 = high
};

// Or via IFrame External API
api.executeCommand('overwriteConfig', { beautyLevel: 2 });
```

## Technical Details

### Shader Implementation

The fragment shader implements:

1. **Skin Detection**: RGB to YCbCr conversion with tunable skin color ranges
2. **Edge Detection**: Sobel gradient calculation for edge preservation
3. **Bilateral Filtering**: 9-tap sampling with Gaussian spatial and range weights
4. **Blending**: Smooth transition between original and processed image

### Performance Considerations

- **Target**: 720p @ 30fps on modern laptops
- **Optimization**: Single-pass shader with efficient sampling patterns
- **Fallback**: Graceful degradation for unsupported devices
- **Memory**: Minimal texture usage with efficient buffer management

### WebGL Requirements

- WebGL 1.0 support required
- Fragment shader precision: `mediump`
- Texture formats: RGBA8
- Framebuffer support for off-screen rendering

## Configuration

### Beauty Levels

| Level | Spatial Sigma | Range Sigma | Blend | Description |
|-------|---------------|-------------|-------|-------------|
| 0     | 0.0           | 0.0         | 0.0   | Off         |
| 1     | 2.0           | 0.1         | 0.3   | Subtle      |
| 2     | 3.0           | 0.15        | 0.5   | Medium      |
| 3     | 4.0           | 0.2         | 0.7   | High        |

### Skin Detection Parameters

- **YCbCr Ranges**: Tunable for different skin tones
- **Ideal Skin**: Cb=0.25, Cr=0.25
- **Falloff Distance**: 0.3 for smooth transitions

## Browser Compatibility

- **Chrome**: 60+ (WebGL 1.0)
- **Firefox**: 55+ (WebGL 1.0)
- **Safari**: 12+ (WebGL 1.0)
- **Edge**: 79+ (WebGL 1.0)

## Development

### Building

The beauty filter is integrated into the main Jitsi Meet build process. No additional build steps are required.

### Testing

1. Start Jitsi Meet with WebGL support
2. Enable camera
3. Click beauty filter button in toolbar
4. Test different intensity levels
5. Verify edge preservation on facial features

### Debugging

Enable WebGL debugging by setting:

```javascript
// In browser console
localStorage.setItem('debug', 'beauty:*');
```

## API Reference

### BeautyEffectWebGL Class

```typescript
class BeautyEffectWebGL {
    constructor(options: IBeautyEffectOptions, store: IStore)
    async applyEffect(stream: MediaStream): Promise<MediaStream>
    updateLevel(level: number): void
    stop(): void
    getLevel(): number
    static isSupported(): boolean
}
```

### PostMessage API

#### Messages from Parent

- `beauty:set` - Set beauty level
- `beauty:get` - Get current state
- `beauty:toggle` - Toggle effect

#### Messages to Parent

- `beauty:state` - Current beauty state
- `beauty:stateChanged` - State change notification
- `beauty:error` - Error notification

## License

This implementation follows the same license as Jitsi Meet.
