import { IStore } from '../../app/types';
import { getLocalVideoTrack, getTrackState } from '../../base/tracks/functions.any';
import { showErrorNotification } from '../../notifications/actions';

import { IBeautyEffectOptions, createBeautyEffect } from './index';

// Keep a single WebGL effect per Jitsi local video track.
const trackToEffect = new WeakMap<any, any>();

/**
 * Interface for beauty effect state.
 */
export interface IBeautyEffectState {
    enabled: boolean;
    filterType: number; // 0 = none, 1 = grayscale, 2 = cloudDay, 3 = sunlight, 4 = moonlight
    intensity: number; // 0.0 to 1.0 for filter strength
}

/**
 * Applies or removes the filter effect on the local video track.
 *
 * @param {IBeautyEffectOptions} options - Filter effect options.
 * @param {IStore} store - Redux store.
 * @returns {Promise<void>} Promise that resolves when the effect is applied or removed.
 */
export async function toggleBeautyEffect(options: IBeautyEffectOptions, store: IStore): Promise<void> {
    try {
        const state = store.getState();
        const localVideoTrack = getLocalVideoTrack(getTrackState(state));

        if (!localVideoTrack?.jitsiTrack) {
            console.warn('toggleBeautyEffect: No local video track available');
            return;
        }

        const track = localVideoTrack.jitsiTrack as any;

        // Prefer the effect currently applied on the track. If not present, fall back to cached one.
        const appliedEffect: any = track.getEffect ? track.getEffect() : undefined;
        let effect: any = appliedEffect || trackToEffect.get(track);

        if (!options.filterType || !options.intensity) {
            // Disable/remove beauty effect completely.
            if (effect) {
                try {
                    effect.stop?.();
                } catch (_) {}
                try {
                    await track.setEffect(undefined);
                } catch (_) {}
                trackToEffect.delete(track);
            }
            return;
        }

        if (effect) {
            if (appliedEffect) {
                // Effect is already applied on the track: just update options.
                if (effect.updateOptions) {
                    effect.updateOptions(options);
                }
                try {
                    trackToEffect.set(track, effect);
                } catch (_e) {}
                return;
            }

            // We have a cached effect but it's not applied (e.g., after another effect was used).
            // Re-attach the cached beauty effect and then update options.
            await track.setEffect(effect);
            if (effect.updateOptions) {
                effect.updateOptions(options);
            }
            try {
                trackToEffect.set(track, effect);
            } catch (_e) {}
            return;
        }

        effect = await createBeautyEffect(options, store);
        if (effect.setJitsiTrack) {
            effect.setJitsiTrack(track);
        }

        await track.setEffect(effect);
        trackToEffect.set(track, effect);
    } catch (error) {
        console.error('toggleBeautyEffect: Error applying filter effect:', error);
        store.dispatch(showErrorNotification({
            titleKey: 'dialog.beautyEffectError',
            descriptionKey: 'dialog.beautyEffectErrorDescription'
        }));
        throw error;
    }
}

/**
 * Updates the beauty effect level on the local video track.
 *
 * @param {number} level - New beauty level (0-4, where 0 = no filter, 1-4 = filter types).
 * @param {IStore} store - Redux store.
 * @returns {Promise<void>} Promise that resolves when the effect is updated.
 */
export async function updateBeautyLevel(level: number, store: IStore): Promise<void> {
    const filterType = level;
    const intensity = level > 0 ? 1.0 : 0.0;

    const options: IBeautyEffectOptions = {
        filterType,
        intensity
    };

    await toggleBeautyEffect(options, store);
}

/**
 * Checks if the beauty effect is supported.
 *
 * @returns {boolean} True if the beauty effect is supported.
 */
let _beautySupportCache: boolean | null = null;
export function isBeautyEffectSupported(): boolean {
    if (_beautySupportCache !== null) {
        return _beautySupportCache;
    }

    try {
        const canvas = document.createElement('canvas');
        const gl: any = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const supported = !!gl;

        try {
            if (gl && typeof gl.getExtension === 'function') {
                const lose = gl.getExtension('WEBGL_lose_context');
                if (lose && typeof lose.loseContext === 'function') {
                    lose.loseContext();
                }
            }
        } catch (_ignored) {}

        _beautySupportCache = supported;
        return supported;
    } catch (_e) {
        _beautySupportCache = false;
        return false;
    }
}
