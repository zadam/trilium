import server from "./server.js";
import froca from "./froca.js";
import toastService from "./toast.js";
import FAttribute from "../entities/fattribute.js";
import noteCreateService from "../services/note_create.js";
const TASKPROP = "taskprop";

async function getTaskProps(task) {
    if (task.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${task.type}`);
        return;
    }

    const resp = await server.get(`tree?subTreeNoteId=${task.noteId}`);
    let props = {};
    const attributeRows = resp.attributes;
    for (const attributeRow of attributeRows) {
        const { attributeId } = attributeRow;

        if (task && !task.attributes.includes(attributeId)) {
            continue;
        }

        let attr = new FAttribute(this, attributeRow);
        props[attr.name] = attr.value;
    }

    
    return props;
}

async function updateTaskDescription(task, newDescription) {
    if (task.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${task.type}`);
        return;
    }

    await server.put(`notes/${task.noteId}/set-attribute`, {
        value: newDescription,
        name: "description",
        type: TASKPROP
    });
}

async function removeTaskDeadline(task) {
    if (task.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${task.type}`);
        return;
    }

    server.put(`notes/${task.noteId}/attribute`, {
        value: 1,
        name: "hasDeadline",
        type: TASKPROP
    });
}

async function updateTaskDeadline(task, newDeadline) {
    if (task.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${task.type}`);
        return;
    }


    await server.put(`notes/${task.noteId}/set-attribute`, {
        value: newDeadline,
        name: "deadline",
        type: "taskprop"
    });
}

async function findMainBucket(note) {
    if (!note) {
        return null;
    }
    if (note.type === "bucket") {
        return note;
    }

    const parents = note.parents;

    for (const i in parents) {
        const parent = await froca.getNote(parents[i]);
        const res = await findMainBucket(parent);
        if (res) {
            return res;
        }
    }

    return null;
}

async function getDoneSwimlaneId(note) {

    const main = await findMainBucket(note);
    
    const attrs = await froca.getAttributes(main.noteId);

    return attrs.find(a => a.name === 'doneTasksParent')?.value;
}

async function updateTaskPriority(note, priority) {
    if (!note) {
        return null;
    }
    if (note.type !== "task") {
        return;
    }

    await server.put(`notes/${note.noteId}/set-attribute`, {
        type: "taskprop",
        name: "prio",
        value: priority
    });
}

async function updateTaskSwimlane(note, swimlane) {
    if (!note) {
        return null;
    }
    if (note.type !== "task") {
        return;
    }

    await server.put(`notes/${note.noteId}/set-attribute`, {
        type: "taskprop",
        name: "swimlane",
        value: swimlane
    });
}

async function updateTaskStatus(taskId, newStatus) {
    const note = await froca.getNote(taskId);
    if (note.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${task.type}`);
        return false;
    }

    const attrs = note.attributes;

    await server.put(`notes/${taskId}/set-attribute`, {
        attributeId: attrs.find(a => a.name === 'state'),
        type: 'taskprop',
        name: 'state',
        value: newStatus
    });
}

async function markTaskAsDone(task) {
    if (task.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while this is: ${task.type}`);
        return false;
    }

    await server.put(`notes/${task.noteId}/set-attribute`, {
        type: 'taskprop',
        name: 'state',
        value: 'done'
    });
    
    const done = await getDoneSwimlaneId(task);
    
    await server.put(`notes/${task.noteId}/set-attribute`, {
        type: 'taskprop',
        name: 'swimlane',
        value: done
    });

    return true;
}

async function isDone(note) {
    if (note.type !== 'task') {
        return false;
    }

    const fnote = await froca.getNote(note.noteId);

    if (fnote.children && fnote.children.length > 0) {
        return false;
    }

    const attrs = await froca.getAttributes(note.noteId);
    for (const i in attrs) {
        if (attrs[i].name === 'state') {
            return (attrs[i].value === 'done');
        }
    }

    return false;
}

