"use strict";

const ws = require('./ws.js');

// taskId => TaskContext
const taskContexts = {};

class TaskContext {
    constructor(taskId, taskType, data) {
        this.taskId = taskId;
        this.taskType = taskType;
        this.data = data;

        // progressCount is meant to represent just some progress - to indicate the task is not stuck
        this.progressCount = 0;
        this.lastSentCountTs = Date.now();
    }

    /** @return {TaskContext} */
    static getInstance(taskId, data) {
        if (!taskContexts[taskId]) {
            taskContexts[taskId] = new TaskContext(taskId, 'import', data);
        }

        return taskContexts[taskId];
    }

    async increaseProgressCount() {
        this.progressCount++;

        if (Date.now() - this.lastSentCountTs >= 300) {
            this.lastSentCountTs = Date.now();

            await ws.sendMessageToAllClients({
                type: 'task-progress-count',
                taskId: this.taskId,
                taskType: this.taskType,
                progressCount: this.progressCount
            });
        }
    }

    // must remaing non-static
    async reportError(message) {
        await ws.sendMessageToAllClients({
            type: 'task-error',
            taskId: this.taskId,
            taskType: this.taskType,
            message: message
        });
    }

    // must remaing non-static
    async taskSucceeded(parentNoteId, importedNoteId) {
        await ws.sendMessageToAllClients({
            type: 'task-succeeded',
            taskId: this.taskId,
            taskType: this.taskType,
            parentNoteId: parentNoteId,
            importedNoteId: importedNoteId
        });
    }
}

module.exports = TaskContext;