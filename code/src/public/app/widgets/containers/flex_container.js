import Container from "./container.js";

export default class FlexContainer extends Container {
    constructor(direction) {
        super();

        if (!direction || !['row', 'column'].includes(direction)) {
            throw new Error(`Direction argument given as '${direction}', use either 'row' or 'column'`);
        }

        this.attrs.style = `display: flex; flex-direction: ${direction};`;
    }
}
