import React, { useCallback, useState } from 'react';
import { connect } from 'react-redux';

import { IReduxState } from '../../app/types';
import { translate } from '../../base/i18n/functions';
import { IconBeauty } from '../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../base/toolbox/components/AbstractButton';
import { openDialog } from '../../base/dialog/actions';
import BeautyDialog from './BeautyDialog';
import { getLocalVideoTrack } from '../../base/tracks/functions.any';
import { getTrackState } from '../../base/tracks/functions.any';
import { isBeautyEffectAvailable, isBeautyEffectEnabled } from '../functions';
import { BEAUTY_LEVELS } from '../constants';
import { setBeautyLevel, toggleBeautyEffectAction } from '../actions';

import BeautyMenu from './BeautyMenu';

/**
 * The type of the React {@code Component} props of {@link BeautyButton}.
 */
interface IProps extends AbstractButtonProps {
    /**
     * Whether the beauty effect is enabled.
     */
    _isBeautyEnabled: boolean;

    /**
     * Whether the beauty effect is available.
     */
    _isBeautyAvailable: boolean;

    /**
     * The current beauty level.
     */
    _beautyLevel: number;

    /**
     * The Redux state.
     */
    _state: IReduxState;
}

/**
 * An abstract implementation of a button that toggles the beauty effect.
 */
class BeautyButton extends AbstractButton<IProps, { showMenu: boolean; }> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.beauty';
    override icon = IconBeauty;
    override label = 'toolbar.beauty';
    override tooltip = 'toolbar.beauty';

    constructor(props: IProps) {
        super(props);
        this.state = { showMenu: false };
    }

    /**
     * Handles clicking / pressing the button, and toggles the beauty effect
     * state accordingly.
     *
     * @protected
     * @returns {void}
     */
    override _handleClick() {
        // Open modal dialog for consistent behavior across overlays/whiteboard
        this.props.dispatch(openDialog(BeautyDialog));
    }

    /**
     * Returns {@code boolean} value indicating if the beauty effect is
     * enabled or not.
     *
     * @protected
     * @returns {boolean}
     */
    override _isToggled() {
        return this.props._isBeautyEnabled;
    }

    /**
     * Returns {@code boolean} value indicating if the button should be
     * visible or not.
     *
     * @protected
     * @returns {boolean}
     */
    override _isVisible() {
        return this.props._isBeautyAvailable;
    }

    /**
     * Renders the button with a dropdown menu.
     *
     * @protected
     * @returns {ReactElement}
     */
    override _renderButton() {
        const { _beautyLevel } = this.props;
        const menu = (
            <div
                className = 'beauty-inline-menu'
                style = {{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#2a3a4b',
                    border: '1px solid #4a5a6b',
                    borderRadius: 8,
                    padding: '8px 0',
                    marginBottom: 8,
                    minWidth: 160,
                    zIndex: 1000
                }}>
                {[
                    { level: BEAUTY_LEVELS.OFF, label: 'None' },
                    { level: 1, label: 'Grayscale' },
                    { level: 2, label: 'Cloud Day' },
                    { level: 3, label: 'Sunlight' },
                    { level: 4, label: 'Moonlight' }
                ].map(({ level, label }) => (
                    <button
                        key = { level }
                        onClick = { () => this._onLevelSelect(level) }
                        style = {{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: _beautyLevel === level ? '#4a5a6b' : 'transparent',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer'
                        }}>
                        {_beautyLevel === level ? '✓ ' : ''}{label}
                    </button>
                ))}
            </div>
        );

        return super._renderButton();
    }

    /**
     * Handles beauty level selection.
     *
     * @param {number} level - The selected beauty level.
     * @private
     * @returns {void}
     */
    _onLevelSelect = (level: number) => {
        const { dispatch } = this.props;
        // Map selected level directly to filter type (0..4). Intensity handled in reducer/effect.
        dispatch(setBeautyLevel(level));
        this.setState({ showMenu: false });
    };
}

/**
 * Maps (parts of) the redux state to the associated props for the
 * {@code BeautyButton} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {{
 *     _isBeautyEnabled: boolean,
 *     _isBeautyAvailable: boolean,
 *     _beautyLevel: number
 * }}
 */
function _mapStateToProps(state: IReduxState) {
    return {
        _isBeautyEnabled: isBeautyEffectEnabled(state),
        _isBeautyAvailable: isBeautyEffectAvailable(state),
        _beautyLevel: state['features/beauty']?.level || 0,
        _state: state
    };
}

export default translate(connect(_mapStateToProps)(BeautyButton));
