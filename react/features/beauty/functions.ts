import { IReduxState } from '../app/types';
import { isScreenVideoShared } from '../screen-share/functions';
import { isBeautyEffectSupported } from '../stream-effects/beauty-webgl/toggleBeauty';

/**
 * Checks if beauty effect is enabled.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean} True if beauty effect is enabled.
 */
export function isBeautyEffectEnabled(state: IReduxState): boolean {
    return Boolean(state['features/beauty']?.enabled);
}

/**
 * Gets the current beauty effect level.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {number} The current beauty level (0-3).
 */
export function getBeautyLevel(state: IReduxState): number {
    return state['features/beauty']?.level || 0;
}

/**
 * Checks if beauty effect should be available.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {boolean} True if beauty effect should be available.
 */
export function isBeautyEffectAvailable(state: IReduxState): boolean {
    return isBeautyEffectSupported() && !isScreenVideoShared(state);
}
