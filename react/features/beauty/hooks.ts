import { useSelector } from 'react-redux';

import BeautyButton from './components/BeautyButton';
import { isBeautyEffectAvailable } from './functions';

const beauty = {
    key: 'beauty',
    Content: BeautyButton,
    group: 3
};

/**
 * A hook that returns the beauty button if it is enabled and undefined otherwise.
 *
 * @returns {Object | undefined}
 */
export function useBeautyButton() {
    const _isBeautyAvailable = useSelector(isBeautyEffectAvailable);

    if (_isBeautyAvailable) {
        return beauty;
    }
}
