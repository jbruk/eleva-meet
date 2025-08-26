/**
 * Placeholder virtual background module to fix import errors.
 * This is a temporary implementation until the actual virtual background is implemented.
 */
export function createVirtualBackgroundEffect(options?: any): Promise<any> {
    return Promise.resolve({
        applyEffect: async (stream: MediaStream) => stream,
        stop: () => {}
    });
}
