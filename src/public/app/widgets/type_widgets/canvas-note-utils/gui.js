import EraserBrushFactory from './EraserBrush.js';
import EraserBrushPathFactory from './EraserBrushPath.js';

/**
 * add listeners to buttons
 */
export const initButtons = (self) => {
  const canvas = self.$canvas;

  var saveCanvas = $('#save-canvas'),
    refreshCanvas = $('#refresh-canvas'),
    zoom100 = $('#zoom-100'),
    showSVG = $('#show-svg'),
    clearEl = $('#clear-canvas'),
    undo = $('#undo'),
    redo = $('#redo');
  const deletedItems = [];

  undo.on('click', () => {
    // // Source: https://stackoverflow.com/a/28666556
    // var lastItemIndex = canvas.getObjects().length - 1;
    // var item = canvas.item(lastItemIndex);

    // deletedItems.push(item);
    // // if(item.get('type') === 'path') {
    // canvas.remove(item);
    // canvas.renderAll();
    // // }

    canvas.undo(); //fabric-history
  });

  redo.on('click', () => {
    // const lastItem = deletedItems.pop();
    // if (lastItem) {
    //   canvas.add(lastItem);
    //   canvas.renderAll();
    // }

    canvas.redo(); //fabric-history
  });

  clearEl.on('click', () => {
    console.log('cE-oC');
    canvas.clear();
  });

  saveCanvas.on('click', () => {
    console.log('sC-oC');
    const canvasContent = canvas.toJSON();
    console.log('Canvas JSON', canvasContent);
    const payload = {
      width: self.width,
      height: self.height,
      lastScale: self.lastScale,
      canvas: canvasContent,
    };
    localStorage.setItem('infiniteCanvas', JSON.stringify(payload));
  });

  refreshCanvas.on('click', () => {
    console.log('rC-oC');
    const infiniteCanvas = JSON.parse(localStorage.getItem('infiniteCanvas') || "");
    console.log('rcoc, inf', infiniteCanvas);

    canvas.loadFromJSON(infiniteCanvas.canvas, () => {
      self.width = self.scaledWidth = infiniteCanvas.width;
      self.height = self.scaledHeight = infiniteCanvas.height;
      self.lastScale = infiniteCanvas.lastScale;
      canvas.setWidth(infiniteCanvas.width);
      canvas.setHeight(infiniteCanvas.height);
      self.$canvasContainer.width(infiniteCanvas.width).height(infiniteCanvas.height);
      canvas.renderAll();
    });
  });

  zoom100.on('click', () => {
    console.log('zoom100');
    // TODO extract zoom to into separate function (reuse for zoom 100% button)
    // zoom level of canvas
    self.resetZoom();

    canvas.renderAll();
  });

  showSVG.on('click', () => {
    console.log('showSVG');
    const svg = self.$canvas.toSVG();
    const imageSrc = `data:image/svg+xml;utf8,${svg}`;
    // $('#svgImage').html(`<img src="${imageSrc}" height="100" />`);
    $('#svgImage').html(`${svg}`);
  });

  $('#enlarge-left').on('click', () => {
    const enlargeValue = parseInt($('#enlargeValue').val(), 10);
    self.$canvas.transformCanvas('left', enlargeValue);
  });
  $('#enlarge-top').on('click', () => {
    const enlargeValue = parseInt($('#enlargeValue').val(), 10);
    self.$canvas.transformCanvas('top', enlargeValue);
  });
  $('#enlarge-right').on('click', () => {
    const enlargeValue = parseInt($('#enlargeValue').val(), 10);
    self.$canvas.transformCanvas('right', enlargeValue);
  });
  $('#enlarge-bottom').on('click', () => {
    const enlargeValue = parseInt($('#enlargeValue').val(), 10);
    self.$canvas.transformCanvas('bottom', enlargeValue);
  });
  $('#crop-canvas').on('click', () => {
    self.cropCanvas();
  });

  $('#mode-select').on('click', () => {
    self.$canvas.isDrawingMode = false;
    self.drawWithTouch = false;
  });
  $('#mode-drawWithTouch').on('click', () => {
    self.drawWithTouch = true;
  });
};

export const initPens = (self) => {
  const canvas = self.$canvas;
  $('#pen-1').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'black';
    canvas.freeDrawingBrush.width = 2;
    canvas.isDrawingMode = true;
  });
  $('#pen-2').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'red';
    canvas.freeDrawingBrush.width = 2;
    canvas.isDrawingMode = true;
  });
  $('#pen-3').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'green';
    canvas.freeDrawingBrush.width = 2;
    canvas.isDrawingMode = true;
  });
  $('#pen-4').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'blue';
    canvas.freeDrawingBrush.width = 2;
    canvas.isDrawingMode = true;
  });
  $('#marker-1').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'rgba(255, 255, 0, 0.5)';
    canvas.freeDrawingBrush.width = 10;
    canvas.isDrawingMode = true;
  });
  $('#marker-2').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'rgba(241,229,170, 0.5)';
    canvas.freeDrawingBrush.width = 10;
    canvas.isDrawingMode = true;
  });
  $('#marker-3').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'rgba(51,204,0, 0.5)';
    canvas.freeDrawingBrush.width = 10;
    canvas.isDrawingMode = true;
  });
  $('#marker-4').on('click', () => {
    canvas.freeDrawingBrush = new fabric['PencilBrush'](canvas);
    canvas.freeDrawingBrush.color = 'rgba(75,141,242, 0.5)';
    canvas.freeDrawingBrush.width = 10;
    canvas.isDrawingMode = true;
  });
  $('#eraser').on('click', () => {
    const { EraserBrush } = EraserBrushFactory(fabric);
    const eraserBrush = new EraserBrush(canvas);
    eraserBrush.width = 10;
    eraserBrush.color = 'rgb(236,195,195)'; // erser works with opacity!
    canvas.freeDrawingBrush = eraserBrush;
    canvas.isDrawingMode = true;
  });
  $('#eraser-path').on('click', () => {
    const { EraserBrushPath } = EraserBrushPathFactory(fabric);
    const eraserBrush = new EraserBrushPath(canvas);
    eraserBrush.width = 8;
    eraserBrush.color = 'rgba(236,195,220, 20)'; // erser works with opacity!
    canvas.freeDrawingBrush = eraserBrush;
    canvas.isDrawingMode = true;
  });
  $('#text-1').on('click', () => {
    self.activatePlaceTextBox = true;
    canvas.isDrawingMode = false;
  });
};
