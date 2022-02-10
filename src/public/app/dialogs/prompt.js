import utils from "../services/utils.js";

const $dialog = $("#prompt-dialog");
const $dialogBody = $dialog.find(".modal-body");

let $question;
let $answer;

const $form = $("#prompt-dialog-form");

let resolve;
let shownCb;

export function ask({ title, message, defaultValue, shown }) {
    shownCb = shown;

    $("#prompt-title").text(title || "Prompt");

    $question = $("<label>")
        .prop("for", "prompt-dialog-answer")
        .text(message);

    $answer = $("<input>")
        .prop("type", "text")
        .prop("id", "prompt-dialog-answer")
        .addClass("form-control")
        .val(defaultValue || "");

    $dialogBody.empty().append(
        $("<div>")
            .addClass("form-group")
            .append($question)
            .append($answer));

    utils.openDialog($dialog, false);

    return new Promise((res, rej) => { resolve = res; });
}

$dialog.on('shown.bs.modal', () => {
    if (shownCb) {
        shownCb({ $dialog, $question, $answer, $form });
    }

    $answer.trigger('focus').select();
});

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve(null);
    }
});

$form.on('submit', e => {
    e.preventDefault();
    resolve($answer.val());

    $dialog.modal('hide');
});