async function getSwimlaneTasks(swimlaneId, sorted = false) {

    const tasks = await server.get(`swimlanes/${swimlaneId}/tasks`);

    if (!sorted) return tasks;
    const normal = [];
    const nice_to_have = [];
    const urgent = [];
    const show_stopper = [];
    for (const i in tasks) {

        const deadline = tasks[i]['deadline'];
        if (deadline !== undefined && deadline !== '1999-01-01') {
            const diff = dayjs(deadline).diff(dayjs(), 'day');
            if (diff <= 0) {
                show_stopper.push(tasks[i]);
                continue;
            } else if (diff < 3) {
                urgent.push(tasks[i]);
                continue;
            }
        }

        switch (tasks[i]['priority']) {
            case 'nice_to_have':
                nice_to_have.push(tasks[i]);
                break;
            case 'normal':
                normal.push(tasks[i]);
                break;
            case 'urgent':
                urgent.push(tasks[i]);
                break;
            case 'show_stopper':
                show_stopper.push(tasks[i]);
                break;
        }
    }

    const getCommonParent = async (note1, note2) => {
        if (!note1 || !note2) {
            throw new Error('note1 and note2 cannot be null');
        }
        const note1Parents = await froca.getParentsList(note1);
        const note2ParentIds = (await froca.getParentsList(note2)).map(n => n.noteId);
        
        var common = null;

        for( var i = 1 ; i < note1Parents.length; i++) {
            if (note2ParentIds.includes(note1Parents[i].noteId) && ['task', 'text'].includes(note1Parents[i].type)){
                common = note1Parents[i];
                
            }
        }
        return common;
    };

    const tasksAreRelated = async (a,b) => {
        const t1 = await froca.getNote(a.taskId);
        const t2 = await froca.getNote(b.taskId);
        const parent = await getCommonParent(t1, t2);
        
        if (!parent){
            return false;
        }
        return true;
    };
    const sortedList = [...show_stopper, ...urgent, ...normal, ...nice_to_have];
    const result = [];
    const skipList = {};
    for (let i = 0; i < sortedList.length; i++) {
        if (skipList[i]){
            continue;
        }
        const tempList = [];
        tempList.push(sortedList[i]);
        skipList[i] = true;
        for (let j = i + 1; j < sortedList.length; j++) {
            if (skipList[j]){
                continue;
            }
            if ((await tasksAreRelated(sortedList[i], sortedList[j])) === true) {                
                skipList[j] = true;
                tempList.push(sortedList[j]);
            }
        }
        result.push(tempList);
    }

    return result;
}

async function getTaskStatus(task) {
    if (task.type !== "task") {
        toastService.showAndLogError(`Note needs to be of task type, while it is: ${task.type}`);
        return;
    }

    const attrs = await server.get(`notes/${task.noteId}/attributes`);
    for (const i in attrs) {
        const attr = attrs[i];
        if (attr.type === 'taskprop' && attr.name === 'state') {
            return attr.value;
        }
    }

    await server.post(`notes/${this.$noteId}/attributes`, {
        name: 'state',
        type: 'taskprop',
        value: 'default'
    });
    return 'default';
}

function shouldBlink(priority) {
    return (priority === 'show_stopper' || priority === 'blocker');
}

async function createNewTask(path, title, description, deadline, swimlane) {
    const result = await noteCreateService.createNote(path, {
        type: "task",
        mime: "text/html",
        title: title,
        activate: false
    });

    await updateTaskSwimlane(result.note, swimlane);
    await updateTaskDeadline(result.note, deadline);
    await updateTaskDeadline(result.note, deadline);
    await updateTaskDescription(result.note, description);
}

function getTaskStatusText(str) {
    switch (str) {
        case "default":
            return 'NOT STARTED';
        case "in_progress":
            return 'IN PROGRESS';
        case "postponed":
            return 'POSTPONED';
        case "blocked":
            return 'BLOCKED';
        case "done":
            return 'DONE';
        default:
            return '';
    }
}

export default {
    getTaskProps,
    createNewTask,
    markTaskAsDone,
    updateTaskDeadline,
    updateTaskDescription,
    updateTaskStatus,
    findMainBucket,
    isDone,
    getDoneSwimlaneId,
    removeTaskDeadline,
    getTaskStatus,
    shouldBlink,
    getTaskStatusText,
    getSwimlaneTasks
};
