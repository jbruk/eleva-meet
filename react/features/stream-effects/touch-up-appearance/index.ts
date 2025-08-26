import { IStore } from '../../app/types';
import { TouchUpAppearanceEffect, ITouchUpOptions } from './touchUpAppearanceEffect';

export async function createTouchUpAppearanceEffect(options: Partial<ITouchUpOptions>, store: IStore) {
    const impl = new TouchUpAppearanceEffect(options, store);

    return {
        startEffect: (stream: MediaStream) => impl.startEffect(stream),
        stopEffect: () => impl.stopEffect(),
        updateOptions: (opts: Partial<ITouchUpOptions>) => impl.updateOptions(opts),
        setJitsiTrack: (jitsiTrack: any) => (impl as any).setJitsiTrack?.(jitsiTrack),
        isEnabled: () => true
    } as any;
}

export type { ITouchUpOptions };


