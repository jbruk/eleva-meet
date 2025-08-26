import { IStore } from '../../app/types';

import { BeautyEffectWebGL, IBeautyEffectOptions } from './BeautyEffectWebGL';

/**
 * Factory that returns an effect object compatible with JitsiLocalTrack#setEffect.
 * It exposes applyEffect(stream) and stop() methods and wraps the WebGL implementation.
 */
export async function createBeautyEffect(options: IBeautyEffectOptions, store: IStore) {
    const impl = new BeautyEffectWebGL(options, store);

    return {
        /**
         * JitsiLocalTrack expects an effect interface with:
         *  - startEffect(originalStream): MediaStream
         *  - stopEffect(): void
         *  - isEnabled(track): boolean
         * See _startStreamEffect / _stopStreamEffect inside lib-jitsi-meet's JitsiLocalTrack.
         */
        startEffect: (stream: MediaStream) => impl.startEffect(stream),
        stopEffect: () => impl.stopEffect(),
        updateOptions: (opts: IBeautyEffectOptions) => impl.updateOptions(opts),
        setJitsiTrack: (jitsiTrack: any) => (impl as any).setJitsiTrack?.(jitsiTrack),
        isEnabled: () => true
    };
}

export type { IBeautyEffectOptions };

