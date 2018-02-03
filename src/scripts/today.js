api.addButtonToToolbar('go-today', $('<button class="btn btn-xs" onclick="goToday();"><span class="ui-icon ui-icon-calendar"></span> Today</button>'));

window.goToday = async function() {
    const todayDateStr = formatDateISO(new Date());

    const todayNoteId = await server.exec([todayDateStr], async todayDateStr => {
        return await this.getDateNoteId(todayDateStr);
    });

    api.activateNote(todayNoteId);
};