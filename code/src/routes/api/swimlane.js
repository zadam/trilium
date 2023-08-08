"use strict";

const log = require('../../services/log');
const becca = require("../../becca/becca");

function getSwimlaneTasks(req) {
    const swimlaneId = req.params.swimlaneId;
   
    const tasks = becca.getSwimlaneTasks(swimlaneId);
   
    let result = [];

    for(const i in tasks) {
        const task = tasks[i];
        if (task.type === 'task') {
            result.push({
                title: task.title,
                status: task.getAttributeValue('taskprop', 'state'),
                priority: task.getAttributeValue('taskprop', 'prio'),
                href: `${task.parents[0].noteId}/${task.noteId}`,
                deadline: task.getAttributeValue('taskprop', 'deadline'),
                taskId: task.noteId
            });
        }
    }

    return result;
}

module.exports = {
    getSwimlaneTasks
};
