import { IStore } from '../../app/types';
import { NoiseSuppressionEffect } from '../../stream-effects/noise-suppression/NoiseSuppressionEffect';
import { createVirtualBackgroundEffect } from '../../stream-effects/virtual-background';
import { createBeautyEffect } from '../../stream-effects/beauty-webgl';
import { createTouchUpAppearanceEffect } from '../../stream-effects/touch-up-appearance';

import logger from './logger';

/**
 * Loads the enabled stream effects.
 *
 * @param {Object} store - The Redux store.
 * @returns {Promise} - A Promise which resolves when all effects are created.
 */
export default function loadEffects(store: IStore): Promise<any> {
    const start = window.performance.now();
    const state = store.getState();
    const virtualBackground = state['features/virtual-background'];
    const noiseSuppression = state['features/noise-suppression'];
    const beauty = state['features/beauty'];
    const touchUp = state['features/touch-up-appearance'];
    const { noiseSuppression: nsOptions } = state['features/base/config'];


    const backgroundPromise = virtualBackground.backgroundEffectEnabled
        ? createVirtualBackgroundEffect(virtualBackground)
            .catch((error: Error) => {
                logger.error('Failed to obtain the background effect instance with error: ', error);

                return Promise.resolve();
            })
        : Promise.resolve();

    const noiseSuppressionPromise = noiseSuppression?.enabled
        ? Promise.resolve(new NoiseSuppressionEffect(nsOptions))
        : Promise.resolve();

    const beautyPromise = beauty?.enabled
        ? createBeautyEffect({ filterType: beauty.filterType ?? beauty.level ?? 0, intensity: beauty.intensity ?? (beauty.level > 0 ? 1 : 0) }, store)
            .catch((error: Error) => {
                logger.error('Failed to obtain the beauty effect instance with error: ', error);
                return Promise.resolve();
            })
        : Promise.resolve();

    const touchUpPromise = touchUp?.enabled
        ? createTouchUpAppearanceEffect({
            intensity: touchUp.intensity,
            brighten: touchUp.brighten,
            smoothness: touchUp.smoothness
        }, store)
            .catch((error: Error) => {
                logger.error('Failed to obtain the touch-up appearance effect instance with error: ', error);
                return Promise.resolve();
            })
        : Promise.resolve();

    return Promise.all([ backgroundPromise, noiseSuppressionPromise, beautyPromise, touchUpPromise ]).then(effectsArray => {
        const end = window.performance.now();

        logger.debug(`(TIME) loadEffects() start=${start}, end=${end}, time=${end - start}`);

        return effectsArray;
    });
}
