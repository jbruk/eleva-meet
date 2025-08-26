import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { IconBeauty } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { setBeautyLevel } from '../../../beauty/actions';

/**
 * Props for FilterButton – extend Jitsi's AbstractButton props
 */
interface IProps extends AbstractButtonProps {}

/**
 * Filter types available
 */
const FILTER_TYPES = {
    NONE: 0,
    GRAYSCALE: 1,
    CLOUD_DAY: 2,
    SUNLIGHT: 3,
    MOONLIGHT: 4
};

/**
 * Filter names for display
 */
const FILTER_NAMES = {
    [FILTER_TYPES.NONE]: 'None',
    [FILTER_TYPES.GRAYSCALE]: 'Grayscale',
    [FILTER_TYPES.CLOUD_DAY]: 'Cloud Day',
    [FILTER_TYPES.SUNLIGHT]: 'Sunlight',
    [FILTER_TYPES.MOONLIGHT]: 'Moonlight'
};

/**
 * FilterButton – provides multiple filter options similar to Google Meet
 *
 * @param {IProps} props - The component props.
 * @returns {ReactElement}
 */
const FilterButton: React.FC<IProps> = props => {
    const dispatch = useDispatch();
    const [showMenu, setShowMenu] = useState(false);

    // pull current filter state from redux
    const filterType = useSelector((state: IReduxState) =>
        state[ 'features/beauty' ]?.filterType ?? FILTER_TYPES.NONE
    );
    const _intensity = useSelector((state: IReduxState) =>
        state[ 'features/beauty' ]?.intensity ?? 0
    );

    // Handle filter selection
    const handleFilterSelect = (newFilterType: number) => {
        const _newIntensity = newFilterType === FILTER_TYPES.NONE ? 0 : 1.0;

        // Update the beauty level to trigger the filter change
        // We'll map filter types to levels for now (0-4)
        dispatch(setBeautyLevel(newFilterType));

        setShowMenu(false);
        console.log(`Filter applied: ${FILTER_NAMES[newFilterType as keyof typeof FILTER_NAMES]}`);
    };

    // Toggle menu visibility
    const handleClick = () => {
        setShowMenu(!showMenu);
    };

    // Close menu when clicking outside
    const handleMenuClose = () => {
        setShowMenu(false);
    };

    const currentFilterName = FILTER_NAMES[filterType as keyof typeof FILTER_NAMES] || 'None';
    const isFilterActive = filterType !== FILTER_TYPES.NONE;

    return (
        <div style={{ position: 'relative' }}>
        <AbstractButton
            {...props}
            accessibilityLabel='toolbar.accessibilityLabel.beauty'
                icon={IconBeauty}
                label={isFilterActive ? `Filter: ${currentFilterName}` : 'Apply Filter'}
                onClick={handleClick}
                toggled={isFilterActive}
            />
            
            {showMenu && (
                <div 
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#2a3a4b',
                        border: '1px solid #4a5a6b',
                        borderRadius: '8px',
                        padding: '8px 0',
                        marginBottom: '8px',
                        minWidth: '150px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                >
                    <div style={{ padding: '8px 16px', fontSize: '12px', color: '#fff', borderBottom: '1px solid #4a5a6b' }}>
                        Choose Filter
                    </div>
                    {Object.entries(FILTER_NAMES).map(([type, name]) => {
                        const filterTypeNum = parseInt(type);
                        const isSelected = filterType === filterTypeNum;
                        
                        return (
                            <button
                                key={type}
                                onClick={() => handleFilterSelect(filterTypeNum)}
                                style={{
                                    width: '100%',
                                    padding: '8px 16px',
                                    backgroundColor: isSelected ? '#4a5a6b' : 'transparent',
                                    border: 'none',
                                    color: '#fff',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = isSelected ? '#4a5a6b' : '#3a4a5b';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = isSelected ? '#4a5a6b' : 'transparent';
                                }}
                            >
                                {isSelected && (
                                    <span style={{ fontSize: '12px' }}>✓</span>
                                )}
                                {name}
                            </button>
                        );
                    })}
                </div>
            )}
            
            {/* Overlay to close menu when clicking outside */}
            {showMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999
                    }}
                    onClick={handleMenuClose}
                />
            )}
        </div>
    );
};

export default FilterButton;
