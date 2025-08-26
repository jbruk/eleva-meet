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
