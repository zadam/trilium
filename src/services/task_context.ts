"use strict";

import ws = require('./ws');

// taskId => TaskContext
const taskContexts: Record<string, TaskContext> = {};

interface TaskData {
    safeImport?: boolean;
    textImportedAsText?: boolean;
    codeImportedAsCode?: boolean;
    shrinkImages?: boolean;
}

class TaskContext {

    private taskId: string;
    private taskType: string | null;
    private progressCount: number;
    private lastSentCountTs: number;
    data: TaskData | null;
    noteDeletionHandlerTriggered: boolean;
    
    constructor(taskId: string, taskType: string | null = null, data: {} | null = {}) {
        this.taskId = taskId;
        this.taskType = taskType;
        this.data = data;
        this.noteDeletionHandlerTriggered = false;

        // progressCount is meant to represent just some progress - to indicate the task is not stuck
        this.progressCount = -1; // we're incrementing immediately
        this.lastSentCountTs = 0; // 0 will guarantee the first message will be sent

        // just the fact this has been initialized is a progress which should be sent to clients
        // this is esp. important when importing big files/images which take a long time to upload/process
        // which means that first "real" increaseProgressCount() will be called quite late and user is without
        // feedback until then
        this.increaseProgressCount();
    }

    static getInstance(taskId: string, taskType: string, data: {} | null = null): TaskContext {
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
                data: this.data || undefined,
                progressCount: this.progressCount
            });
        }
    }

    reportError(message: string) {
        ws.sendMessageToAllClients({
            type: 'taskError',
            taskId: this.taskId,
            taskType: this.taskType,
            data: this.data || undefined,
            message: message
        });
    }

    taskSucceeded(result?: string) {
        ws.sendMessageToAllClients({
            type: 'taskSucceeded',
            taskId: this.taskId,
            taskType: this.taskType,
            data: this.data || undefined,
            result: result
        });
    }
}

export = TaskContext;
