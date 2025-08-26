import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../app/types';
import { hideDialog } from '../../base/dialog/actions';
import Dialog from '../../base/ui/components/web/Dialog';
import Checkbox from '../../base/ui/components/web/Checkbox';
import { toggleTouchUpAppearance } from '../../touch-up-appearance/actions';
import { setBeautyLevel } from '../actions';

const FILTERS: Array<{ level: number; label: string; }> = [
    { level: 0, label: 'None' },
    { level: 1, label: 'Grayscale' },
    { level: 2, label: 'Cloud Day' },
    { level: 3, label: 'Sunlight' },
    { level: 4, label: 'Moonlight' }
];

export default function BeautyDialog() {
    const dispatch = useDispatch();
    const current = useSelector((state: IReduxState) => state['features/beauty']?.level ?? 0);
    const touchUpEnabled = useSelector((state: IReduxState) => Boolean((state as any)['features/touch-up-appearance']?.enabled));

    const onSelect = (level: number) => {
        dispatch(setBeautyLevel(level));
        dispatch(hideDialog());
    };

    return (
        <Dialog
            okDisabled = {true}
            submitDisabled = {true}
            onCancel = {() => dispatch(hideDialog())}
            titleKey = 'toolbar.beauty'>
            <div style = {{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {FILTERS.map(({ level, label }) => (
                    <button
                        key = {level}
                        onClick = {() => onSelect(level)}
                        style = {{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--toolbar-border)',
                            background: current === level ? 'var(--toolbar-active-background)' : 'var(--toolbar-background)',
                            color: 'var(--toolbar-color)',
                            cursor: 'pointer'
                        }}>
                        {current === level ? '✓ ' : ''}{label}
                    </button>
                ))}

                <div style = {{ borderTop: '1px solid var(--toolbar-border)', marginTop: 8, paddingTop: 8 }} />
                {/* Whiteboard section placeholder assumed above; placing the toggle beneath */}
                <div style = {{ padding: '6px 2px' }}>
                    <Checkbox
                        checked = { touchUpEnabled }
                        label = { 'Touch Up Appearance' }
                        onChange = { () => {
                            const enable = !touchUpEnabled;
                            dispatch(toggleTouchUpAppearance(enable ? { intensity: 0.6, brighten: 0.3, smoothness: 0.7 } : { intensity: 0 }));
                        } } />
                </div>
            </div>
        </Dialog>
    );
}


