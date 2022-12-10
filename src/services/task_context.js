"use strict";

const ws = require('./ws');

// taskId => TaskContext
const taskContexts = {};

class TaskContext {
    constructor(taskId, taskType, data = null) {
        this.taskId = taskId;
        this.taskType = taskType;
        this.data = data;
        this.noteDeletionHandlerTriggered = false;

        // progressCount is meant to represent just some progress - to indicate the task is not stuck
        this.progressCount = -1; // we're incrementing immediatelly
        this.lastSentCountTs = 0; // 0 will guarantee first message will be sent

        // just the fact this has been initialized is a progress which should be sent to clients
        // this is esp. important when importing big files/images which take long time to upload/process
        // which means that first "real" increaseProgressCount() will be called quite late and user is without
        // feedback until then
        this.increaseProgressCount();
    }

    /** @returns {TaskContext} */
    static getInstance(taskId, taskType, data = null) {
        if (!taskContexts[taskId]) {
            taskContexts[taskId] = new TaskContext(taskId, taskType, data);
        }

        return taskContexts[taskId];
    }

    increaseProgressCount() {
        this.progressCount++;

        if (Date.now() - this.lastSentCountTs >= 300 && this.taskId !== 'no-progress-reporting') {
            this.lastSentCountTs = Date.now();

            ws.sendMessageToAllClients({
                type: 'taskProgressCount',
                taskId: this.taskId,
                taskType: this.taskType,
                data: this.data,
                progressCount: this.progressCount
            });
        }
    }

    reportError(message) {
        ws.sendMessageToAllClients({
            type: 'taskError',
            taskId: this.taskId,
            taskType: this.taskType,
            data: this.data,
            message: message
        });
    }

    taskSucceeded(result) {
        ws.sendMessageToAllClients({
            type: 'taskSucceeded',
            taskId: this.taskId,
            taskType: this.taskType,
            data: this.data,
            result: result
        });
    }
}

module.exports = TaskContext;
