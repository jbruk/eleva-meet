import PersistenceRegistry from '../base/redux/PersistenceRegistry';
import ReducerRegistry from '../base/redux/ReducerRegistry';

import { SET_BEAUTY_EFFECT_ENABLED, SET_BEAUTY_LEVEL } from './actionTypes';

const STORE_NAME = 'features/beauty';

export interface IBeautyState {
    enabled: boolean;
    level: number; // Keep for backward compatibility
    filterType: number; // 0 = none, 1 = grayscale, 2 = cloudDay, 3 = sunlight, 4 = moonlight
    intensity: number; // 0.0 to 1.0 for filter strength
}

/**
 * Reduces redux actions which activate/deactivate beauty effect, or
 * indicate if the beauty effect is activated/deactivated.
 *
 * @param {State} state - The current redux state.
 * @param {Action} action - The redux action to reduce.
 * @returns {State} The next redux state that is the result of reducing the
 * specified action.
 */
ReducerRegistry.register<IBeautyState>(STORE_NAME, (state = { 
    enabled: false, 
    level: 0, 
    filterType: 0, 
    intensity: 0 
}, action): IBeautyState => {
    /**
     * Sets up the persistence of the feature {@code beauty}.
     */
    PersistenceRegistry.register(STORE_NAME);

    switch (action.type) {
    case SET_BEAUTY_EFFECT_ENABLED: {
        return {
            ...state,
            enabled: action.enabled
        };
    }
    case SET_BEAUTY_LEVEL: {
        // Map level to filter type for backward compatibility
        const filterType = action.level;
        const intensity = action.level > 0 ? 1.0 : 0.0;
        
        return {
            ...state,
            level: action.level,
            filterType,
            intensity,
            enabled: action.level > 0
        };
    }
    }

    return state;
});
