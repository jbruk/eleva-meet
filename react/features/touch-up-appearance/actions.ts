import './reducer';
import { IStore } from '../app/types';
import { getLocalVideoTrack, getTrackState } from '../base/tracks/functions.any';
import { showErrorNotification } from '../notifications/actions';

import { createTouchUpAppearanceEffect, ITouchUpOptions } from '../stream-effects/touch-up-appearance';
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
                if (effect) {
                    // Important: Do NOT call stopEffect manually; let Jitsi handle it inside setEffect(undefined)
                    try { await track.setEffect(undefined); } catch (_) {}
                    try { trackToEffect.delete(track); } catch (_) {}
                }
                dispatch(toggleTouchUpEnabled(false));
                return;
            }

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


