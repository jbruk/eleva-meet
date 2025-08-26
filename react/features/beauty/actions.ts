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

            // If touch-up is enabled, don't attach the separate beauty effect.
            // Instead, forward the filter selection to the touch-up effect which composites filters internally.
            const touch = (getState() as any)['features/touch-up-appearance'];
            if (touch?.enabled) {
                const filterType = options.filterType;
                const filterStrength = options.intensity;

                await dispatch<any>(toggleTouchUpAppearance({
                    filterType,
                    filterStrength,
                    intensity: touch.intensity ?? 0.6,
                    brighten: touch.brighten ?? 0.3,
                    smoothness: touch.smoothness ?? 0.7
                }));

                dispatch({
                    type: SET_BEAUTY_EFFECT_ENABLED,
                    enabled: options.enabled
                });

                return;
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

            const touch = (getState() as any)['features/touch-up-appearance'];
            if (touch?.enabled) {
                // Don't attach BeautyEffect while TouchUp is active; forward filter to touch-up instead.
                const beauty = (getState() as any)['features/beauty'];
                const filterType = level;
                const filterStrength = beauty?.intensity ?? (level > 0 ? 1 : 0);

                await dispatch<any>(toggleTouchUpAppearance({
                    filterType,
                    filterStrength,
                    intensity: touch.intensity ?? 0.6,
                    brighten: touch.brighten ?? 0.3,
                    smoothness: touch.smoothness ?? 0.7
                }));
            } else {
                // Update the beauty level normally (applies BeautyEffect)
                await updateBeautyLevel(level, store);
            }

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
