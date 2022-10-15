const registeredClasses = new Set();

function createClassForColor(color) {
    if (!color?.trim()) {
        return "";
    }

    const normalizedColorName = color.replace(/[^a-z0-9]/gi, "");

    if (!normalizedColorName.trim()) {
        return "";
    }

    const className = 'color-' + normalizedColorName;

    if (!registeredClasses.has(className)) {
        $("head").append(`<style>.${className} { color: ${color} !important; }</style>`);

        registeredClasses.add(className);
    }

    return className;
}

export default {
    createClassForColor
};
