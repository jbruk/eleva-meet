import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BEAUTY_LEVELS, BEAUTY_LEVEL_LABELS } from '../constants';

/**
 * The type of the React {@code Component} props of {@link BeautyMenu}.
 */
interface IProps {
    /**
     * Whether the menu is open.
     */
    isOpen: boolean;

    /**
     * Callback to handle level selection.
     */
    onLevelSelect: (level: number) => void;

    /**
     * The current beauty level.
     */
    currentLevel: number;

    /**
     * Whether the beauty effect is enabled.
     */
    isEnabled: boolean;
}

/**
 * React component for beauty effect level selection menu.
 *
 * @returns {ReactElement}
 */
function BeautyMenu({ isOpen, onLevelSelect, currentLevel, isEnabled }: IProps) {
    const { t } = useTranslation();

    if (!isOpen) {
        return null;
    }

    const handleLevelSelect = (level: number) => {
        onLevelSelect(level);
    };

    return (
        <div className = 'beauty-menu'>
            <div className = 'beauty-menu-header'>
                {t('toolbar.beauty')}
            </div>
            <div className = 'beauty-menu-options'>
                {Object.entries(BEAUTY_LEVEL_LABELS).map(([level, label]) => (
                    <div
                        key = {level}
                        className = {`beauty-menu-option ${Number(level) === currentLevel ? 'selected' : ''}`}
                        onClick = {() => handleLevelSelect(Number(level))}>
                        <span className = 'beauty-menu-label'>
                            {t(`toolbar.beauty.${label.toLowerCase()}`)}
                        </span>
                        {Number(level) === currentLevel && (
                            <span className = 'beauty-menu-checkmark'>✓</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default BeautyMenu;
