import { IStore } from '../app/types';
import { toggleBeautyEffect, updateBeautyLevel } from '../stream-effects/beauty-webgl/toggleBeauty';
import { toggleTouchUpAppearance } from '../touch-up-appearance/actions';

import { SET_BEAUTY_EFFECT_ENABLED, SET_BEAUTY_LEVEL } from './actionTypes';
import logger from './logger';

/**
 * Signals the local participant to activate/deactivate the filter effect.
 *
 * @param {Object} options - Represents the filter effect options.
 * @param {Object} _jitsiTrack - Represents the jitsi track that will have filter effect applied.
 * @returns {Promise}
 */
export function toggleBeautyEffectAction(options: { enabled: boolean; filterType: number; intensity: number }, _jitsiTrack: any) {
    return async function(dispatch: IStore['dispatch'], getState: IStore['getState']) {
        try {
            const store = { dispatch, getState };

            // Enforce mutual exclusivity: if touch-up is enabled and beauty is being enabled, disable touch-up first.
            const touch = (getState() as any)['features/touch-up-appearance'];
            if (options.enabled && touch?.enabled) {
                await dispatch<any>(toggleTouchUpAppearance({ intensity: 0 }));
                // Wait a bit for the previous WebGL context to be fully released.
                await new Promise(r => setTimeout(r, 400));
            }

            if (options.enabled) {
                // Apply filter effect
                await toggleBeautyEffect({
                    filterType: options.filterType,
                    intensity: options.intensity
                }, store);
            } else {
                // Remove filter effect
                await toggleBeautyEffect({
                    filterType: 0,
                    intensity: 0
                }, store);
            }

            dispatch({
                type: SET_BEAUTY_EFFECT_ENABLED,
                enabled: options.enabled
            });
        } catch (error) {
            logger.error('Error on apply filter effect:', error);
        }
    };
}

/**
 * Updates the beauty level and keeps touch-up filters in sync when enabled.
 *
 * @param {number} level - The new beauty level.
 * @param {Object} _jitsiTrack - Unused jitsi track param for API parity.
 * @returns {Function}
 */
export function setBeautyLevel(level: number, _jitsiTrack?: any) {
    return async function(dispatch: IStore['dispatch'], getState: IStore['getState']) {
        try {
            const store = { dispatch, getState };
            // Enforce mutual exclusivity: if enabling a beauty level (>0) and touch-up is enabled, disable touch-up first.
            const touch = (getState() as any)['features/touch-up-appearance'];
            if (level > 0 && touch?.enabled) {
                await dispatch<any>(toggleTouchUpAppearance({ intensity: 0 }));
            }

            // Update the beauty level normally (applies or removes BeautyEffect)
            await updateBeautyLevel(level, store);

            dispatch({
                type: SET_BEAUTY_LEVEL,
                level
            });

            try {
                /* no-op to keep linter happy */
            } catch (_e) {
                /* no-op */
            }
        } catch (error) {
            logger.error('Error on apply beauty level:', error);
        }
    };
}
