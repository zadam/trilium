# Context

In this doc I'll add the list of features that I wish to add.

## Priorities

- Fix Mark as Done ( on note-tree, in swimlane)
- A button to hide done tasks from the tree, on the parent note_tree_item
- Add a backup script 
- Investigate adding electron support

## Must have

- Track last update of the task, to set automatic reminders.
- Set task to done should be done from only 1 place
- Recurring tasks

- List the tasks without a swimlane to the backlog swimlane
- In swimlanes:
    -- Add an indicator for the number of tasks to swimlanes
    -- Add a property for each Swimlane for max number of tasks and show somewhere
    -- Add a prop for Order of Swimlanes (both for Dashboard and Dropdown)
    
- When creating subtasks, the subtask should get deadline/prio/etc. from parent
    -- + default func should be creating a new task, not a new note


## Nice to have
- Drag/move tasks between swimlanes
- Docker image registry => So that we can pull the image from local registry and not to pull the build packages again
- Delete comments
- Mark as done, in task => a button with checkmark icon on the top ribbon
- Change the swimlane task retrieval algorithm. It's very slow atm