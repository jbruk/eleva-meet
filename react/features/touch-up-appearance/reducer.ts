import PersistenceRegistry from '../base/redux/PersistenceRegistry';
import ReducerRegistry from '../base/redux/ReducerRegistry';

import { SET_TOUCH_UP_ENABLED, SET_TOUCH_UP_OPTIONS } from './actionTypes';

export interface ITouchUpState {
    enabled: boolean;
    intensity: number; // 0..1
    brighten: number;  // 0..1
    smoothness: number; // 0..1
}

const STORE_NAME = 'features/touch-up-appearance';

ReducerRegistry.register<ITouchUpState>(STORE_NAME, (state = {
    enabled: false,
    intensity: 0.6,
    brighten: 0.3,
    smoothness: 0.7
}, action): ITouchUpState => {
    PersistenceRegistry.register(STORE_NAME);

    switch (action.type) {
    case SET_TOUCH_UP_ENABLED:
        return {
            ...state,
            enabled: action.enabled
        };
    case SET_TOUCH_UP_OPTIONS:
        return {
            ...state,
            intensity: typeof action.intensity === 'number' ? action.intensity : state.intensity,
            brighten: typeof action.brighten === 'number' ? action.brighten : state.brighten,
            smoothness: typeof action.smoothness === 'number' ? action.smoothness : state.smoothness
        };
    default:
        return state;
    }
});


