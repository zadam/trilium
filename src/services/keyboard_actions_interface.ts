export interface KeyboardShortcut {
    separator?: string;
    actionName?: string;
    description?: string;
    defaultShortcuts?: string[];
    effectiveShortcuts?: string[];
    scope?: string;
}

export interface KeyboardShortcutWithRequiredActionName extends KeyboardShortcut {
    actionName: string;
}