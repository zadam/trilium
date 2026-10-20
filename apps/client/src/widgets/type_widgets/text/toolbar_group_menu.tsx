import "./toolbar_group_menu.css";

import type {
    ToolbarGroupMenuEntry, ToolbarGroupMenuHost, ToolbarGroupMenuItem, ToolbarGroupMenuRequest
} from "@triliumnext/ckeditor5";
import clsx from "clsx";
import { render } from "preact";

import { escapeHtml, isMobile, isNarrowLayout } from "../../../services/utils";
import { FormDropdownDivider, FormDropdownSubmenu, FormListHeader, FormListItem } from "../../react/FormList";
import Menu, { MenuTile } from "../../react/Menu";
import { isKeyboardPanelOpen, logMenuHost, useKeyboardPanel } from "./mobile_editor_toolbar";

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
            // TEMPORARY: press diagnostics.
            logMenuHost(`show ${request.anchor.getAttribute("aria-labelledby") ?? ""}`);
            shown = request;
            // An entry that runs hides the menu first, so a close that follows finds it gone.
            const close = (returnFocus: boolean) => {
                if (shown !== request) return;
                request.onClose(returnFocus);
                unmount();
            };
            render(<ToolbarGroupMenu request={request} onClose={close} />, container);
        },
        hide: () => {
            // TEMPORARY: press diagnostics.
            logMenuHost("hide");
            unmount();
        },
        destroy: unmount,
        isInPlaceOfKeyboard: isKeyboardPanelOpen
    };
}

function ToolbarGroupMenu({ request, onClose }: {
    request: ToolbarGroupMenuRequest;
    onClose(returnFocus: boolean): void;
}) {
    const bottomSheet = isMobile() && isNarrowLayout();
    const { isPanel, replacesPanel } = useKeyboardPanel(bottomSheet);

    return (
        <Menu
            anchor={request.anchor}
            offset={ANCHOR_GAP}
            portalClassName="tn-dropdown-portal"
            className={clsx(
                "tn-dropdown-menu", isPanel && "keyboard-panel", replacesPanel && "replaces-panel"
            )}
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
                if (item.kind === "heading") {
                    return <FormListHeader key={index} text={item.label} />;
                }

                const { label, icon, iconClass, isEnabled, isOn, className, run, children } = item;
                if (children) {
                    return (
                        <FormDropdownSubmenu
                            key={index} icon={iconClass} iconSvg={icon} title={label} disabled={!isEnabled}
                            onDropdownToggleClicked={run && (() => run())}
                        >
                            <MenuRows items={children} />
                        </FormDropdownSubmenu>
                    );
                }

                return (
                    <FormListItem
                        key={index} icon={iconClass} iconSvg={icon} disabled={!isEnabled} onClick={() => run?.()}
                        checkable={isOn !== undefined} checked={isOn} className={className}
                    >
                        <span className="toolbar-group-menu-label">{label}</span>
                    </FormListItem>
                );
            })}
        </>
    );
}

/**
 * The entries as tiles, a grid of them for each group between separators. An entry with a submenu
 * is a tile that opens it.
 */
function MenuTileGroups({ items }: { items: ToolbarGroupMenuItem[] }) {
    const groups: ToolbarGroupMenuEntry[][] = [ [] ];
    for (const item of items) {
        if (item.kind === "entry") {
            groups[groups.length - 1].push(item);
        } else {
            groups.push([]);
        }
    }

    return (
        <>
            {groups.map((group, index) => (
                <li key={index} className="tn-menu-actions tn-menu-actions-cards toolbar-group-menu-tiles" role="group">
                    {group.map(({ label, icon, iconClass, isEnabled, isOn, run, children }, tileIndex) => (children
                        ? (
                            <FormDropdownSubmenu key={tileIndex} tile icon={iconClass} iconSvg={icon} title={label} disabled={!isEnabled}>
                                <MenuRows items={children} />
                            </FormDropdownSubmenu>
                        )
                        : (
                            <MenuTile
                                key={tileIndex} icon={iconClass} iconSvg={icon} title={escapeHtml(label)} tooltip={label}
                                disabled={!isEnabled} checked={isOn} onSelect={() => run?.()}
                            />
                        )
                    ))}
                </li>
            ))}
        </>
    );
}
