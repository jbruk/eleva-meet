/**
 * Placeholder rnnoise module to fix import errors.
 * This is a temporary implementation until the actual rnnoise is implemented.
 */
export class RNNoiseEffect {
    constructor(options?: any) {
        // Placeholder implementation
        console.log('RNNoiseEffect initialized with options:', options);
    }

    async applyEffect(stream: MediaStream): Promise<MediaStream> {
        // Return original stream for now
        return stream;
    }

    stop(): void {
        // Placeholder cleanup
    }
}

// Factory expected by conference.js
export async function createRnnoiseProcessor(): Promise<any> {
    // If you have a real WASM loader, wire it here.
    // Returning a minimal stub to keep pipeline green.
    return {
        getSampleLength: () => 480,
        getRequiredPCMFrequency: () => 44100,
        processAudioFrame: () => 0.0,
        calculateAudioFrameVAD: () => 0.0,
        destroy: () => {}
    } as any;
}