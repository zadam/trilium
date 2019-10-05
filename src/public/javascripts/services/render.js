import server from "./server.js";
import bundleService from "./bundle.js";

async function render(note, $el, ctx) {
    const attributes = await note.getAttributes();
    const renderNoteIds = attributes.filter(attr =>
        attr.type === 'relation'
        && attr.name === 'renderNote'
        && !!attr.value).map(rel => rel.value);

    $el.empty().toggle(renderNoteIds.length > 0);

    for (const renderNoteId of renderNoteIds) {
        const bundle = await server.get('script/bundle/' + renderNoteId);

        const $scriptContainer = $('<div>');
        $el.append($scriptContainer);

        $scriptContainer.append(bundle.html);

        const $result = await bundleService.executeBundle(bundle, note, ctx, $scriptContainer);

        if ($result) {
            $scriptContainer.append($result);
        }
    }

    return renderNoteIds.length > 0;
}

export default {
    render
}