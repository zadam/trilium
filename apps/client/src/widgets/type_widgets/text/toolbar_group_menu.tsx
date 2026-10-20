import "./toolbar_group_menu.css";

import type {
    ToolbarGroupMenuEntry, ToolbarGroupMenuHost, ToolbarGroupMenuItem, ToolbarGroupMenuRequest
} from "@triliumnext/ckeditor5";
import { render } from "preact";

import { escapeHtml, isMobile, isNarrowLayout } from "../../../services/utils";
import { FormDropdownDivider, FormDropdownSubmenu, FormListItem } from "../../react/FormList";
import Menu, { MenuTile } from "../../react/Menu";
import { useKeyboardPanel } from "./mobile_editor_toolbar";

/** The gap between the group's button and the menu, as a `Dropdown` leaves under its toggle. */
const ANCHOR_GAP = 2;

/**
 * Draws the menu of a toolbar group marked `asMenu` with the app's own `Menu`, for the editor
 * config's `toolbarGroupMenu.host`.
 */
export function createToolbarGroupMenuHost(): ToolbarGroupMenuHost {
    const container = document.createElement("div");
    let shown: ToolbarGroupMenuRequest | null = null;
    const unmount = () => {
        shown = null;
        render(null, container);
    };

    return {
        show(request) {
            shown = request;
            // An entry that runs hides the menu first, so a close that follows finds it gone.
            const close = (returnFocus: boolean) => {
                if (shown !== request) return;
                request.onClose(returnFocus);
                unmount();
            };
            render(<ToolbarGroupMenu request={request} onClose={close} />, container);
        },
        hide: unmount,
        destroy: unmount
    };
}

function ToolbarGroupMenu({ request, onClose }: {
    request: ToolbarGroupMenuRequest;
    onClose(returnFocus: boolean): void;
}) {
    const bottomSheet = isMobile() && isNarrowLayout();
    const keyboardPanel = useKeyboardPanel(bottomSheet);

    return (
        <Menu
            anchor={request.anchor}
            offset={ANCHOR_GAP}
            portalClassName="tn-dropdown-portal"
            className={keyboardPanel ? "tn-dropdown-menu keyboard-panel" : "tn-dropdown-menu"}
            bottomSheet={bottomSheet}
            aria-labelledby={request.anchor.getAttribute("aria-labelledby") ?? undefined}
            elementRef={request.setElement}
            onDismiss={() => onClose(false)}
            onClose={() => onClose(true)}
        >
            {request.layout === "tiles"
                ? <MenuTileGroups items={request.items} />
                : <MenuRows items={request.items} />}
        </Menu>
    );
}

function MenuRows({ items }: { items: ToolbarGroupMenuItem[] }) {
    return (
        <>
            {items.map((item, index) => {
                if (item.kind === "separator") {
                    return <FormDropdownDivider key={index} />;
                }

                const { label, icon, isEnabled, isOn, className, run, children } = item;
                if (children) {
                    return (
                        <FormDropdownSubmenu
                            key={index} iconSvg={icon} title={label} disabled={!isEnabled}
                            onDropdownToggleClicked={run && (() => run())}
                        >
                            <MenuRows items={children} />
                        </FormDropdownSubmenu>
                    );
                }

                return (
                    <FormListItem
                        key={index} iconSvg={icon} disabled={!isEnabled} onClick={() => run?.()}
                        checkable={isOn !== undefined} checked={isOn} className={className}
                    >
                        <span className="toolbar-group-menu-label">{label}</span>
                    </FormListItem>
                );
            })}
        </>
    );
}

/** The entries as tiles, a grid of them for each group between separators. */
function MenuTileGroups({ items }: { items: ToolbarGroupMenuItem[] }) {
    const groups: ToolbarGroupMenuEntry[][] = [ [] ];
    for (const item of items) {
        if (item.kind === "separator") {
            groups.push([]);
        } else {
            groups[groups.length - 1].push(item);
        }
    }

    return (
        <>
            {groups.map((group, index) => (
                <li key={index} className="tn-menu-actions tn-menu-actions-cards toolbar-group-menu-tiles" role="group">
                    {group.map(({ label, icon, isEnabled, isOn, run }, tileIndex) => (
                        <MenuTile
                            key={tileIndex} iconSvg={icon} title={escapeHtml(label)} tooltip={label}
                            disabled={!isEnabled} checked={isOn} onSelect={() => run?.()}
                        />
                    ))}
                </li>
            ))}
        </>
    );
}
