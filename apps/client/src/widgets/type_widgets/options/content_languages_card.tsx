import "./content_languages_card.css";

import { LOCALES } from "@triliumnext/commons";
import type { ComponentChildren } from "preact";
import { useCallback, useMemo } from "preact/hooks";

import dialog from "../../../services/dialog";
import { getAvailableLocales, getEnglishAnnotation, t } from "../../../services/i18n";
import options from "../../../services/options";
import ActionButton from "../../react/ActionButton";
import { useTriliumOption } from "../../react/hooks";
import Icon from "../../react/Icon";
import { type SortableItem, SortableCard } from "../../react/SortableCard";

const LANGUAGE_ICON = "bx bx-globe";

interface ContentLanguagesCardProps {
    /** Left out in a dialog whose title already names the card. */
    heading?: string;
    actions?: ComponentChildren;
}

interface LanguageItem extends SortableItem {
    englishName: string | null;
}

/**
 * The languages offered when the language of a text note is chosen, sorted by their native names
 * as `LOCALES` is.
 *
 * In its own module because the content languages dialog renders it too.
 */
export function ContentLanguagesCard({ heading, actions }: ContentLanguagesCardProps) {
    const [ storedLanguages, setStoredLanguages ] = useTriliumOption("languages");
    const languages = useMemo(
        () => (options.getJson("languages") as string[] | null) ?? [],
        [ storedLanguages ]); // eslint-disable-line react-hooks/exhaustive-deps
    const setLanguages = useCallback(
        (ids: string[]) => setStoredLanguages(JSON.stringify(ids)), [ setStoredLanguages ]);

    const items = useMemo<LanguageItem[]>(() => LOCALES
        .filter((locale) => languages.includes(locale.id))
        .map((locale) => ({
            key: locale.id,
            caption: locale.name,
            icon: LANGUAGE_ICON,
            englishName: getEnglishAnnotation(locale)
        })), [ languages ]);
    const availableCount = LOCALES.length - items.length;

    const remove = useCallback((id: string) => {
        setLanguages(languages.filter((candidate) => candidate !== id));
    }, [ languages, setLanguages ]);

    /** Opens the item picker on the languages that are not enabled yet. */
    const pick = useCallback(async () => {
        const picked = await dialog.pickSingleItem({
            title: t("content_language.add_title"),
            items: getAvailableLocales()
                .filter((locale) => !languages.includes(locale.id))
                .map((locale) => ({ key: locale.id, caption: locale.name, icon: LANGUAGE_ICON }))
        });

        return picked
            ? { key: picked.key, caption: picked.caption, icon: picked.icon, englishName: null }
            : undefined;
    }, [ languages ]);

    return (
        <SortableCard
            className="content-languages-card"
            heading={heading}
            actions={actions}
            description={t("content_language.description")}
            items={items}
            // The card reports additions only, since it cannot be reordered.
            onChange={(order) => setLanguages([
                ...languages,
                ...order.map((item) => item.key).filter((id) => !languages.includes(id))
            ])}
            isReorderable={false}
            onItemKeyDown={(item, event) => {
                if (event.key === "Delete") {
                    event.preventDefault();
                    remove(item.key);
                }
            }}
            renderItem={(item) => <>
                <Icon icon={LANGUAGE_ICON} />
                <span className="content-languages-title">
                    <span className="content-languages-native-name">{item.caption}</span>
                    {item.englishName && (
                        <span className="content-languages-english-name">
                            {item.englishName}
                        </span>
                    )}
                </span>
                <ActionButton
                    className="content-languages-remove"
                    icon="bx bx-x"
                    text={t("content_language.remove")}
                    onClick={(event) => {
                        event.stopPropagation();
                        remove(item.key);
                    }}
                />
            </>}
            itemCreationButtons={[ {
                label: items.length
                    ? t("content_language.add_another", { count: availableCount })
                    : t("content_language.add_first", { count: availableCount }),
                icon: "bx bx-plus",
                disabled: !availableCount,
                onCreateItem: pick
            } ]}
        />
    );
}
