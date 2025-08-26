export const BEAUTY_LEVELS = {
    OFF: 0,
    SUBTLE: 1,
    MEDIUM: 2,
    HIGH: 3
} as const;

export const BEAUTY_LEVEL_LABELS = {
    [BEAUTY_LEVELS.OFF]: 'Off',
    [BEAUTY_LEVELS.SUBTLE]: 'Subtle',
    [BEAUTY_LEVELS.MEDIUM]: 'Medium',
    [BEAUTY_LEVELS.HIGH]: 'High'
} as const;
