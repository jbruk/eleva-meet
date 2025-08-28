import './reducer';
import { IStore } from '../app/types';
import { getLocalVideoTrack, getTrackState } from '../base/tracks/functions.any';
import { showErrorNotification } from '../notifications/actions';

import { createTouchUpAppearanceEffect, ITouchUpOptions } from '../stream-effects/touch-up-appearance';
import { toggleBeautyEffect } from '../stream-effects/beauty-webgl/toggleBeauty';
import { SET_TOUCH_UP_ENABLED, SET_TOUCH_UP_OPTIONS } from './actionTypes';

const trackToEffect = new WeakMap<any, any>();

export function setTouchUpOptions(options: Partial<ITouchUpOptions>) {
    return {
        type: SET_TOUCH_UP_OPTIONS,
        ...options
    } as any;
}

export function toggleTouchUpEnabled(enabled: boolean) {
    return {
        type: SET_TOUCH_UP_ENABLED,
        enabled
    } as any;
}

export function toggleTouchUpAppearance(options: Partial<ITouchUpOptions>, jitsiTrack?: any) {
    return async function(dispatch: IStore['dispatch'], getState: IStore['getState']) {
        try {
            const store = { dispatch, getState };

            let track = jitsiTrack;
            if (!track) {
                const state = getState();
                const localVideoTrack = getLocalVideoTrack(getTrackState(state));
                track = localVideoTrack?.jitsiTrack;
            }
            if (!track) { return; }

            let effect: any = (track.getEffect ? track.getEffect() : undefined) || trackToEffect.get(track);

            if (!options || options.intensity === 0) {
                // Always detach any current effect from the track to avoid stale/cached attachment
                try { await track.setEffect(undefined); } catch (_) {}
                try { if (effect) { trackToEffect.delete(track); } } catch (_) {}
                dispatch(toggleTouchUpEnabled(false));
                return;
            }

            // Enforce mutual exclusivity: when enabling touch-up, remove beauty filter effect if present.
            try {
                await toggleBeautyEffect({ filterType: 0, intensity: 0 }, store as any);
            } catch (_ignored) {}

            if (effect) {
                // Ensure the effect is the one applied on track
                if ((track.getEffect && track.getEffect()) !== effect) {
                    try { await track.setEffect(effect); } catch (_) {}
                }
                effect.updateOptions?.(options);
                try { trackToEffect.set(track, effect); } catch (_) {}
                dispatch(toggleTouchUpEnabled(true));
                return;
            }

            effect = await createTouchUpAppearanceEffect(options, store as any);
            effect.setJitsiTrack?.(track);
            await track.setEffect(effect);
            trackToEffect.set(track, effect);
            dispatch(toggleTouchUpEnabled(true));
        } catch (error) {
            dispatch(toggleTouchUpEnabled(false));
            dispatch(showErrorNotification({
                titleKey: 'dialog.touchUpEffectError',
                descriptionKey: 'dialog.touchUpEffectErrorDescription'
            }));
        }
    };
}


