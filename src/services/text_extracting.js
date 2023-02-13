const Canvas = require("canvas");
const OCRAD = require("ocrad.js");
const log = require("./log");
const optionService = require("./options");
const cls = require("./cls");

function ocrFromByteArray(img) {
    // byte array contains raw uncompressed pixel data
    // kind: 1 - GRAYSCALE_1BPP (unsupported)
    // kind: 2 - RGB_24BPP
    // kind: 3 - RGBA_32BPP

    if (!(img.data instanceof Uint8ClampedArray) || ![2, 3].includes(img.kind)) {
        return null;
    }

    const start = Date.now();
    const canvas = new Canvas.createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');

    const imageData = ctx.createImageData(img.width, img.height);
    const imageBytes = imageData.data;

    for (let j = 0, k = 0, jj = img.width * img.height * 4; j < jj;) {
        imageBytes[j++] = img.data[k++];
        imageBytes[j++] = img.data[k++];
        imageBytes[j++] = img.data[k++];
        // in case of kind = 2, the alpha channel is missing in source pixels and we'll add it
        imageBytes[j++] = img.kind === 2 ? 255 : img.data[k++];
    }

    ctx.putImageData(imageData, 0, 0);
    const text = OCRAD(canvas);

    log.info(`OCR of ${img.data.length} canvas into ${text.length} chars of text took ${Date.now() - start}ms`);

    return text;
}

async function ocrTextFromPdfImages(pdfjsLib, page, strings) {
    const ops = await page.getOperatorList();

    const fns = ops.fnArray;
    const args = ops.argsArray;

    for (const arg of args) {
        const i = args.indexOf(arg);

        if (fns[i] !== pdfjsLib.OPS.paintXObject && fns[i] !== pdfjsLib.OPS.paintImageXObject) {
            continue;
        }

        const imgKey = arg[0];
        const img = await new Promise((res) => page.objs.get(imgKey, r => res(r)));

        if (!img) {
            continue;
        }

        const text = ocrFromByteArray(img);

        if (text) {
            strings.push(text);
        }
    }
}

async function extractTextFromPdf(note, buffer) {
    if (note.mime !== 'application/pdf' || !optionService.getOptionBool('extractTextFromPdf')) {
        return;
    }

    try {
        const pdfjsLib = require("pdfjs-dist");
        const doc = await pdfjsLib.getDocument({data: buffer}).promise;
        let strings = [];

        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);

            const content = await page.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false
            });

            content.items.forEach(({str}) => strings.push(str));

            try {
                if (optionService.getOptionBool('ocrImages') && !cls.isOcrDisabled()) {
                    await ocrTextFromPdfImages(pdfjsLib, page, strings);
                }
            }
            catch (e) {
                log.info(`Could not OCR images from PDF note '${note.noteId}': '${e.message}', stack '${e.stack}'`);
            }
        }

        strings = strings.filter(str => str?.trim());

        note.saveNoteAncillary('plainText', 'text/plain', strings.join(" "));
    }
    catch (e) {
        log.info(`Extracting text from PDF on note '${note.noteId}' failed with error '${e.message}', stack ${e.stack}`);
    }
}

async function ocrTextFromBuffer(buffer) {
    // buffer is expected to contain an image in JPEG, PNG etc.
    const start = Date.now();

    const img = await new Promise((res, rej) => {
        const img = new Canvas.Image();
        img.onload = () => res(img);
        img.onerror = err => rej(new Error("Can't load the image " + err));
        img.src = buffer;
    });

    const canvas = new Canvas.createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const plainText = OCRAD(canvas);

    log.info(`OCR of ${buffer.byteLength} image bytes into ${plainText.length} chars of text took ${Date.now() - start}ms`);
    return plainText;
}

async function runOcr(note, buffer) {
    if (!note.isImage()
        || !optionService.getOptionBool('ocrImages')
        || cls.isOcrDisabled()
        || buffer.length === 0
    ) {
        return;
    }

    try {
        const plainText = await ocrTextFromBuffer(buffer);

        console.log("OCR", plainText);

        note.saveNoteAncillary('plainText', 'text/plain', plainText);
    }
    catch (e) {
        log.error(`OCR on note '${note.noteId}' failed with error '${e.message}', stack ${e.stack}`);
    }
}

module.exports = {
    runOcr,
    extractTextFromPdf
};
