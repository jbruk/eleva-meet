/**
 * PostMessage bridge for external beauty effect control.
 * Allows parent applications to control the beauty effect via postMessage.
 */

import { getBeautyEffectState, updateBeautyLevel } from './toggleBeauty';

/**
 * Handles beauty effect messages from parent frame.
 * 
 * @param {MessageEvent} event - The postMessage event
 * @param {Object} store - The Redux store
 */
export function handleBeautyMessage(event, store) {
    const { data, origin } = event;
    
    // Validate message structure
    if (!data || typeof data !== 'object' || !data.type) {
        return;
    }
    
    // Only handle beauty-related messages
    if (!data.type.startsWith('beauty:')) {
        return;
    }
    
    try {
        switch (data.type) {
            case 'beauty:set':
                handleBeautySet(data, store);
                break;
            case 'beauty:get':
                handleBeautyGet(data, store, origin);
                break;
            case 'beauty:toggle':
                handleBeautyToggle(data, store);
                break;
            default:
                console.warn('Unknown beauty message type:', data.type);
        }
    } catch (error) {
        console.error('Error handling beauty message:', error);
        sendBeautyResponse(origin, {
            type: 'beauty:error',
            error: error.message
        });
    }
}

/**
 * Handles beauty:set message to set beauty level.
 * 
 * @param {Object} data - Message data
 * @param {Object} store - Redux store
 */
async function handleBeautySet(data, store) {
    const { level } = data;
    
    if (typeof level !== 'number' || level < 0 || level > 3) {
        throw new Error('Invalid beauty level. Must be 0-3.');
    }
    
    await updateBeautyLevel(level, store);
    
    console.log(`Beauty effect level set to: ${level}`);
}

/**
 * Handles beauty:get message to get current beauty state.
 * 
 * @param {Object} data - Message data
 * @param {Object} store - Redux store
 * @param {string} origin - Message origin
 */
function handleBeautyGet(data, store, origin) {
    const state = getBeautyEffectState(store);
    
    sendBeautyResponse(origin, {
        type: 'beauty:state',
        state
    });
}

/**
 * Handles beauty:toggle message to toggle beauty effect.
 * 
 * @param {Object} data - Message data
 * @param {Object} store - Redux store
 */
async function handleBeautyToggle(data, store) {
    const currentState = getBeautyEffectState(store);
    const newLevel = currentState.enabled ? 0 : 1; // Toggle between off and subtle
    
    await updateBeautyLevel(newLevel, store);
    
    console.log(`Beauty effect toggled to: ${newLevel}`);
}

/**
 * Sends a response back to the parent frame.
 * 
 * @param {string} origin - Target origin
 * @param {Object} data - Response data
 */
function sendBeautyResponse(origin, data) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(data, origin);
    }
}

/**
 * Initializes the beauty effect PostMessage bridge.
 * 
 * @param {Object} store - The Redux store
 */
export function initBeautyBridge(store) {
    // Listen for messages from parent frame
    window.addEventListener('message', (event) => {
        handleBeautyMessage(event, store);
    });
    
    console.log('Beauty effect PostMessage bridge initialized');
}

/**
 * Sends beauty effect state to parent frame.
 * 
 * @param {Object} store - The Redux store
 * @param {string} origin - Target origin (optional)
 */
export function notifyBeautyStateChange(store, origin = '*') {
    const state = getBeautyEffectState(store);
    
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'beauty:stateChanged',
            state
        }, origin);
    }
}
