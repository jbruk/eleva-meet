/**
 * Placeholder NoiseSuppressionEffect class to fix import errors.
 * This is a temporary implementation until the actual noise suppression is implemented.
 */
export class NoiseSuppressionEffect {
    constructor(options?: any) {
        // Placeholder implementation
        console.log('NoiseSuppressionEffect initialized with options:', options);
    }

    async applyEffect(stream: MediaStream): Promise<MediaStream> {
        // Return original stream for now
        return stream;
    }

    stop(): void {
        // Placeholder cleanup
    }
}
