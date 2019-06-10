import utils from "../services/utils.js";

const $dialog = $("#prompt-dialog");
const $dialogBody = $dialog.find(".modal-body");

let $question;
let $answer;

const $form = $("#prompt-dialog-form");

let resolve;
let shownCb;

function ask({ message, defaultValue, shown }) {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    shownCb = shown;

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

    $dialog.modal();

    return new Promise((res, rej) => { resolve = res; });
}

$dialog.on('shown.bs.modal', () => {
    if (shownCb) {
        shownCb({ $dialog, $question, $answer, $form });
    }

    $answer.focus().select();
});

$dialog.on("hidden.bs.modal", () => {
    if (resolve) {
        resolve(null);
    }
});

$form.submit(() => {
    resolve($answer.val());

    $dialog.modal('hide');
});

export default {
    ask
}