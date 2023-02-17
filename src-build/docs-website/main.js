document.addEventListener('DOMContentLoaded', function () {
    for (const li of document.querySelectorAll('.note-tree-nav li')) {
        const branchId = li.getAttribute("data-branch-id");
        if (branchId.startsWith("root_")) {
            // first level is expanded and cannot be collapsed
            continue;
        }

        const newDiv = document.createElement("span");
        const subList = li.querySelector('ul');

        if (subList) {
            const toggleVisibility = (show) => {
                newDiv.innerHTML = show ? "&blacktriangledown; " : "&blacktriangleright; ";
                subList.style.display = show ? 'block' : 'none';

                localStorage.setItem(branchId, show ? "true" : "false");
            };

            newDiv.classList.add("expander");
            newDiv.addEventListener('click', () => toggleVisibility(subList.style.display === 'none'));

            toggleVisibility(localStorage.getItem(branchId) === "true");
        } else {
            newDiv.classList.add("spacer");
        }

        li.prepend(newDiv);
    }
}, false);
