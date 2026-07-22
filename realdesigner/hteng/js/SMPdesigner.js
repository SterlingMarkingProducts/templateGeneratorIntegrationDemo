"use strict";
/* text  fit in rect pseudo code:
on text change {
text.text = text with no line breaks;
if (text.get("width") >= rect.get("width") | text.get("height") >= rect.get("height"))
text.fontsize = min (text.get("fontSize")*(rect.get("height")/(text.get("height")+1)),
text.get("fontSize")*(rect.get("width")/(text.get("width")+constant)));
//center in rect
text.set("top",rect.get("top")+(rect.get("height")/2) -(text.get("height")/2));
text.set("left",rect.get("left")+(rect.get("width")/2) -(text.get("width")/2));
canvas.requestRenderAll.bind(canvas)();
}
*/
var oldTemplate = {
	isOld: false
};
var saveToCartFlag = saveToCartFlag || false;
var topRuler;
var leftRuler;
var rulerUnit = "inch";
var grid = 30;
var snapToGrid = true;
var renderingDpi = 96;
var proofDpi = renderingDpi * 2;
var languageCode = languageCode || "en";
var fabric = fabric || null;
var JL = JL || null;
if (fabric === null || JL === null) {
	if (languageCode === "fr") {
		alert("Échec du chargement des fichiers Javascript requis, si vous utilisez un bloqueur de publicité, veuillez ajouter ce site à la liste blanche.");
	} else {
		alert("Failed to load required Javascript files, if you use an ad blocker, please whitelist this site.");
	}
	if (JL != null) {
		JL().fatalException("fabric is missing");
	}
}
fabric.Object.NUM_FRACTION_DIGITS = 10;
var simpleMode = simpleMode || false;
var formData = "";
var qd = {};
var canvases = [];
var pagesToLoad = 1;
var productInfo = "";
if (location.search) {
	location.search.substr(1).split("&").forEach(function(item) {
		var s = item.split("=");
		var k = s[0];
		var v = s[1] && decodeURIComponent(s[1]);
		(qd[k] = qd[k] || []).push(v);
	});
}
// var svgForPdfProduction = null; now in canvas
var showGuides = false;
//var backgroundColour = "#ffffff";
var keepOverlayOpen = window.keepOverlayOpen || false;
var sterlingFieldsToSave = ["lockMovementX", "lockMovementY", "lockRotation", "lockScalingX", "lockScalingY", "lockUniScaling", "sterlingAlign", "id", "sterlingType", "imageKey", "zIndex", "containedText", "fixedImage", "objectName", "template", "form", "prodstroke", "prodfill", "fieldOrder", "fieldId", "formKey", "fixed", "dropdownId", "dropdownFieldId", "QRdata", "radius", "originAngle", "maxAngleSubtended", "letterSpacing", "reverse", ];
var specialObjectNames = ["boundingBox", "dateBox", "dateText", ];
var specialObjectsForeground = ["dateBox", "dateText", ];
var TemplateEditMode = false;
var SterlingDesignerVersion = 1.0;
var designUUID = saveCode;
var templateData = {};
//var textObjects = [];
//var imageObjects = []; //object with imageKey and fabricImage, store imageKey in fabricimage and include in json args to serialize.
//var shapeObjects = [];
//var textContainers = [];
//var nonPrintedObjects = [];
var imageLoadEvents = [];
//var backgroundImageLoaded = true;
var canvasProperties = {
	bandString: '',
	width: 0,
	height: 0,
	topMargin: 0,
	sideMargin: 0,
	topBorder: 2,
	sideBorder: 2,
	daterBoxWidth: 0,
	daterBoxHeight: 0,
	shape: "rect",
	isProstamp: false,
	productNumber: window.productNumber,
	productNumberVariation: window.productNumber,
	backgroundImageSrc: "",
	maxLines: 0,
	materialColour: "white",
	bleedMargin: 0,
	angle: 0,
};
//var productionImageBinary;
var proofImageBinary;
var defaultLineHeight = 0.917;
var i = 0;
var j = 0;
//var textObjects.length = 25;
//var pxfactor = 1; //1.33 - LEAVE THIS IN FOR PROCESSING OLD TEMPLATES!!!! - pxfactor is in template.js
//var pxfontfactor = 1; //1.33
//var textColourDropdown; was theColour, now stored in the dropdown itself
var saveDesignFlag = false;
var toggleSimple = false;
//var newImage;
//var pattern = new Image();
var currentCanvas;
var backgroundCanvas;
var tmpHoldColor;
//var bestFitOverRide = false;
//var maxlines = 8;
var activeLine = null;
var textFillColour = "black";
//var dlnvar = "line ";
//var mfnt1 = 12;
//var mfnt2 = 12;
//var mfnt3 = 12;
//var Colour1; changed to engravedColourSelector
//var canvasBackgroundColourDropdown; was bgengravedColourSelector
//var thePos;
//var logoposition;
window.maxFilesize = 5; //MB
var dropzoneMessage = "<h3>Click here or drag an image to add it to the design</h3> We recommend 300dpi.  PNG files with transparent backgrounds are recommended, JPG, PDF and GIF files are acceptable. Max " + window.maxFilesize + " MB.";
if (languageCode === "fr") {
	dropzoneMessage = "<h3>Cliquez ici ou faites glisser une image pour l'ajouter au dessin</h3> Nous recommandons 300 dpi.  Les fichiers PNG avec des arrière-plans transparents sont recommandés, JPG, PDF et les fichiers GIF sont acceptables. Max " + window.maxFilesize + " MO.";
}
var colourStandards = {
	yellow: {
		name: "yellow",
		cmykColour: "rgb(255,202,69)",
		inkColour: "rgb(255,242,0)",
		dateColour: "rgb(255,242,0)",
	},
	blue: {
		name: "blue",
		cmykColour: "rgb(9,98,171)",
		inkColour: "rgb(31,82,164)",
		dateColour: "rgb(31,82,164)",
	},
	maroon: {
		name: "maroon",
		cmykColour: "rgb(124,44,59)",
		inkColour: "rgb(192,49,26)",
		dateColour: "rgb(192,49,26)",
	},
	orange: {
		name: "orange",
		cmykColour: "rgb(237,96,59)",
		inkColour: "rgb(24,118,51)",
		dateColour: "rgb(24,118,51)",
	},
	green: {
		name: "green",
		cmykColour: "rgb(0,130,78)",
		inkColour: "rgb(75,183,74)",
		dateColour: "rgb(75,183,74)",
	},
	red: {
		name: "red",
		cmykColour: "rgb(188,54,66)",
		inkColour: "rgb(239,56,41)",
		dateColour: "rgb(239,56,41)",
	},
	purple: {
		name: "purple",
		cmykColour: false,
		inkColour: "rgb(173,80,160)",
		dateColour: "rgb(173,80,160)",
	},
	violet: {
		name: "violet",
		cmykColour: false,
		inkColour: "rgb(172,80,160)",
		dateColour: "rgb(172,80,160)",
	},
	silver: {
		name: "silver",
		cmykColour: "rgb(162,166,168)",
		inkColour: false,
		dateColour: false,
	},
	gold: {
		name: "gold",
		cmykColour: "rgb(210,174,109)",
		inkColour: false,
		dateColour: false,
	},
	black: {
		name: "black",
		cmykColour: "rgb(46,43,43)",
		inkColour: "rgb(0,0,0)",
		dateColour: "rgb(0,0,0)",
	},
	white: {
		name: "white",
		cmykColour: "rgb(255,255,255)",
		inkColour: "rgb(234,234,234)",
		dateColour: "rgb(255,255,255)",
	},
	bluered: {
		name: "bluered",
		cmykColour: false,
		inkColour: "rgb(32,82,164)",
		dateColour: "rgb(239,56,41)",
	},
	1: {
		name: "1",
		inkColour: "rgb(186,44,38)",
		backgroundColour: "rgb(255,255,255)",
	},
	2: {
		name: "2",
		inkColour: "rgb(14,95,75)",
		backgroundColour: "rgb(255,255,255)",
	},
	3: {
		name: "3",
		inkColour: "rgb(0,0,0)",
		backgroundColour: "rgb(255,255,255)",
	},
	4: {
		name: "4",
		inkColour: "rgb(17,91,174)",
		backgroundColour: "rgb(255,255,255)",
	},
	5: {
		name: "5",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(186,44,38)",
	},
	6: {
		name: "6",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(0,166,81)",
	},
	7: {
		name: "7",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(241,89,42)",
	},
	8: {
		name: "8",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(28,45,74)",
	},
	9: {
		name: "9",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(0,0,0)",
	},
	10: {
		name: "10",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(139,69,19)",
	},
	11: {
		name: "11",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(0,0,0)",
	},
	12: {
		name: "12",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(136,22,48)",
	},
	13: {
		name: "13",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(17,91,166)",
	},
	14: {
		name: "14",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(88,88,90)",
	},
	15: {
		name: "15",
		inkColour: "rgb(255,255,255)",
		backgroundImage: "hteng/dimages/blackwal_back.png",
	},
	16: {
		name: "16",
		inkColour: "rgb(255,255,255)",
		backgroundImage: "hteng/dimages/Oak.png",
	},
	17: {
		name: "17",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(14,95,72)",
	},
	18: {
		name: "18",
		inkColour: "rgb(255,242,0)",
		backgroundColour: "rgb(186,38,38)",
	},
	19: {
		name: "19",
		inkColour: "rgb(255,242,0)",
		backgroundColour: "rgb(0,0,0)",
	},
	20: {
		name: "20",
		inkColour: "rgb(255,242,0)",
		backgroundColour: "rgb(21,70,131)",
	},
	21: {
		name: "21",
		inkColour: "rgb(0,0,0)",
		backgroundImage: "hteng/dimages/brass_back.png",
	},
	22: {
		name: "22",
		inkColour: "rgb(0,0,0)",
		backgroundImage: "hteng/dimages/alum_back.png",
	},
	23: {
		name: "23",
		inkColour: "rgb(17,91,174)",
		backgroundImage: "hteng/dimages/alum_back.png",
	},
	24: {
		name: "24",
		inkColour: "rgb(0,0,0)",
		backgroundColour: "rgb(255,242,0)",
	},
};
/* 	8: {
		name: "8",
		inkColour: "rgb(255,255,255)",
		backgroundColour: "rgb(21,70,131)"
	},
	*/
fabric.Object.prototype.getZIndex = function() {
	return this.canvas.getObjects().indexOf(this);
};
/* This is a better idea, convert arrays to a function that RETURNS an array, sterlingType = text, nonPrintedObject, image, etc

fabric.Canvas.prototype.textObjects = function () { 
	return this.getObjects("I-text");
}
fabric.Canvas.prototype.imageObjects = function () { 
	return this.getObjects("image");
} */
/* fabric.Image.prototype.getSvgSrc = function () {
	return this.toDataURLforSVG();
};
fabric.Image.prototype.toDataURLforSVG = function (options) {
	var el = fabric.util.createCanvasElement();
	el.width = this._element.naturalWidth;
	el.height = this._element.naturalHeight;
	el.getContext("2d").drawImage(this._element, 0, 0);
	var data = el.toDataURL(options);
	return data;
};*/
/*fabric.Canvas.prototype.undoStack;
fabric.Canvas.prototype.redoStack;*/
fabric.Canvas.prototype.parsingObjects = false;

function fontSizePixToPnt(size) {
	return size * 72 / 96;
}

function fontSizePntToPix(size) {
	return size * 96 / 72;
}

function copyPageToPage(copyFromIndex, copyToIndex) {
	activateModal("copying", true);
	canvases[copyToIndex].loadFromJSON(canvases[copyFromIndex].undoStack[canvases[copyFromIndex].undoStack.length - 1].canvasData, function() {
		parseObjectsFromCanvas(null, canvases[copyToIndex]);
		deactivateModal();
	});
}

function storeState(canvas) {
	if (!canvas.undoStack) {
		canvas.undoStack = [];
	}
	if (canvas.parsingObjects) {
		console.log("ignoring storeState, currently loading a template");
		return;
	}
	console.log("storeState in undo stack");
	wipeRedo(canvas);
	canvas.undoStack.push({
		canvasProperties: JSON.stringify(canvasProperties),
		canvasData: JSON.stringify(canvas.toDatalessJSON(sterlingFieldsToSave)),
	});
}

function undo(canvas) {
	if (!canvas.undoStack) {
		canvas.undoStack = [];
	}
	if (canvas.parsingObjects || simpleMode) {
		return;
	}
	//current state is top of the undo stack, pop it to redo and reload the new top of the stack
	if (canvas.undoStack.length < 2) {
		console.log("no more undos");
		return;
	}
	console.log("UNDO!");
	canvas.redoStack.push(canvas.undoStack.pop());
	var newState = canvas.undoStack[canvas.undoStack.length - 1];
	canvasProperties = JSON.parse(newState.canvasProperties);
	canvas.parsingObjects = true;
	activateModal("undo", true);
	canvas.loadFromJSON(newState.canvasData, function() {
		parseObjectsFromCanvas(null, canvas);
		deactivateModal();
	});
}

function redo(canvas) {
	if (!canvas.undoStack) {
		canvas.undoStack = [];
	}
	if (canvas.parsingObjects || simpleMode) {
		return;
	}
	if (canvas.redoStack.length < 1) {
		console.log("no more redos");
		return;
	}
	console.log("REDO!");
	canvas.undoStack.push(canvas.redoStack.pop());
	var newState = canvas.undoStack[canvas.undoStack.length - 1];
	canvasProperties = JSON.parse(newState.canvasProperties);
	canvas.parsingObjects = true;
	activateModal("redo", true);
	canvas.loadFromJSON(newState.canvasData, function() {
		parseObjectsFromCanvas(null, canvas);
		deactivateModal();
	});
}

function wipeRedo(canvas) {
	if (canvas.parsingObjects) {
		return;
	}
	canvas.redoStack = [];
}

function fixLayers(canvas) {
	if (canvas.getObjects().length === 0) {
		return;
	}
	changeLayer(canvas, canvas.getObjects()[0], "DoNothing");
}

function changeLayer(canvas, object, action) {
	if (object === void 0 || object === null || canvas === void 0 || canvas === null || object.canvas !== canvas) {
		return;
	}
	var minLayer = 0;
	for (var i = 0; i < specialObjectNames.length; i++) {
		if (canvas.nonPrintedObjects[specialObjectNames[i]] !== null && canvas.nonPrintedObjects[specialObjectNames[i]] !== void 0) {
			canvas.nonPrintedObjects[specialObjectNames[i]].sendToBack();
			for (var j = 0; j < minLayer; j++) {
				canvas.nonPrintedObjects[specialObjectNames[i]].bringForward();
			}
			minLayer += 1;
		}
	}
	for (var i = 0; i < canvas.nonPrintedObjects.unnamedObjects.length; i++) {
		if (canvas.nonPrintedObjects.unnamedObjects[i] !== null && canvas.nonPrintedObjects.unnamedObjects[i] !== void 0) {
			canvas.nonPrintedObjects.unnamedObjects[i].sendToBack();
			for (var j = 0; j < minLayer; j++) {
				if (typeof canvas.nonPrintedObjects.unnamedObjects[i].group == "undefined" || canvas.nonPrintedObjects.unnamedObjects[i].group == null) {
					canvas.nonPrintedObjects.unnamedObjects[i].bringForward();
				}
			}
			minLayer += 1;
		}
	}
	switch (action) {
		case "sendToBack":
			canvas.moveTo(object, minLayer);
			break;
		case "bringToFront":
			canvas.bringToFront(object);
			break;
		case "sendBackwards":
			if (object.getZIndex() > minLayer) {
				canvas.sendBackwards(object);
			}
			break;
		case "bringForward":
			canvas.bringForward(object);
			break;
	}
	for (var i = 0; i < specialObjectsForeground.length; i++) {
		if (canvas.nonPrintedObjects[specialObjectsForeground[i]] !== null && canvas.nonPrintedObjects[specialObjectsForeground[i]] !== void 0) {
			canvas.nonPrintedObjects[specialObjectsForeground[i]].bringToFront();
		}
	}
	for (var j = 0; j < canvas.getObjects().length; j++) {
		canvas.getObjects()[j].zIndex = canvas.getObjects()[j].getZIndex();
	}
	storeState(canvas);
	canvas.requestRenderAll.bind(canvas)();
}

function moveObjectToLayer(object, layerNumber) {
	object.canvas.sendToBack(object);
	for (let i = 0; i < layerNumber; i++) {
		object.canvas.bringForward(object);
	}
}

function handleCodePoints(array) {
	var CHUNK_SIZE = 0x8000; // arbitrary number here, not too small, not too big
	var index = 0;
	var length = array.length;
	var result = "";
	var slice;
	while (index < length) {
		slice = array.slice(index, Math.min(index + CHUNK_SIZE, length));
		result += String.fromCharCode.apply(null, slice);
		index += CHUNK_SIZE;
	}
	return result;
}

function setPngDpi(base64ImageData, newDpi) {
	try {
		var pngHeader = "data:image/png;base64,";
		var data = base64ImageData.replace(pngHeader, "");
		var binary_string = window.atob(data);
		var len = binary_string.length;
		var bytes = new Uint8Array(len);
		// pixels per metre
		var ppm = Math.floor((newDpi / 2.54) * 100);
		for (var i = 0; i < len; i++) {
			bytes[i] = binary_string.charCodeAt(i);
		}
		bytes = rewrite_pHYs_chunk(bytes, ppm, ppm);
		// re-encode PNG (btoa method)
		var b64encoded = btoa(handleCodePoints(bytes));
		return pngHeader + b64encoded;
	} catch (err) {
		console.log("Error saving png as " + newDpi + "DPI");
		return base64ImageData;
	}
}

function sortByKey(array, key) {
	return array.sort(function(a, b) {
		var x = a[key];
		var y = b[key];
		return x < y ? -1 : x > y ? 1 : 0;
	});
}

function isEmpty(str) {
	//return Encoder.isEmpty();
	if (typeof str === "undefined" || str === null || str.length === 0 || str === "" || !/[^\s]/.test(str) || /^\s*$/.test(str) || str.replace(/\s/g, "") === "") {
		return true;
	}
	return false;
}

function hex2rgb(hex) {
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	hex = hex.replace(shorthandRegex, function(m, r, g, b) {
		return r + r + g + g + b + b;
	});
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? "rbg(" + parseInt(result[1], 16) + "," + parseInt(result[2], 16) + "," + parseInt(result[3], 16) + ")" : null;
}
var rgb2hex = function(rgb) {
	rgb = Array.apply(null, arguments).join().match(/\d+/g);
	rgb = ((rgb[0] << 16) + (rgb[1] << 8) + +rgb[2]).toString(16);
	while (rgb.length < 6) {
		rgb = "0" + rgb;
	}
	return "#" + rgb;
};

function loadProductInfo(productname) {
	//ToDo: fill in spans with this info.
	$.ajax("getStampInfo.cfm?part=" + productname).done(function(data) {
		if (oldTemplate.isOld) {
			canvasProperties.materialColour = defaultFor(oldTemplate.Colour, "3");
			canvasProperties.drawFullBorder = defaultFor(oldTemplate.Border, false);
			var widthRatio = data.CANVASWIDTH / oldTemplate.width;
			var heightRatio = data.CANVASHEIGHT / oldTemplate.height;
			console.log("old ratio: " + widthRatio + " / " + heightRatio);
			for (var x = 0; x < canvases.length; x++) {
				var objects = canvases[x].textObjects;
				for (var y = 0; y < objects.length; y++) {
					objects[y].set("top", objects[y].get("top") * heightRatio);
					objects[y].set("left", objects[y].get("left") * widthRatio);
					objects[y].set("fontSize", objects[y].get("fontSize") * widthRatio);
					//width and height?
				}
				var objects = canvases[x].imageObjects;
				for (var y = 0; y < objects.length; y++) {
					objects[y].fabricImage.set("top", objects[y].fabricImage.get("top") * heightRatio);
					objects[y].fabricImage.set("left", objects[y].fabricImage.get("left") * widthRatio);
					objects[y].fabricImage.set("scaleX", objects[y].fabricImage.get("scaleX") * heightRatio);
					objects[y].fabricImage.set("scaleY", objects[y].fabricImage.get("scaleY") * heightRatio);
					//width and height?
				}
			}
		}
		var offsetLeft = 0;
		var offsetTop = 0;
		canvasProperties.bleedLeft = canvasProperties.bleedLeft || 0;
		canvasProperties.bleedTop = canvasProperties.bleedTop || 0;
		if (canvasProperties.bleedLeft !== data.BLEEDLEFT) {
			offsetLeft = data.BLEEDLEFT - canvasProperties.bleedLeft;
		}
		if (canvasProperties.bleedTop !== data.BLEEDTOP) {
			offsetTop = data.BLEEDTOP - canvasProperties.bleedTop;
		}
		for (var x = 0; x < canvases.length; x++) {
			var objects = canvases[x].getObjects();
			for (var y = 0; y < objects.length; y++) {
				objects[y].set("top", objects[y].get("top") + offsetTop);
				objects[y].set("left", objects[y].get("left") + offsetLeft);
			}
		}
		productInfo = data;
		if (canvasProperties.angle === 0 || canvasProperties.angle === 180) {
			canvasProperties.height = data.CANVASHEIGHT;
			canvasProperties.width = data.CANVASWIDTH;
		} else {
			canvasProperties.width = data.CANVASHEIGHT;
			canvasProperties.height = data.CANVASWIDTH;
		}
		canvasProperties.isProstamp = data.ISPROSTAMP;
		canvasProperties.greenInkAvailable = data.GREENINKAVAILABLE;
		canvasProperties.topMargin = data.MARGINTOP;
		canvasProperties.sideMargin = data.MARGINLEFT;
		canvasProperties.topBorder = data.BORDERTOP;
		canvasProperties.sideBorder = data.BORDERLEFT;
		canvasProperties.bandString = data.BANDSTRING || "";
		canvasProperties.bandString = canvasProperties.bandString.toString();
		canvasProperties.daterBoxHeight = data.DATERBOXHEIGHT;
		canvasProperties.daterBoxWidth = data.DATERBOXWIDTH;
		canvasProperties.shape = data.SHAPE.toString();
		canvasProperties.maxLines = data.MAXLINES;
		canvasProperties.marginTop = data.MARGINTOP;
		canvasProperties.marginRight = data.MARGINRIGHT;
		canvasProperties.marginBottom = data.MARGINBOTTOM;
		canvasProperties.marginLeft = data.MARGINLEFT;
		canvasProperties.borderTop = data.BORDERTOP;
		canvasProperties.borderRight = data.BORDERRIGHT;
		canvasProperties.borderBottom = data.BORDERBOTTOM;
		canvasProperties.borderLeft = data.BORDERLEFT;
		canvasProperties.bleedTop = data.BLEEDTOP;
		canvasProperties.bleedRight = data.BLEEDRIGHT;
		canvasProperties.bleedBottom = data.BLEEDBOTTOM;
		canvasProperties.bleedLeft = data.BLEEDLEFT;
		canvasProperties.borderWidth = data.BORDERWIDTH;
		canvasProperties.availableColours = [];
		canvasProperties.customerPartNumber = data.PARTNUMBER.toString();
		if (Array.isArray(data.COLOURS) && data.COLOURS.length > 0) {
			for (var c = 0; c < data.COLOURS.length; c++) {
				canvasProperties.availableColours.push(data.COLOURS[c]);
				addColour(data.COLOURS[c]);
			}
		} else {
			// No colours available, like rubber stamps, set it to black and hide the options.
			canvasProperties.availableColours.push({
				BACKRGB: "",
				DATECOLOUR: "rgb(0,0,0)",
				DESCRIPTION: "Black",
				INK: "rgb(0,0,0)",
				NAME: "black",
			});
			addColour(canvasProperties.availableColours[0]);
		}
		if (canvasProperties.availableColours.length == 1 && (designerVariationCode == "Grayscale" || designerVariationCode == "EngravedPlastic" || designerVariationCode == "SingleColour")) {
			if (simpleMode) {
				$("#tabs").tabs("option", "disabled", [2]);
			} else {
				$("#tabs").tabs("option", "disabled", [3]);
			}
		}
		console.log(data);
		var samplePictureDiv = document.getElementById("sampleImageDiv");
		if (samplePictureDiv == null) {
			const productSpecsDiv = document.getElementById("productSpecs");
			samplePictureDiv = document.createElement('div');
			samplePictureDiv.id = 'sampleImageDiv';
			samplePictureDiv.classList.add('sampleImageHolder');
			productSpecsDiv.prepend(samplePictureDiv);
		}
		var sampleImageSrc = data.SAMPLEIMAGEEN || "";
		if (data.SAMPLEIMAGEFR != "" && data.SAMPLEIMAGEFR != undefined && languageCode == "fr") {
			sampleImageSrc = data.SAMPLEIMAGEFR;
		}
		if (sampleImageSrc != "") {
			const img = document.createElement('img');
			img.src = sampleImageSrc;
			samplePictureDiv.innerHTML = img.outerHTML;
		}
		var productPictureDiv = document.getElementById("productImageDiv");
		if (productPictureDiv == null) {
			const productSpecsDiv = document.getElementById("productSpecs");
			productPictureDiv = document.createElement('div');
			productPictureDiv.id = 'productImageDiv';
			productPictureDiv.classList.add('sampleImageHolder');
			productSpecsDiv.prepend(productPictureDiv);
		}
		var sampleImageSrc = data.PRODUCTIMAGEEN || "";
		if (data.PRODUCTIMAGEFR != "" && data.PRODUCTIMAGEFR != undefined && languageCode == "fr") {
			sampleImageSrc = data.PRODUCTIMAGEFR;
		}
		if (sampleImageSrc != "") {
			const img = document.createElement('img');
			img.src = sampleImageSrc;
			productPictureDiv.innerHTML = img.outerHTML;
		}
		document.getElementById("cProd").innerHTML = data.PARTNUMBER + " - " + (languageCode == "fr" && data.DESCRIPTIONFR ? data.DESCRIPTIONFR : data.DESCRIPTION);
		if (data.HEIGHTDISPLAY !== "" && data.WIDTHDISPLAY !== "" && data.DISPLAYUNIT !== "") {
			var unitString = "";
			if (data.DISPLAYUNIT === "mm") {
				unitString = " mm";
			} else {
				unitString = '"';
				if (languageCode === "fr") {
					unitString = " po";
				}
			}
			document.getElementById("cSize").innerHTML = data.HEIGHTDISPLAY + unitString + " x " + data.WIDTHDISPLAY + unitString;
		}
		if (data.MAXLINES > 0 || data.MAXLINES !== "") {
			if (languageCode === "fr") {
				document.getElementById("cMaxlines").innerHTML = data.MAXLINES + " Ligne, ";
			} else {
				document.getElementById("cMaxlines").innerHTML = data.MAXLINES + " Line, ";
			}
		}
		if (data.LOWESTPRICE > 0 || data.LOWESTPRICE !== "") {
			if (languageCode === "fr") {
				document.getElementById("lowestPrice").innerHTML = "à partir de: " + data.LOWESTPRICE;
			} else {
				document.getElementById("lowestPrice").innerHTML = "From: " + data.LOWESTPRICE;
			}
		}
		//deactivateModal();
		canvasApp();
	}).fail(function(jqXHR, textStatus, errorThrown) {
		deactivateModal();
		if (languageCode === "fr") {
			activateModal("Nous sommes désolés, nous n'avons pas pu charger les spécifications du produit sélectionné", true);
		} else {
			activateModal("We're sorry, we were unable to load the selected product specifications", true);
		}
		if (JL != null) {
			JL().fatalException("loadProductInfo Failed and locked up the app: " + productname, errorThrown);
		}
	});
}

function OLDloadTemplate(templateID) {
	//try loading template.json
	$.ajax("hteng/UserFilesTemporary/" + templateID + "/template.json").done(parseTemplate)
		//try loadting template.js
		.fail(function() {
			window.pxfactor = 1;
			window.pxfontfactor = 1;
			$.getScript("hteng/UserFilesTemporary/" + templateID + "/template.js").done(function() {
					parseTemplate({
						version: 0,
					});
				})
				//handle catastrophic failure
				.fail(function(jqXHR, textStatus, errorThrown) {
					deactivateModal();
					if (languageCode === "fr") {
						activateModal("Nous sommes désolés, nous n'avons pas pu charger le modèle de conception sélectionné", true);
					} else {
						activateModal("We're sorry, we were unable to load the selected design template", true);
					}
					if (JL != null) {
						JL().fatalException("loadTemplate Failed and locked up the app: " + templateID, errorThrown);
					}
				});
		});
}

function isPositiveInt(value) {
	return /^\d+$/.test(value);
}

function loadTemplate(templateID) {
	if (isPositiveInt(templateID)) {
		$.ajax("getTemplateJson.cfm?templateid=" + templateID).done(parseTemplate);
	} else {
		$.ajax("getTemplateJson.cfm?templateCode=" + templateID).done(parseTemplate);
	}
}

function loadDesign(templateID) {
	$.ajax("getDesignJson.cfm?designCode=" + templateID).done(parseTemplate);
}

function parseTemplate(templateDataJson) {
	//craft json if retrieving json fails and you need to fallback to v0.
	if (defaultFor(templateDataJson.version, 0) === 0 || defaultFor(templateDataJson, 0) === 0) {
		return parseOriginalTemplate(templateDataJson);
	} else if (templateDataJson.version === SterlingDesignerVersion) {
		return parseCurrentTemplate(templateDataJson);
	} else if (templateDataJson.version >= 1 && templateDataJson.version < 2) {
		return parseV1Template(templateDataJson);
	}
}

function parseCurrentTemplate(templateDataJson) {
	parseV1Template(templateDataJson);
}

function parseV1Template(templateDataJson) {
	//example: templateDataJson = {"canvasProperties:"{},"canvasData":{...canvas.toDatalessJSON stringified...}}
	//templateData = JSON.parse(templateDataJson);
	canvasProperties = templateDataJson.canvasProperties;
	canvasProperties.productNumber = window.productNumber;
	canvasProperties.bleedMargin = canvasProperties.bleedMargin || 0;
	canvasProperties.dpi = canvasProperties.dpi || 72; //assume template is 72 if not specified
	canvasProperties.width = toRenderingDpi(canvasProperties.dpi, canvasProperties.width);
	canvasProperties.height = toRenderingDpi(canvasProperties.dpi, canvasProperties.height);
	canvasProperties.topMargin = toRenderingDpi(canvasProperties.dpi, canvasProperties.topMargin);
	canvasProperties.sideMargin = toRenderingDpi(canvasProperties.dpi, canvasProperties.sideMargin);
	canvasProperties.topBorder = toRenderingDpi(canvasProperties.dpi, canvasProperties.topBorder);
	canvasProperties.sideBorder = toRenderingDpi(canvasProperties.dpi, canvasProperties.sideBorder);
	canvasProperties.daterBoxHeight = toRenderingDpi(canvasProperties.dpi, canvasProperties.daterBoxHeight);
	canvasProperties.daterBoxWidth = toRenderingDpi(canvasProperties.dpi, canvasProperties.daterBoxWidth);
	canvasProperties.bleedMargin = toRenderingDpi(canvasProperties.dpi, canvasProperties.bleedMargin);
	canvasProperties.angle = canvasProperties.angle || 0;
	canvasProperties.bandString = canvasProperties.bandString || '';
	canvasProperties.bandString = canvasProperties.bandString.toString();
	canvasProperties.marginTop = toRenderingDpi(canvasProperties.dpi, canvasProperties.marginTop);
	canvasProperties.marginRight = toRenderingDpi(canvasProperties.dpi, canvasProperties.marginRight);
	canvasProperties.marginBottom = toRenderingDpi(canvasProperties.dpi, canvasProperties.marginBottom);
	canvasProperties.marginLeft = toRenderingDpi(canvasProperties.dpi, canvasProperties.marginLeft);
	canvasProperties.borderTop = toRenderingDpi(canvasProperties.dpi, canvasProperties.borderTop);
	canvasProperties.borderRight = toRenderingDpi(canvasProperties.dpi, canvasProperties.borderRight);
	canvasProperties.borderBottom = toRenderingDpi(canvasProperties.dpi, canvasProperties.borderBottom);
	canvasProperties.borderLeft = toRenderingDpi(canvasProperties.dpi, canvasProperties.borderLeft);
	canvasProperties.bleedTop = toRenderingDpi(canvasProperties.dpi, canvasProperties.bleedTop);
	canvasProperties.bleedRight = toRenderingDpi(canvasProperties.dpi, canvasProperties.bleedRight);
	canvasProperties.bleedBottom = toRenderingDpi(canvasProperties.dpi, canvasProperties.bleedBottom);
	canvasProperties.bleedLeft = toRenderingDpi(canvasProperties.dpi, canvasProperties.bleedLeft);
	canvasProperties.borderWidth = toRenderingDpi(canvasProperties.dpi, canvasProperties.borderWidth);
	currentCanvas.clear();
	canvases.push(currentCanvas);
	/*  var correctedJson = templateDataJson.canvasData.replace(/http:/gi, "https:");
	  correctedJson = correctedJson.replace(/newdb.sterling.ca/gi, "www.sterling.ca");*/
	//Fix for images with wrong url, better fix would be to store only the relative path to the images. ...Or Would IT?
	//check for multiple pages
	if (typeof templateDataJson.pages === "undefined") {
		canvases[canvases.length - 1].imageObjects = [];
		canvases[canvases.length - 1].textObjects = [];
		canvases[canvases.length - 1].curvedTextObjects = [];
		canvases[canvases.length - 1].nonPrintedObjects = {
			unnamedObjects: [],
		};
		canvases[canvases.length - 1].textContainers = [];
		if (typeof templateDataJson.canvasData.objects !== "undefined" && templateDataJson.canvasData.objects !== null && typeof templateDataJson.canvasData.objects.length !== "undefined" && templateDataJson.canvasData.objects.length !== null) {
			for (var i = 0; i < templateDataJson.canvasData.objects.length; i++) {
				templateDataJson.canvasData.objects[i].left = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].left);
				templateDataJson.canvasData.objects[i].top = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].top);
				if (typeof templateDataJson.canvasData.objects[i].fontSize !== "undefined" && templateDataJson.canvasData.objects[i].fontSize !== null) {
					templateDataJson.canvasData.objects[i].fontSize = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].fontSize);
				}
				if (typeof templateDataJson.canvasData.objects[i].strokeWidth !== "undefined" && templateDataJson.canvasData.objects[i].strokeWidth !== null) {
					templateDataJson.canvasData.objects[i].strokeWidth = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].strokeWidth, false);
				}
				if (typeof templateDataJson.canvasData.objects[i].cropX !== "undefined" && templateDataJson.canvasData.objects[i].cropX !== null) {
					templateDataJson.canvasData.objects[i].cropX = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].cropX);
				}
				if (typeof templateDataJson.canvasData.objects[i].cropY !== "undefined" && templateDataJson.canvasData.objects[i].cropY !== null) {
					templateDataJson.canvasData.objects[i].cropY = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].cropY);
				}
				if (typeof templateDataJson.canvasData.objects[i].text !== "undefined" && templateDataJson.canvasData.objects[i].text !== null) {
					templateDataJson.canvasData.objects[i].text = templateDataJson.canvasData.objects[i].text.toString();
				}
				if (typeof templateDataJson.canvasData.objects[i].src !== "undefined" && templateDataJson.canvasData.objects[i].src !== null && templateDataJson.canvasData.objects[i].src.substring(0, 1) !== "/" && templateDataJson.canvasData.objects[i].src.substring(0, 4).toLowerCase() === "http") {
					if (typeof templateDataJson.canvasData.objects[i].scaleX !== "undefined" && templateDataJson.canvasData.objects[i].scaleX !== null) {
						templateDataJson.canvasData.objects[i].scaleX = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].scaleX, false);
					}
					if (typeof templateDataJson.canvasData.objects[i].scaleY !== "undefined" && templateDataJson.canvasData.objects[i].scaleY !== null) {
						templateDataJson.canvasData.objects[i].scaleY = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].scaleY, false);
					}
					templateDataJson.canvasData.objects[i].src = templateDataJson.canvasData.objects[i].src.replace(/http:/gi, "https:").replace(/(^\w+:|^)\/\//, "");
					templateDataJson.canvasData.objects[i].src = "https://" + window.location.hostname + templateDataJson.canvasData.objects[i].src.slice(templateDataJson.canvasData.objects[i].src.indexOf("/") - templateDataJson.canvasData.objects[i].src.length);
				} else {
					templateDataJson.canvasData.objects[i].width = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].width);
					templateDataJson.canvasData.objects[i].height = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].height);
				}
				if (templateDataJson.canvasData.objects[i].sterlingType === "fixedTextObjectParent" && typeof templateDataJson.canvasData.objects[i].containedText === "object") {
					templateDataJson.canvasData.objects[i].containedText.left = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.left);
					templateDataJson.canvasData.objects[i].containedText.top = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.top);
					if (typeof templateDataJson.canvasData.objects[i].containedText.fontSize !== "undefined" && templateDataJson.canvasData.objects[i].containedText.fontSize !== null) {
						templateDataJson.canvasData.objects[i].containedText.fontSize = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.fontSize);
					}
					if (typeof templateDataJson.canvasData.objects[i].containedText.strokeWidth !== "undefined" && templateDataJson.canvasData.objects[i].containedText.strokeWidth !== null) {
						templateDataJson.canvasData.objects[i].containedText.strokeWidth = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.strokeWidth, false);
					}
					if (typeof templateDataJson.canvasData.objects[i].containedText.cropX !== "undefined" && templateDataJson.canvasData.objects[i].containedText.cropX !== null) {
						templateDataJson.canvasData.objects[i].containedText.cropX = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.cropX);
					}
					if (typeof templateDataJson.canvasData.objects[i].containedText.cropY !== "undefined" && templateDataJson.canvasData.objects[i].containedText.cropY !== null) {
						templateDataJson.canvasData.objects[i].containedText.cropY = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.cropY);
					}
					if (typeof templateDataJson.canvasData.objects[i].containedText.text !== "undefined" && templateDataJson.canvasData.objects[i].containedText.text !== null) {
						templateDataJson.canvasData.objects[i].containedText.text = templateDataJson.canvasData.objects[i].containedText.text.toString();
					}
					templateDataJson.canvasData.objects[i].containedText.width = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.width);
					templateDataJson.canvasData.objects[i].containedText.height = toRenderingDpi(canvasProperties.dpi, templateDataJson.canvasData.objects[i].containedText.height);
				}
			}
		}
		canvasProperties.dpi = renderingDpi;
		currentCanvas.parsingObjects = true;
		currentCanvas.loadFromJSON(templateDataJson.canvasData,
			(function() {
				return function() {
					parseObjectsFromCanvas(0);
				};
			})());
	} else if (Array.isArray(templateDataJson.pages)) {
		//pages exist!
		//TODO: fix this.
		pagesToLoad = templateDataJson.pages.length;
		for (var i = 0; i < templateDataJson.pages.length; i++) {
			if (i === 0) {
				canvases[0].imageObjects = [];
				canvases[0].textObjects = [];
				canvases[0].curvedTextObjects = [];
				canvases[0].nonPrintedObjects = {
					unnamedObjects: [],
				};
				canvases[0].textContainers = [];
			}
			var canvasData = templateDataJson.pages[i].canvasData;
			if (typeof canvasData.objects !== "undefined" && canvasData.objects !== null && typeof canvasData.objects.length !== "undefined" && canvasData.objects.length !== null) {
				for (var j = 0; j < canvasData.objects.length; j++) {
					if (typeof canvasData.objects[j].src !== "undefined" && canvasData.objects[j].src !== null && canvasData.objects[j].src.substring(0, 1) !== "/" && canvasData.objects[j].src.substring(0, 4).toLowerCase() === "http") {
						canvasData.objects[j].src = canvasData.objects[j].src.replace(/http:/gi, "https:").replace(/(^\w+:|^)\/\//, "");
						canvasData.objects[j].src = "https://" + window.location.hostname + canvasData.objects[j].src.slice(canvasData.objects[j].src.indexOf("/") - canvasData.objects[j].src.length);
					}
				}
			}
			if (i > 0) {
				//there's always one page.
				currentCanvas = addPage(); //sets latest canvas to 'canvas'
			}
			currentCanvas.parsingObjects = true;
			currentCanvas.loadFromJSON(canvasData,
				(function() {
					var index = i;
					return function() {
						parseObjectsFromCanvas(index);
					};
				})());
		}
	}
}

function recurseGroup(objects, canvas) {
	if (!Array.isArray(objects) || objects.length == 0) {
		return;
	}
	objects.forEach((el) => {
		if (el.type === "group") {
			recurseGroup(el.getObjects(), canvas);
		}
		el.group.remove(el);
		canvas.remove(el);
	});
}

function parseObjectsFromCanvas(index, canvas) {
	if ((canvas === null || canvas === undefined) && parseInt(index) > -1) {
		canvas = canvases[index];
	}
	canvas.parsingObjects = true;
	canvas.imageObjects = [];
	canvas.textObjects = [];
	canvas.shapeObjects = [];
	canvas.curvedTextObjects = [];
	canvas.nonPrintedObjects = {
		unnamedObjects: [],
	};
	canvas.textContainers = [];
	canvasProperties.angle = defaultFor(canvasProperties.angle, 0);
	//imageObjects = canvas.imageObjects;
	//textObjects = canvas.textObjects;
	//nonPrintedObjects = canvas.nonPrintedObjects;
	//textContainers = canvas.textContainers;
	if (designerVariationCode === "EngravedPlastic") {
		canvasProperties.materialColour = defaultFor(canvasProperties.materialColour, "3");
	} else {
		canvasProperties.materialColour = defaultFor(canvasProperties.materialColour, "white");
	}
	var objects = canvas.getObjects();
	//textObjects = canvas.getObjects("text"); // "i-text" not "text"
	var objectIndexesToDelete = [];
	for (var i = 0; i < objects.length; i++) {
		var currentObject = objects[i];
		if (currentObject.containedText !== void 0 && currentObject.containedText.text !== void 0 && typeof currentObject.containedText.text !== "string") {
			currentObject.containedText.text = currentObject.containedText.text.toString();
		}
	}
	for (var i = 0; i < objects.length; i++) {
		var currentObject = objects[i];
		currentObject.zIndex = currentObject.getZIndex(); //TODO: confirm this works, might have to check for undefined then do this
		if (
			(currentObject.type === "text" || currentObject.type === "i-text") && (currentObject.underline === false || currentObject.underline === "" || currentObject.underline === "N")) {
			currentObject.underline = false;
		} else if (currentObject.type === "text" || currentObject.type === "i-text") {
			currentObject.underline = true;
		}
		if (currentObject.type === "group" && currentObject.sterlingType === "nonPrintedObject") {
			canvas.nonPrintedObjects.unnamedObjects.push(currentObject);
			//recurseGroup(currentObject.getObjects(), canvas); only mark group as nonprinted, then delete group and objects before draw production files.
		} else if (
			(currentObject.type === "text" || currentObject.type === "i-text") && currentObject.sterlingType !== "fixedTextObjectSlave") {
			if (currentObject.sterlingType === "nonPrintedObject") {
				objectIndexesToDelete.push(i);
				//canvas.remove(currentObject);
				//canvas.nonPrintedObjects.push(currentObject);
			} else {
				canvas.textObjects.push(currentObject);
				currentObject.set("objectCaching", false);
			}
		} else if (currentObject.type === "image") {
			if (currentObject.sterlingType === "nonPrintedObject") {
				canvas.nonPrintedObjects.unnamedObjects.push(currentObject);
			} else {
				canvas.imageObjects.push({
					imageKey: currentObject.imageKey,
					imageOptions: {
						top: currentObject.get("top"),
						left: currentObject.get("left"),
						height: currentObject.get("height") / currentObject.get("scaleY"),
						width: currentObject.get("width") / currentObject.get("scaleX"),
						fixedImage: currentObject.fixedImage || false,
					},
					fabricImage: currentObject,
				});
				/* var imageArrayIndex = canvas.imageObjects.push({
					imageKey: currentObject.imageKey,
					imageOptions: {
						top: currentObject.get("top"),
						left: currentObject.get("left"),
						height: currentObject.get("height") / currentObject.get("scaleY"),
						width: currentObject.get("width") / currentObject.get("scaleX"),
						fixedImage: currentObject.fixedImage || false
					},
					fabricImage: currentObject
				}) - 1; */
				if (currentObject.fixedImage) {
					currentObject.hasControls = false;
					currentObject.lockMovementX = true;
					currentObject.lockMovementY = true;
				}
			}
		} else if (currentObject.type === "circle") {
			if (currentObject.sterlingType === "nonPrintedObject") {
				objectIndexesToDelete.push(i);
				//canvas.remove(currentObject);
				//canvas.nonPrintedObjects.push(currentObject);
			}
		} else if (currentObject.type === "curvedText") {
			currentObject.set("objectCaching", false);
			if (currentObject.sterlingType === "nonPrintedObject") {
				objectIndexesToDelete.push(i);
			} else {
				canvas.curvedTextObjects.push(currentObject);
			}
		} else if (currentObject.type === "rect") {
			if (currentObject.sterlingType === "nonPrintedObject") {
				objectIndexesToDelete.push(i);
				//canvas.remove(currentObject);
				//canvas.nonPrintedObjects.push(currentObject);
			} else if (currentObject.sterlingType === "fixedTextObjectParent") {
				canvas.textContainers.push(currentObject);
				var containedTextFound = false;
				for (var j = 0; j < objects.length; j++) {
					if (objects[j].sterlingType === "fixedTextObjectSlave" && !objects[j].textContainer && Number(currentObject.containedText.top) === Number(objects[j].top) && Number(currentObject.containedText.left) === Number(objects[j].left) && currentObject.containedText.text === objects[j].text) {
						currentObject.containedText = objects[j];
						objects[j].textContainer = currentObject;
						currentObject.set("objectCaching", false);
						containedTextFound = true;
					}
				}
				if (containedTextFound === false) {
					currentObject.containedText.text = currentObject.containedText.text.toString();
					var newObj = new fabric.Text(currentObject.containedText.text, currentObject.containedText);
					currentObject.containedText = newObj;
					canvas.add(newObj);
					newObj.textContainer = currentObject;
				}
			} else {
				canvas.shapeObjects.push(currentObject);
			}
			//else imageObjects.push(currentObject);
		}
	}
	for (var i = objectIndexesToDelete.length - 1; i >= 0; i--) {
		canvas.remove(objects[objectIndexesToDelete[i]]);
	}
	canvas.parsingObjects = false;
	pagesToLoad -= 1;
	if (pagesToLoad === 0) {
		loadProductInfo(canvasProperties.productNumber);
		//canvasApp();
	}
}

function toRenderingDpi(originalDPI, value, round) {
	if (round !== true && round !== false) {
		round = true;
	}
	if (originalDPI === renderingDpi) {
		if (round === true) {
			return Math.round(value);
		} else {
			return value;
		}
	} else {
		if (round === true) {
			return Math.round(value * (renderingDpi / originalDPI));
		} else {
			return value * (renderingDpi / originalDPI);
		}
	}
}

function fix72dpi(value, round = false) {
	return toRenderingDpi(72, value, round);
}
/*  old definition
function parseOriginalTemplate() {
  //dpi = 72; changed to convert to 96
  //var templateComplete = true;
  var shape = defaultFor(window.isCircle, "N");
  switch (shape.toLowerCase()) {
    case "rect":
    case "n":
    case "false":
      shape = "rect";
      break;
    case "circle":
    case "y":
    case "true":
      shape = "circle";
      break;
    default:
      shape = "rect";
  }
  templateData = {};
  templateData.text = [];
  templateData.images = [];
  templateData.canvasProperties = {};
  templateData.canvasProperties.width = fix72dpi(defaultFor(window.cwidth, -1));
  templateData.canvasProperties.height = fix72dpi(
    defaultFor(window.cheight, -1)
  );
  templateData.canvasProperties.bleedMargin = fix72dpi(
    defaultFor(window.bleedMargin, 0)
  );
  templateData.canvasProperties.topMargin = fix72dpi(
    defaultFor(window.ctopMargin, -1)
  );
  templateData.canvasProperties.sideMargin = fix72dpi(
    defaultFor(window.csideMargin, -1)
  );
  templateData.canvasProperties.topBorder = fix72dpi(
    defaultFor(window.ctopBorder, -1)
  );
  templateData.canvasProperties.sideBorder = fix72dpi(
    defaultFor(window.csideBorder, -1)
  );
  templateData.canvasProperties.daterBoxHeight = fix72dpi(
    defaultFor(window.dateh, 0)
  );
  templateData.canvasProperties.daterBoxWidth = fix72dpi(
    defaultFor(window.datew, 0)
  );
  templateData.canvasProperties.angle = defaultFor(window.angle, 0);
  templateData.canvasProperties.shape = shape;
  templateData.canvasProperties.maxLines = window.maxlines;
  templateData.canvasProperties.drawFullBorder =
    defaultFor(window.borderFC, "N") === "N" ? false : true;
  templateData.canvasProperties.greenInkAvailable =
    defaultFor(window.IncGC, "N") === "N" ? false : true;
  templateData.canvasProperties.isProstamp =
    defaultFor(window.isProstamp, "N") === "N" ? false : true;
  templateData.canvasProperties.productNumber = window.productNumber; //defaultFor(window.cproduct, "");
  templateData.canvasProperties.productNumberVariation = window.productNumber;
  var i = 1;
  //Text lines
  while (typeof window["message" + i] !== "undefined") {
    //old templates stored 25 of each variable
    if (!isEmpty(window["message" + i])) {
      templateData.text[templateData.text.length] = {
        //fix 1 indexed to 0 indexed
        text: Encoder.htmlDecode(window["message" + i]),
        fontFamily: window["fontFace" + i] || "Arial",
        fontSize: fix72dpi(window["fontSize" + i] || 15),
        fontWeight: window["fontWeight" + i] || "normal",
        fontStyle: window["fontStyle" + i] || "normal",
        left: fix72dpi(defaultFor(window["x" + i], 0)),
        top: fix72dpi(defaultFor(window["y" + i], 0)),
        textDecoration: window["fontUnderline" + i] || "",
        fill: window["colour" + i] || window.textFillColor || "rgb(0,0,0)",
        backgroundColor: window["BColour" + i] || "",
        sterlingAlign: window["textAn" + i] || "",
      };
    }
    //un-mess-up the global scope
    delete window["message" + i];
    delete window["fontFace" + i];
    delete window["fontSize" + i];
    delete window["fontWeight" + i];
    delete window["fontStyle" + i];
    delete window["x" + i];
    delete window["y" + i];
    delete window["fontUnderline" + i];
    delete window["colour" + i];
    delete window["BColour" + i];
    delete window["textAn" + i];
    i++;
  }
  //Images
  i = 1;
  while (typeof window["logo" + i] !== "undefined") {
    //old templates stored 25 of each variable
    if (!isEmpty(window["logo" + i])) {
      templateData.images[templateData.images.length] = {
        //fix 1 indexed to 0 indexed
        imageKey: Encoder.htmlDecode(window["logo" + i]),
        x: fix72dpi(window["logo" + i + "_x"] || -51),
        y: fix72dpi(window["logo" + i + "_y"] || -51),
        height: fix72dpi(window["logo" + i + "_height"] || 30),
        width: fix72dpi(window["logo" + i + "_width"] || 30),
      };
    }
    //un-mess-up the global scope
    delete window["logo" + i + "_x"];
    delete window["logo" + i + "_y"];
    delete window["logo" + i + "_height"];
    delete window["logo" + i + "_width"];
    delete window["logo" + i];
    i++;
  }
  delete window.pxfactor;
  delete window.pxfontfactor;
  delete window.textFillColor;
  delete window.BColour;
  delete window.cproduct;
  delete window.isProstamp;
  delete window.isCircle;
  delete window.cwidth;
  delete window.cheight;
  delete window.ctopMargin;
  delete window.csideMargin;
  delete window.dateh;
  delete window.datew;
  delete window.borderFC;
  delete window.IncGC;
  delete window.maxLines;
  currentCanvas.imageObjects = [];
  currentCanvas.textObjects = [];
  currentCanvas.curvedTextObjects = [];
  currentCanvas.nonPrintedObjects = {
    unnamedObjects: [],
  };
  currentCanvas.textContainers = [];
  //create text objects from data and attach to canvas -> don't attach, might be redundant?
  templateData.canvasProperties.dpi = renderingDpi; //save with 96 dpi indicated on json.
  canvasProperties = templateData.canvasProperties;
  for (i = 0; i < templateData.text.length; i++) {
    //set lines
    currentCanvas.textObjects[i] = new fabric.IText(
      Encoder.htmlDecode(templateData.text[i].text) || ""
    );
    currentCanvas.textObjects[i].set("lineHeight", defaultLineHeight);
    currentCanvas.textObjects[i].set(
      "fontFamily",
      Encoder.htmlDecode(templateData.text[i].fontFamily)
    );
    currentCanvas.textObjects[i].set("fontSize", templateData.text[i].fontSize);
    currentCanvas.textObjects[i].set(
      "fontWeight",
      templateData.text[i].fontWeight
    );
    currentCanvas.textObjects[i].set(
      "fontStyle",
      templateData.text[i].fontStyle
    );
    currentCanvas.textObjects[i].set("left", templateData.text[i].left);
    currentCanvas.textObjects[i].set("top", templateData.text[i].top);
    currentCanvas.textObjects[i].set(
      "underline",
      templateData.text[i].textDecoration === "underline"
    );
    currentCanvas.textObjects[i].set(
      "fill",
      getColourByInkColour(templateData.text[i].fill).inkColour
    );
    currentCanvas.textObjects[i].set(
      "backgroundColor",
      hex2rgb(templateData.text[i].backgroundColor)
    );
    currentCanvas.textObjects[i].sterlingAlign =
      templateData.text[i].sterlingAlign;
    selectFontName(currentCanvas.textObjects[i].get("fontFamily"));
  }
  for (i = 0; i < templateData.images.length; i++) {
    //set lines
    imageFromImageKey(
      currentCanvas,
      null,
      templateData.images[i].imageKey,
      {
        left: templateData.images[i].x,
        top: templateData.images[i].y,
        height: templateData.images[i].height,
        width: templateData.images[i].width,
        scaleX: fix72dpi(1),
        scaleY: fix72dpi(1),
        pageNumber: 1,
      },
      i === templateData.images.length - 1
    );
  }
  canvases.push(currentCanvas);
  loadProductInfo(canvasProperties.productNumber);
  //canvasApp();
} */
function parseOriginalTemplate(templateJson) {
	//dpi = 72; changed to convert to 96
	//var templateComplete = true;
	oldTemplate.isOld = true;
	var shape = defaultFor(templateJson.isCircle, "N");
	switch (shape.toLowerCase()) {
		case "rect":
		case "n":
		case "false":
			shape = "rect";
			break;
		case "circle":
		case "y":
		case "true":
			shape = "circle";
			break;
		default:
			shape = "rect";
	}
	oldTemplate.Colour = templateJson.Colour1;
	oldTemplate.Border = templateJson.Border == "Y";
	templateData = {};
	templateData.text = [];
	templateData.images = [];
	templateData.canvasProperties = {};
	templateData.canvasProperties.width = fix72dpi(defaultFor(templateJson.cwidth, -1));
	oldTemplate.width = templateData.canvasProperties.width;
	oldTemplate.orgWidth = templateJson.cwidth;
	templateData.canvasProperties.height = fix72dpi(defaultFor(templateJson.cheight, -1));
	oldTemplate.height = templateData.canvasProperties.height;
	oldTemplate.orgHeight = templateJson.cheight;
	templateData.canvasProperties.bleedMargin = fix72dpi(defaultFor(templateJson.bleedMargin, 0));
	templateData.canvasProperties.topMargin = fix72dpi(defaultFor(templateJson.ctopMargin, -1));
	templateData.canvasProperties.sideMargin = fix72dpi(defaultFor(templateJson.csideMargin, -1));
	templateData.canvasProperties.topBorder = fix72dpi(defaultFor(templateJson.ctopBorder, -1));
	templateData.canvasProperties.sideBorder = fix72dpi(defaultFor(templateJson.csideBorder, -1));
	templateData.canvasProperties.daterBoxHeight = fix72dpi(defaultFor(templateJson.dateh, 0));
	templateData.canvasProperties.daterBoxWidth = fix72dpi(defaultFor(templateJson.datew, 0));
	templateData.canvasProperties.angle = defaultFor(templateJson.angle, 0);
	templateData.canvasProperties.shape = shape;
	templateData.canvasProperties.maxLines = templateJson.maxlines;
	templateData.canvasProperties.drawFullBorder = defaultFor(templateJson.borderFC, "N") === "N" ? false : true;
	templateData.canvasProperties.greenInkAvailable = defaultFor(templateJson.IncGC, "N") === "N" ? false : true;
	templateData.canvasProperties.isProstamp = defaultFor(templateJson.isProstamp, "N") === "N" ? false : true;
	templateData.canvasProperties.productNumber = window.productNumber; //defaultFor(templateJson.cproduct, "");
	templateData.canvasProperties.productNumberVariation = templateData.canvasProperties.productNumber;
	templateData.canvasProperties.bandString = '';
	var i = 1;
	//Text lines
	while (typeof templateJson["message" + i] !== "undefined") {
		//old templates stored 25 of each variable
		if (!isEmpty(templateJson["message" + i])) {
			templateData.text[templateData.text.length] = {
				//fix 1 indexed to 0 indexed
				text: Encoder.htmlDecode(templateJson["message" + i]),
				fontFamily: templateJson["fontFace" + i] || "Arial",
				fontSize: fix72dpi(templateJson["fontSize" + i] || 15),
				fontWeight: templateJson["fontWeight" + i] || "normal",
				fontStyle: templateJson["fontStyle" + i] || "normal",
				left: fix72dpi(defaultFor(templateJson["x" + i], 0)),
				top: fix72dpi(defaultFor(templateJson["y" + i], 0)),
				textDecoration: templateJson["fontUnderline" + i] || "",
				fill: templateJson["colour" + i] || templateJson.textFillColor || "rgb(0,0,0)",
				backgroundColor: templateJson["BColour" + i] || "",
				sterlingAlign: templateJson["textAn" + i] || "",
			};
		}
		i++;
	}
	//Images
	i = 1;
	while (typeof templateJson["logo" + i] !== "undefined") {
		//old templates stored 25 of each variable
		if (!isEmpty(templateJson["logo" + i])) {
			templateData.images[templateData.images.length] = {
				//fix 1 indexed to 0 indexed
				imageKey: Encoder.htmlDecode(templateJson["logo" + i]),
				x: fix72dpi(templateJson["logo" + i + "_x"] || -51),
				y: fix72dpi(templateJson["logo" + i + "_y"] || -51),
				height: fix72dpi(templateJson["logo" + i + "_height"] || 30),
				width: fix72dpi(templateJson["logo" + i + "_width"] || 30),
			};
		}
		i++;
	}
	currentCanvas.imageObjects = [];
	currentCanvas.textObjects = [];
	currentCanvas.curvedTextObjects = [];
	currentCanvas.nonPrintedObjects = {
		unnamedObjects: [],
	};
	currentCanvas.textContainers = [];
	//create text objects from data and attach to canvas -> don't attach, might be redundant?
	templateData.canvasProperties.dpi = renderingDpi; //save with 96 dpi indicated on json.
	canvasProperties = templateData.canvasProperties;
	for (i = 0; i < templateData.text.length; i++) {
		//set lines
		currentCanvas.textObjects[i] = new fabric.IText(Encoder.htmlDecode(templateData.text[i].text) || "");
		currentCanvas.textObjects[i].set("lineHeight", defaultLineHeight);
		currentCanvas.textObjects[i].set("fontFamily", Encoder.htmlDecode(templateData.text[i].fontFamily));
		currentCanvas.textObjects[i].set("fontSize", templateData.text[i].fontSize);
		currentCanvas.textObjects[i].set("fontWeight", templateData.text[i].fontWeight);
		currentCanvas.textObjects[i].set("fontStyle", templateData.text[i].fontStyle);
		currentCanvas.textObjects[i].set("left", templateData.text[i].left);
		currentCanvas.textObjects[i].set("top", templateData.text[i].top);
		currentCanvas.textObjects[i].set("underline", templateData.text[i].textDecoration === "underline");
		currentCanvas.textObjects[i].set("fill", getColourByInkColour(templateData.text[i].fill).inkColour);
		currentCanvas.textObjects[i].set("backgroundColor", hex2rgb(templateData.text[i].backgroundColor));
		currentCanvas.textObjects[i].sterlingAlign = templateData.text[i].sterlingAlign;
		selectFontName(currentCanvas.textObjects[i].get("fontFamily"));
	}
	for (i = 0; i < templateData.images.length; i++) {
		//set lines  canvas, existingObject, urlKey, pageNumber, imageOptions, redraw, callback, showModal, closeModal
		imageFromImageKey(currentCanvas, null, templateData.images[i].imageKey, 1, {
			left: templateData.images[i].x,
			top: templateData.images[i].y,
			height: templateData.images[i].height,
			width: templateData.images[i].width,
			scaleX: fix72dpi(1),
			scaleY: fix72dpi(1),
			pageNumber: 1,
		}, i === templateData.images.length - 1);
	}
	canvases.push(currentCanvas);
	loadProductInfo(canvasProperties.productNumber);
	//canvasApp();
}

function clipCanvasToPath(canvas, pathString, production) {
	realClipCanvasToPath(canvas, pathString, production);
	if (backgroundCanvas && !window._productionExport) {
		realClipCanvasToPath(backgroundCanvas, pathString, production);
	}
	//TODO: add error handler here if backgroundCanvas is not defined.
}

function realClipCanvasToPath(canvas, pathString, production) {
	if (pathString === "" || typeof pathString !== "string" || pathString === null) {
		return null;
	}
	canvas.clipToPathString = pathString;
	production = typeof production === "boolean" ? production : false;
	var cropColour = "lightgray";
	if (production === true) {
		cropColour = "white";
	}
	var path = new fabric.Path(pathString);
	if (!path.width || !path.height) {
		console.error("Invalid clip path: zero dimensions for path", pathString);
		return null;
	}
	var strokeWidth = 0;
	if (canvasProperties.angle === 90) {
		path.set({
			top: 0,
			left: canvas.getWidth() / canvas.getZoom(),
			scaleX: canvas.getHeight() / canvas.getZoom() / (path.width + strokeWidth),
			scaleY: canvas.getWidth() / canvas.getZoom() / (path.height + strokeWidth),
			angle: canvasProperties.angle,
			//height: (canvas.getWidth()/canvas.getZoom()),
			//width: (canvas.getHeight()/canvas.getZoom()),
		});
	} else if (canvasProperties.angle === 180) {
		path.set({
			top: canvas.getHeight() / canvas.getZoom(),
			left: canvas.getWidth() / canvas.getZoom(),
			scaleY: canvas.getHeight() / canvas.getZoom() / (path.height + strokeWidth),
			scaleX: canvas.getWidth() / canvas.getZoom() / (path.width + strokeWidth),
			angle: canvasProperties.angle,
			//height: (canvas.getHeight()/canvas.getZoom()),
			//width: (canvas.getWidth()/canvas.getZoom()),
		});
	} else if (canvasProperties.angle === 270) {
		path.set({
			top: canvas.getHeight() / canvas.getZoom(),
			left: 0,
			scaleX: canvas.getHeight() / canvas.getZoom() / (path.width + strokeWidth),
			scaleY: canvas.getWidth() / canvas.getZoom() / (path.height + strokeWidth),
			angle: canvasProperties.angle,
			//height: (canvas.getWidth()/canvas.getZoom()),
			//width: (canvas.getHeight()/canvas.getZoom()),
		});
	} else {
		path.set({
			top: 0,
			left: 0,
			scaleX: canvas.getWidth() / canvas.getZoom() / (path.width + strokeWidth),
			scaleY: canvas.getHeight() / canvas.getZoom() / (path.height + strokeWidth),
			//angle: canvasProperties.angle,
			//height: (canvas.getHeight()/canvas.getZoom()),
			//width: (canvas.getWidth()/canvas.getZoom()),
		});
	}
	//path.rotate(canvasProperties.angle);
	/*		path.set({
				objectCaching:false,
				fill:'white',
				stroke:'black',
				strokeWidth:strokeWidth,
				backgroundColor:cropColour,
				fillRule: 'nonzero'
			});*/
	canvas.clipPath = path;
	canvas.requestRenderAll.bind(canvas)();
}
/*function clipCanvasToPathold(canvas, pathString, production) {
	if (pathString === "" || typeof pathString !== "string" || pathString === null) {
		return null;
	}
	canvas.clipToPathString = pathString;
	production = (typeof production === "boolean") ? production : false;
	var cropColour = 'lightgray';
	if (production === true) {
		cropColour = 'white';
	}
	var path = new fabric.Path(pathString);
	canvas.clipTo = function(ctx) {
		var strokeWidth = 0;
		if (canvasProperties.angle === 90) {
			path.set({
				top: 0,
				left: ctx.canvas.width,
				scaleX: ctx.canvas.height / (path.width + strokeWidth),
				scaleY: ctx.canvas.width / (path.height + strokeWidth),
				angle: canvasProperties.angle,
				//height: canvas.width,
				//width: canvas.height,
			});
		} else if (canvasProperties.angle === 180) {
			path.set({
				top: ctx.canvas.height,
				left: ctx.canvas.width,
				scaleY: ctx.canvas.height / (path.height + strokeWidth),
				scaleX: ctx.canvas.width / (path.width + strokeWidth),
				angle: canvasProperties.angle,
				//height: canvas.height,
				//width: canvas.width,
			});
		} else if (canvasProperties.angle === 270) {
			path.set({
				top: ctx.canvas.height,
				left: 0,
				scaleX: ctx.canvas.height / (path.width + strokeWidth),
				scaleY: ctx.canvas.width / (path.height + strokeWidth),
				angle: canvasProperties.angle,
				//height: canvas.width,
				//width: canvas.height,
			});
		} else {
			path.set({
				top: 0,
				left: 0,
				scaleX: ctx.canvas.width / (path.width + strokeWidth),
				scaleY: ctx.canvas.height / (path.height + strokeWidth),
				angle: canvasProperties.angle,
				//height: canvas.height,
				//width: canvas.width,
			});
		}
		//path.rotate(canvasProperties.angle);
		path.set({
			objectCaching: false,
			fill: 'white',
			stroke: 'black',
			strokeWidth: strokeWidth,
			backgroundColor: cropColour,
			fillRule: 'nonzero'
		});
		path.render(ctx);
	};
	canvas.requestRenderAll.bind(canvas)();
}*/
function imageFromImageKey(canvas, existingObject, urlKey, pageNumber, imageOptions, redraw, callback, showModal, closeModal) {
	showModal = defaultFor(showModal, true);
	closeModal = defaultFor(closeModal, true);
	var imgObj = null;
	if (imageLoadEvents.length === 0 && showModal === true && !saveDialogOpen) {
		activateModal("Please wait while loading images", true);
	}
	//find existing image and replace fabricImage with correct colour, add new if not found.
	var imageSuffix = "gray";
	if (designerVariationCode === "FullColour") {
		imageSuffix = "scale";
	} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		switch (textFillColour) {
			case "red":
				imageSuffix = "red";
				break;
			case "green":
				imageSuffix = "green";
				break;
			case "blue":
			case "bluered":
				imageSuffix = "blue";
				break;
			case "purple":
			case "violet":
				imageSuffix = "violet";
				break;
		}
	}
	var hasBleed = false;
	if (canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedBottom > 0 || canvasProperties.bleedRight > 0) {
		hasBleed = true;
	}
	var mode = "FC";
	if (canvasProperties.designerVariationCode === "SingleColour" || canvasProperties.designerVariationCode === "EngravedPlastic") {
		mode = "BW";
	}
	if (canvasProperties.designerVariationCode === "Grayscale") {
		mode = "GS";
	}
	var imageUrl = "getImage.cfm?key=" + urlKey + "&ver=" + imageSuffix + "&page=" + pageNumber + "&bleed=" + hasBleed + "&mode=" + mode;
	var imageAlreadyExists = false;
	for (var i = 0; i < canvas.imageObjects.length; i++) {
		//fix imageOptions if incorrect.
		if (typeof canvas.imageObjects[i] !== "undefined" && typeof canvas.imageObjects[i].fabricImage !== "undefined") {
			canvas.imageObjects[i].imageOptions.top = canvas.imageObjects[i].fabricImage.get("top");
			canvas.imageObjects[i].imageOptions.left = canvas.imageObjects[i].fabricImage.get("left");
			canvas.imageObjects[i].imageOptions.height = canvas.imageObjects[i].fabricImage.get("height") * canvas.imageObjects[i].fabricImage.get("scaleY"); //was divide, now multiply
			canvas.imageObjects[i].imageOptions.width = canvas.imageObjects[i].fabricImage.get("width") * canvas.imageObjects[i].fabricImage.get("scaleX"); //was divide, now multiply
		}
	}
	for (i = 0; i < canvas.imageObjects.length; i++) {
		if (!imageAlreadyExists) {
			if (canvas.imageObjects[i].fabricImage === existingObject) {
				//if (canvas.imageObjects[i].imageKey === urlKey) {
				imageLoadEvents[i] = false;
				console.log("image " + urlKey + " found " + Date.now());
				imageAlreadyExists = true;
				canvas.imageObjects[i].fabricImage.setSrc(imageUrl,
					(function(canvas, i, imageOptions, urlKey) {
						var canvas = canvas;
						var index = i;
						var imageOptions = imageOptions;
						var urlKey = urlKey;
						return function(oImg) {
							console.log("image " + urlKey + " loaded " + Date.now());
							oImg.set("top", imageOptions.top);
							oImg.set("left", imageOptions.left);
							//Set img object to full size of the image, then use scalex/y to set on screen size
							var imgElement = oImg.getElement();
							var elWidth = imgElement.naturalWidth || imgElement.width;
							var elHeight = imgElement.naturalHeight || imgElement.height;
							var scaleX = imageOptions.width / elWidth;
							var scaleY = imageOptions.height / elHeight;
							if (imageOptions.maxheight && imageOptions.maxwidth) {
								scaleX = imageOptions.maxwidth / elWidth;
								scaleY = imageOptions.maxheight / elHeight;
								//set image to max area that fits in original image box.
								//set both height and width to scalex or scaley to maintain ratio
								if (scaleX * elHeight <= imageOptions.maxheight && scaleX * elWidth <= imageOptions.maxwidth) {
									scaleY = scaleX;
								} else {
									scaleX = scaleY;
								}
								if (imageOptions.fixedImage) {
									oImg.set({
										hasControls: false,
										lockMovementX: true,
										lockMovementY: true,
									});
								}
								oImg.set({
									top: imageOptions.orgtop + (imageOptions.maxheight / 2 - (elHeight * scaleX) / 2),
									left: imageOptions.orgleft + (imageOptions.maxwidth / 2 - (elWidth * scaleX) / 2),
								});
							}
							//oImg.set("height",imageData.height);
							//oImg.set("width",imageData.width);
							oImg.set({
								width: elWidth,
								height: elHeight,
								scaleX: scaleX,
								scaleY: scaleY,
								flipX: false,
								flipY: false,
								lockRotation: false,
								lockUniScaling: true,
								imageKey: urlKey,
								fill: colourStandards[textFillColour].inkColour,
							});
							if (imageOptions.centerImage == true) {
								imageOptions.centerImage = false;
								centerCanvasObject(canvas, oImg);
							}
							imageLoadEvents[index] = true;
							if (imageLoadEvents.every(function(x) {
									return x === true;
								})) {
								canvas.requestRenderAll.bind(canvas)();
								if (closeModal === true) {
									deactivateModal();
								}
								imageLoadEvents = [];
								console.log("All images loaded " + Date.now());
								if (redraw) {
									console.log("callback IS a function and redraw called " + Date.now());
									drawScreenAsync(function() {
										canvas.setActiveObject(oImg);
										if (typeof callback === "function") {
											callback();
										}
									}, canvas);
								} else {
									console.log("callback IS a function and redraw false " + Date.now());
									canvas.setActiveObject(oImg);
									if (typeof callback === "function") {
										callback();
									}
								}
							}
						};
					})(canvas, i, imageOptions, urlKey), {
						crossOrigin: "anonymous",
					});
				break; //break;  //switched from break to continue to update imageOptions with current top left height width
			}
		}
	}
	if (!imageAlreadyExists) {
		console.log("image " + urlKey + " added " + Date.now());
		canvas.imageObjects[canvas.imageObjects.length] = {
			imageKey: urlKey,
			imageOptions: imageOptions,
			imageUrl: imageUrl,
		};
		imageLoadEvents[i] = false;
		fabric.Image.fromURL(canvas.imageObjects[canvas.imageObjects.length - 1].imageUrl,
			(function() {
				return function(oImg) {
					console.log("image " + urlKey + " loaded " + Date.now());
					var imageIndex = canvas.imageObjects.length - 1;
					var imageKey = urlKey;
					oImg.set(imageOptions);
					oImg.set("top", imageOptions.top);
					oImg.set("left", imageOptions.left);
					//Set img object to full size of the image, then use scalex/y to set on screen size
					var imgElement = oImg.getElement();
					var elWidth = imgElement.naturalWidth || imgElement.width;
					var elHeight = imgElement.naturalHeight || imgElement.height;
					var scaleX = imageOptions.width / elWidth;
					var scaleY = imageOptions.height / elHeight;
					//oImg.set("height",imageOptions.height);
					//oImg.set("width",imageOptions.width); //sets width of onscreen element
					scaleX = Math.min(scaleX, scaleY);
					scaleY = scaleX;
					oImg.set({
						width: elWidth,
						height: elHeight,
						scaleX: scaleX,
						scaleY: scaleY,
						flipX: false,
						flipY: false,
						lockRotation: false,
						lockUniScaling: true,
						fill: colourStandards[textFillColour].inkColour,
						imageKey: imageKey,
					});
					if (imageOptions.centerImage == true) {
						imageOptions.centerImage = false;
						centerCanvasObject(canvas, oImg);
					}
					canvas.imageObjects[imageIndex].fabricImage = oImg;
					imageLoadEvents[imageIndex] = true;
					if (imageLoadEvents.every(function(x) {
							return x === true;
						})) {
						canvas.requestRenderAll.bind(canvas)();
						if (closeModal === true) {
							deactivateModal();
						}
						imageLoadEvents = [];
						console.log("All images loaded " + Date.now());
						if (redraw) {
							console.log("callback IS a function and redraw called " + Date.now());
							drawScreenAsync(function() {
								canvas.setActiveObject(oImg);
								if (typeof callback === "function") {
									callback();
								}
							}, canvas);
						} else {
							console.log("callback IS a function and redraw false " + Date.now());
							canvas.setActiveObject(oImg);
							if (typeof callback === "function") {
								callback();
							}
						}
					}
				};
			})(), {
				crossOrigin: "anonymous",
			});
	}
}
//SVGS
function svgFromImageKey(canvas, existingObject, urlKey, pageNumber, imageOptions, redraw, callback) {
	return imageFromImageKey(canvas, existingObject, urlKey, pageNumber, imageOptions, redraw, callback);
	//find existing image and replace fabricImage with correct colour, add new if not found.
	var imageSuffix = "grey";
	if (designerVariationCode === "FullColour") {
		imageSuffix = "scale";
	} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		switch (textFillColour) {
			case "red":
				imageSuffix = "red";
				break;
			case "green":
				imageSuffix = "green";
				break;
			case "blue":
			case "bluered":
				imageSuffix = "blue";
				break;
			case "purple":
			case "violet":
				imageSuffix = "violet";
				break;
		}
	}
	var hasBleed = false;
	if (canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedBottom > 0 || canvasProperties.bleedRight > 0) {
		hasBleed = true;
	}
	var imageUrl = "getImage.cfm?key=" + urlKey + "&ver=" + imageSuffix + "&page=" + pageNumber + "&bleed=" + hasBleed;
	var imageAlreadyExists = false;
	for (i = 0; i < canvas.imageObjects.length; i++) {
		if (!imageAlreadyExists) {
			if (canvas.imageObjects[i].fabricImage === existingObject) {
				//if (canvas.imageObjects[i].imageKey === urlKey) {
				imageLoadEvents[i] = false;
				console.log("image " + urlKey + " found " + Date.now());
				imageAlreadyExists = true;
				canvas.imageObjects[i].fabricImage.setSrc(imageUrl,
					(function(canvas, i, imageOptions, urlKey) {
						var canvas = canvas;
						var index = i;
						var imageOptions = imageOptions;
						var urlKey = urlKey;
						return function(oImg) {
							console.log("image " + urlKey + " loaded " + Date.now());
							oImg.set("top", imageOptions.top);
							oImg.set("left", imageOptions.left);
							//Set img object to full size of the image, then use scalex/y to set on screen size
							var imgElement = oImg.getElement();
							var elWidth = imgElement.naturalWidth || imgElement.width;
							var elHeight = imgElement.naturalHeight || imgElement.height;
							var scaleX = imageOptions.width / elWidth;
							var scaleY = imageOptions.height / elHeight;
							if (imageOptions.maxheight && imageOptions.maxwidth) {
								scaleX = imageOptions.maxwidth / elWidth;
								scaleY = imageOptions.maxheight / elHeight;
								//set image to max area that fits in original image box.
								//set both height and width to scalex or scaley to maintain ratio
								if (scaleX * elHeight <= imageOptions.maxheight && scaleX * elWidth <= imageOptions.maxwidth) {
									scaleY = scaleX;
								} else {
									scaleX = scaleY;
								}
								if (imageOptions.fixedImage) {
									oImg.set({
										hasControls: false,
										lockMovementX: true,
										lockMovementY: true,
									});
								}
								oImg.set({
									top: imageOptions.orgtop + (imageOptions.maxheight / 2 - (elHeight * scaleX) / 2),
									left: imageOptions.orgleft + (imageOptions.maxwidth / 2 - (elWidth * scaleX) / 2),
								});
							}
							//oImg.set("height",imageData.height);
							//oImg.set("width",imageData.width);
							oImg.set({
								width: elWidth,
								height: elHeight,
								scaleX: scaleX,
								scaleY: scaleY,
								flipX: false,
								flipY: false,
								lockRotation: false,
								lockUniScaling: true,
								imageKey: urlKey,
								fill: colourStandards[textFillColour].inkColour,
							});
							if (imageOptions.centerImage == true) {
								imageOptions.centerImage = false;
								centerCanvasObject(canvas, oImg);
							}
							imageLoadEvents[index] = true;
							if (imageLoadEvents.every(function(x) {
									return x === true;
								})) {
								imageLoadEvents = [];
								console.log("All images loaded " + Date.now());
								if (redraw) {
									console.log("callback IS a function and redraw called " + Date.now());
									drawScreenAsync(function() {
										canvas.setActiveObject(oImg);
										if (typeof callback === "function") {
											callback();
										}
									}, canvas);
								} else {
									console.log("callback IS a function and redraw false " + Date.now());
									canvas.setActiveObject(oImg);
									if (typeof callback === "function") {
										callback();
									}
								}
							}
						};
					})(canvas, i, imageOptions, urlKey), {
						crossOrigin: "anonymous",
					});
				break; //break;  //switched from break to continue to update imageOptions with current top left height width
			}
		}
	}
	if (!imageAlreadyExists) {
		console.log("image " + urlKey + " added " + Date.now());
		canvas.imageObjects[canvas.imageObjects.length] = {
			imageKey: urlKey,
			imageOptions: imageOptions,
			imageUrl: imageUrl,
		};
		imageLoadEvents[i] = false;
		fabric.loadSVGFromURL(canvas.imageObjects[canvas.imageObjects.length - 1].imageUrl, function(objects, options) {
			var oImg = fabric.util.groupSVGElementsAsGroup(objects, options, canvas.imageObjects[canvas.imageObjects.length - 1].imageUrl);
			console.log("image " + urlKey + " loaded " + Date.now());
			var imageIndex = canvas.imageObjects.length - 1;
			var imageKey = urlKey;
			var elWidth = oImg.width;
			var elHeight = oImg.height;
			var scaleX = imageOptions.width / elWidth;
			var scaleY = imageOptions.height / elHeight;
			oImg.set({
				top: imageOptions.top,
				left: imageOptions.left,
				width: elWidth,
				height: elHeight,
				scaleX: scaleX,
				scaleY: scaleY,
				flipX: false,
				flipY: false,
				lockRotation: false,
				lockUniScaling: true,
				fill: colourStandards[textFillColour].inkColour,
				imageKey: imageKey,
			});
			canvas.add(oImg);
			if (imageOptions.centerImage == true) {
				imageOptions.centerImage = false;
				centerCanvasObject(canvas, oImg);
			}
			canvas.imageObjects[imageIndex].fabricImage = oImg;
			imageLoadEvents[imageIndex] = true;
			if (imageLoadEvents.every(function(x) {
					return x === true;
				})) {
				imageLoadEvents = [];
				console.log("All images loaded " + Date.now());
				if (redraw) {
					console.log("callback IS a function and redraw called " + Date.now());
					drawScreenAsync(function() {
						canvas.setActiveObject(oImg);
						if (typeof callback === "function") {
							callback();
						}
					}, canvas);
				} else {
					console.log("callback IS a function and redraw false " + Date.now());
					canvas.setActiveObject(oImg);
					if (typeof callback === "function") {
						callback();
					}
				}
			}
		});
	}
}

function addTextLine(canvas, textIn) {
	canvas.parsingObjects = true;
	if (canvas == void 0 || canvas == null) {
		return;
	}
	canvas.discardActiveObject();
	//$("#textSize")[0].selectedIndex = 0;
	var checkFontSizePix = fontSizePntToPix(Number($("#textSize").val()));
	if (isNaN(checkFontSizePix) || checkFontSizePix === "" || checkFontSizePix <= 0) {
		checkFontSizePix = +fontSizePntToPix($("#font-size option:first").val());
	}
	if (checkFontSizePix > +fontSizePntToPix($("#font-size option:last").val())) {
		checkFontSizePix = +fontSizePntToPix($("#font-size option:last").val());
	}
	$("#textSize").val(fontSizePixToPnt(checkFontSizePix));
	if (languageCode === "fr") {
		textIn = defaultFor(textIn, "Texte ici");
	} else {
		textIn = defaultFor(textIn, "Enter Text");
	}
	var insertAt = canvas.textObjects.length;
	canvas.textObjects[insertAt] = new fabric.IText(textIn);
	canvas.textObjects[insertAt].sterlingType = "textObject";
	if (designerVariationCode === "FullColour") {
		canvas.textObjects[insertAt].set("fill", $("#customTextColour").val());
		//textObjects[insertAt].set("fill",colourStandards[$("#textColourDropdown").val()].cmykColour);
	} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		canvas.textObjects[insertAt].set("fill", colourStandards[$("input[name=textFillColour]:checked").val()].inkColour);
	} else if (designerVariationCode === "EngravedPlastic") {
		canvas.textObjects[insertAt].set("fill", colourStandards[$("input[name=engravedColourSelector]:checked").val()].inkColour);
	}
	canvas.textObjects[insertAt].set("lineHeight", defaultLineHeight);
	canvas.textObjects[insertAt].set("fontFamily", $("#fontDropDown").val() || $("#fontDropDown option:first").val());
	canvas.textObjects[insertAt].set("fontSize", checkFontSizePix);
	canvas.textObjects[insertAt].set("charSpacing", +$("#charSpacing").val() || 0);
	//textObjects[insertAt].set("fontWeight",$("#textSize").val());
	//textObjects[insertAt].set("fontStyle",);
	canvas.textObjects[insertAt].set("underline", false);
	//textObjects[insertAt].set("fill",$("#textFillColour").val()); //call colourChanged instead
	canvas.textObjects[insertAt].set("backgroundColor", "");
	canvas.textObjects[insertAt].set("objectCaching", false);
	canvas.textObjects[insertAt].sterlingAlign = "center";
	canvas.textObjects[insertAt].zIndex = -1;
	canvas.add(canvas.textObjects[insertAt]);
	canvas.parsingObjects = false;
	canvas.textObjects[insertAt].zIndex = canvas.textObjects[insertAt].getZIndex();
	var availableWidth = canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight);
	checkFontSizePix = Math.floor(checkFontSizePix);
	do {
		if (canvas.textObjects[insertAt].get("width") * canvas.textObjects[insertAt].get("scaleX") <= availableWidth) {
			break;
		}
		checkFontSizePix--;
		if (checkFontSizePix <= +fontSizePntToPix($("#font-size option:first").val())) {
			checkFontSizePix = +fontSizePntToPix($("#font-size option:first").val());
		}
		canvas.textObjects[insertAt].set({
			fontSize: checkFontSizePix,
		});
		canvas.textObjects[insertAt].setCoords();
		canvas.textObjects[insertAt].initDimensions();
		if (checkFontSizePix <= +fontSizePntToPix($("#font-size option:first").val())) {
			break;
		}
	} while (true);
	centerCanvasObject(canvas, canvas.textObjects[insertAt], true);
	canvas.setActiveObject(canvas.textObjects[insertAt]);
	/*	 setActiveObject triggers onObjectSelected

	onObjectSelected({
			target: canvas.textObjects[insertAt]
		});*/
	canvas.textObjects[insertAt].selectAll();
	canvas.textObjects[insertAt].enterEditing();
	//colourChanged(false); //moved colour selection to before textobject is added to canvas.
}

function addCurvedText(canvas, textIn, options) {
	if (textIn == "") {
		return;
	}
	options || (options = {});
	options.radius || (options.radius = Math.min(canvasProperties.height / 2, canvasProperties.width / 2));
	canvas.discardActiveObject();
	//$("#textSize")[0].selectedIndex = 0;
	var checkFontSizePix = fontSizePntToPix(Number($("#textSize-curve").val()));
	if (isNaN(checkFontSizePix) || checkFontSizePix === "" || checkFontSizePix <= 0) {
		checkFontSizePix = +fontSizePntToPix($("#font-size-curve option:first").val());
	}
	if (checkFontSizePix > +fontSizePntToPix($("#font-size-curve option:last").val())) {
		checkFontSizePix = +fontSizePntToPix($("#font-size-curve option:last").val());
	}
	$("#textSize-curve").val(fontSizePixToPnt(checkFontSizePix));
	if (languageCode === "fr") {
		textIn = defaultFor(textIn, "Entrez votre texte ici").trim();
	} else {
		textIn = defaultFor(textIn, "Enter your text here").trim();
	}
	/*  if (textIn === "") {
	    textIn = "Enter your text here";
	  }*/
	var insertAt = canvas.curvedTextObjects.length;
	options.objectCaching = false;
	canvas.curvedTextObjects[insertAt] = new fabric.CurvedText(textIn, options);
	canvas.curvedTextObjects[insertAt].sterlingType = "curvedTextObject";
	if (designerVariationCode === "FullColour") {
		canvas.curvedTextObjects[insertAt].set("fill", $("#customTextColour").val());
		//curvedTextObjects[insertAt].set("fill",colourStandards[$("#textColourDropdown").val()].cmykColour);
	} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		canvas.curvedTextObjects[insertAt].set("fill", colourStandards[$("input[name=textFillColour]:checked").val()].inkColour);
	} else if (designerVariationCode === "EngravedPlastic") {
		canvas.curvedTextObjects[insertAt].set("fill", colourStandards[$("input[name=engravedColourSelector]:checked").val()].inkColour);
	}
	//canvas.curvedTextObjects[insertAt].set("lineHeight", defaultLineHeight);
	canvas.curvedTextObjects[insertAt].set("fontFamily", $("#fontDropDown-curve").val() || $("#fontDropDown-curve option:first").val());
	canvas.curvedTextObjects[insertAt].set("textAlign", "center");
	canvas.curvedTextObjects[insertAt].set("fontSize", checkFontSizePix);
	canvas.curvedTextObjects[insertAt].set("spacing", +$("#charSpacing-curve").val() || 0);
	//curvedTextObjects[insertAt].set("fontWeight",$("#textSize-curve").val());
	//curvedTextObjects[insertAt].set("fontStyle",);
	//canvas.curvedTextObjects[insertAt].set("underline", false);
	//curvedTextObjects[insertAt].set("fill",$("#textFillColour").val()); //call colourChanged instead
	canvas.curvedTextObjects[insertAt].set("backgroundColor", "");
	canvas.curvedTextObjects[insertAt].set({
		lockRotation: false,
		lockScalingY: false,
		lockScalingY: false,
		lockScalingX: false,
		lockUniScaling: true,
		hasRotatingPoint: true,
		hasControls: true,
	});
	canvas.curvedTextObjects[insertAt].sterlingAlign = "center";
	canvas.curvedTextObjects[insertAt].zIndex = -1;
	canvas.add(canvas.curvedTextObjects[insertAt]);
	canvas.curvedTextObjects[insertAt].zIndex = canvas.curvedTextObjects[insertAt].getZIndex();
	var availableWidth = canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight * 2);
	checkFontSizePix = Math.floor(checkFontSizePix);
	do {
		if (canvas.curvedTextObjects[insertAt].get("width") * canvas.curvedTextObjects[insertAt].get("scaleX") <= availableWidth) {
			break;
		}
		checkFontSizePix--;
		if (checkFontSizePix <= +fontSizePntToPix($("#font-size-curve option:first").val())) {
			checkFontSizePix = +fontSizePntToPix($("#font-size-curve option:first").val());
		}
		canvas.curvedTextObjects[insertAt].set({
			fontSize: checkFontSizePix,
		});
		canvas.curvedTextObjects[insertAt].setCoords();
		canvas.curvedTextObjects[insertAt].initDimensions();
		if (checkFontSizePix <= +fontSizePntToPix($("#font-size-curve option:first").val())) {
			break;
		}
	} while (true);
	centerCanvasObject(canvas, canvas.curvedTextObjects[insertAt]);
	canvas.setActiveObject(canvas.curvedTextObjects[insertAt]);
}

function toggleFixedImage() {
	var possibleImage = currentCanvas.getActiveObject();
	if (!TemplateEditMode) {
		toggleTemplateEditMode();
	}
	if (possibleImage !== null && possibleImage.isType("image")) {
		var imageObject = possibleImage.canvas.imageObjects[getImageKeyIndex(possibleImage.canvas, possibleImage.imageKey)];
		if (typeof imageObject !== "undefined" && imageObject !== null) {
			if (imageObject.fabricImage.fixedImage) {
				console.log("deactivating fixed Image");
				imageObject.fabricImage.fixedImage = false;
				imageObject.imageOptions.fixedImage = false;
				imageObject.fabricImage.set({
					hasControls: true,
					lockMovementX: false,
					lockMovementY: false,
				});
			} else {
				console.log("activating fixed Image");
				imageObject.fabricImage.fixedImage = true;
				imageObject.imageOptions.fixedImage = true;
				imageObject.imageOptions.orgtop = imageObject.fabricImage.get("top");
				imageObject.imageOptions.orgleft = imageObject.fabricImage.get("left");
				imageObject.imageOptions.maxheight = imageObject.fabricImage.get("height") * imageObject.fabricImage.get("scaleY");
				imageObject.imageOptions.maxwidth = imageObject.fabricImage.get("width") * imageObject.fabricImage.get("scaleX");
			}
		}
	}
}

function getImageKeyIndex(canvas, imageKey) {
	for (var x = 0; x < canvas.imageObjects.length; x++) {
		if (canvas.imageObjects[x].imageKey === imageKey) {
			return x;
		}
	}
	return -1;
}

function addTextContainer(canvas, textIn) {
	if (!TemplateEditMode) {
		toggleTemplateEditMode();
	}
	textIn = defaultFor(textIn, "Text");
	var insertAt = canvas.textContainers.length;
	canvas.textContainers[insertAt] = new fabric.Rect({
		width: 100,
		height: 50,
		stroke: "red",
		strokeWidth: 0.1,
		fill: "",
	});
	//strokeDashArray: [5, 5],
	canvas.textContainers[insertAt].sterlingType = "fixedTextObjectParent";
	canvas.textContainers[insertAt].containedText = new fabric.IText(textIn, {
		lockMovementX: true,
		lockMovementY: true,
		lockRotation: true,
		lockScalingX: true,
		lockScalingY: true,
		lockUniScaling: true,
		hasControls: false,
		fontSize: 999,
	});
	canvas.textContainers[insertAt].containedText.sterlingType = "fixedTextObjectSlave";
	canvas.textContainers[insertAt].containedText.textContainer = canvas.textContainers[insertAt];
	if (designerVariationCode === "FullColour") {
		canvas.textContainers[insertAt].containedText.set("fill", $("#customTextColour").val());
		//textContainers[insertAt].containedText.set("fill",colourStandards[$("#textColourDropdown").val()].cmykColour);
	} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		canvas.textContainers[insertAt].containedText.set("fill", colourStandards[$("input[name=textFillColour]:checked").val()].inkColour);
	} else if (designerVariationCode === "EngravedPlastic") {
		canvas.textContainers[insertAt].containedText.set("fill", colourStandards[$("input[name=engravedColourSelector]:checked").val()].inkColour);
	}
	canvas.textContainers[insertAt].containedText.set("lineHeight", defaultLineHeight);
	canvas.textContainers[insertAt].containedText.set("fontFamily", $("#fontDropDown").val());
	canvas.textContainers[insertAt].containedText.set("fontSize", fontSizePntToPix($("#textSize").val()));
	canvas.textContainers[insertAt].containedText.set("charSpacing", $("#charSpacing").val());
	//textContainers[insertAt].containedText.set("fontWeight",$("#textSize").val());
	//textContainers[insertAt].containedText.set("fontStyle",);
	canvas.textContainers[insertAt].containedText.set("underline", false);
	//textContainers[insertAt].containedText.set("fill",$("#textFillColour").val()); //call colourChanged instead
	canvas.textContainers[insertAt].containedText.set("backgroundColor", "");
	canvas.textContainers[insertAt].containedText.sterlingAlign = "center";
	canvas.textContainers[insertAt].zIndex = -1;
	canvas.add(canvas.textContainers[insertAt]);
	canvas.textContainers[insertAt].zIndex = canvas.textContainers[insertAt].getZIndex();
	centerCanvasObject(canvas, canvas.textContainers[insertAt]);
	canvas.textContainers[insertAt].containedText.zIndex = -1;
	canvas.add(canvas.textContainers[insertAt].containedText);
	canvas.textContainers[insertAt].containedText.zIndex = canvas.textContainers[insertAt].containedText.getZIndex();
	centerCanvasObject(canvas, canvas.textContainers[insertAt].containedText);
	canvas.setActiveObject(canvas.textContainers[insertAt].containedText);
	/*	 setActiveObject triggers onObjectSelected
	onObjectSelected({
			target: canvas.textContainers[insertAt].containedText
		});*/
	//colourChanged(false); //moved colour selection to before textobject is added to canvas.
	itextChanged({
		target: canvas.textContainers[insertAt].containedText,
	});
}

function deleteObject(canvas) {
	var deleteThisObject = canvas.getActiveObject();
	if (deleteThisObject === null || typeof deleteThisObject === "undefined") {
		return;
	}
	if (deleteThisObject === activeLine) {
		activeLine = null;
	}
	if (!TemplateEditMode && (deleteThisObject.sterlingType === "fixedTextObjectSlave" || deleteThisObject.sterlingType === "fixedTextObjectParent")) {
		return;
	}
	var index = -1;
	for (var i = 0; i < canvas.imageObjects.length; i++) {
		if (canvas.imageObjects[i].fabricImage === deleteThisObject) {
			index = i;
			break;
		}
	}
	if (index > -1) {
		canvas.imageObjects.splice(index, 1);
	}
	for (var i = 0; i < canvas.textContainers.length; i++) {
		if (canvas.textContainers[i].containedText === deleteThisObject) {
			index = i;
			canvas.remove(canvas.textContainers[i]);
			break;
		} else if (canvas.textContainers[i] === deleteThisObject) {
			index = i;
			canvas.remove(canvas.textContainers[i].containedText);
			break;
		}
	}
	if (index > -1) {
		canvas.textContainers.splice(index, 1);
	}
	index = canvas.textObjects.indexOf(deleteThisObject);
	if (index > -1) {
		canvas.textObjects.splice(index, 1);
	}
	index = canvas.curvedTextObjects.indexOf(deleteThisObject);
	if (index > -1) {
		canvas.curvedTextObjects.splice(index, 1);
	}
	index = canvas.nonPrintedObjects.unnamedObjects.indexOf(deleteThisObject);
	if (index > -1) {
		canvas.nonPrintedObjects.unnamedObjects.splice(index, 1);
	}
	canvas.remove(deleteThisObject);
}

function getColourByCMYK(cmykcolour) {
	cmykcolour = cmykcolour.toLowerCase();
	if (cmykcolour === "#000000" || cmykcolour === "#000" || cmykcolour === "rgb(0,0,0)") {
		return colourStandards.black;
	}
	if (cmykcolour === "#ffffff" || cmykcolour === "#fff" || cmykcolour === "rgb(255,255,255)") {
		return colourStandards.white;
	}
	if (cmykcolour.substring(0, 1) === "#") {
		cmykcolour = hex2rgb(cmykcolour);
	}
	if (cmykcolour.substring(0, 4) === "rgb(") {
		//colour in file is #xxxxxx or rgb(x,x,x)
		cmykcolour = cmykcolour.replace(/\s+/g, "");
		for (var colour in colourStandards) {
			if ((designerVariationCode === "EngravedPlastic" && +colour !== +colour) || (designerVariationCode !== "EngravedPlastic" && +colour === +colour)) {
				continue;
			}
			if (colourStandards[colour].cmykColour && colourStandards[colour].cmykColour === cmykcolour) {
				return colourStandards[colour];
			}
		}
	} else {
		// colour in file is a colour word
		for (var currentColour in colourStandards) {
			if ((designerVariationCode === "EngravedPlastic" && +currentColour !== +currentColour) || (designerVariationCode !== "EngravedPlastic" && +currentColour === +currentColour)) {
				continue;
			}
			if (colourStandards[currentColour].name && colourStandards[currentColour].name.toLowerCase() === cmykcolour) {
				return colourStandards[currentColour];
			}
		}
	}
	return null;
}

function getColourByInkColour(inkcolour) {
	inkcolour = inkcolour.toLowerCase();
	if (inkcolour === "#000000" || inkcolour === "#000") {
		return colourStandards.black;
	}
	if (inkcolour === "#ffffff" || inkcolour === "#fff") {
		return colourStandards.white;
	}
	if (inkcolour === "#ff0000" || inkcolour === "#f00") {
		return colourStandards.red;
	}
	if (inkcolour === "#00ff00" || inkcolour === "#0f0") {
		return colourStandards.green;
	}
	if (inkcolour === "#0000ff" || inkcolour === "#00f") {
		return colourStandards.blue;
	}
	if (inkcolour === "#ffffff" || inkcolour === "#fff") {
		return colourStandards.white;
	}
	if (inkcolour === "#808080" || inkcolour === "#800080") {
		return colourStandards.violet;
	}
	if (inkcolour === "#0000fe") {
		return colourStandards.bluered;
	}
	if (inkcolour.substring(0, 1) === "#") {
		inkcolour = hex2rgb(inkcolour);
	}
	if (inkcolour.substring(0, 4) === "rgb(") {
		//colour in file is #xxxxxx or rgb(x,x,x)
		inkcolour = inkcolour.replace(/\s+/g, "");
		for (var colour in colourStandards) {
			if ((designerVariationCode === "EngravedPlastic" && +colour !== +colour) || (designerVariationCode !== "EngravedPlastic" && +colour === +colour)) {
				continue;
			}
			if (colourStandards[colour].inkColour && colourStandards[colour].inkColour === inkcolour) {
				return colourStandards[colour];
			}
		}
	} else {
		// colour in file is a colour word
		for (var currentColour in colourStandards) {
			if ((designerVariationCode === "EngravedPlastic" && +currentColour !== +currentColour) || (designerVariationCode !== "EngravedPlastic" && +currentColour === +currentColour)) {
				continue;
			}
			if (colourStandards[currentColour].name && colourStandards[currentColour].name.toLowerCase() === inkcolour) {
				return colourStandards[currentColour];
			}
		}
	}
	return null;
}

function defaultFor(arg, val) {
	return typeof arg !== "undefined" ? arg : val;
}

function canvasSupport() {
	return Modernizr.canvas;
}

function addTopRuler() {
	var ruler = [];
	var line = new fabric.Line(
		[60, 0, 60, 30], {
			strokeWidth: 2,
			stroke: "black",
		});
	ruler.push(line);
	var number = new fabric.Text("0", {
		scaleX: 0.5,
		scaleY: 0.5,
		top: 18,
		left: 68,
	});
	ruler.push(number);
	topRuler.add(line);
	var markerSpacing = topRuler.height / 24;
	for (var i = 0; i < 144; i++) {
		var newLine = new fabric.Line(
			[60, 0, 60, 30], {
				strokeWidth: 2,
				stroke: 'black'
			});
		newLine.set({
			x1: 60 + markerSpacing * (i + 1),
			y1: 0,
			x2: 60 + markerSpacing * (i + 1),
			y2: 15,
			strokeWidth: 1,
			stroke: "black",
		});
		if ((i + 1) % 6 == 0) {
			if ((i + 1) % 12 == 0) {
				newLine.set({
					y2: 30,
					strokeWidth: 2,
				});
				var number = new fabric.Text(((i + 1) / 12).toString(), {
					scaleX: 0.5,
					scaleY: 0.5,
					top: 18,
					left: 68 + markerSpacing * (i + 1),
				});
				ruler.push(number);
			} else {
				newLine.set({
					y2: 20,
					strokeWidth: 2,
				});
			}
		}
		ruler.push(newLine);
	}
	topRuler.add(new fabric.Group(ruler, {
		// top: $('.workspace').scrollTop(),
		selectable: false,
	}));
	topRuler.renderAll();
}

function rulerMouseLine(e) {
	var topRulerOffset = e.pageX - $("#topRulerContainer").offset().left;
	var leftRulerOffset = e.pageY - $("#leftRulerContainer").offset().top;
	if (topRulerOffset === 0 && leftRulerOffset === 0) {
		topRuler.mouseLine.set("left", -100);
		leftRuler.mouseLine.set("top", -100);
	} else {
		topRuler.mouseLine.set("left", topRulerOffset);
		leftRuler.mouseLine.set("top", leftRulerOffset);
	}
	topRuler.requestRenderAll.bind(topRuler)();
	leftRuler.requestRenderAll.bind(leftRuler)();
}

function panRulers(e) {
	console.log(e.target.scrollLeft);
	topRuler.ticks.set("left", topRuler.zeroOffset - e.target.scrollLeft);
	leftRuler.ticks.set("top", leftRuler.zeroOffset - e.target.scrollTop);
	topRuler.requestRenderAll.bind(topRuler)();
	leftRuler.requestRenderAll.bind(leftRuler)();
}

function changeRulerUnit() {
	var btn = document.getElementById("changeRulerUnitButton");
	if (rulerUnit === "inch") {
		rulerUnit = "mm";
		btn.innerHTML = "MM";
	} else if (rulerUnit === "mm") {
		rulerUnit = "px";
		btn.innerHTML = "PX";
	} else {
		rulerUnit = "inch";
		btn.innerHTML = "IN";
		if (languageCode == "fr") {
			btn.innerHTML = "PO";
		}
	}
	updateImageControls(currentCanvas.getActiveObject());
	//TienAdded
	updateShapeControls(currentCanvas.getActiveObject());
	redrawRulers();
}

function redrawRulers() {
	topRuler.clear();
	leftRuler.clear();
	topRuler.setBackgroundColor("#eee");
	leftRuler.setBackgroundColor("#eee");
	topRuler.setWidth($("#topRulerContainer").width());
	leftRuler.setHeight($("#leftRulerContainer").height());
	var topLine;
	var leftLine;
	var zoomLevel = currentCanvas.getZoom();
	var xOffset = canvasProperties.bleedLeft * zoomLevel;
	var yOffset = canvasProperties.bleedTop * zoomLevel;
	var totalPoints = Math.max(canvasProperties.width, canvasProperties.height) + 200;
	var step1;
	var step2;
	var step3;
	var step4;
	if (rulerUnit === "inch") {
		step1 = 96;
		step2 = 48;
		step3 = 24;
		step4 = 12;
		if (zoomLevel < 0.5) {
			step1 = 192;
			step2 = 96;
			step3 = 48;
			step4 = 24;
		}
		if (zoomLevel < 0.25) {
			step1 = 384;
			step2 = 192;
			step3 = 96;
			step4 = 48;
		}
		for (i = -200; i < totalPoints; i += 1) {
			var xPosition = zoomLevel * i + xOffset;
			var yPosition = zoomLevel * i + yOffset;
			if (i % step4 === 0) {
				if (i % step1 === 0) {
					topLine = new fabric.Line([xPosition, 20, xPosition, 40], {
						stroke: "black",
						strokeWidth: 3,
					});
					leftLine = new fabric.Line([20, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 3,
					});
					var text = new fabric.Text(Math.floor(i / 96).toString(), {
						left: xPosition + 6,
						top: 10,
						fontSize: 12,
						fontFamily: "Arial",
					});
					topRuler.add(text);
					var text = new fabric.Text(Math.floor(i / 96).toString(), {
						top: yPosition + 6,
						left: 10,
						fontSize: 12,
						fontFamily: "Arial",
					});
					leftRuler.add(text);
				} else if (i % step2 === 0) {
					topLine = new fabric.Line([xPosition, 25, xPosition, 40], {
						stroke: "black",
						strokeWidth: 2,
					});
					leftLine = new fabric.Line([25, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 2,
					});
				} else if (i % step3 === 0) {
					topLine = new fabric.Line([xPosition, 30, xPosition, 40], {
						stroke: "black",
						strokeWidth: 1,
					});
					leftLine = new fabric.Line([30, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 1,
					});
				} else if (i % step4 === 0) {
					topLine = new fabric.Line([xPosition, 35, xPosition, 40], {
						stroke: "black",
						strokeWidth: 1,
					});
					leftLine = new fabric.Line([35, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 1,
					});
				}
				topRuler.add(topLine);
				leftRuler.add(leftLine);
			}
		}
	} else if (rulerUnit === "mm") {
		var ratio = 96 / 25.4;
		step1 = 20;
		step2 = 10;
		step3 = 5;
		if (zoomLevel < 0.5) {
			step1 = 40;
			step2 = 20;
			step3 = 10;
		}
		if (zoomLevel < 0.25) {
			step1 = 80;
			step2 = 40;
			step3 = 20;
		}
		for (i = -200; i < totalPoints; i += 1) {
			var xPosition = Math.round(zoomLevel * i * ratio + xOffset);
			var yPosition = Math.round(zoomLevel * i * ratio + yOffset);
			if (i % step1 === 0 || i % step2 === 0 || i % step3 === 0) {
				if (i % step1 === 0) {
					topLine = new fabric.Line([xPosition, 20, xPosition, 40], {
						stroke: "black",
						strokeWidth: 3,
					});
					leftLine = new fabric.Line([20, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 3,
					});
					var text = new fabric.Text(i.toString(), {
						left: xPosition + 6,
						top: 10,
						fontSize: 12,
						fontFamily: "Arial",
					});
					topRuler.add(text);
					var text = new fabric.Text(i.toString(), {
						top: yPosition + 6,
						left: 10,
						fontSize: 12,
						fontFamily: "Arial",
					});
					leftRuler.add(text);
				} else if (i % step2 === 0) {
					topLine = new fabric.Line([xPosition, 25, xPosition, 40], {
						stroke: "black",
						strokeWidth: 2,
					});
					leftLine = new fabric.Line([25, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 2,
					});
				} else if (i % step3 === 0) {
					topLine = new fabric.Line([xPosition, 30, xPosition, 40], {
						stroke: "black",
						strokeWidth: 1,
					});
					leftLine = new fabric.Line([30, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 1,
					});
				}
				/*else 	if(i%25===0){
			 topLine = new fabric.Line([xPosition, 35, xPosition, 40], {
      stroke: 'black',
      strokeWidth: 1
    });
			  leftLine = new fabric.Line([35, yPosition, 40, yPosition], {
      stroke: 'black',
      strokeWidth: 1
    });
		}*/
				topRuler.add(topLine);
				leftRuler.add(leftLine);
			}
		}
	} else {
		var ratio = 1;
		//var ratio = 96 / 25.4;
		step1 = 20;
		step2 = 10;
		step3 = 5;
		if (zoomLevel < 0.5) {
			step1 = 40;
			step2 = 20;
			step3 = 10;
		}
		if (zoomLevel < 0.25) {
			step1 = 80;
			step2 = 40;
			step3 = 20;
		}
		for (i = -200; i < totalPoints; i += 1) {
			var xPosition = Math.round(zoomLevel * i * ratio + xOffset);
			var yPosition = Math.round(zoomLevel * i * ratio + yOffset);
			if (i % step1 === 0 || i % step2 === 0 || i % step3 === 0) {
				if (i % step1 === 0) {
					topLine = new fabric.Line([xPosition, 20, xPosition, 40], {
						stroke: "black",
						strokeWidth: 3,
					});
					leftLine = new fabric.Line([20, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 3,
					});
					var text = new fabric.Text(i.toString(), {
						left: xPosition + 6,
						top: 10,
						fontSize: 12,
						fontFamily: "Arial",
					});
					topRuler.add(text);
					var text = new fabric.Text(i.toString(), {
						top: yPosition + 6,
						left: 10,
						fontSize: 12,
						fontFamily: "Arial",
					});
					leftRuler.add(text);
				} else if (i % step2 === 0) {
					topLine = new fabric.Line([xPosition, 25, xPosition, 40], {
						stroke: "black",
						strokeWidth: 2,
					});
					leftLine = new fabric.Line([25, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 2,
					});
				} else if (i % step3 === 0) {
					topLine = new fabric.Line([xPosition, 30, xPosition, 40], {
						stroke: "black",
						strokeWidth: 1,
					});
					leftLine = new fabric.Line([30, yPosition, 40, yPosition], {
						stroke: "black",
						strokeWidth: 1,
					});
				}
				/*else 	if(i%25===0){
			 topLine = new fabric.Line([xPosition, 35, xPosition, 40], {
      stroke: 'black',
      strokeWidth: 1
    });
			  leftLine = new fabric.Line([35, yPosition, 40, yPosition], {
      stroke: 'black',
      strokeWidth: 1
    });
		}*/
				topRuler.add(topLine);
				leftRuler.add(leftLine);
			}
		}
	}
	topRuler.ticks = new fabric.Group(topRuler.getObjects());
	leftRuler.ticks = new fabric.Group(leftRuler.getObjects());
	topRuler.zeroOffset = topRuler.ticks.left;
	leftRuler.zeroOffset = leftRuler.ticks.top;
	topRuler.mouseLine = new fabric.Line([0, 0, 0, 40], {
		stroke: "red",
		strokeWidth: 3,
	});
	topRuler.add(topRuler.mouseLine);
	topRuler.mouseLine.sendToBack();
	leftRuler.mouseLine = new fabric.Line([0, 0, 40, 0], {
		stroke: "red",
		strokeWidth: 3,
	});
	leftRuler.add(leftRuler.mouseLine);
	leftRuler.mouseLine.sendToBack();
}

function SmpDesignerInit() {
	if (!canvasSupport()) {
		if (languageCode === "fr") {
			alert("Ce site nécessite JavaScript et un navigateur Web moderne prenant en charge HTML5 et Canvas.");
		} else {
			alert("This site requires javascript and a modern web browser that supports HTML5 and Canvas.");
		}
		return;
	}
	topRuler = new fabric.Canvas("canvasTopRuler");
	leftRuler = new fabric.Canvas("canvasLeftRuler");
	topRuler.setWidth($("#topRulerContainer").width());
	leftRuler.setHeight($("#leftRulerContainer").height());
	switch (designerVariationCode.toLowerCase()) {
		case "pl":
			designerVariationCode = "EngravedPlastic";
			break;
		case "sgn":
			designerVariationCode = "FullColour";
			break;
		case "zfc":
			designerVariationCode = "FullColour";
			break;
		case j:
			/* falls through */
			designerVariationCode = "SingleColour";
			break;
	}
	if (designerVariationCode === "EngravedPlastic") {
		$("input[name=engravedColourSelector]").val(["3"]); //Black text on white
	} else if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
		//thePos = "Centre Left";
		//$('#canvasBackgroundColourDropdown').val("white");
		//$('#textColourDropdown').val("black");
		$("#customTextColour").val("#000000");
	}
	/*	if (designerVariationCode === "FullColourFixedImagePosition") {
			logoposition = "";
		}*/
	currentCanvas = new fabric.Canvas("canvasPage", {
		imageSmoothingEnabled: true,
		selection: false,
		statefull: false,
		enableRetinaScaling: false,
		preserveObjectStacking: true,
		controlsAboveOverlay: true,
	});
	backgroundCanvas = new fabric.StaticCanvas("canvasBackground", {
		backgroundColor: "white",
		imageSmoothingEnabled: true,
	});
	if (currentTemplate != "" && currentTemplate != -1) {
		loadTemplate(currentTemplate);
	} else {
		loadDesign(currentDesign);
	}
}
//$(function () {
Dropzone.options.foregroundImageForm = {
	timeout: 60000,
	url: "designerImageUpload.cfm",
	maxFiles: 1,
	maxFilesize: window.maxFilesize,
	uploadMultiple: false,
	dictDefaultMessage: dropzoneMessage,
	accept: function(file, done) {
		done();
		if (languageCode === "fr") {
			activateModal("<div><div>Veuillez patienter pendant le traitement de votre image.</div><br><br><div><span id='dropboxProgress'>0</span>% téléchargé</div><div id='dropboxError'></div><div><button class=\"mui-btn mui-btn--primary\" onclick='document.getElementById(\"foregroundImageForm\").dropzone.removeAllFiles(true);deactivateModal();'>Annuler le téléchargement</button></div></div>", true);
		} else {
			activateModal("<div><div>Please wait while your image is processed.</div><br><br><div><span id='dropboxProgress'>0</span>% uploaded</div><div id='dropboxError'></div><div><button class=\"mui-btn mui-btn--primary\" onclick='document.getElementById(\"foregroundImageForm\").dropzone.removeAllFiles(true);deactivateModal();'>Cancel Upload</button></div></div>", true);
		}
	},
	maxfilesexceeded: function(file) {
		console.log("maxfilesexceeded");
		this.removeAllFiles();
		this.addFile(file);
	},
	addedfile: function() {
		if (typeof this.files[1] !== "undefined" && this.files[1] !== null) {
			this.removeFile(this.files[0]);
		}
	},
	sending: function(file, xhr, formData) {
		var hasBleed = false;
		if (canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedBottom > 0 || canvasProperties.bleedRight > 0) {
			hasBleed = true;
		}
		formData.append("bleed", hasBleed);
		formData.append("designUUID", window.designUUID);
		if (canvasProperties.bleedBottom > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0) {
			formData.append("width", Math.floor(canvasProperties.width + (canvasProperties.bleedLeft + canvasProperties.bleedRight)));
			formData.append("height", Math.floor(canvasProperties.height + (canvasProperties.bleedBottom + canvasProperties.bleedTop)));
		} else {
			/*formData.append("width", Math.floor(canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight)));
			formData.append("height", Math.floor(canvasProperties.height - (canvasProperties.marginTop + canvasProperties.marginBottom)));*/
			formData.append("width", Math.floor(canvasProperties.width));
			formData.append("height", Math.floor(canvasProperties.height));
		}
		formData.append("isProstamp", canvasProperties.isProstamp);
		formData.append("displayLanguageCode", languageCode);
		formData.append("designerVariationCode", designerVariationCode);
		xhr.ontimeout = function() {
			if (languageCode === "fr") {
				activateModal('<div><h2>téléchargement annulé ou expiration</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
			} else {
				activateModal('<div><h2>upload canceled or timeout</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
			}
			//Execute on case of timeout only
			console.log("dropZone Timeout");
		};
	},
	success: function(file, response) {
		var width;
		var height;
		if (canvasProperties.bleedBottom > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0) {
			width = Math.floor(canvasProperties.width + (canvasProperties.bleedLeft + canvasProperties.bleedRight));
			height = Math.floor(canvasProperties.height + (canvasProperties.bleedBottom + canvasProperties.bleedTop));
		} else {
			/*formData.append("width", Math.floor(canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight)));
			formData.append("height", Math.floor(canvasProperties.height - (canvasProperties.marginTop + canvasProperties.marginBottom)));*/
			width = Math.floor(canvasProperties.width);
			height = Math.floor(canvasProperties.height);
		}
		if (response.IMAGEOPTIONS[0].FORMAT && response.IMAGEOPTIONS[0].FORMAT === "svg") {
			svgFromImageKey(currentCanvas, null, response.IMAGEKEY, 1, {
				top: response.IMAGEOPTIONS[0].TOP + canvasProperties.bleedTop + canvasProperties.marginTop,
				left: response.IMAGEOPTIONS[0].LEFT + canvasProperties.bleedLeft + canvasProperties.marginLeft,
				height: height, //response.IMAGEOPTIONS[0].HEIGHT,
				width: width, //response.IMAGEOPTIONS[0].WIDTH,
				template: response.IMAGEOPTIONS[0].TEMPLATE,
				pageNumber: response.IMAGEOPTIONS[0].PAGE,
				centerImage: true,
			}, true, deactivateModal);
		} else {
			imageFromImageKey(currentCanvas, null, response.IMAGEKEY, 1, {
				top: response.IMAGEOPTIONS[0].TOP + canvasProperties.bleedTop + canvasProperties.marginTop,
				left: response.IMAGEOPTIONS[0].LEFT + canvasProperties.bleedLeft + canvasProperties.marginLeft,
				height: height, //response.IMAGEOPTIONS[0].HEIGHT,
				width: width, //response.IMAGEOPTIONS[0].WIDTH,
				template: response.IMAGEOPTIONS[0].TEMPLATE,
				pageNumber: response.IMAGEOPTIONS[0].PAGE,
				centerImage: true,
			}, true, deactivateModal);
		}
	},
	uploadprogress: function(file, progress, bytesSent) {
		document.getElementById("dropboxProgress").innerHTML = parseInt(progress);
		if (parseInt(progress) == 100) {
			(document.getElementById("dropboxError") || {}).innerHTML = "Image Received, Please wait while yout image is processed.";
		}
	},
	error: function(file, errorMessage) {
		if (languageCode === "fr") {
			activateModal("<div><h2>" + (errorMessage.MESSAGE || errorMessage) + '</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
		} else {
			activateModal("<div><h2>" + (errorMessage.MESSAGE || errorMessage) + '</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
		}
		//(document.getElementById("dropboxError")||{}).innerHTML = errorMessage;
	},
	canceled: function(file) {
		if (languageCode === "fr") {
			activateModal('<div><h2>téléchargement annulé ou expiration</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
		} else {
			activateModal('<div><h2>upload canceled or timeout</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
		}
		//(document.getElementById("dropboxError")||{}).innerHTML = "upload canceled or timeout";
	},
};
/*  Dropzone.options.backgroundImageForm = {
    url: "designerImageUpload.cfm",
    maxFiles: 1,
    uploadMultiple: false,
    dictDefaultMessage: "Click here or drag an image to add it to the design.  Your backround image should be at least <span id='backgroundHeight'></span> pixels high by <span id='backgroundWidth'></span> pixels wide",
    params: {
      uqkey: window.designUUID,
      cwidth: Math.round(canvasProperties.width),
      cheight: Math.round(canvasProperties.height),
      isProstamp: canvasProperties.isProstamp
    },
    accept: function (file, done) {
      done();
    },
    maxfilesexceeded: function (file) {
      console.log("maxfilesexceeded");
      this.removeAllFiles();
      this.addFile(file);
    },
    sending: function (file, xhr, formData) {
      formData.append("designUUID", window.designUUID);
      formData.append("width", Math.round(canvasProperties.width));
      formData.append("height", Math.round(canvasProperties.height));
      formData.append("isProstamp", canvasProperties.isProstamp);
      formData.append("displayLanguageCode", languageCode);
      formData.append("designerVariationCode", designerVariationCode);
    },
    init: function () {
      this.on("addedfile", function () {
        if (typeof this.files[1] !== 'undefined' && this.files[1] !== null) {
          this.removeFile(this.files[0]);
        }
      });
    }
  };*/
//SmpDesignerInit()
//});
function resizeWindow() {
	if (currentCanvas == null || currentCanvas == undefined) {
		return;
	}
	topRuler.setWidth($("#topRulerContainer").width());
	leftRuler.setHeight($("#leftRulerContainer").height());
	fitToScreen(currentCanvas);
}

function setDaterLanguage(canvas, selectedPartNumber) {
	if (!canvas.nonPrintedObjects.dateText || canvasProperties.bandString.trim() != "") {
		return;
	}
	var dateCode = "JAN 21 20XX";
	if (selectedPartNumber.toUpperCase().endsWith("F")) {
		var dateCode = "21 JAN 20XX";
	}
	if (selectedPartNumber.toUpperCase().endsWith("I")) {
		var dateCode = "20XX - 01 - 21";
	}
	if (selectedPartNumber.toUpperCase().endsWith("L") || selectedPartNumber.toUpperCase().endsWith("M")) {
		var dateCode = "JAN 21 20XX";
	}
	canvas.nonPrintedObjects.dateText.set("text", dateCode);
	if (canvas.nonPrintedObjects.dateText.width > canvas.nonPrintedObjects.dateBox.width) {
		canvas.nonPrintedObjects.dateText.scaleX = canvas.nonPrintedObjects.dateBox.width / canvas.nonPrintedObjects.dateText.width;
	}
	centerCanvasObject(canvas, canvas.nonPrintedObjects.dateText);
}

function canvasApp() {
	//$("#backgroundWidth").html(Math.floor(canvasProperties.width * (1 / pxfactor)));
	//$("#backgroundHeight").html(Math.floor(canvasProperties.height * (1 / pxfactor)));
	$(window).on("resize", resizeWindow);
	$("#designZoom").attr("max", Math.max(1, Math.min(10, Math.min(4000 / canvasProperties.width, 4000 / canvasProperties.height))));
	$("#charSpacing").on("input", setCharSpacing);
	$("#charSpacing-curve").on("input", setCurveSpacing);
	$("#radius-curve").on("input", setCurveRadius);
	$("#curveSwitchInput").on("input", toggleCurveRadius);
	$("#curvedTextBox").on("change", curvedTextBoxChanged);
	$("#curvedTextBox").on("focus", curvedTextBoxChanged);
	$("#curvedTextBox").on("keyup", curvedTextBoxChanged);
	$("#canvasParent").on("mousemove", rulerMouseLine);
	$("#canvasParent").on("scroll", panRulers);
	/* I don't know what this is here for, it sets them later on.
	if (designerVariationCode === "EngravedPlastic") {
		$("input[name=engravedColourSelector]").val(["3"]);
	}*/
	$("input[name=textFillColour]").each(function() {
		$("label:has(input[name=textFillColour]:radio:not(:checked))").addClass("unselectedLabel");
		$("label:has(input[name=textFillColour]:radio:checked)").addClass("selectedLabel");
	});
	$("input[name=textFillColour]").on("change", function() {
		$("label:has(input[name=textFillColour]:radio:checked)").removeClass("unselectedLabel").addClass("selectedLabel");
		$("label:has(input[name=textFillColour]:radio:not(:checked))").removeClass("selectedLabel").addClass("unselectedLabel");
	});
	if (designerVariationCode === "FullColourFixedImagePosition") {
		if (canvasProperties.productNumber === "220-15P" || canvasProperties.productNumber === "214-131P" || canvasProperties.productNumber === "220-12B") {
			//document.getElementById("backc").style.visibility = "display";
			/*      $("#canvasBackgroundColourDropdown option[value=\"1\"]").remove();
			      $("#canvasBackgroundColourDropdown option[value=\"3\"]").remove();
			      ToDo: what's this for?*/
		} else {
			document.getElementById("backc").style.visibility = "hidden";
		}
	}
	if (canvasProperties.bleedMargin > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedBottom > 0) {
		showGuides = true;
	}
	if (canvasProperties.width < canvasProperties.height && blankOrientation == "landscape" && canRotate) {
		showGuides = false;
	}
	if (canvasProperties.width > canvasProperties.height && blankOrientation == "portrait" && canRotate) {
		showGuides = false;
	}
	canvasInit(canvases[0]);
	//select first page canvas
	if (productInfo.MINPAGES > canvases.length) {
		for (var i = canvases.length; i < productInfo.MINPAGES; i++) {
			currentCanvas = addPage();
		}
	}
	if (productInfo.MAXPAGES === 1) {
		document.getElementById("pageSelectButtonContainer").style.display = "none";
	}
	document.getElementById("textMenu").click();
	//$("#textEntryBox").on("keyup", textBoxChanged);
	$("#textSize").on("change", textSizeChanged);
	$("#textSize-curve").on("change", textSizeChanged);
	$("select[name=Variation]").on("change", function() {
		changeBackgroundColour.bind(null, currentCanvas);
		setDaterLanguage(currentCanvas, document.querySelector("select[name=Variation]").value);
		enableProductOptions();
	});
	if (designerVariationCode === "EngravedPlastic") {
		if (Array.isArray(canvasProperties.availableColours) && canvasProperties.availableColours.length > 0) {
			document.querySelectorAll("label[for^=ColSwatch]").forEach((el) => {
				el.style.visibility = "collapse";
				el.style.display = "none";
			});
			for (var c = 0; c < canvasProperties.availableColours.length; c++) {
				document.querySelectorAll("label[for=ColSwatch" + canvasProperties.availableColours[c].NAME + "]").forEach((el) => {
					el.style.visibility = "visible";
					el.style.display = "block";
				});
				//addColour(canvasProperties.availableColours[c]);
			}
			$("input[name=engravedColourSelector]").val([
				canvasProperties.materialColour || canvasProperties.availableColours[0].NAME,
			]);
		} else {
			$("input[name=engravedColourSelector]").val([
				canvasProperties.materialColour || "3",
			]);
		}
	} else if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
		currentCanvas.backgroundColourStore = currentCanvas.get("backgroundColor") || "#ffffff";
		/* for (i = 0; i < textObjects.length; i++) {
			textObjects[i].set("fill",getColourByCMYK(textObjects[i].get("fill")).cmykColour);
		} */
		/* if (getColourByCMYK(canvas.backgroundColor)) {
			canvas.setBackgroundColor(getColourByCMYK(canvas.backgroundColor || "rgb(255,255,255)").cmykColour);
					} */
		//canvas.setBackgroundColor(getColourByCMYK(canvas.backgroundColor || "rgb(255,255,255)").cmykColour);
	}
	//document.getElementById("textBox0").focus();
	//document.getElementById("cProd").innerHTML = canvasProperties.productNumber;
	if (typeof canvasProperties.productNumberVariation !== "undefined" && canvasProperties.productNumberVariation !== null && document.querySelectorAll("select[name=Variation] option[data-variationid='" + canvasProperties.productNumberVariation + "']").length > 0) {
		//&& $("select[name=Variation] option[value='" + canvasProperties.productNumberVariation + "']").length > 0) {
		document.querySelector("select[name=Variation]").value = document.querySelectorAll("select[name=Variation] option[data-variationid='" + canvasProperties.productNumberVariation + "']")[0].value;
	}
	//TODO majorly!: move all of this garbage to the loadProductInfo API, maybe even move the designerVariationCode stuff there too!
	if (canvasProperties.productNumber.indexOf("B") === 0) {
		// B instead of BD
		canvasProperties.isProstamp = true;
	}
	if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		/*document.getElementById("textFillColour_purple").style.visibility = "visible";
		document.getElementById("textFillColour_bluered").style.visibility = "visible";
		document.getElementById("textFillColour_green").style.visibility = "visible";
		document.getElementById("textFillColour_red").style.visibility = "visible";
		document.getElementById("textFillColour_blue").style.visibility = "visible";
		document.getElementById("textFillColour_purple").style.visibility = "visible";*/
		if (!(canvasProperties.productNumber === "DT3" || canvasProperties.productNumber === "DT1" || canvasProperties.productNumber === "DT4" || canvasProperties.productNumber === "DT2" || canvasProperties.productNumber === "DT5" || canvasProperties.productNumber === "DT6")) {
			/*document.getElementById("textFillColour_bluered").style.display = "none";*/
		}
		/*	if (canvasProperties.productNumber.indexOf("N") > -1 || canvasProperties.productNumber.indexOf("MX") > -1) {
				//document.getElementById("textFillColour_purple").style.visibility = "visible";
			} else {
				document.getElementById("textFillColour_purple").style.display = "none";
			}*/
		if (canvasProperties.productNumber.substr(0, 3) === "31-" || canvasProperties.productNumber.substr(0, 5) === "MX400") {
			/*document.getElementById("textFillColour_bluered").style.display = "none";
			document.getElementById("textFillColour_green").style.display = "none";
			document.getElementById("textFillColour_red").style.display = "none";
			document.getElementById("textFillColour_blue").style.display = "none";
			document.getElementById("textFillColour_purple").style.display = "none";*/
			textColourSelect(currentCanvas, "black", true);
		}
		if (canvasProperties.productNumber === "DT7" || canvasProperties.productNumber === "DT11" || canvasProperties.productNumber === "DT8" || canvasProperties.productNumber === "DT9" || canvasProperties.productNumber === "DT10") {
			/*document.getElementById("textFillColour_bluered").style.display = "none";
			document.getElementById("textFillColour_green").style.display = "none";
			document.getElementById("textFillColour_red").style.display = "none";
			document.getElementById("textFillColour_blue").style.display = "none";
			document.getElementById("textFillColour_purple").style.display = "none";*/
			textColourSelect(currentCanvas, "black", true);
		}
		/*		if (!canvasProperties.greenInkAvailable) {
					document.getElementById("textFillColour_green").style.display = "none";
				}*/
		if (Array.isArray(canvasProperties.availableColours) && canvasProperties.availableColours.length > 0) {
			/*	document.getElementById("textFillColour_bluered").style.display = "none";
				document.getElementById("textFillColour_green").style.display = "none";
				document.getElementById("textFillColour_red").style.display = "none";
				document.getElementById("textFillColour_blue").style.display = "none";
				document.getElementById("textFillColour_purple").style.display = "none";
				document.getElementById("textFillColour_black").style.display = "none";*/
			for (var c = 0; c < canvasProperties.availableColours.length; c++) {
				addColour(canvasProperties.availableColours[c]);
			}
		}
	}
	if (canvasProperties.drawFullBorder) {
		$("#myonoffswitch").prop("checked", true);
	}
	if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		//textColourSelect(currentCanvas, (currentCanvas.textObjects.length > 0) ? getColourByInkColour(currentCanvas.textObjects[0].fill).name : "black", true);
		var targetColour = currentCanvas.textObjects.length > 0 ? getColourByInkColour(currentCanvas.textObjects[0].fill).name : "black";
		if (Array.isArray(canvasProperties.availableColours) && canvasProperties.availableColours.length > 0 && getAvailableColourByName(targetColour) == false) {
			targetColour = canvasProperties.availableColours[0].NAME;
		}
		textColourSelect(currentCanvas, targetColour, true);
	}
	/*  if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
	    drawScreen(canvas); // had a 900 ms timeout in original
	  }*/
	//$("#overlay").slideUp();
	currentCanvas = selectCanvas(0);
	//	why do this?
	if (currentCanvas.textObjects.length && currentCanvas.textObjects[0].canvas === currentCanvas && currentCanvas.textObjects[0].text != "") {
		currentCanvas.setActiveObject(currentCanvas.textObjects[0]);
	}
	//$("#backgroundWidth").html(Math.floor((canvasProperties.width + canvasProperties.bleedMargin) * (1 / pxfactor)));
	//$("#backgroundHeight").html(Math.floor((canvasProperties.height + canvasProperties.bleedMargin) * (1 / pxfactor)));
	drawScreenAsync(readyToGo.bind(null, currentCanvas), currentCanvas);
}

function getAvailableColourByName(name) {
	for (var i = 0; i < canvasProperties.availableColours.length; i++) {
		if (canvasProperties.availableColours[i].NAME == name) {
			return canvasProperties.availableColours[i];
		}
	}
	return null;
}

function addColour(colourObj) {
	switch (designerVariationCode) {
		case "SingleColour":
		case "Grayscale":
			var currentColour = document.getElementById("textFillColour_" + colourObj.NAME);
			if (currentColour != null && typeof currentColour != "undefined") {
				currentColour.style.visibility = "visible";
				currentColour.style.display = "inline-block";
			} else {
				var label = document.createElement("LABEL");
				label.setAttribute("for", "textFillColour_" + colourObj.NAME + "_input");
				label.setAttribute("id", "textFillColour_" + colourObj.NAME);
				label.setAttribute("class", "btn_" + colourObj.NAME);
				var colourString = "";
				if (colourObj.INK) {
					if (colourObj.DATECOLOUR && colourObj.DATECOLOUR != "") {
						colourString = "background: linear-gradient(" + colourObj.INK + ", " + colourObj.DATECOLOUR + ");";
					} else {
						colourString = "background-color : " + colourObj.INK;
					}
				} else if (colourStandards[colourObj.NAME]) {
					if (colourStandards[colourObj.NAME].dateColour && colourStandards[colourObj.NAME].dateColour != "") {
						colourString = "background: linear-gradient(" + colourStandards[colourObj.NAME].inkColour + ", " + colourStandards[colourObj.NAME].dateColour + ");";
					} else {
						colourString = "background-color  : " + colourStandards[colourObj.NAME].inkColour;
					}
				}
				label.setAttribute("style", "width: 30px; height: 30px; display: inline-block; border-radius: 30px; margin-right: 2px; visibility: visible; " + colourString);
				label.innerHTML = '<input type="radio" name="textFillColour" value="' + colourObj.NAME + '" style="display:none;" id="textFillColour_' + colourObj.NAME + '_input" onclick="textColourSelect(currentCanvas,\'' + colourObj.NAME + "',true);\">";
				document.getElementById("colourMenu").firstElementChild.firstElementChild.appendChild(label);
			}
			break;
		case "EngravedPlastic":
		case "FullColourFixedImagePosition":
		case "FullColour":
			console.log("Skip add colour for designerVariationCode: " + designerVariationCode);
			break;
		default:
			console.log("Skip add colour for designerVariationCode: " + designerVariationCode);
	}
}

function readyToGo(canvas) {
	for (var i = 0; i < canvases.length; i++) {
		if (canvasProperties.width > canvasProperties.height && blankOrientation == "portrait" && canRotate) {
			canvasProperties.angle = 0;
			rotate(canvases[i]);
		} else if (canvasProperties.width < canvasProperties.height && blankOrientation == "landscape" && canRotate) {
			canvasProperties.angle = 0;
			rotate(canvases[i]);
		}
	}
	fitToScreen(canvas);
	if (currentCanvas.textObjects.length === 0 && currentCanvas.textContainers.length === 0 && !simpleMode && currentCanvas.imageObjects.length === 0 && !blankUpload && canvas.getObjects().every(function(element, index, array) {
			return !element.isType("group");
		})) {
		addTextLine(canvas);
	}
	if (canvasProperties.bleedMargin > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedBottom > 0) {
		drawGuides(canvas);
	}
	if (blankUpload) {
		uploadWholeImage();
	} else {
		deactivateModal();
	}
	if (Array.isArray(productInfo.VARIATIONS) && productInfo.VARIATIONS.length > 0) {
		activateTab("productVariationDiv");
	}
	if (Array.isArray(productInfo.PRODUCTOPTIONS) && productInfo.PRODUCTOPTIONS.length > 0) {
		//build dropdown from options
		var optDiv = document.getElementById("productOptionsDiv");
		if (optDiv) {
			optDiv.innerHTML = '';
			for (const optCat of productInfo.PRODUCTOPTIONS) {
				var optionContainer = document.createElement('div');
				optionContainer.className = 'optionContainer';
				optionContainer.id = 'prodOptCont' + optCat.ID;
				optDiv.appendChild(optionContainer);
				var header = document.createElement('div');
				header.innerHTML = languageCode == "en" ? optCat.DISPLAYEN : optCat.DISPLAYFR;
				header.className = 'optionTitle';
				optionContainer.appendChild(header);
				var select = document.createElement('select');
				select.name = 'prodOpts' + optCat.ID;
				select.id = select.name + 'Id';
				select.title = languageCode == "en" ? optCat.TOOLTIPEN : optCat.TOOLTIPFR;
				select.required = optCat.REQUIRED == 1;
				select.multiple = optCat.MULTI == 1;
				select.setAttribute('data-variationIdArray', optCat.VARIATIONIDARRAY);
				select.setAttribute('data-required', optCat.REQUIRED == 1);
				select.setAttribute('data-name', optCat.NAME);
				select.setAttribute('data-toolTipEN', optCat.TOOLTIPEN);
				select.setAttribute('data-toolTipFR', optCat.TOOLTIPFR);
				select.setAttribute('data-displayEN', optCat.DISPLAYEN);
				select.setAttribute('data-displayFR', optCat.DISPLAYFR);
				select.setAttribute('data-optId', optCat.ID);
				for (var i = 0; i < optCat.OPTIONSARRAY.length; i++) {
					var option = document.createElement('option');
					option.value = optCat.OPTIONSARRAY[i].CODE;
					option.text = languageCode == "en" ? optCat.OPTIONSARRAY[i].DISPLAYEN : optCat.OPTIONSARRAY[i].DISPLAYFR;
					option.title = languageCode == "en" ? optCat.OPTIONSARRAY[i].TOOLTIPEN : optCat.OPTIONSARRAY[i].TOOLTIPFR;
					option.setAttribute('data-toolTipEN', optCat.TOOLTIPEN);
					option.setAttribute('data-toolTipFR', optCat.TOOLTIPFR);
					option.setAttribute('data-custDescEN', optCat.CUSTDESCEN);
					option.setAttribute('data-custDescFR', optCat.CUSTDESCFR);
					option.setAttribute('data-textEN', optCat.DISPLAYEN);
					option.setAttribute('data-textFR', optCat.DISPLAYFR);
					option.setAttribute('data-instructions', optCat.INSTRUCTIONS);
					select.appendChild(option);
				}
				optionContainer.appendChild(select);
			}
			activateTab("productVariationDiv");
			enableProductOptions();
		}
	}
	document.querySelectorAll(".blocker").forEach((x) => x.remove());
}

function enableProductOptions() {
	var varDropdown = document.querySelector("select[name=Variation]");
	if (!varDropdown) {
		return;
	}
	var selectedVariationId = varDropdown.options[varDropdown.selectedIndex].dataset.variationid;
	var options = document.querySelectorAll(".optionContainer");
	options.forEach((option) => {
		var select = option.querySelector("select");
		var variations = select.dataset.variationidarray.split(",");
		if (variations.includes(selectedVariationId) || variations.includes(-1) || variations.len == 0) {
			option.classList.remove("hidden");
			select.disabled = false;
			select.required = select.dataset.required;
		} else {
			option.classList.add("hidden");
			select.disabled = true;
			select.required = false;
		}
	});
}

function getProductOptions() {
	var varDropdown = document.querySelector("select[name=Variation]");
	if (!varDropdown) {
		return;
	}
	var selectedVariationId = varDropdown.options[varDropdown.selectedIndex].dataset.variationid;
	var options = document.querySelectorAll(".optionContainer");
	var returnArray = [];
	options.forEach((option) => {
		var select = option.querySelector("select");
		if (select.disabled) {
			return;
		}
		var optid = select.dataset.optid;
		var selectedOption = select.options[select.selectedIndex].value;
		returnArray.push({
			id: optid,
			selectedOption: selectedOption
		});
	});
	return returnArray;
}

function canvasInit(canvas) {
	//These were math.rounded, I don't think it's neccessary
	canvas.setHeight(canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom);
	canvas.setWidth(canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight);
	backgroundCanvas.setHeight(canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom);
	backgroundCanvas.setWidth(canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight);
	canvas.requestRenderAll.bind(canvas)();
	backgroundCanvas.requestRenderAll.bind(backgroundCanvas)();
	//zoomInBy(96 / 72);  //changed to zoom to screen size
	canvas.on("object:scaling", onObjectScaling);
	canvas.on("object:moving", onObjectMoving);
	canvas.on("object:modified", onObjectModified);
	canvas.on("object:added", onObjectAdded);
	canvas.on("object:removed", onObjectRemoved);
	canvas.on("path:created", onPathCreated);
	//canvas.on("object:selected", onObjectSelected); //deprecated in v2.0.0
	canvas.on("selection:created", onObjectSelected);
	canvas.on("selection:updated", onObjectSelected);
	canvas.on("object:rotating", onObjectRotating);
	canvas.on("mouse:dblclick", onObjectDoubleClicked);
	canvas.on("text:changed", itextChanged);
	canvas.on("text:selection:changed", itextSelectionChanged);
	canvas.on("text:editing:entered", itextEditingEntered);
	canvas.on("text:editing:exited", itextEditingExited);
}

function previewxxx(canvas) {
	if (canvases.length > 1) {
		var previewString = "<div id='previewDiv'><h1>Preview</h1><div class='previewImageContainer'><div class='cycle-slideshow' data-cycle-fx='scrollHorz' data-cycle-timeout='0' data-cycle-prev='#prev' data-cycle-next='#next' data-cycle-auto-height=container >";
		for (var i = 0; i < canvases.length; i++) {
			previewString += "<img src='" + getCroppedImage(canvases[i]) + "'>";
		}
		previewString += "</div></div><div class='center'><a href=# id='prev'>Prev</a> <a href=# id='next'>Next</a></div><div><button class=\"mui-btn mui-btn--primary\" onclick='deactivateModal();'>Close</button></div></div>";
		activateModal(previewString);
		$(".cycle-slideshow").cycle();
	} else {
		var previewString = "<div id='previewDiv'><h1>Preview</h1><div class='previewImageContainer'><div class='cycle-slideshow' data-cycle-auto-height=container>";
		for (var i = 0; i < canvases.length; i++) {
			previewString += "<img src='" + getCroppedImage(canvases[i]) + "'>";
		}
		previewString += "</div></div><div><button class=\"mui-btn mui-btn--primary\" onclick='deactivateModal();'>Close</button></div></div>";
		activateModal(previewString);
	}
}

function activatePreviews(height, width, offset) {
	$(".templateThumbnailMulti").hover(function() {
		$(this).siblings().css("z-index", "2");
		$(this).css("z-index", "3");
	});
	$(".previewImageContainerMulti").height(Math.min(500, offset + height)).width(Math.min(500, offset + width));
}

function selectPreviewByIndex(index) {
	$(".templateThumbnailMulti").css("z-index", "2");
	$(".templateThumbnailMulti:nth-of-type(" + (index + 1) + ")").css("z-index", "3");
}
var TRpreview = languageCode == "en" ? "Preview" : "Aperçu";
var TRpreviewConf1 = languageCode == "en" ? "I have reviewed my order and my design.  I confirm that the spelling is correct, the images are clear and of proper resolution, artwork is within cut-lines and important components are within the safe-area." : "J'ai examiné ma commande et ma conception. Je confirme que l'orthographe est correcte, que les images sont claires et de résolution correcte, que les illustrations sont dans les lignes de coupe et que des composants importants se trouvent dans la zone de sécurité.";
var TRpreviewConf2 = languageCode == "en" ? "I understand that colours shown on my screen may vary slightly compared to the printed output" : "Je comprends que les couleurs affichées sur mon écran peuvent varier légèrement par rapport à la sortie imprimée.";
var TRclose = languageCode == "en" ? "Close" : "Retour au concepteur";
var TRAddToCart = languageCode == "en" ? "Add To Cart" : "Ajouter au Panier";
var TRclose = languageCode == "en" ? "Close" : "Retour au concepteur";
async function preview() {
	var height = 0;
	var width = 0;
	var offset = 0;
	var previewString = "<div id='previewDiv'><h1>" + TRpreview + "</h1>";
	if (canvases.length > 1) {
		previewString += "<div class='previewImageContainerMulti'>";
		offset = 40;
		for (var i = 0; i < canvases.length; i++) {
			var currentWidth = canvases[i].width / canvases[i].getZoom() - canvasProperties.bleedLeft / canvases[i].getZoom() - canvasProperties.bleedRight / canvases[i].getZoom();
			var currentHeight = canvases[i].height / canvases[i].getZoom() - canvasProperties.bleedTop / canvases[i].getZoom() - canvasProperties.bleedBottom / canvases[i].getZoom();
			height = Math.max(height, currentHeight);
			width = Math.max(width, currentWidth);
			if (i === 0) {
				previewString += '<img src="' + await getCroppedImage(canvases[i]) + '" class="templateThumbnailMulti" style="z-index: 3;">';
			} else {
				previewString += '<img src="' + await getCroppedImage(canvases[i]) + '" class="templateThumbnailMulti" alt="proof" title="proof" style="top: ' + offset + "px; left: " + offset + 'px;">';
			}
		}
		previewString += "</div><div class='center'>";
		for (var i = 0; i < canvases.length; i++) {
			if (canvases.length === 2) {
				if (i === 0) {
					previewString += "<a href=# style='margin:10px;' onclick='selectPreviewByIndex(" + i + ")' id='proof" + i + "'>Front</a>";
				} else {
					previewString += "<a href=# style='margin:10px;' onclick='selectPreviewByIndex(" + i + ")' id='proof" + i + "'>Back</a>";
				}
			} else {
				previewString += "<a href=# style='margin:10px;' onclick='selectPreviewByIndex(" + i + ")' id='proof" + i + "'>Page " + (i + 1) + "</a>";
			}
		}
	} else {
		previewString += "<div class='previewImageContainer'>";
		var currentWidth = canvases[0].width / canvases[0].getZoom() - canvasProperties.bleedLeft / canvases[0].getZoom() - canvasProperties.bleedRight / canvases[0].getZoom();
		var currentHeight = canvases[0].height / canvases[0].getZoom() - canvasProperties.bleedTop / canvases[0].getZoom() - canvasProperties.bleedBottom / canvases[0].getZoom();
		height = Math.max(height, currentHeight);
		width = Math.max(width, currentWidth);
		previewString += '<img src="' + await getCroppedImage(canvases[0]) + '" class="templateThumbnail" style="z-index: 3;">';
	}
	previewString += "</div><div class='previewFooter'><div class='previewActionBox'><div class='previewDisclaimerContainer'><div class='previewDisclaimer'><input type='checkbox' id='confirm1'><label for='confirm1'>" + TRpreviewConf1 + "</label></div><div class='previewDisclaimer'><input type='checkbox' id='confirm2'><label for='confirm2'>" + TRpreviewConf2 + "</label></div></div><div class='previewAddToCartContainer'>	<button class='mui-btn mui-btn--primary previewAddToCartButton' onclick='addToCartClicked();''> <i class='material-icons'> add_shopping_cart </i><br>" + TRAddToCart + "</button></div></div><div class='previewCloseButtonContainer'><button class='mui-btn mui-btn--primary' onclick='deactivateModal();'>" + TRclose + "</button></div></div>";
	activateModal(previewString);
	if (canvases.length > 1) {
		activatePreviews(height * 2, width * 2, offset);
	}
}

function addToCartClicked() {
	if ($("#confirm1").prop("checked") && $("#confirm2").prop("checked")) {
		addDesignToCart();
	} else {
		$(".previewDisclaimerContainer").css("background-color", "#edabac");
	}
}
async function getCroppedImage(canvas) {
	return await getCroppedProofImage(canvas, canvasProperties);
	hideGuides(canvas);
	var image = canvas.toDataURL({
		multiplier: proofDpi / renderingDpi / canvas.getZoom(),
		left: canvasProperties.bleedLeft * canvas.getZoom(),
		top: canvasProperties.bleedTop * canvas.getZoom(),
		width: canvas.width - canvasProperties.bleedLeft * canvas.getZoom() - canvasProperties.bleedRight * canvas.getZoom() + 2,
		height: canvas.height - canvasProperties.bleedTop * canvas.getZoom() - canvasProperties.bleedBottom * canvas.getZoom() + 2,
	});
	return image;
}
/*function getCroppedImage(canvas, multiplier) {
	hideGuides(canvas);
	multiplier = multiplier || 1 / canvas.getZoom();
	var image = null;
	var backgroundImage = null;
	if (backgroundCanvas.backgroundColour != "white" || backgroundCanvas.backgroundImage != 0){
		image = canvas.toDataURL({
			multiplier: multiplier,
			left: canvasProperties.bleedLeft * canvas.getZoom(),
			top: canvasProperties.bleedTop * canvas.getZoom(),
			width: canvas.width - canvasProperties.bleedLeft * canvas.getZoom() - canvasProperties.bleedRight * canvas.getZoom() + 2,
			height: canvas.height - canvasProperties.bleedTop * canvas.getZoom() - canvasProperties.bleedBottom * canvas.getZoom() + 2
		});
		backgroundImage = canvas.toDataURL({
			multiplier: multiplier,
			left: canvasProperties.bleedLeft * canvas.getZoom(),
			top: canvasProperties.bleedTop * canvas.getZoom(),
			width: canvas.width - canvasProperties.bleedLeft * canvas.getZoom() - canvasProperties.bleedRight * canvas.getZoom() + 2,
			height: canvas.height - canvasProperties.bleedTop * canvas.getZoom() - canvasProperties.bleedBottom * canvas.getZoom() + 2
		});
	} else {
		var canvasBack = canvas.backgroundColour;
		if (canvas.backgroundColour === "" && canvas.backgroundImage === 0){
			canvas.backgroundColour = "white";
			canvas.requestRenderAll.bind(canvas)();
		}
		image = canvas.toDataURL({
			multiplier: multiplier,
			left: canvasProperties.bleedLeft * canvas.getZoom(),
			top: canvasProperties.bleedTop * canvas.getZoom(),
			width: canvas.width - canvasProperties.bleedLeft * canvas.getZoom() - canvasProperties.bleedRight * canvas.getZoom() + 2,
			height: canvas.height - canvasProperties.bleedTop * canvas.getZoom() - canvasProperties.bleedBottom * canvas.getZoom() + 2
		});
		if (canvas.backgroundColour !== canvasBack ){
			canvas.backgroundColour = canvasBack;
			canvas.requestRenderAll.bind(canvas)();
		}
		return image;
	}
}*/
async function getCroppedProofImage(canvas, canvasProperties) {
	return new Promise((resolve, reject) => {
		hideGuides(canvas);
		/*var image = canvas.toDataURL({
			multiplier: (proofDpi / renderingDpi) / canvas.getZoom(),
			left: canvasProperties.bleedLeft * canvas.getZoom(),
			top: canvasProperties.bleedTop * canvas.getZoom(),
			width: canvas.width - canvasProperties.bleedLeft * canvas.getZoom() - canvasProperties.bleedRight * canvas.getZoom() + 2,
			height: canvas.height - canvasProperties.bleedTop * canvas.getZoom() - canvasProperties.bleedBottom * canvas.getZoom() + 2
		});*/
		/* OLD:
			fabric.Image.fromURL(canvas.toDataURL({
			multiplier: (proofDpi / renderingDpi) / canvas.getZoom(),
			left: canvasProperties.bleedLeft * canvas.getZoom(),
			top: canvasProperties.bleedTop * canvas.getZoom(),
			width: canvas.width - canvasProperties.bleedLeft * canvas.getZoom() - canvasProperties.bleedRight * canvas.getZoom() + 2,
			height: canvas.height - canvasProperties.bleedTop * canvas.getZoom() - canvasProperties.bleedBottom * canvas.getZoom() + 2
		})
		*/
		var workImage = canvas.toDataURL({
			multiplier: (proofDpi / renderingDpi) / canvas.getZoom(),
			left: 0,
			top: 0,
			width: canvas.width,
			height: canvas.height
		});
		fabric.Image.fromURL(workImage, function(img) {
			// Clear backgroundCanvas clipPath so the preview thumbnail only uses
			// the clip already baked into the canvas raster (from canvas.toDataURL).
			// Without this, backgroundCanvas retains the selected page's clip path,
			// causing double-clipping on the non-selected page's preview.
			backgroundCanvas.clipPath = null;
			backgroundCanvas.setZoom(this.getZoom());
			backgroundCanvas.setWidth(this.getWidth());
			backgroundCanvas.setHeight(this.getHeight());
			backgroundCanvas.renderAll.bind(backgroundCanvas)();
			img.set({ //width: canvas.getWidth()/canvas.getZoom(),
				//height: canvas.getHeight()/canvas.getZoom(),
				scaleX: (backgroundCanvas.getWidth() / backgroundCanvas.getZoom()) / img.width, //new update
				scaleY: (backgroundCanvas.getHeight() / backgroundCanvas.getZoom()) / img.height, //new update
				originX: 'left',
				originY: 'top',
				left: 0,
				top: 0
			});
			//backgroundCanvas.image
			backgroundCanvas.add(img);
			img.bringToFront();
			backgroundCanvas.renderAll.bind(backgroundCanvas)();
			if (canvasProperties.width > 1000 || canvasProperties.height > 1000) {
				proofDpi = 36;
			}
			var proofImageBinaryCropped = backgroundCanvas.toDataURL({
				multiplier: (proofDpi / renderingDpi) / this.getZoom(),
				left: canvasProperties.bleedLeft * this.getZoom(),
				top: canvasProperties.bleedTop * this.getZoom(),
				width: this.width - canvasProperties.bleedLeft * this.getZoom() - canvasProperties.bleedRight * this.getZoom() + 2,
				height: this.height - canvasProperties.bleedTop * this.getZoom() - canvasProperties.bleedBottom * this.getZoom() + 2
			});
			this.proofImageBinaryCropped = proofImageBinaryCropped;
			backgroundCanvas.remove(img);
			console.log("Proof image " + this.proofImageBinaryCropped + " created " + Date.now());
			resolve(proofImageBinaryCropped);
		}.bind(canvas), {
			crossOrigin: 'anonymous'
		});
		//return canvas.proofImageBinaryCropped;
	});
}

function updateImageControls(imageObject) {
	if (simpleMode === true) {
		return;
	}
	var imgHeight = document.getElementById("imageHeight");
	var imgWidth = document.getElementById("imageWidth");
	var imgX = document.getElementById("imageX");
	var imgY = document.getElementById("imageY");
	if (imgHeight == null || imgHeight == void 0 || imgWidth == null || imgWidth == void 0 || imgX == null || imgX == void 0 || imgY == null || imgY == void 0) {
		return;
	}
	if (imageObject == void 0 || imageObject == null || !imageObject.isType("image") || imageObject.fixedImage == true) {
		imgHeight.onchange = null;
		imgWidth.onchange = null;
		imgX.onchange = null;
		imgY.onchange = null;
		imgX.value = null;
		imgY.value = null;
		imgHeight.value = null;
		imgWidth.value = null;
		return;
	}
	var unitFactor = 1;
	if (rulerUnit == "inch") {
		unitFactor = 96;
	} else if (rulerUnit == "mm") {
		unitFactor = 96 / 25.4;
	}
	imgHeight.onchange = transformImageWithControls(imageObject);
	imgWidth.onchange = transformImageWithControls(imageObject);
	imgX.onchange = transformImageWithControls(imageObject);
	imgY.onchange = transformImageWithControls(imageObject);
	imgX.value = +((imageObject.left - canvasProperties.bleedLeft) / unitFactor).toFixed(4);
	imgY.value = +((imageObject.top - canvasProperties.bleedTop) / unitFactor).toFixed(4);
	imgHeight.value = +((imageObject.height * imageObject.scaleY) / unitFactor).toFixed(4);
	imgWidth.value = +((imageObject.width * imageObject.scaleX) / unitFactor).toFixed(4);
}

function transformImageWithControls(imageObject) {
	return function(e) {
		var field = e.target.id;
		var newValue = Number(e.target.value);
		var unitFactor = 1;
		if (rulerUnit == "inch") {
			unitFactor = 96;
		} else if (rulerUnit == "mm") {
			unitFactor = 96 / 25.4;
		}
		var newValuePX = newValue * unitFactor;
		if (isNaN(newValue) || newValue == void 0 || newValue == null) {
			return;
		}
		if (field == "imageX") {
			imageObject.set("left", newValuePX + canvasProperties.bleedLeft);
		} else if (field == "imageY") {
			imageObject.set("top", newValuePX + canvasProperties.bleedTop);
		} else if (field == "imageHeight") {
			var newScale = +(newValuePX / imageObject.height);
			imageObject.set("scaleY", newScale);
			imageObject.set("scaleX", newScale);
		} else if (field == "imageWidth") {
			var newScale = +(newValuePX / imageObject.width);
			imageObject.set("scaleY", newScale);
			imageObject.set("scaleX", newScale);
		}
		imageObject.setCoords();
		updateImageControls(imageObject);
		imageObject.canvas.requestRenderAll.bind(imageObject.canvas)();
	};
}

function imageResolutionCheck(imageObject) {
	if (imageObject.typeImage === "shapes") {
		var currentDpi = (imageObject.width / imageObject.getScaledWidth()) * renderingDpi;
	} else {
		var currentDpi = (imageObject.getElement().width / imageObject.getScaledWidth()) * renderingDpi;
	}
	console.log("image DPI = " + currentDpi);
	if (currentDpi < renderingDpi) {
		$("#imageWarning").html("The image selected is currently stretched beyond it's original resolution.  Your finished product may not print well.  Please scale your image down, or replace it with a higher resolution image");
		imageObject.set({
			transparentCorners: false,
			borderColor: "red",
			cornerColor: "#ff0000",
			borderScaleFactor: 6,
			//selectionLineWidth: 10,
			cornerSize: 12,
			selectionBackgroundColor: "transparent", //'rgba(207, 247, 213,0.5)',
			borderDashArray: [20, 10],
		});
	} else {
		$("#imageWarning").html("");
		imageObject.set({
			transparentCorners: false,
			borderColor: "black",
			cornerColor: "#ff0000",
			borderScaleFactor: 1,
			//selectionLineWidth: 2,
			cornerSize: 12,
			selectionBackgroundColor: "transparent", //'rgba(207, 247, 213,0.5)',
			borderDashArray: null,
		});
	}
}

function updateShapeControls(shapeObject) {
	/**TienDao changed */
	/**if (simpleMode === true) {
	  return;
	}*/
	var shpHeight = document.getElementById("shapeHeight");
	var shpWidth = document.getElementById("shapeWidth");
	var shpX = document.getElementById("shapeX");
	var shpY = document.getElementById("shapeY");
	var strokeWeight = document.getElementById("sweight");
	var strokeColour;
	var fillColour;
	//Check if the values are null or not
	if (shpHeight == null || shpHeight == void 0 || shpWidth == null || shpWidth == void 0 || shpX == null || shpX == void 0 || shpY == null || shpY == void 0) {
		return;
	}
	if (shapeObject == void 0 || shapeObject == null || !shapeObject.sterlingType == "shape" || shapeObject.fixedImage == true) {
		shpHeight.onchange = null;
		shpWidth.onchange = null;
		shpX.onchange = null;
		shpY.onchange = null;
		shpX.value = null;
		shpY.value = null;
		shpHeight.value = null;
		shpWidth.value = null;
		return;
	}
	//RulerUnit
	var unitFactor = 1;
	if (rulerUnit == "inch") {
		unitFactor = 96;
	} else if (rulerUnit == "mm") {
		unitFactor = 96 / 25.4;
	}
	//Event handler onChange
	shpHeight.onchange = transformShapeWithControls(shapeObject);
	shpWidth.onchange = transformShapeWithControls(shapeObject);
	shpX.onchange = transformShapeWithControls(shapeObject);
	shpY.onchange = transformShapeWithControls(shapeObject);
	shpX.value = +((shapeObject.left - canvasProperties.bleedLeft) / unitFactor).toFixed(4);
	shpY.value = +((shapeObject.top - canvasProperties.bleedTop) / unitFactor).toFixed(4);
	shpHeight.value = +((shapeObject.height * shapeObject.scaleY) / unitFactor).toFixed(4);
	shpWidth.value = +((shapeObject.width * shapeObject.scaleX) / unitFactor).toFixed(4);
	strokeWeight.value = +shapeObject.strokeWidth;
}

function transformShapeWithControls(shapeObject) {
	return function(e) {
		var field = e.target.id;
		var newValue = Number(e.target.value);
		var unitFactor = 1;
		if (rulerUnit == "inch") {
			unitFactor = 96;
		} else if (rulerUnit == "mm") {
			unitFactor = 96 / 25.4;
		}
		var newValuePX = newValue * unitFactor;
		if (isNaN(newValue) || newValue == void 0 || newValue == null) {
			return;
		}
		if (field == "shapeX") {
			shapeObject.set("left", newValuePX + canvasProperties.bleedLeft);
		} else if (field == "shapeY") {
			shapeObject.set("top", newValuePX + canvasProperties.bleedTop);
		} else if (field == "shapeHeight") {
			var newScale = +(newValuePX / shapeObject.height);
			shapeObject.set("scaleY", newScale);
			shapeObject.set("scaleX", newScale);
		} else if (field == "shapeWidth") {
			var newScale = +(newValuePX / shapeObject.width);
			shapeObject.set("scaleY", newScale);
			shapeObject.set("scaleX", newScale);
		}
		shapeObject.setCoords();
		updateShapeControls(shapeObject);
		shapeObject.canvas.requestRenderAll.bind(shapeObject.canvas)();
	};
}

function addPage() {
	var indexOfNewCanvas = canvases.length;
	if (productInfo.MAXPAGES <= canvases.length && productInfo.MAXPAGES !== -1) {
		console.log("Max pages already reached! " + canvases.length + " of " + productInfo.MAXPAGES);
		return;
	}
	var newCanvas = document.createElement("canvas");
	newCanvas.height = canvasProperties.height;
	newCanvas.width = canvasProperties.width;
	newCanvas.id = "canvasPage" + indexOfNewCanvas;
	newCanvas.className = "card__face";
	document.getElementById("canvdim").appendChild(newCanvas);
	canvases.push(new fabric.Canvas("canvasPage" + indexOfNewCanvas, {
		imageSmoothingEnabled: true,
		selection: false,
		statefull: false,
		enableRetinaScaling: false,
		preserveObjectStacking: true,
		controlsAboveOverlay: true,
		page: indexOfNewCanvas,
		imageObjects: [],
		textObjects: [],
		nonPrintedObjects: {
			unnamedObjects: [],
		},
		textContainers: [],
		curvedTextObjects: [],
	}));
	//canvases[indexOfNewCanvas].imageObjects = [];
	//canvases[indexOfNewCanvas].textObjects = [];
	//canvases[indexOfNewCanvas].nonPrintedObjects = {unnamedObjects: []};
	//canvases[indexOfNewCanvas].textContainers = [];
	$("#pageSelectButtonContainer").append('<input type="radio" id="pageSelectButton' + (indexOfNewCanvas + 1) + '" name="pageSelector" value="pageSelectButton' + (indexOfNewCanvas + 1) + '" checked="" onclick="currentCanvas = selectCanvas(' + indexOfNewCanvas + ')"><label for="pageSelectButton' + (indexOfNewCanvas + 1) + '">Page ' + (indexOfNewCanvas + 1) + "</label>");
	/* var b = document.createElement("button");
	b.classList.add('mui-btn');
	b.classList.add('mui-btn--primary');
	b.innerHTML = 'Page ' + canvases.length;
	b.id = "pageSelectButton" + canvases.length;
	b.onclick=function (){
		var index = canvases.length;
					return function () {
			selectCanvas(index-1);
			}}();
	document.getElementById('pageSelectButtonContainer').appendChild(b);*/
	canvasInit(canvases[canvases.length - 1]);
	return selectCanvas(canvases.length - 1);
}

function selectCanvas(index) {
	console.log("select canvas " + index);
	var pagenumber = index + 1;
	/* $("#pageSelectButtonContainer button").removeClass("mui-btn--accent");
	$("#pageSelectButtonContainer button").addClass("mui-btn--primary");
	$("#pageSelectButton" + pagenumber).removeClass("mui-btn--primary");
	$("#pageSelectButton" + pagenumber).addClass("mui-btn--accent");*/
	$("input[name=pageSelector][value='pageSelectButton" + pagenumber + "']").prop("checked", true);
	//add marker to canvas to say what page number it is.
	for (var j = 0; j < canvases.length; j++) {
		canvases[j].page = j;
	}
	if (canvases[index] === void 0) {
		return;
	}
	if (productInfo !== void 0 && productInfo.CLIPPATHS !== void 0) {
		for (var i = 0; i < productInfo.CLIPPATHS.length; i++) {
			var clippath = productInfo.CLIPPATHS[i];
			//for (var j = 0; j < canvases.length; j++) {
			if (canvases[index] !== void 0 && clippath.PATHSTRING !== "") {
				//canvas exists
				if ((clippath.PAGESTART <= index && clippath.PAGEEND >= index) || clippath.PAGESTART === -1 || (clippath.PAGESTART <= index && clippath.PAGEEND === -1)) {
					clipCanvasToPath(canvases[index], clippath.PATHSTRING);
				}
			}
			//}
		}
	}
	canvases[index].backgroundColourStore = canvases[index].backgroundColor;
	populateTextBoxes(canvases[index]);
	if (canvases[index] === currentCanvas) {
		/*		imageObjects = currentCanvas.imageObjects;
				textObjects = currentCanvas.textObjects;
				nonPrintedObjects = currentCanvas.nonPrintedObjects;
				textContainers = currentCanvas.textContainers;*/
		return currentCanvas;
	}
	currentCanvas.discardActiveObject();
	activeLine = null;
	var zoom = currentCanvas.getZoom();
	var orgCanvas = currentCanvas.getElement().parentElement;
	orgCanvas.style.zIndex = -1;
	orgCanvas.style.display = "none";
	//currentCanvas = canvases[index];
	var newCanvas = canvases[index].getElement().parentElement;
	newCanvas.style.zIndex = 1;
	newCanvas.style.display = "";
	//imageObjects = canvases[index].imageObjects;
	//textObjects = canvases[index].textObjects;
	//nonPrintedObjects = canvases[index].nonPrintedObjects;
	//textContainers = canvases[index].textContainers;
	zoomInBy(canvases[index], zoom);
	return canvases[index];
}
/* function selectCanvasFlip(index){
	for (var i=0; i< canvases.length; i++){
		if(canvases[i] !== void 0 && canvases[i].getElement() !== void 0 && canvases[i].getElement().parentElement !== void 0){
			canvases[i].getElement().parentElement.classList.add("card__face");
		}
	}
	if(canvases[index] === void 0 ){
		return;
	}
	if(canvases[index] === canvas){
		imageObjects = canvas.imageObjects;
	  textObjects = canvas.textObjects;
	  nonPrintedObjects = canvas.nonPrintedObjects;
	  textContainers = canvas.textContainers;
		return;
	}
	canvas.discardActiveObject();
	activeLine = null;
	var zoom = canvas.getZoom();
	var visibleCanvas = canvas.getElement().parentElement;
	canvas = canvases[index];
	var newCanvas = canvas.getElement().parentElement;
	newCanvas.classList.add("card__face");
	for (var i=0; i< canvases.length; i++){
		if(canvases[i] !== void 0 && canvases[i].getElement() !== void 0 && canvases[i].getElement().parentElement !== void 0 && canvases[i].getElement().parentElement !== visibleCanvas && canvases[i].getElement().parentElement !== newCanvas){
			canvases[i].getElement().parentElement.classList.remove("card__face--front");
			canvases[i].getElement().parentElement.classList.remove("card__face--back");
			
		}
	}
	
	if(document.getElementById("canvdim").classList.contains("is-flipped")){
		//back side is showing, replace front and unflip
		newCanvas.classList.add("card__face--front");
		document.getElementById("canvdim").classList.toggle("is-flipped");
		//visibleCanvas.classList.remove("card__face--back");
	} else {
		//front side is showing, replace back and flip
		newCanvas.classList.add("card__face--back");
		document.getElementById("canvdim").classList.toggle("is-flipped");
		//visibleCanvas.classList.remove("card__face--front");
		
	}
	//newCanvas.style.zIndex = 2;
	//visibleCanvas.style.zIndex = 1;
	//visibleCanvas.style.display = 'none';
  
	//newCanvas.style.display = "";
	imageObjects = canvases[index].imageObjects;
	textObjects = canvases[index].textObjects;
	nonPrintedObjects = canvases[index].nonPrintedObjects;
	textContainers = canvases[index].textContainers;
	zoomInBy(zoom);
}
*/
function drawScreen(canvas) {
	console.log("drawScreen Called from " + Date.now()); //arguments.callee.caller.name.toString() +
	drawScreenAsync(function() {}, canvas);
}

function drawScreenAsync(callback, canvas) {
	console.log("drawScreenAsync Called from " + Date.now()); //arguments.callee.caller.name.toString() +
	//var j;
	//var img;
	//var imgElement;
	//var setscale;
	//var setscaleh;
	//var setscalew;
	for (var objCounter = 0; objCounter < canvas.getObjects().length; objCounter++) {
		canvas.getObjects()[objCounter].zIndex = canvas.getObjects()[objCounter].getZIndex();
	}
	/*	canvas.renderOnAddRemove = false;
		canvas.clear();
		canvas.renderOnAddRemove = true;
		canvas.setBackgroundColor("rgb(255,255,255)", canvas.requestRenderAll.bind(canvas));*/
	//inBounds = true;
	//var sidevar = canvasProperties.sideBorder / 2;
	//var topvar = canvasProperties.topBorder / 2;
	//TODO: fix bounding box calculation
	if (canvas.nonPrintedObjects.boundingBox !== null && typeof canvas.nonPrintedObjects.boundingBox !== "undefined" && canvas.contains(canvas.nonPrintedObjects.boundingBox)) {
		//do I need to do anything with the bounding box here?
	} else {
		canvas.nonPrintedObjects.boundingBox = new fabric.Rect({
			id: 0,
			sterlingType: "nonPrintedObject",
			fill: "",
			width: canvasProperties.width - (canvasProperties.borderLeft + canvasProperties.borderRight),
			height: canvasProperties.height - (canvasProperties.borderTop + canvasProperties.borderBottom),
			hasBorders: false,
			hasControls: false,
			lockMovementX: true,
			lockMovementY: true,
			selectable: false,
			evented: false,
			zIndex: -1,
			objectName: "boundingBox",
			strokeWidth: canvasProperties.borderWidth,
		}); //stroke: 'lightgray',
		//nonPrintedObjects.boundingBox.selectable = false;
		canvas.add(canvas.nonPrintedObjects.boundingBox);
		canvas.nonPrintedObjects.boundingBox.zIndex = canvas.nonPrintedObjects.boundingBox.getZIndex();
		centerCanvasObject(canvas, canvas.nonPrintedObjects.boundingBox);
		canvas.calcOffset();
		canvas.requestRenderAll.bind(canvas)();
	}
	// moved code for border and fixed positions to fixedsizecode.js, for reference only, needs to be implemented as a template object type.
	changeBackgroundColour(canvas);
	//Lines start here
	for (var i = canvas.textObjects.length - 1; i >= 0; i--) {
		if (canvas.textObjects[i].get("text").trim() === "" && !simpleMode) {
			//delete the element here? YES
			canvas.remove(canvas.textObjects[i]);
			canvas.textObjects.splice(i, 1);
		} else {
			canvas.textObjects[i].selectable = true;
			/*      if (designerVariationCode === "EngravedPlastic") {
			        textObjects[i].selectable = true;
			      }*/
			//textObjects[i].textDecoration = window["fontUnderline" + i];
			if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "EngravedPlastic") {
				canvas.textObjects[i].set("fill", colourStandards[textFillColour].inkColour);
			} else if (designerVariationCode === "FullColour") {
				//var ncol = incolor.indexOf(engravedColourSelector.toLowerCase());
				//var ncolstr = cmykcolor[ncol];
				//sText1.set("fill","#" + ncolstr); // Jan.22.15
				//textObjects[i].set("fill","#" + cmykcolor[incolor.indexOf(window["Colour" + i].toLowerCase())]); //Jan.22.15
			}
			if (canvas.textObjects[i].sterlingAlign === "left") {
				//textObjects[i].set("left", canvasProperties.sideMargin);
				canvas.textObjects[i].set("textAlign", "left");
			} else if (canvas.textObjects[i].sterlingAlign === "center") {
				//textObjects[i].set("left", (canvasProperties.width - textObjects[i].get("width")) / 2);
				canvas.textObjects[i].set("textAlign", "center");
			} else if (canvas.textObjects[i].sterlingAlign === "right") {
				//textObjects[i].set("left", canvasProperties.width - textObjects[i].get("width") - canvasProperties.sideMargin);
				canvas.textObjects[i].set("textAlign", "right");
			}
			//if (x1 + sText1.get("width") >= canvasProperties.width) { x1=canvasProperties.sideBorder;}
			//if (x1 <= canvasProperties.sideMargin) { x1=canvasProperties.sideMargin;}
			// if (y1 <= 0) { y1=canvasProperties.topMargin;}
			//if (y1 + sText1.get("height") >= canvasProperties.height-(canvasProperties.topMargin*2)) { y1= canvasProperties.height - sText1.get("height");}
			//textAn = "center";
			//textObjects[i].set("left",window["x" + i]);
			//textObjects[i].set("top",window["y" + i]);
			if (designerVariationCode === "EngravedPlastic") {
				canvas.textObjects[i].lockRotation = false;
				/*textObjects[i].lockScalingY = true;
				textObjects[i].lockScalingX = true;
				textObjects[i].lockMovementX = true;
				textObjects[i].lockMovementY = true;
				textObjects[i].lockUniScaling = true;
				textObjects[i].hasControls = false;*/
				canvas.textObjects[i].visible = true;
				canvas.textObjects[i].selectable = true; //was false
				canvas.textObjects[i].padding = 0;
			} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "FullColour") {
				canvas.textObjects[i].lockRotation = false;
				canvas.textObjects[i].lockScalingY = false;
				canvas.textObjects[i].lockScalingX = false;
				canvas.textObjects[i].lockUniScaling = false;
				canvas.textObjects[i].lockMovementX = false;
				canvas.textObjects[i].lockMovementY = false;
				canvas.textObjects[i].hasControls = true;
				canvas.textObjects[i].visible = true;
				canvas.textObjects[i].padding = 0; //was -2.5
			}
			//textObjects[i].set("lineHeight", 1);
			/*      if (designerVariationCode === "EngravedPlastic") {
			        canvas.calcOffset();
			      }*/
			//canvas.calcOffset();
			if (!canvas.contains(canvas.textObjects[i])) {
				canvas.add(canvas.textObjects[i]);
			}
		}
	}
	//curved Lines start here
	for (var i = canvas.curvedTextObjects.length - 1; i >= 0; i--) {
		if (canvas.curvedTextObjects[i].get("text").trim() === "") {
			//delete the element here? YES
			if (!simpleMode) {
				canvas.remove(canvas.curvedTextObjects[i]);
				canvas.curvedTextObjects.splice(i, 1);
			}
		} else {
			canvas.curvedTextObjects[i].selectable = true;
			/*      if (designerVariationCode === "EngravedPlastic") {
			        curvedTextObjects[i].selectable = true;
			      }*/
			//curvedTextObjects[i].textDecoration = window["fontUnderline" + i];
			if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "EngravedPlastic") {
				canvas.curvedTextObjects[i].set("fill", colourStandards[textFillColour].inkColour);
			} else if (designerVariationCode === "FullColour") {
				//var ncol = incolor.indexOf(engravedColourSelector.toLowerCase());
				//var ncolstr = cmykcolor[ncol];
				//sText1.set("fill","#" + ncolstr); // Jan.22.15
				//curvedTextObjects[i].set("fill","#" + cmykcolor[incolor.indexOf(window["Colour" + i].toLowerCase())]); //Jan.22.15
			}
			if (canvas.curvedTextObjects[i].sterlingAlign === "left") {
				//curvedTextObjects[i].set("left", canvasProperties.sideMargin);
				canvas.curvedTextObjects[i].set("textAlign", "left");
			} else if (canvas.curvedTextObjects[i].sterlingAlign === "center") {
				//curvedTextObjects[i].set("left", (canvasProperties.width - curvedTextObjects[i].get("width")) / 2);
				canvas.curvedTextObjects[i].set("textAlign", "center");
			} else if (canvas.curvedTextObjects[i].sterlingAlign === "right") {
				//curvedTextObjects[i].set("left", canvasProperties.width - curvedTextObjects[i].get("width") - canvasProperties.sideMargin);
				canvas.curvedTextObjects[i].set("textAlign", "right");
			}
			//if (x1 + sText1.get("width") >= canvasProperties.width) { x1=canvasProperties.sideBorder;}
			//if (x1 <= canvasProperties.sideMargin) { x1=canvasProperties.sideMargin;}
			// if (y1 <= 0) { y1=canvasProperties.topMargin;}
			//if (y1 + sText1.get("height") >= canvasProperties.height-(canvasProperties.topMargin*2)) { y1= canvasProperties.height - sText1.get("height");}
			//textAn = "center";
			//curvedTextObjects[i].set("left",window["x" + i]);
			//curvedTextObjects[i].set("top",window["y" + i]);
			if (designerVariationCode === "EngravedPlastic") {
				canvas.curvedTextObjects[i].lockRotation = false;
				/*curvedTextObjects[i].lockScalingY = true;
				curvedTextObjects[i].lockScalingX = true;
				curvedTextObjects[i].lockMovementX = true;
				curvedTextObjects[i].lockMovementY = true;
				curvedTextObjects[i].lockUniScaling = true;
				curvedTextObjects[i].hasControls = false;*/
				canvas.curvedTextObjects[i].visible = true;
				canvas.curvedTextObjects[i].selectable = true; //was false
				canvas.curvedTextObjects[i].padding = 0;
			} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "FullColour") {
				canvas.curvedTextObjects[i].lockRotation = false;
				canvas.curvedTextObjects[i].lockScalingY = false;
				canvas.curvedTextObjects[i].lockScalingX = false;
				canvas.curvedTextObjects[i].lockUniScaling = false;
				canvas.curvedTextObjects[i].lockMovementX = false;
				canvas.curvedTextObjects[i].lockMovementY = false;
				canvas.curvedTextObjects[i].hasControls = true;
				canvas.curvedTextObjects[i].visible = true;
				canvas.curvedTextObjects[i].padding = 0; //was -2.5
			}
			//curvedTextObjects[i].set("lineHeight", 1);
			/*      if (designerVariationCode === "EngravedPlastic") {
			        canvas.calcOffset();
			      }*/
			//canvas.calcOffset();
			if (!canvas.contains(canvas.curvedTextObjects[i])) {
				canvas.add(canvas.curvedTextObjects[i]);
			}
		}
	}
	//Text container Lines start here
	for (i = 0; i < canvas.textContainers.length; i++) {
		//textContainers[i].containedText.selectable = true;
		if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "EngravedPlastic") {
			canvas.textContainers[i].containedText.set("fill", colourStandards[textFillColour].inkColour);
		}
		if (canvas.textContainers[i].containedText.sterlingAlign === "left") {
			canvas.textContainers[i].containedText.set("left", canvas.textContainers[i].left);
			canvas.textContainers[i].containedText.set("textAlign", "left");
		} else if (canvas.textContainers[i].containedText.sterlingAlign === "center") {
			canvas.textContainers[i].containedText.set("left", canvas.textContainers[i].left + (canvas.textContainers[i].width - canvas.textContainers[i].containedText.get("width")) / 2);
			canvas.textContainers[i].containedText.set("textAlign", "center");
		} else if (canvas.textContainers[i].containedText.sterlingAlign === "right") {
			canvas.textContainers[i].containedText.set("left", canvas.textContainers[i].left + canvas.textContainers[i].width - canvas.textContainers[i].containedText.get("width"));
			canvas.textContainers[i].containedText.set("textAlign", "right");
		}
		//			if (designerVariationCode === "EngravedPlastic") {
		//				textContainers[i].containedText.lockRotation = true;
		//				/*textObjects[i].lockScalingY = true;
		//				textObjects[i].lockScalingX = true;
		//				textObjects[i].lockMovementX = true;
		//				textObjects[i].lockMovementY = true;
		//				textObjects[i].lockUniScaling = true;
		//				textObjects[i].hasControls = false;*/
		//				textContainers[i].containedText.visible = true;
		//				textContainers[i].containedText.selectable = true; //was false
		//				textContainers[i].containedText.padding = 0;
		//			} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "FullColour") {
		//				textContainers[i].containedText.lockRotation = false;
		//				textContainers[i].containedText.lockScalingY = false;
		//				textContainers[i].containedText.lockScalingX = false;
		//				textContainers[i].containedText.lockUniScaling = false;
		//				textContainers[i].containedText.lockMovementX = false;
		//				textContainers[i].containedText.lockMovementY = false;
		//				textContainers[i].containedText.hasControls = true;
		//				textContainers[i].containedText.visible = true;
		//				textContainers[i].containedText.padding = 0; //was -2.5
		//			}
		//			textContainers[i].containedText.set("lineHeight", 1);
		//canvas.calcOffset();
		if (!canvas.contains(canvas.textContainers[i]) && !canvas.contains(canvas.textContainers[i].containedText)) {
			canvas.add(canvas.textContainers[i]);
			canvas.add(canvas.textContainers[i].containedText);
		}
		itextChanged({
			target: canvas.textContainers[i].containedText,
		});
	}
	for (i = 0; i < canvas.imageObjects.length; i++) {
		if (typeof canvas.imageObjects[i].fabricImage !== "undefined") {
			/*			if (imageObjects[i].fabricImage.top === -51) {
							imageObjects[i].fabricImage.set("left", canvasProperties.sideMargin);
							imageObjects[i].fabricImage.set("top", canvasProperties.topMargin);
							var setscaleh = (canvasProperties.height - (canvasProperties.topMargin * 2)) / imageObjects[i].fabricImage.get("height"); // imgElement.height;
							var setscalew = (canvasProperties.width - (canvasProperties.sideMargin * 2)) / imageObjects[i].fabricImage.get("width"); //imgElement.width;
							var setscale = setscaleh;
							if (setscaleh > setscalew) {
								setscale = setscalew;
							}
							imageObjects[i].fabricImage.scale(setscale);
						}*/
			if (!canvas.contains(canvas.imageObjects[i].fabricImage)) {
				canvas.add(canvas.imageObjects[i].fabricImage);
			}
		}
	}
	if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "EngravedPlastic") {
		for (objCounter = 0; objCounter < canvas.getObjects().length; objCounter++) {
			let currentObject = canvas.getObjects()[objCounter];
			let currentColour = colourStandards[textFillColour].inkColour;
			if (currentObject.sterlingType === "shape") {
				if (currentObject.fill == null) {
					currentObject.set("fill", "transparent");
				}
				if (currentObject.stroke == null) {
					currentObject.set("stroke", "transparent");
				}
				if (currentObject.fill != "white" && currentObject.fill != "transparent" && currentObject.fill != "#fff" && currentObject.fill != "#ffffff" && currentObject.fill != "rgb(255,255,255)") {
					currentObject.set("fill", currentColour);
				}
				if (currentObject.stroke != "white" && currentObject.stroke != "transparent" && currentObject.stroke != "#fff" && currentObject.stroke != "#ffffff" && currentObject.stroke != "rgb(255,255,255)") {
					currentObject.set("stroke", currentColour);
				}
			}
		}
	}
	/*	if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
			canvas.setBackgroundColor(colourStandards[$('#canvasBackgroundColourDropdown').val().toLowerCase()].cmykColour, canvas.requestRenderAll.bind(canvas));
		}*/
	//$("#prevImage").css("margin-top", (300 - canvasProperties.height) / 2); what this do? OLD?
	//Put objects in correct order on the stack
	for (objCounter = 0; objCounter < canvas.getObjects().length; objCounter++) {
		for (var zIndexCounter = 0; zIndexCounter < canvas.getObjects().length; zIndexCounter++) {
			if (canvas.getObjects()[zIndexCounter].zIndex === objCounter) {
				canvas.getObjects()[zIndexCounter].moveTo(canvas.getObjects()[zIndexCounter].zIndex);
			}
		}
	}
	fixLayers(canvas);
	canvas.requestRenderAll.bind(canvas)();
	if (typeof callback === "function") {
		callback();
	}
}

function fitToScreen(canvas) {
	var screenHeight = $("#canvasParent").innerHeight() - 30;
	var screenWidth = $("#canvasParent").innerWidth() - 30;
	var heightRatio = screenHeight / (canvas.getHeight() / canvas.getZoom());
	var widthRatio = screenWidth / (canvas.getWidth() / canvas.getZoom());
	zoomInBy(canvas, Math.min(heightRatio, widthRatio));
	return;
	/* if (screenHeight <= screenWidth) {
		zoomInBy(heightRatio);
	} else {
		zoomInBy(widthRatio);
	}*/
}

function setCharSpacing(e) {
	console.log("setCharSpacing");
	var newValue;
	if (typeof e === "number") {
		newValue = e;
	} else {
		newValue = e.target.value;
	}
	newValue = Number(newValue);
	if (typeof activeLine !== "undefined" && activeLine !== null && (activeLine.isType("text") || activeLine.isType("i-text"))) {
		activeLine.set("charSpacing", newValue);
		itextChanged({
			target: activeLine,
		});
		activeLine.canvas.requestRenderAll.bind(activeLine.canvas)();
		$("#charSpacing").val(newValue);
	}
}

function setCurveSpacing(e) {
	console.log("setCurveSpacing");
	var newValue;
	if (typeof e === "number") {
		newValue = e;
	} else {
		newValue = e.target.value;
	}
	newValue = Number(newValue);
	if (typeof activeLine !== "undefined" && activeLine !== null && activeLine.isType("curvedText")) {
		activeLine.set("spacing", newValue);
		activeLine.canvas.requestRenderAll.bind(activeLine.canvas)();
		$("#charSpacing-curve").val(newValue);
	}
}

function toggleCurveRadius(e) {
	console.log("setCurveRadius");
	if (typeof activeLine !== "undefined" && activeLine !== null && activeLine.isType("curvedText")) {
		activeLine.set("reverse", $(e.target).is(":checked"));
		activeLine.canvas.requestRenderAll.bind(activeLine.canvas)();
	}
}

function setCurveRadius(e) {
	console.log("setCurveRadius");
	var newValue;
	if (typeof e === "number") {
		newValue = e;
	} else {
		newValue = Number(e.target.value);
	}
	if (typeof activeLine !== "undefined" && activeLine !== null && activeLine.isType("curvedText")) {
		activeLine.set("radius", newValue);
		activeLine.canvas.requestRenderAll.bind(activeLine.canvas)();
		$("#radius-curve").val(newValue);
	}
}
/*function loadPattern(url,obj) {
	if(typeof url === "string"){
    fabric.util.loadImage(url, function(img) {
      obj.set('fill', new fabric.Pattern({
        source: img,
        repeat: "repeat"
      }));
            canvas.renderAll();
    });
} else {

	      obj.set('fill', new fabric.Pattern({
        source: url.getElement().src,
        repeat: "repeat"
      }));
            canvas.renderAll();
}
  }*/
function activateTab(tabIdName) {
	try {
		var id = $("#" + tabIdName).attr("aria-labelledby").split("-")[2] - 1;
		$("#tabs").tabs("option", "active", id);
	} catch (e) {}
}

function onObjectSelected(e) {
	$("input[name=colourselector][value='text']").prop("checked", true);
	console.log("onObjectSelected");
	var activeObject = e.target;
	activeObject.saveState();
	activeObject.set({
		transparentCorners: false,
		borderColor: "black",
		cornerColor: "#ff0000",
		//borderScaleFactor: 5,
		selectionLineWidth: 2,
		cornerSize: 12,
		selectionBackgroundColor: "transparent", //'rgba(207, 247, 213,0.5)',
	});
	if (activeObject.sterlingType == "shape") {
		updateShapeControls(activeObject);
	} else {
		updateImageControls(activeObject);
	}
	if (activeObject.isType("text") || activeObject.isType("i-text")) {
		activateTab("textMenu");
		activeLine = activeObject;
		$("#textSize").val(fontSizePixToPnt(activeObject.get("fontSize")));
		$("#charSpacing").val(activeObject.get("charSpacing"));
		selectFontName(activeObject.get("fontFamily"));
		// clear bold, italic, underline, then recheck proper options
		$("#boldBtn").removeClass("pushedButton");
		$("#italicBtn").removeClass("pushedButton");
		$("#underlineBtn").removeClass("pushedButton");
		if (activeLine.get("fontWeight") === "bold") {
			$("#boldBtn").addClass("pushedButton");
		}
		if (activeLine.get("fontStyle") === "italic") {
			$("#italicBtn").addClass("pushedButton");
		}
		if (activeLine.get("underline") === true) {
			$("#underlineBtn").addClass("pushedButton");
		}
		if (designerVariationCode === "FullColour") {
			if (typeof activeLine.fill === "object") {
				//assume pattern
				//$("#textColourDropdown").val(colourStandards.white.name);
			} else {
				if (getColourByCMYK(activeObject.get("fill"))) {
					$("#customTextColour").val(rgb2hex(getColourByCMYK(activeObject.get("fill")).inkColour));
				} else {
					$("#customTextColour").val(activeObject.get("fill"));
				}
				//$("#textColourDropdown").val(getColourByCMYK(activeObject.get("fill")).name);
			}
		}
		if (activeObject.sterlingType === "fixedTextObjectSlave") {
			activeObject.selectAll();
			activeObject.enterEditing();
		}
		if (activeObject.sterlingAlign === "center") {
			$("input[name=alignRadio][value=center]").prop("checked", true);
		} else if (activeObject.sterlingAlign === "right") {
			$("input[name=alignRadio][value=right]").prop("checked", true);
		} else if (activeObject.sterlingAlign === "left") {
			$("input[name=alignRadio][value=left]").prop("checked", true);
		} else {
			activeObject.sterlingAlign = "center";
			$("input[name=alignRadio][value=center]").prop("checked", true);
		}
		//$("#textEntryBox").val(activeObject.get("text")); //got rid of text box.
	} else if (activeObject.isType("curvedText")) {
		activateTab("curvedTextMenu");
		activeLine = activeObject;
		$("#curvedTextBox").val(activeObject.get("text"));
		$("#textSize-curve").val(fontSizePixToPnt(activeObject.get("fontSize")));
		$("#charSpacing-curve").val(activeObject.get("spacing"));
		$("#radius-curve").val(activeObject.get("radius"));
		$("#radius-curve").val(activeObject.get("radius"));
		if (activeObject.get("reverse") === true) {
			$("#curveSwitchInput").prop("checked", true);
		} else {
			$("#curveSwitchInput").prop("checked", false);
		}
		selectFontName(activeObject.get("fontFamily"));
		$("#boldBtn-curve").removeClass("pushedButton");
		$("#italicBtn-curve").removeClass("pushedButton");
		$("#underlineBtn-curve").removeClass("pushedButton");
		if (activeLine.get("fontWeight") === "bold") {
			$("#boldBtn-curve").addClass("pushedButton");
		}
		if (activeLine.get("fontStyle") === "italic") {
			$("#italicBtn-curve").addClass("pushedButton");
		}
		if (activeLine.get("underline") === true) {
			$("#underlineBtn-curve").addClass("pushedButton");
		}
		if (designerVariationCode === "FullColour") {
			if (typeof activeLine.fill === "object") {
				//assume pattern
				//$("#textColourDropdown").val(colourStandards.white.name);
			} else {
				if (getColourByCMYK(activeObject.get("fill"))) {
					$("#customTextColour").val(rgb2hex(getColourByCMYK(activeObject.get("fill")).inkColour));
				} else {
					$("#customTextColour").val(activeObject.get("fill"));
				}
				//$("#textColourDropdown").val(getColourByCMYK(activeObject.get("fill")).name);
			}
		}
		if (activeObject.sterlingAlign === "center") {
			$("input[name=alignRadio][value=center]").prop("checked", true);
		} else if (activeObject.sterlingAlign === "right") {
			$("input[name=alignRadio][value=right]").prop("checked", true);
		} else if (activeObject.sterlingAlign === "left") {
			$("input[name=alignRadio][value=left]").prop("checked", true);
		} else {
			activeObject.sterlingAlign = "center";
			$("input[name=alignRadio][value=center]").prop("checked", true);
		}
		//$("#textEntryBox").val(activeObject.get("text")); //got rid of text box.
	} else if (activeObject.isType("rect") && activeObject.sterlingType === "fixedTextObjectParent") {
		if (TemplateEditMode) {
			activeLine = activeObject.containedText;
			if (designerVariationCode === "FullColour") {
				if (typeof activeLine.fill === "object") {
					//assume pattern
					//$("#textColourDropdown").val(colourStandards.white.name);
				} else {
					if (getColourByCMYK(activeLine.get("fill"))) {
						$("#customTextColour").val(rgb2hex(getColourByCMYK(activeLine.get("fill")).inkColour));
					} else {
						$("#customTextColour").val(activeLine.get("fill"));
					}
					//$("#textColourDropdown").val(getColourByCMYK(activeLine.get("fill")).name);
				}
			}
			$("#textSize").val(fontSizePixToPnt(activeLine.get("fontSize")));
			$("#charSpacing").val(activeLine.get("charSpacing"));
			selectFontName(activeLine.get("fontFamily"));
		} else {
			activateTab("textMenu");
			activeObject.canvas.setActiveObject(activeObject.containedText);
			/*	setActiveObject triggers onObjectSelected
			onObjectSelected({
							target: activeObject.containedText
						});*/
			//colourChanged(false); //moved colour selection to before textobject is added to canvas.
			itextChanged({
				target: activeObject.containedText,
			});
			//activeObject.containedText.selectAll();
			//activeObject.containedText.enterEditing();
		}
	} else if (activeObject.isType("image")) {
		imageResolutionCheck(activeObject);
		activateTab("imagesMenu");
	} else if (activeObject.isType("group")) {
		activateTab("imagesMenu");
	} else if (activeObject.sterlingType == "shape") {
		activeLine = activeObject;
		activateTab("shapesMenu");
	}
	/*else if(activeObject.isType("image") ) {
		// code to replace existing image
		//find image in array
		var imageFound = false;
		var targetImageObject = null;
		for ( i = 0; i < imageObjects.length; i++) {
			if(imageObjects[i].fabricImage === activeObject){
				imageFound = true;
				targetImageObject = imageObjects[i];
				break;
			}
		}
		if (imageFound){
activateModal('<form action="designerImageUpload.cfm" class="dropzone" id="replaceImage"><div class="fallback"><input name="file" type="file"/></div></form>');

		
		Dropzone.options.replaceImage = {
		url: "designerImageUpload.cfm",
		maxFiles: 1,
		uploadMultiple: false,
		dictDefaultMessage: "Click here or drag an image to add it to the design.  PNG files with transparent backgrounds are recommended, JPG and GIF files are acceptable.",
		accept: function (file, done) {
			done();
			activateModal("<div>Please wait while your image is processed.</div>");
		},
		maxfilesexceeded: function (file) {
			console.log("maxfilesexceeded");
			this.removeAllFiles();
			this.addFile(file);
		},
		addedfile: function () {
			if (typeof this.files[1] !== 'undefined' && this.files[1] !== null) {
				this.removeFile(this.files[0]);
			}
		},
		sending: function (file, xhr, formData) {
			formData.append("designUUID", window.designUUID);
			formData.append("width", Math.round(canvasProperties.width));
			formData.append("height", Math.round(canvasProperties.height));
			formData.append("isProstamp", canvasProperties.isProstamp);
			formData.append("displayLanguageCode", languageCode);
			formData.append("designerVariationCode", designerVariationCode);
		},
		success: function (file, response) {
			targetImageObject.imageKey = response.IMAGEKEY;
			imageFromImageKey(response.IMAGEKEY, targetImageObject.imageOptions, true, deactivateModal);
		}
	};
			
		$("#replaceImage").dropzone({ url: "designerImageUpload.cfm" });
		}
	}*/
	activeObject.setCoords();
	activeObject.canvas.requestRenderAll.bind(activeObject.canvas)();
}

function uploadWholeImage() {
	if (languageCode === "fr") {
		activateModal('<div><h1>Upload l\'image</h1><form action="designerImageUpload.cfm" class="dropzone" id="uploadWholeImage"><div class="fallback"><input name="file" type="file"/></div></form><div><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Annuler le téléchargement</button></div></div>');
	} else {
		activateModal('<div><h1>Upload your image</h1><form action="designerImageUpload.cfm" class="dropzone" id="uploadWholeImage"><div class="fallback"><input name="file" type="file"/></div></form><div><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Cancel Upload</button></div></div>');
	}
	Dropzone.options.uploadWholeImage = {
		timeout: 90000,
		url: "designerImageUpload.cfm",
		maxFiles: 1,
		maxFilesize: window.maxFilesize,
		uploadMultiple: false,
		dictDefaultMessage: dropzoneMessage,
		accept: function(file, done) {
			done();
			if (languageCode === "fr") {
				activateModal("<div><div>Veuillez patienter pendant le traitement de votre image.</div><br><br><div><span id='dropboxProgress'>0</span>% téléchargé</div><div id='dropboxError'></div><div><button class=\"mui-btn mui-btn--primary\" onclick='document.getElementById(\"foregroundImageForm\").dropzone.removeAllFiles(true);deactivateModal();'>Annuler le téléchargement</button></div></div>", true);
			} else {
				activateModal("<div><div>Please wait while your image is processed.</div><br><br><div><span id='dropboxProgress'>0</span>% uploaded</div><div id='dropboxError'></div><div><button class=\"mui-btn mui-btn--primary\" onclick='document.getElementById(\"foregroundImageForm\").dropzone.removeAllFiles(true);deactivateModal();'>Cancel Upload</button></div></div>", true);
			}
		},
		maxfilesexceeded: function(file) {
			console.log("maxfilesexceeded");
			this.removeAllFiles();
			this.addFile(file);
		},
		addedfile: function() {
			if (typeof this.files[1] !== "undefined" && this.files[1] !== null) {
				this.removeFile(this.files[0]);
			}
		},
		sending: function(file, xhr, formData) {
			var hasBleed = false;
			if (canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedBottom > 0 || canvasProperties.bleedRight > 0) {
				hasBleed = true;
			}
			formData.append("bleed", hasBleed);
			formData.append("designUUID", window.designUUID);
			if (canvasProperties.bleedBottom > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0) {
				formData.append("width", Math.floor(canvasProperties.width + (canvasProperties.bleedLeft + canvasProperties.bleedRight)));
				formData.append("height", Math.floor(canvasProperties.height + (canvasProperties.bleedBottom + canvasProperties.bleedTop)));
			} else {
				formData.append("width", Math.floor(canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight)));
				formData.append("height", Math.floor(canvasProperties.height - (canvasProperties.marginTop + canvasProperties.marginBottom)));
			}
			formData.append("isProstamp", canvasProperties.isProstamp);
			formData.append("displayLanguageCode", languageCode);
			formData.append("designerVariationCode", designerVariationCode);
			xhr.ontimeout = function() {
				if (languageCode === "fr") {
					activateModal('<div><h2>téléchargement annulé ou expiration</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
				} else {
					activateModal('<div><h2>upload canceled or timeout</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
				}
				//Execute on case of timeout only
				console.log("dropZone Timeout");
			};
		},
		success: function(file, response) {
			var width;
			var height;
			if (canvasProperties.bleedBottom > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0) {
				width = Math.floor(canvasProperties.width + (canvasProperties.bleedLeft + canvasProperties.bleedRight));
				height = Math.floor(canvasProperties.height + (canvasProperties.bleedBottom + canvasProperties.bleedTop));
			} else {
				/*formData.append("width", Math.floor(canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight)));
				formData.append("height", Math.floor(canvasProperties.height - (canvasProperties.marginTop + canvasProperties.marginBottom)));*/
				width = Math.floor(canvasProperties.width);
				height = Math.floor(canvasProperties.height);
			}
			if (response.IMAGEOPTIONS[0].FORMAT && response.IMAGEOPTIONS[0].FORMAT === "svg") {
				svgFromImageKey(currentCanvas, null, response.IMAGEKEY, 1, {
					top: response.IMAGEOPTIONS[0].TOP + canvasProperties.bleedTop + canvasProperties.marginTop,
					left: response.IMAGEOPTIONS[0].LEFT + canvasProperties.bleedLeft + canvasProperties.marginLeft,
					height: height, //response.IMAGEOPTIONS[0].HEIGHT,
					width: width, //response.IMAGEOPTIONS[0].WIDTH,
					template: response.IMAGEOPTIONS[0].TEMPLATE,
					pageNumber: response.IMAGEOPTIONS[0].PAGE,
					centerImage: true,
				}, true, deactivateModal);
			} else {
				imageFromImageKey(currentCanvas, null, response.IMAGEKEY, 1, {
					top: response.IMAGEOPTIONS[0].TOP + canvasProperties.bleedTop + canvasProperties.marginTop,
					left: response.IMAGEOPTIONS[0].LEFT + canvasProperties.bleedLeft + canvasProperties.marginLeft,
					height: height, //response.IMAGEOPTIONS[0].HEIGHT,
					width: width, //response.IMAGEOPTIONS[0].WIDTH,
					template: response.IMAGEOPTIONS[0].TEMPLATE,
					pageNumber: response.IMAGEOPTIONS[0].PAGE,
					centerImage: true,
				}, true, deactivateModal);
			}
		},
		uploadprogress: function(file, progress, bytesSent) {
			(document.getElementById("dropboxProgress") || {}).innerHTML = parseInt(progress);
			if (parseInt(progress) == 100) {
				(document.getElementById("dropboxError") || {}).innerHTML = "Image Received, Please wait while yout image is processed.";
			}
		},
		error: function(file, errorMessage) {
			if (languageCode === "fr") {
				activateModal("<div><h2>" + (errorMessage.MESSAGE || errorMessage) + '</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
			} else {
				activateModal("<div><h2>" + (errorMessage.MESSAGE || errorMessage) + '</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
			}
			//(document.getElementById("dropboxError")||{}).innerHTML = errorMessage;
		},
		canceled: function(file) {
			if (languageCode === "fr") {
				activateModal('<div><h2>téléchargement annulé ou expiration</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
			} else {
				activateModal('<div><h2>upload canceled or timeout</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
			}
			//(document.getElementById("dropboxError")||{}).innerHTML = "upload canceled or timeout";
		},
	};
	$("#uploadWholeImage").dropzone({
		url: "designerImageUpload.cfm",
	});
}

function onObjectDoubleClicked(e) {
	console.log("onObjectDoubleClicked");
	var activeObject = e.target;
	if (typeof activeObject !== "undefined" && activeObject !== null) {
		if (activeObject.isType("image")) {
			// code to replace existing image
			//find image in array
			var imageFound = false;
			var targetImageObject = null;
			for (i = 0; i < activeObject.canvas.imageObjects.length; i++) {
				if (activeObject.canvas.imageObjects[i].fabricImage === activeObject) {
					imageFound = true;
					targetImageObject = activeObject.canvas.imageObjects[i];
					break;
				}
			}
			if (imageFound) {
				if (languageCode === "fr") {
					activateModal('<div><h1>Remplacer l\'image cliquée</h1><form action="designerImageUpload.cfm" class="dropzone" id="replaceImage"><div class="fallback"><input name="file" type="file"/></div></form><div><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Annuler le téléchargement</button></div></div>');
				} else {
					activateModal('<div><h1>Replace clicked image</h1><form action="designerImageUpload.cfm" class="dropzone" id="replaceImage"><div class="fallback"><input name="file" type="file"/></div></form><div><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Cancel Upload</button></div></div>');
				}
				Dropzone.options.replaceImage = {
					timeout: 60000,
					url: "designerImageUpload.cfm",
					maxFiles: 1,
					maxFilesize: window.maxFilesize,
					uploadMultiple: false,
					dictDefaultMessage: dropzoneMessage,
					accept: function(file, done) {
						done();
						if (languageCode === "fr") {
							activateModal("<div><div>Veuillez patienter pendant le traitement de votre image.</div><br><br><div><span id='dropboxProgress'>0</span>% téléchargé</div><div id='dropboxError'></div><div><button class=\"mui-btn mui-btn--primary\" onclick='document.getElementById(\"foregroundImageForm\").dropzone.removeAllFiles(true);deactivateModal();'>Annuler le téléchargement</button></div></div>", true);
						} else {
							activateModal("<div><div>Please wait while your image is processed.</div><br><br><div><span id='dropboxProgress'>0</span>% uploaded</div><div id='dropboxError'></div><div><button class=\"mui-btn mui-btn--primary\" onclick='document.getElementById(\"foregroundImageForm\").dropzone.removeAllFiles(true);deactivateModal();'>Cancel Upload</button></div></div>", true);
						}
					},
					maxfilesexceeded: function(file) {
						console.log("maxfilesexceeded");
						this.removeAllFiles();
						this.addFile(file);
					},
					addedfile: function() {
						if (typeof this.files[1] !== "undefined" && this.files[1] !== null) {
							this.removeFile(this.files[0]);
						}
					},
					sending: function(file, xhr, formData) {
						var hasBleed = false;
						if (canvasProperties.bleedLeft > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedBottom > 0 || canvasProperties.bleedRight > 0) {
							hasBleed = true;
						}
						formData.append("bleed", hasBleed);
						formData.append("designUUID", window.designUUID);
						formData.append("width", Math.floor(canvasProperties.width));
						formData.append("height", Math.floor(canvasProperties.height));
						formData.append("isProstamp", canvasProperties.isProstamp);
						formData.append("displayLanguageCode", languageCode);
						formData.append("designerVariationCode", designerVariationCode);
						xhr.ontimeout = function() {
							if (languageCode === "fr") {
								activateModal('<div><h2>téléchargement annulé ou expiration</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
							} else {
								activateModal('<div><h2>upload canceled or timeout</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
							}
							//Execute on case of timeout only
							console.log("dropZone Timeout");
						};
					},
					success: function(file, response) {
						targetImageObject.imageKey = response.IMAGEKEY;
						if (!targetImageObject.imageOptions.maxheight || !targetImageObject.imageOptions.fixedImage) {
							/*targetImageObject.imageOptions.maxheight = targetImageObject.imageOptions.height;
							targetImageObject.imageOptions.maxwidth = targetImageObject.imageOptions.width;
							targetImageObject.imageOptions.orgtop = targetImageObject.imageOptions.top;
							targetImageObject.imageOptions.orgleft = targetImageObject.imageOptions.left;*/
							targetImageObject.imageOptions.orgtop = targetImageObject.fabricImage.get("top");
							targetImageObject.imageOptions.orgleft = targetImageObject.fabricImage.get("left");
							targetImageObject.imageOptions.maxheight = targetImageObject.fabricImage.get("height") * targetImageObject.fabricImage.get("scaleY"); //was divide, now multiply
							targetImageObject.imageOptions.maxwidth = targetImageObject.fabricImage.get("width") * targetImageObject.fabricImage.get("scaleX"); //was divide, now multiply
						}
						imageFromImageKey(activeObject.canvas, targetImageObject.fabricImage, response.IMAGEKEY, 1, targetImageObject.imageOptions, true, deactivateModal);
					},
					uploadprogress: function(file, progress, bytesSent) {
						(document.getElementById("dropboxProgress") || {}).innerHTML = parseInt(progress);
						if (parseInt(progress) == 100) {
							(document.getElementById("dropboxError") || {}).innerHTML = "Image Received, Please wait while yout image is processed.";
						}
					},
					error: function(file, errorMessage) {
						if (languageCode === "fr") {
							activateModal("<div><h2>" + (errorMessage.MESSAGE || errorMessage) + '</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
						} else {
							activateModal("<div><h2>" + (errorMessage.MESSAGE || errorMessage) + '</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
						}
						//(document.getElementById("dropboxError")||{}).innerHTML = errorMessage;
					},
					canceled: function(file) {
						if (languageCode === "fr") {
							activateModal('<div><h2>téléchargement annulé ou expiration</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Retour au concepteur</button></div></div>');
						} else {
							activateModal('<div><h2>upload canceled or timeout</h2><button class="mui-btn mui-btn--primary" onclick=\'document.getElementById("foregroundImageForm").dropzone.removeAllFiles(true);deactivateModal();\'>Close</button></div></div>');
						}
						//(document.getElementById("dropboxError")||{}).innerHTML = "upload canceled or timeout";
					},
				};
				$("#replaceImage").dropzone({
					url: "designerImageUpload.cfm",
				});
			}
		}
	}
}
/**
 * sanitizeUnicodeToAscii
 * Replaces common Unicode characters that render fine in browsers but may be
 * absent from embedded PDF fonts, substituting safe ASCII equivalents.
 *
 * Primary culprits: smart quotes, fancy dashes, non-breaking spaces/hyphens,
 * typographic ligatures, and ellipsis — all common Word/clipboard artifacts.
 */
function sanitizeUnicodeToAscii(text) {
	if (!text) return text;
	// ── Hyphens & Dashes ─────────────────────────────────────────────────────
	text = text.replace(/\u2010/g, "-") // HYPHEN (not ASCII hyphen, believe it or not)
		.replace(/\u2011/g, "-") // NON-BREAKING HYPHEN (the original culprit)
		.replace(/\u2012/g, "-") // FIGURE DASH
		.replace(/\u2013/g, "-") // EN DASH
		.replace(/\u2014/g, "--") // EM DASH
		.replace(/\u2015/g, "--") // HORIZONTAL BAR
		.replace(/\u2212/g, "-") // MINUS SIGN (math)
		.replace(/\uFE58/g, "-") // SMALL EM DASH
		.replace(/\uFE63/g, "-") // SMALL HYPHEN-MINUS
		.replace(/\uFF0D/g, "-"); // FULLWIDTH HYPHEN-MINUS
	// ── Spaces ───────────────────────────────────────────────────────────────
	text = text.replace(/\u00A0/g, " ") // NO-BREAK SPACE
		.replace(/\u00AD/g, "") // SOFT HYPHEN (invisible, just drop it)
		.replace(/\u2002/g, " ") // EN SPACE
		.replace(/\u2003/g, " ") // EM SPACE
		.replace(/\u2004/g, " ") // THREE-PER-EM SPACE
		.replace(/\u2005/g, " ") // FOUR-PER-EM SPACE
		.replace(/\u2006/g, " ") // SIX-PER-EM SPACE
		.replace(/\u2007/g, " ") // FIGURE SPACE
		.replace(/\u2008/g, " ") // PUNCTUATION SPACE
		.replace(/\u2009/g, " ") // THIN SPACE
		.replace(/\u200A/g, " ") // HAIR SPACE
		.replace(/\u202F/g, " ") // NARROW NO-BREAK SPACE
		.replace(/\u205F/g, " ") // MEDIUM MATHEMATICAL SPACE
		.replace(/\u3000/g, " ") // IDEOGRAPHIC SPACE
		.replace(/\u200B/g, "") // ZERO WIDTH SPACE (drop it)
		.replace(/\u200C/g, "") // ZERO WIDTH NON-JOINER (drop it)
		.replace(/\u200D/g, "") // ZERO WIDTH JOINER (drop it)
		.replace(/\uFEFF/g, ""); // ZERO WIDTH NO-BREAK SPACE / BOM (drop it)
	// ── Quotation Marks ──────────────────────────────────────────────────────
	text = text.replace(/[\u2018\u2019\u201B\u2032\u02BC\u02B9]/g, "'") // Various single quotes / prime
		.replace(/[\u201C\u201D\u201F\u2033\u02BA]/g, '"') // Various double quotes / double prime
		.replace(/\u201A/g, ",") // SINGLE LOW-9 QUOTATION MARK (looks like a comma)
		.replace(/\u201E/g, '"') // DOUBLE LOW-9 QUOTATION MARK
		.replace(/\u00AB/g, '"') // LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
		.replace(/\u00BB/g, '"') // RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
		.replace(/\u2039/g, "<") // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
		.replace(/\u203A/g, ">") // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
		.replace(/\u0060/g, "'"); // GRAVE ACCENT used as quote
	// ── Ellipsis & Punctuation ───────────────────────────────────────────────
	text = text.replace(/\u2026/g, "...") // HORIZONTAL ELLIPSIS
		.replace(/\u2027/g, ".") // HYPHENATION POINT
		.replace(/\u00B7/g, ".") // MIDDLE DOT
		.replace(/\u2022/g, "*") // BULLET → asterisk (reasonable stamp substitute)
		.replace(/\u2023/g, "*") // TRIANGULAR BULLET
		.replace(/\u25CF/g, "*") // BLACK CIRCLE
		.replace(/\u2044/g, "/") // FRACTION SLASH
		.replace(/\u2215/g, "/") // DIVISION SLASH
		.replace(/\uFF0F/g, "/") // FULLWIDTH SOLIDUS
		.replace(/\u00D7/g, "x") // MULTIPLICATION SIGN
		.replace(/\u00F7/g, "/") // DIVISION SIGN
		.replace(/\u2117/g, "(P)") // SOUND RECORDING COPYRIGHT
		.replace(/\u00A9/g, "(C)") // COPYRIGHT SIGN
		.replace(/\u00AE/g, "(R)") // REGISTERED SIGN
		.replace(/\u2122/g, "(TM)") // TRADE MARK SIGN
		.replace(/\u2120/g, "(SM)") // SERVICE MARK
		.replace(/\u2116/g, "No."); // NUMERO SIGN
	// ── Ligatures ────────────────────────────────────────────────────────────
	text = text.replace(/\uFB00/g, "ff") // ff ligature
		.replace(/\uFB01/g, "fi") // fi ligature
		.replace(/\uFB02/g, "fl") // fl ligature
		.replace(/\uFB03/g, "ffi") // ffi ligature
		.replace(/\uFB04/g, "ffl") // ffl ligature
		.replace(/\uFB05/g, "st") // st ligature (long s)
		.replace(/\uFB06/g, "st") // st ligature
		.replace(/\u0132/g, "IJ") // IJ ligature
		.replace(/\u0133/g, "ij") // ij ligature
		.replace(/\u00C6/g, "AE") // Æ
		.replace(/\u00E6/g, "ae") // æ
		.replace(/\u0152/g, "OE") // Œ
		.replace(/\u0153/g, "oe") // œ
		.replace(/\u00DF/g, "ss") // ß (German sharp s)
		.replace(/\u1E9E/g, "SS"); // ẞ (capital ß)
	// ── Fullwidth ASCII (Word/CJK keyboards) ─────────────────────────────────
	// U+FF01–FF5E are fullwidth versions of U+0021–007E
	text = text.replace(/[\uFF01-\uFF5E]/g, function(ch) {
		return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
	});
	return text;
}
///*------ Event Handlers
function itextChanged(e, skipBestFit) {
	var skipBestFit = skipBestFit || false;
	console.log("itextChanged");
	if (e.target === null || e.target === void 0) {
		return;
	}
	var obj = e.target;
	// ── Sanitize Unicode → ASCII before any layout logic runs ────────────────
	var rawText = obj.get("text");
	var cleanText = sanitizeUnicodeToAscii(rawText);
	if (cleanText !== rawText) {
		obj.set("text", cleanText);
		// Restore cursor position — sanitization can shift char count on
		// multi-char substitutions like ... or (TM), so just park at end.
		// If that's jarring, you can try to preserve selectionEnd instead.
		if (obj.selectionEnd !== undefined) {
			obj.selectionEnd = cleanText.length;
			obj.selectionStart = cleanText.length;
		}
	}
	obj.initDimensions();
	if (obj.sterlingType === "fixedTextObjectSlave") {
		var rectObjPadding = 0;
		var textObj = obj;
		var rectObj = textObj.textContainer;
		if (textObj.get("fontSize") <= 0) {
			textObj.set("fontSize", 999);
		}
		textObj.set("scaleX", 1);
		textObj.set("scaleY", 1);
		textObj.set("fontSize", textObj.get("fontSize") * ((rectObj.get("height") * rectObj.get("scaleY")) / (textObj.get("height") + rectObjPadding)));
		//text.text = text with no line breaks;
		if (textObj.get("width") + rectObjPadding >= rectObj.get("width") * rectObj.get("scaleX")) {
			textObj.set("scaleX", (rectObj.get("width") * rectObj.get("scaleX") - rectObjPadding) / textObj.get("width"));
		} else if (textObj.get("width") + rectObjPadding <= rectObj.get("width") * rectObj.get("scaleX") || textObj.get("height") + rectObjPadding <= rectObj.get("height") * rectObj.get("scaleY")) {
			textObj.set("fontSize", Math.min(textObj.get("fontSize") * ((rectObj.get("height") * rectObj.get("scaleY")) / (textObj.get("height") + rectObjPadding)), textObj.get("fontSize") * ((rectObj.get("width") * rectObj.get("scaleX")) / (textObj.get("width") + rectObjPadding))));
		}
		if (textObj.get("height") >= rectObj.get("height") * rectObj.get("scaleY")) {
			textObj.set("scaleY", (rectObj.get("height") * rectObj.get("scaleY")) / (textObj.get("height") + rectObjPadding));
		}
		//center in rect
		textObj.set("top", rectObj.get("top") + (rectObj.get("height") * rectObj.get("scaleY")) / 2 - textObj.get("height") / 2);
		//((textObj.getBoundingRect().height/canvas.getZoom()) / 2) -> same as textObj.getheight
		if (textObj.sterlingAlign === "left") {
			textObj.set("left", rectObj.get("left"));
			textObj.set("textAlign", "left");
		} else if (textObj.sterlingAlign === "right") {
			textObj.set("left", rectObj.left + rectObj.width * rectObj.get("scaleX") - textObj.get("width") * textObj.get("scaleX"));
			textObj.set("textAlign", "right");
		} else {
			textObj.set("left", rectObj.get("left") + (rectObj.get("width") * rectObj.get("scaleX")) / 2 - (textObj.get("width") * textObj.get("scaleX")) / 2);
			textObj.set("textAlign", "center");
		}
		obj.canvas.requestRenderAll.bind(obj.canvas)();
	} else {
		if (simpleMode) {
			var textOriginal = obj.text;
			// Remove all 3 types (PC, UNIX, iOS) of line breaks
			var textRevised = textOriginal.replace(/(\r\n|\n|\r)/gm, "");
			obj.set({
				text: textRevised,
			}); // update the iText
			if (textRevised !== textOriginal) {
				// set cursor back if text changed
				obj.moveCursorLeft(e);
			}
		}
		if (obj.sterlingAlign === "left") {
			//normal
		} else if (obj.sterlingAlign === "right") {
			if (obj._stateProperties !== void 0) {
				console.log(obj.text + ":change:" + -(obj.get("width") * obj.scaleX - obj._stateProperties.width * obj._stateProperties.scaleX));
				obj.set("left", obj._stateProperties.left - (obj.get("width") * obj.scaleX - obj._stateProperties.width * obj._stateProperties.scaleX));
				obj.set("textAlign", "right");
			}
		} else {
			//center
			if (obj._stateProperties !== void 0) {
				console.log(obj.text + ":change:" + -(obj.get("width") * obj.scaleX - obj._stateProperties.width * obj._stateProperties.scaleX) / 2);
				obj.set("left", obj._stateProperties.left - (obj.get("width") * obj.scaleX - obj._stateProperties.width * obj._stateProperties.scaleX) / 2);
				obj.set("textAlign", "center");
			}
		}
		if (obj.get("width") * obj.scaleX >= canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight) - (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 4 : 0)) {
			obj.set("left", canvasProperties.marginLeft + canvasProperties.bleedLeft + (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0));
			obj.set("scaleX", (canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight + (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 4 : 0))) / obj.get("width"));
		} else if (obj.left + obj.width * obj.scaleX > canvasProperties.width + canvasProperties.bleedLeft - canvasProperties.marginRight) {
			obj.set("left", canvasProperties.width + canvasProperties.bleedLeft - obj.get("width") * obj.scaleX - canvasProperties.marginRight);
		} else if (obj.left < canvasProperties.marginLeft + canvasProperties.bleedLeft) {
			obj.set("left", canvasProperties.marginLeft + canvasProperties.bleedLeft);
		}
		/* the below is to fit lines around images left to right.  it ignores top and bottom.
		moved to bestfit
		if(simpleMode){
			for(var i = 0; i< obj.canvas.imageObjects.length; i++){
				var currentImage = obj.canvas.imageObjects[i].fabricImage;
				var leftImageSpace = currentImage.get("left");
				var rightImageSpace = canvasProperties.width - (canvasProperties.sideMargin * 2) - (currentImage.get("left") + currentImage.get("width")*currentImage.get("scaleX"));
				if(rightImageSpace >= leftImageSpace){
					if(obj.get("left")< currentImage.get("left") + (currentImage.get("width") * currentImage.get("scaleX"))){
						obj.set("left",(currentImage.get("width") * currentImage.get("scaleX")));
					} 
					if (obj.get("width") * obj.scaleX >= rightImageSpace) {
			    
			    obj.set("scaleX", (rightImageSpace) / obj.get("width"));
		    }
				} else {
					if(obj.get("left")+(obj.get("width")*obj.get("scaleX"))< currentImage.get("left")){
						obj.set("left",canvasProperties.sideMargin);
					} 
					if (obj.get("width") * obj.scaleX >= leftImageSpace) {
			    
			    obj.set("scaleX", (leftImageSpace) / obj.get("width"));
				}
			}
			}
		}*/
		obj.setCoords();
		obj.saveState();
		textBoxChangedOnCanvas(e, skipBestFit);
	}
	//	if (obj.sterlingType === "fixedTextObjectSlavexxx") {
	//		var rectObjPadding = 1;
	//		var textObj = obj;
	//		var rectObj = textObj.textContainer;
	//		if (textObj.get("fontSize") <= 0) {
	//			textObj.set("fontSize", 999);
	//		}
	//		//text.text = text with no line breaks;
	//		if (textObj.get("width") >= rectObj.get("width") * rectObj.get("scaleX") || textObj.get("height") >= rectObj.get("height") * rectObj.get("scaleY")) {
	//			textObj.set("fontSize", Math.min(textObj.get("fontSize") * (rectObj.get("height") * rectObj.get("scaleY") / (textObj.get("height") + rectObjPadding)),
	//				textObj.get("fontSize") * (rectObj.get("width") * rectObj.get("scaleX") / (textObj.get("width") + rectObjPadding))));
	//		} else if (textObj.get("width") <= rectObj.get("width") * rectObj.get("scaleX") || textObj.get("height") <= rectObj.get("height") * rectObj.get("scaleY")) {
	//			textObj.set("fontSize", Math.min(textObj.get("fontSize") * (rectObj.get("height") * rectObj.get("scaleY") / (textObj.get("height") + rectObjPadding)),
	//				textObj.get("fontSize") * (rectObj.get("width") * rectObj.get("scaleX") / (textObj.get("width") + rectObjPadding))));
	//		}
	//		//center in rect
	//		textObj.set("top", rectObj.get("top") + (rectObj.get("height") * rectObj.get("scaleY") / 2) - (textObj.get("height") / 2));
	//		textObj.set("left", rectObj.get("left") + (rectObj.get("width") * rectObj.get("scaleX") / 2) - (textObj.get("width") / 2));
	//		canvas.requestRenderAll.bind(canvas)();
	//	}
	obj.setCoords();
	obj.saveState();
}

function itextSelectionChanged(e) {
	console.log("itextSelectionChanged");
}

function itextEditingEntered(e) {
	console.log("itextEditingEntered");
}

function itextEditingExited(e) {
	console.log("itextEditingExited");
}

function onObjectMoving(e) {
	console.log("onObjectMoving");
	var obj = e.target;
	if (obj !== obj.canvas.getActiveObject()) {
		console.log("moving non selected object");
		obj.canvas.setActiveObject(obj);
	}
	if (obj.sterlingType == "shape") {
		//TienAdded
		updateShapeControls(obj);
	} else {
		updateImageControls(obj);
	}
	// if object is too big ignore - not anymore
	/*if (obj.height * obj.scaleY > canvasProperties.height || obj.width * obj.scaleX > canvasProperties.width) {
		return;
	}
	obj.setCoords();*/
	if (snapToGrid) {
		var gridCenterH = (1 / 2) * (canvasProperties.height % grid);
		var gridCenterV = (1 / 2) * (canvasProperties.width % grid);
		if (Math.round(((obj.left - gridCenterV) / grid) * 4) % 4 == 0) {
			obj.set({
				left: Math.round((obj.left - gridCenterV) / grid) * grid + gridCenterV,
			}).setCoords();
		} else if (Math.round(((obj.left - gridCenterV + obj.width * obj.scaleX) / grid) * 4) % 4 == 0) {
			obj.set({
				left: Math.round((obj.left - gridCenterV + obj.width * obj.scaleX) / grid) * grid - obj.width * obj.scaleX + gridCenterV,
			}).setCoords();
		}
		if (Math.round(((obj.top - gridCenterH) / grid) * 4) % 4 == 0) {
			obj.set({
				top: Math.round((obj.top - gridCenterH) / grid) * grid + gridCenterH,
			}).setCoords();
		} else if (Math.round(((obj.top - gridCenterH + obj.height * obj.scaleY) / grid) * 4) % 4 == 0) {
			obj.set({
				top: Math.round((obj.top - gridCenterH + obj.height * obj.scaleY) / grid) * grid - obj.height * obj.scaleY + gridCenterH,
			}).setCoords();
		}
		// top-left  corner
		if (obj.getBoundingRect(true).left < 8 && obj.getBoundingRect(true).left > -8) {
			obj.set({
				left: Math.max(obj.left, obj.left - obj.getBoundingRect(true).left),
			});
		} else if (obj.getBoundingRect(true).left + obj.getBoundingRect(true).width - (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) < 8 && obj.getBoundingRect(true).left + obj.getBoundingRect(true).width - (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) > -8) {
			obj.set({
				left: Math.min(obj.left, canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight - obj.getBoundingRect(true).width + obj.left - obj.getBoundingRect(true).left),
			});
		}
		// bottom-right corner
		if (obj.getBoundingRect(true).top < 8 && obj.getBoundingRect(true).top > -8) {
			obj.set({
				top: Math.max(obj.top, obj.top - obj.getBoundingRect(true).top),
			});
		} else if (obj.getBoundingRect(true).top + obj.getBoundingRect(true).height - (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) < 8 && obj.getBoundingRect(true).top + obj.getBoundingRect(true).height - (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) > -8) {
			obj.set({
				top: Math.min(obj.top, canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom - obj.getBoundingRect(true).height + obj.top - obj.getBoundingRect(true).top),
			});
		}
	}
	if (obj.isType("text") || obj.isType("i-text")) {
		//activeLine = activeObject;  //would already be active from being selected.
		//obj.sterlingAlign = "";
	}
	if (obj.sterlingType !== "undefined" && obj.sterlingType === "fixedTextObjectParent") {
		itextChanged({
			target: obj.containedText,
		});
	}
}

function onObjectAdded(e) {
	console.log("onObjectAdded");
	storeState(e.target.canvas);
}

function onObjectRemoved(e) {
	console.log("onObjectAdded");
	storeState(e.target.canvas);
}

function onPathCreated(e) {
	console.log("onObjectAdded");
	storeState(e.target.canvas);
}

function onObjectModified(e) {
	console.log("onObjectModified");
	var obj = e.target;
	//maybe don't do this for modify??
	if (obj !== obj.canvas.getActiveObject()) {
		console.log("modifying non selected object");
		obj.canvas.setActiveObject(obj);
	}
	// updateImageControls(obj);
	if (obj.sterlingType == "shape") {
		updateShapeControls(obj);
	} else {
		updateImageControls(obj);
	}
	//testing code to change font size on vertical resize instead of scale.
	if (obj.isType("text") || obj.isType("i-text")) {
		var oldscaleX = obj.width * obj.scaleX;
		//was using obj.initDimensions(); after setting the scalex to 1, but I think that's unnecccessary if using setters
		obj.set({
			fontSize: Math.floor(obj.fontSize * obj.scaleY),
			scaleY: 1,
		});
		//2 steps because it uses obj.width at time of calling set, need to get width after calling set to have smooth box stretching
		obj.set({
			scaleX: oldscaleX / obj.width,
		});
		//		obj._clearCache();
		//		obj.setCoords();
		obj.canvas.requestRenderAll.bind(obj.canvas)();
		if (obj.sterlingType !== "fixedTextObjectSlave") {
			onObjectSelected(e);
		}
	} else if (obj.isType("rect") && obj.sterlingType === "fixedTextObjectParent") {
		obj.containedText.set("fontSize", Math.floor(obj.containedText.fontSize));
		//obj.containedText.initDimensions();
		obj.set("height", obj.containedText.height);
		obj.canvas.requestRenderAll.bind(obj.canvas)();
		onObjectSelected(e);
	}
	//var obj = e.target;
	/*  var boundingRect = obj.getBoundingRect(true);
	  if (boundingRect.left < 0 || boundingRect.top < 0 || boundingRect.left + boundingRect.width > canvasProperties.width || boundingRect.top + boundingRect.height > canvasProperties.height) {
	    obj.top = obj._stateProperties.top;
	    obj.left = obj._stateProperties.left;
	    obj.angle = obj._stateProperties.angle;
	    obj.scaleX = obj._stateProperties.scaleX;
	    obj.scaleY = obj._stateProperties.scaleY;
	    
	  } else {
	    obj.setCoords();

	      obj.saveState();}
	  */
	//obj.angle = Math.round(obj.angle);
	storeState(obj.canvas);
}

function onObjectRotating(e) {
	console.log("onObjectRotating");
	return;
	var obj = e.target;
	if (obj !== obj.canvas.getActiveObject()) {
		console.log("rotating non selected object");
		obj.canvas.setActiveObject(obj);
	}
	// if object is too big ignore
	if (obj.height * obj.scaleY > canvasProperties.height || obj.width * obj.scaleX > canvasProperties.width) {
		return;
	}
	obj.set({
		angle: Math.floor(obj.angle),
	});
	obj.setCoords();
	// top-left  corner
	if (obj.getBoundingRect(true).top < 0 || obj.getBoundingRect(true).left < 0 || obj.getBoundingRect(true).top + obj.getBoundingRect(true).height > canvasProperties.height || obj.getBoundingRect(true).left + obj.getBoundingRect(true).width > canvasProperties.width) {
		obj.set({
			angle: obj._stateProperties.angle,
		});
		console.log("angle clipped new: " + obj.angle + " was: " + obj._stateProperties.angle);
	}
	obj.setCoords();
	obj.saveState();
	obj.canvas.requestRenderAll.bind(obj.canvas)();
}

function onObjectScaling(e) {
	console.log("onObjectScaling");
	var obj = e.target;
	if (obj !== obj.canvas.getActiveObject()) {
		console.log("scaling non selected object");
		obj.canvas.setActiveObject(obj);
	}
	if (obj.sterlingType == "shape") {
		updateShapeControls(obj);
	} else {
		updateImageControls(obj);
	}
	// updateImageControls(obj);
	// if object is too big ignore
	/*	if (obj.height * obj.scaleY > canvasProperties.height || obj.width * obj.scaleX > canvasProperties.width) {
			if (obj.type === "rect") {
				obj.set({
					height: obj.height * obj.scaleY,
					width: obj.width * obj.scaleX,
					scaleX: 1,
					scaleY: 1
				});
			}
			obj.saveState();
			return;
		}
		obj.setCoords();
		// top-left  corner
		if (obj.getBoundingRect(true).top < 0 || obj.getBoundingRect(true).left < 0 || obj.getBoundingRect(true).top + obj.getBoundingRect(true).height > canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom || obj.getBoundingRect(true).left + obj.getBoundingRect(true).width > canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) {
			console.log("scaling hit bounds");
			obj.set({
				scaleX: obj._stateProperties.scaleX,
				scaleY: obj._stateProperties.scaleY,
				top: obj._stateProperties.top,
				left: obj._stateProperties.left,
			});
		}*/
	if (obj.type === "rect" || obj.type === "circle" || obj.type === "triangle") {
		obj.set({
			height: obj.height * obj.scaleY,
			width: obj.width * obj.scaleX,
			scaleX: 1,
			scaleY: 1,
			radius: (obj.height * obj.scaleY) / 2,
		});
	} else if (obj.type === "ellipse") {
		obj.set({
			width: obj.width * obj.scaleX,
			height: obj.height * obj.scaleY,
			scaleX: 1,
			scaleY: 1,
			rx: (obj.width * obj.scaleX) / 2,
			ry: (obj.height * obj.scaleY) / 2,
		});
	} else if (obj.type === "line") {
		obj.set({
			width: obj.width * obj.scaleX,
			scaleX: 1,
			scaleY: 1,
		});
	} else if (obj.isType("image")) {
		imageResolutionCheck(obj);
	}
	if (obj.sterlingType !== "undefined" && obj.sterlingType === "fixedTextObjectParent") {
		itextChanged({
			target: obj.containedText,
		});
	}
	obj.setCoords();
	obj.saveState();
	obj.canvas.requestRenderAll.bind(obj.canvas)();
}

function OLDonObjectScaling(e) {
	return;
	console.log("onObjectScaling");
	var obj = e.target;
	if (obj !== obj.canvas.getActiveObject()) {
		console.log("scaling non selected object");
		obj.canvas.setActiveObject(obj);
	}
	// if object is too big ignore
	if (obj.height * obj.scaleY > canvasProperties.height || obj.width * obj.scaleX > canvasProperties.width) {
		if (obj.type === "rect") {
			obj.set({
				height: obj.height * obj.scaleY,
				width: obj.width * obj.scaleX,
				scaleX: 1,
				scaleY: 1,
			});
		}
		obj.saveState();
		return;
	}
	obj.setCoords();
	// top-left  corner
	if (obj.getBoundingRect(true).top < 0 || obj.getBoundingRect(true).left < 0 || obj.getBoundingRect(true).top + obj.getBoundingRect(true).height > canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom || obj.getBoundingRect(true).left + obj.getBoundingRect(true).width > canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) {
		console.log("scaling hit bounds");
		obj.set({
			scaleX: obj._stateProperties.scaleX,
			scaleY: obj._stateProperties.scaleY,
			top: obj._stateProperties.top,
			left: obj._stateProperties.left,
		});
	}
	if (obj.type === "rect") {
		obj.set({
			height: obj.height * obj.scaleY,
			width: obj.width * obj.scaleX,
			scaleX: 1,
			scaleY: 1,
		});
	}
	if (obj.sterlingType !== "undefined" && obj.sterlingType === "fixedTextObjectParent") {
		itextChanged({
			target: obj.containedText,
		});
	}
	obj.setCoords();
	obj.saveState();
	obj.canvas.requestRenderAll.bind(obj.canvas)();
}
/* function textBoxChanged(e) {
	console.log("textBoxChanged");
	if (activeLine === null || typeof activeLine === "undefined") {
		addTextLine(e.target.value);
	}
	if (!(activeLine.isType("text") || activeLine.isType("i-text"))) {
		return;
	}
	activeLine.set("text", e.target.value);
	
	//bestFit(); TODO: change this to only bestfit this line, don't adjust other lines!!
	//textObjects[lineNumber].set("text",$("#textBox" + lineNumber).val());
	//activeLine = lineNumber;
	//$("#curLine").html(dlnvar + " " + (lineNumber + 1));
	$("#textSize").val(activeLine.get("fontSize"));
	if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
		$("#textColourDropdown").val(getColourByCMYK(activeLine.get("fill")).name);
	}
	//$("#textBX>div>input").css('background-color', 'inherit');
	//$("#textBX>#numb_" + activeLine + ">input").css('background-color', 'lightblue');
	//if (canvas.getActiveObject() === textObjects[lineNumber]) return;
	//canvas.setActiveObject(textObjects[lineNumber]);
	selectFontName(activeLine.get("fontFamily"));
	canvas.setActiveObject(activeLine);
	canvas.requestRenderAll.bind(canvas)();
} */
function textSizeChanged(e) {
	var currentActiveObject = currentCanvas.getActiveObject();
	var checkFontSizePix = fontSizePntToPix(Number(e.target.value));
	if (typeof activeLine !== "undefined" && activeLine !== null && activeLine.sterlingType !== "fixedTextObjectSlave") {
		console.log("textSizeChanged");
		//fontSize = e.target.value;
		if (isNaN(checkFontSizePix) || checkFontSizePix === "" || checkFontSizePix < 5) {
			if (activeLine.get("fontSize")) {
				checkFontSizePix = activeLine.get("fontSize");
			} else {
				checkFontSizePix = +fontSizePixToPnt($("#font-size option:first").val());
			}
		}
		activeLine.set("fontSize", checkFontSizePix);
		$("#textSize").val(fontSizePixToPnt(checkFontSizePix));
		selectFontName(activeLine.get("fontFamily"));
		itextChanged({
			target: currentActiveObject,
		});
		console.log("renderall");
		currentCanvas.requestRenderAll.bind(currentCanvas)();
		//drawScreen(canvas);
	} else if (TemplateEditMode && typeof currentActiveObject !== "undefined" && currentActiveObject !== null && currentActiveObject.sterlingType === "fixedTextObjectParent") {
		console.log("textSizeChanged " + checkFontSizePix + " pixel; " + fontSizePixToPnt(checkFontSizePix) + " point");
		if (!isNaN(checkFontSizePix) && checkFontSizePix > 0) {
			Number(checkFontSizePix);
			currentActiveObject.containedText.set("fontSize", checkFontSizePix);
			//currentActiveObject.containedText.initDimensions();
			currentActiveObject.set("height", currentActiveObject.containedText.height);
			//currentActiveObject.setCoords();
			itextChanged({
				target: currentActiveObject.containedText,
			});
		}
	}
}

function textFontChanged(canvas, activeLine) {
	if (typeof activeLine === "undefined" || activeLine === null) {
		return;
	}
	console.log("textFontChanged");
	activeLine.set("fontFamily", fontFace);
	itextChanged({
		target: activeLine,
	});
	canvas.requestRenderAll.bind(canvas)();
	//drawScreen(canvas);
}

function colourChanged(redrawScreen, customColour, canvas) {
	console.log("colourChanged: " + customColour);
	if (MenuSelectedType === "stroke") {
		activeLine.set({
			stroke: customColour
		});
	} else { //if (MenuSelectedType === "fill") 
		redrawScreen = redrawScreen || false;
		if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
			if (activeLine === null || typeof activeLine === "undefined") {
				return;
			}
			/*		if(canvas.backgroundImage !== 0 && canvas.backgroundImage != null &&  $("#textColourDropdown").val() === "white"){
			      loadPattern(canvas.backgroundImage,activeLine);
			    
			    } else {*/
			if (customColour !== null && typeof customColour !== "undefined") {
				activeLine.set("fill", customColour);
				if (customColour === "#ffffff") {
					activeLine.set("globalCompositeOperation", "destination-out");
				} else {
					activeLine.set("globalCompositeOperation", "source-over");
				}
			} else {
				activeLine.set("fill", colourStandards[$("#textColourDropdown").val()].cmykColour);
			}
			//}
			if (redrawScreen) {
				drawScreen(canvas);
			}
		} else if (designerVariationCode === "EngravedPlastic") {
			canvasProperties.materialColour = $("input[name=engravedColourSelector]:checked").val();
			textColourSelect(canvas, $("input[name=engravedColourSelector]:checked").val(), redrawScreen);
		} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
			textColourSelect(canvas, $("input[name=textFillColour]:checked").val(), redrawScreen);
		}
	}
	canvas.requestRenderAll.bind(canvas)();
	storeState(canvas);
}

function shapeColourChanged(redrawScreen, customColour, canvas) {
	console.log("shapeColourChanged");
	var currentActiveObject = canvas.getActiveObject();
	redrawScreen = redrawScreen || false;
	if (redrawScreen) {
		drawScreen(canvas);
	}
	// if (MenuSelectedType === "fill")
	if (MenuSelectedType) {
		currentActiveObject.set(MenuSelectedType, customColour);
		currentActiveObject.set({
			strokeUniform: true, // Ensure stroke width is uniform
		});
	} else {
		currentActiveObject.set("fill", customColour);
	}
	canvas.requestRenderAll.bind(canvas)();
	storeState(canvas);
}

function fontWeightChanged(canvas, activeLine) {
	console.log("fontWeightChanged");
	if (typeof activeLine === "undefined" || activeLine === null) {
		return;
	}
	if (activeLine.get("fontWeight") !== "bold") {
		activeLine.set("fontWeight", "bold");
		$("#boldBtn").addClass("pushedButton");
	} else {
		activeLine.set("fontWeight", "normal");
		$("#boldBtn").removeClass("pushedButton");
	}
	canvas.requestRenderAll.bind(canvas)();
	//drawScreen(canvas);
}

function fontStyleChanged(canvas, activeLine) {
	console.log("fontStyleChanged");
	if (typeof activeLine === "undefined" || activeLine === null) {
		return;
	}
	if (activeLine.get("fontStyle") !== "italic") {
		activeLine.set("fontStyle", "italic");
		$("#italicBtn").addClass("pushedButton");
	} else {
		activeLine.set("fontStyle", "normal");
		$("#italicBtn").removeClass("pushedButton");
	}
	canvas.requestRenderAll.bind(canvas)();
	//drawScreen(canvas);
}

function fontUnderlineChanged(canvas, activeLine) {
	console.log("fontUnderlineChanged");
	if (typeof activeLine === "undefined" || activeLine === null) {
		return;
	}
	if (activeLine.get("underline") !== true) {
		activeLine.set("underline", true);
		$("#underlineBtn").addClass("pushedButton");
	} else {
		activeLine.set("underline", false);
		$("#underlineBtn").removeClass("pushedButton");
	}
	canvas.requestRenderAll.bind(canvas)();
	//drawScreen(canvas);
}

function textAlign(canvas, direction) {
	console.log("textAlign");
	if (typeof activeLine === "undefined" || activeLine === null) {
		return;
	}
	activeLine.sterlingAlign = direction;
	if (direction === "left") {
		activeLine.set("textAlign", "left");
	} else if (direction === "center") {
		activeLine.set("textAlign", "center");
	} else if (direction === "right") {
		activeLine.set("textAlign", "right");
	}
	activeLine.setCoords();
	activeLine.saveState();
	if (activeLine.type === "curvedText") {
		canvas.requestRenderAll.bind(canvas)();
		return;
	}
	if (activeLine.sterlingType === "fixedTextObjectSlave") {
		itextChanged({
			target: activeLine,
		});
		/* if (direction === "left") {
			activeLine.textObj.set("left", rectObj.get("left"));
		} else if (direction === "right") {
			activeLine.textObj.set("left", rectObj.left + (rectObj.width * rectObj.get("scaleX")) - ((textObj.get("width") * textObj.get("scaleX"))));
		} else {
			activeLine.textObj.set("left", rectObj.get("left") + (rectObj.get("width") * rectObj.get("scaleX") / 2) - (textObj.get("width") * textObj.get("scaleX") / 2));
		}*/
	}
	if (simpleMode) {
		objectAlign(canvas, direction);
	}
	canvas.requestRenderAll.bind(canvas)();
	//drawScreen(canvas);
}

function objectAlign(canvas, direction, object, top, left, right, bottom) {
	var boxtop = top || canvasProperties.marginTop + canvasProperties.bleedTop;
	var boxleft = left || canvasProperties.marginLeft + canvasProperties.bleedLeft;
	var boxright = right || canvas.getWidth() / canvas.getZoom() - (canvasProperties.marginRight + canvasProperties.bleedRight);
	var boxbottom = bottom || canvas.getHeight() / canvas.getZoom() - (canvasProperties.marginBottom + canvasProperties.bleedBottom);
	var cuttop = top || canvasProperties.bleedTop;
	var cutleft = left || canvasProperties.bleedLeft;
	var cutright = right || canvas.getWidth() / canvas.getZoom() - canvasProperties.bleedRight;
	var cutbottom = bottom || canvas.getHeight() / canvas.getZoom() - canvasProperties.bleedBottom;
	var bleedtop = top || 0;
	var bleedleft = left || 0;
	var bleedright = right || canvas.getWidth() / canvas.getZoom();
	var bleedbottom = bottom || canvas.getHeight() / canvas.getZoom();
	console.log("objectAlign");
	if (canvas === void 0 || canvas === null) {
		return;
	}
	var canvasHeight = canvas.getHeight() / canvas.getZoom();
	var canvasWidth = canvas.getWidth() / canvas.getZoom();
	var activeObject = object || canvas.getActiveObject();
	if (activeObject === void 0 || activeObject === null) {
		return;
	}
	//var sideMargin = canvasProperties.sideMargin + canvasProperties.bleedMargin;
	//var topMargin = canvasProperties.topMargin + canvasProperties.bleedMargin;
	if (activeObject.sterlingType === "fixedTextObjectSlave" || (!TemplateEditMode && activeObject.fixedImage === true)) {
		return;
	}
	if (direction === "left") {
		if (activeObject.get("left") === bleedleft) {
			activeObject.setPositionByOrigin(new fabric.Point(boxleft, activeObject.get("top")), "left", activeObject.originY);
		} else if (activeObject.get("left") === boxleft) {
			activeObject.setPositionByOrigin(new fabric.Point(cutleft, activeObject.get("top")), "left", activeObject.originY);
		} else if (activeObject.get("left") === cutleft) {
			activeObject.setPositionByOrigin(new fabric.Point(bleedleft, activeObject.get("top")), "left", activeObject.originY);
		} else {
			activeObject.setPositionByOrigin(new fabric.Point(boxleft, activeObject.get("top")), "left", activeObject.originY);
		}
	} else if (direction === "center") {
		activeObject.setPositionByOrigin(new fabric.Point(boxleft + (boxright - boxleft) / 2, activeObject.get("top")), "center", activeObject.originY);
	} else if (direction === "right") {
		var right = activeObject.get("left") + activeObject.get("width");
		if (bleedright - right < 2) {
			activeObject.setPositionByOrigin(new fabric.Point(boxright, activeObject.get("top")), "right", activeObject.originY);
		} else if (right < boxright && Math.abs(boxright - right) < 2) {
			activeObject.setPositionByOrigin(new fabric.Point(cutright, activeObject.get("top")), "right", activeObject.originY);
		} else if (right < cutright && Math.abs(cutright - right) < 2) {
			activeObject.setPositionByOrigin(new fabric.Point(bleedright, activeObject.get("top")), "right", activeObject.originY);
		} else {
			activeObject.setPositionByOrigin(new fabric.Point(boxright, activeObject.get("top")), "right", activeObject.originY);
		}
	} else if (direction === "top") {
		if (activeObject.get("top") === bleedtop) {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), boxtop), activeObject.originX, "top");
		} else if (activeObject.get("top") === boxtop) {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), cuttop), activeObject.originX, "top");
		} else if (activeObject.get("top") === cuttop) {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), bleedtop), activeObject.originX, "top");
		} else {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), boxtop), activeObject.originX, "top");
		}
	} else if (direction === "middle") {
		activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), boxtop + (boxbottom - boxtop) / 2), activeObject.originX, "center");
	} else if (direction === "bottom") {
		var bottom = activeObject.get("top") + activeObject.get("height");
		if (bleedbottom - bottom < 2) {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), boxbottom), activeObject.originX, "bottom");
		} else if (bottom < boxbottom && Math.abs(boxbottom - bottom) < 2) {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), cutbottom), activeObject.originX, "bottom");
		} else if (bottom < cutbottom && Math.abs(cutbottom - bottom) < 2) {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), bleedbottom), activeObject.originX, "bottom");
		} else {
			activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), boxbottom), activeObject.originX, "bottom");
		}
	}
	/* before box coords
		if (direction === "left") {
		activeObject.setPositionByOrigin(new fabric.Point(sideMargin, activeObject.get("top")), 'left', 'top');
	} else if (direction === "center") {
		activeObject.setPositionByOrigin(new fabric.Point(canvasWidth / 2, activeObject.get("top")), 'center', 'top');
	} else if (direction === "right") {
		activeObject.setPositionByOrigin(new fabric.Point(canvasWidth - sideMargin, activeObject.get("top")), 'right', 'top');
	} else if (direction === "top") {
		activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), topMargin), 'left', 'top');
	} else if (direction === "middle") {
		activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), canvasHeight / 2), 'left', 'center');
	} else if (direction === "bottom") {
		activeObject.setPositionByOrigin(new fabric.Point(activeObject.get("left"), canvasHeight - topMargin), 'left', 'bottom');
	}*/
	activeObject.setCoords();
	activeObject.saveState();
	if (activeObject.sterlingType === "fixedTextObjectParent") {
		itextChanged({
			target: activeObject.containedText,
		});
	}
	if (activeObject.sterlingType == "shape") {
		updateShapeControls(activeObject);
	} else {
		updateImageControls(activeObject);
	}
	storeState(canvas);
	canvas.requestRenderAll.bind(canvas)();
}

function textColourSelect(canvas, newColour, redrawScreen, callback) {
	//todo: fix colours
	console.log("textColourSelect");
	redrawScreen = redrawScreen || false;
	if (newColour === textFillColour && !redrawScreen) {
		return;
	}
	textFillColour = newColour;
	if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		$("input[name=textFillColour]").val([newColour]);
		/*		if (!canvasProperties.greenInkAvailable) {
					document.getElementById("textFillColour_green").style.display = "none";
				}*/
		//load1();
		let stampColour = document.getElementById("shapeStampColour");
		if (stampColour != null) {
			stampColour.style.backgroundColor = colourStandards[textFillColour].inkColour;
			stampColour.setAttribute('data-color', colourStandards[textFillColour].inkColour);
			//drawScreen(canvas); no, creates a loop.
		}
		reloadAllImages(canvas, redrawScreen, callback);
	} else if (redrawScreen) {
		drawScreen(canvas);
	}
}
/*function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode("0x" + p1);
    }));
}*/
function escapeHtml(text) {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return text.replace(/[&<>"']/g, char => map[char]);
}

function addDesignToCart() {
	var i;
	console.log("addDesignToCart");
	console.log(canvases);
	// canvases.forEach(canvas => {
	//   canvas._objects.forEach(obj => {
	//       if (obj.type === 'text' || obj.type === 'i-text') {
	//           const originalText = obj.text;
	//           const safeText = escapeHtml(originalText);
	//           // Example: use for HTML output
	//           console.log("Escaped text for HTML:", safeText);
	//           // Don't assign it back to Fabric canvas unless needed
	//           // obj.text = safeText; // Only if you're reloading the canvas from HTML
	//       }
	//   });
	// });
	for (i = 0; i < canvases.length; i++) {
		canvases[i].finished = false;
	}
	// Prevent clipCanvasToPath from modifying backgroundCanvas during production.
	// backgroundCanvas is shared and gets repurposed for proof generation;
	// applying page-specific clip paths to it causes cross-contamination.
	window._productionExport = true;
	backgroundCanvas.clipPath = null;
	for (i = 0; i < canvases.length; i++) {
		console.log("addDesignToCart canvas " + i);
		currentCanvas = selectCanvas(i);
		canvases[i].discardActiveObject();
		canvases[i].requestRenderAll.bind(canvases[i])();
		drawScreenAsync(addDesignToCartAfterDraw.bind(null, canvases[i]), canvases[i]);
	}
}

function saveDesign(toggleSimple) {
	window.toggleSimple = toggleSimple || false;
	console.log("saveDesign");
	window.saveDesignFlag = true;
	addDesignToCart();
}

function addDesignToCartAfterDraw(canvas) {
	console.log("addDesignToCartAfterDraw Called " + Date.now());
	/*  var coverposition = $("#canvasPage").offset();
	  var coverImage = canvas.toDataURL();
	  $('<img id="foo" src="' + coverImage + '" style="position: absolute; top: ' + coverposition.top + 'px; left: ' + coverposition.left + 'px; width: ' + canvas.get("width") + 'px; height: ' + canvas.get("height") + 'px; background-color:purple ">').appendTo('body');*/
	//var pxwidth;
	//var pxheight;
	var j;
	var inBounds = true;
	var lineErr = false;
	//var result;
	//canvas.tmpEngravedColourSelector;
	for (j = 0; j < canvas.textObjects.length; j++) {
		if (canvas.textObjects[j].get("text").trim() !== "") {
			if (canvas.textObjects[j].isContainedWithinObject(canvas.nonPrintedObjects.boundingBox) === false) {
				inBounds = false;
			}
			if (canvas.textObjects[j].get("text").trim() === "Custom Stamp") {
				lineErr = true;
			}
		}
	}
	/* 
	TODO: fuzz check for inBounds and stock text
	 
	if (inBounds === false) {
	    if (languageCode === "fr") {
	      result = confirm("AVIS : Les éléments sur le désign peuvent être hors limite. Votre désign sera produit comme indiqué. Veuillez confirmer.");
	    } else {
	      result = confirm("NOTICE: Elements on the design may be out of bounds.  Your design will be produced as shown, please confirm.");
	    }
	    if (result === false) {
	      return;
	    }
	  }
	  if (lineErr) {
	    if (languageCode === "fr") {
	      result = confirm("AVIS : Une ligne de texte [Custom Stamp] semble être sur votre désign, se il vous plaît annuler cette fenêtre et supprimez cette ligne si elle ne fait pas partie de votre conception. Votre désign sera produit comme indiqué.");
	    } else {
	      result = confirm("NOTICE: A text line [Custom Stamp] appears to be on your design, please cancel this window and remove this line if it is not part of your design.  Your design will be produced as shown.");
	    }
	    if (result === false) {
	      return;
	    }
	  }*/
	if (languageCode === "fr") {
		activateModal("S'il vous plaît attendre pendant que nous sauvegardons votre conception.", true);
	} else {
		activateModal("Please wait while we save your design.", true);
	}
	//added removal of nonprinted objects before save proof.
	for (j = 0; j < canvas.nonPrintedObjects.unnamedObjects.length; j++) {
		//delete all unnamed nonprinted objects
		canvas.remove(canvas.nonPrintedObjects.unnamedObjects[j]);
	}
	for (j = 0; j < specialObjectNames.length; j++) {
		if ((canvasProperties.drawFullBorder && specialObjectNames[j] === "boundingBox") || specialObjectNames[j] === "dateBox" || specialObjectNames[j] === "dateText") {
			continue;
		}
		canvas.remove(canvas.nonPrintedObjects[specialObjectNames[j]]);
	}
	hideGuides(canvas);
	canvas.fullDesignSavedToJson = JSON.stringify(canvas.toDatalessJSON(sterlingFieldsToSave));
	//remove fixed text box outlines.
	for (var textContainer in canvas.textContainers) {
		canvas.remove(canvas.textContainers[textContainer]);
	}
	canvas.requestRenderAll.bind(canvas)();
	//canvas.setBackgroundColor('rgb(255,255,255)', canvas.requestRenderAll.bind(canvas));
	//TODO: should have background colour image in proof, it's removed here.
	/*	proofImageBinary = setPngDpi(canvas.toDataURL({
			multiplier: (96 / 72) / canvas.getZoom()
		}),(96 / 72));*/
	//creates image of canvas, then superimposes it on background canvas, then saves that as the proof
	fabric.Image.fromURL(canvas.toDataURL({
		multiplier: proofDpi / renderingDpi / canvas.getZoom(),
	}), function(img) {
		backgroundCanvas.setZoom(this.getZoom());
		backgroundCanvas.setWidth(this.getWidth());
		backgroundCanvas.setHeight(this.getHeight());
		backgroundCanvas.requestRenderAll.bind(backgroundCanvas)();
		img.set({
			//width: canvas.getWidth()/canvas.getZoom(),
			//height: canvas.getHeight()/canvas.getZoom(),
			scaleX: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.width, //new update
			scaleY: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.height, //new update
			originX: "left",
			originY: "top",
			left: 0,
			top: 0,
		});
		//backgroundCanvas.image
		backgroundCanvas.add(img);
		img.bringToFront();
		backgroundCanvas.renderAll();
		if (canvasProperties.width > 1000 || canvasProperties.height > 1000) {
			proofDpi = 36;
		}
		this.proofImageBinary = setPngDpi(backgroundCanvas.toDataURL({
			multiplier: proofDpi / renderingDpi / this.getZoom(),
		}), proofDpi);
		backgroundCanvas.remove(img);
		console.log("Proof image created " + Date.now());
		// Generate 1:1 proof, low res -> NO, proof image is too small.
		tmpHoldColor = window.textFillColour;
		/*	if (designerVariationCode === "FullColour") {
				//tmpEngravedColourSelector = window.engravedColourSelector; fixx
			}*/
		if (designerVariationCode === "EngravedPlastic") {
			this.tmpEngravedColourSelector = $("input[name=engravedColourSelector]:checked").val();
			$("input[name=engravedColourSelector]").val(["3"]);
			colourChanged(false, null, this);
			saveSvgForPdfProduction(this);
		} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
			$("#black_img1").off("load");
			textColourSelect(this, "black", true, saveSvgForPdfProduction.bind(null, this));
			//This messes up the colour of images, if you save a red stamp, you'll get a red image with black text......
			//TODO: fix this
		} else {
			saveSvgForPdfProduction(this);
		}
	}.bind(canvas), {
		crossOrigin: "anonymous",
	});
}

function saveSvgForPdfProduction(canvas) {
	console.log("saving svg for pdf creation");
	for (j = 0; j < canvas.nonPrintedObjects.unnamedObjects.length; j++) {
		//delete all unnamed nonprinted objects
		canvas.remove(canvas.nonPrintedObjects.unnamedObjects[j]);
	}
	for (j = 0; j < specialObjectNames.length; j++) {
		if (canvasProperties.drawFullBorder && specialObjectNames[j] === "boundingBox") {
			continue;
		}
		canvas.remove(canvas.nonPrintedObjects[specialObjectNames[j]]);
	}
	for (var textContainer in canvas.textContainers) {
		canvas.remove(canvas.textContainers[textContainer]);
	}
	canvas.includeDefaultValues = false;
	//var fullDesignSavedToJson = JSON.stringify(canvas.toDatalessJSON(['lockMovementX', 'lockMovementY', 'lockRotation', 'lockScalingX', 'lockScalingY', 'lockUniScaling', 'sterlingAlign', 'id', 'sterlingType','imageKey','zIndex'])); // moved to before the changes are done to save the production file.
	if (designerVariationCode === "EngravedPlastic") {
		canvasProperties.materialColour = canvas.tmpEngravedColourSelector;
	}
	window.canvasProperties.productNumberVariation = $("select[name=Variation]").val();
	if (window.canvasProperties.productNumberVariation === undefined) {
		window.canvasProperties.productNumberVariation = window.canvasProperties.productNumber;
	}
	canvas.calcOffset();
	canvas.renderAll.bind(canvas)();
	//if (canvas.getZoom() !== 96 / 72) {
	//zoomInBy(canvas, 96 / renderingDpi, function() {
	canvas.svgForPdfProduction = canvas.toSVG({
		width: canvas.width / canvas.getZoom(),
		height: canvas.height / canvas.getZoom(),
	}); //save svg at 96 dpi (zoom canvas to 96/72);
	SetFullSizeAndGenerateFormData(canvas);
	//});
	//} else {
	//   canvas.svgForPdfProduction = canvas.toSVG(); //save svg at 96 dpi (zoom canvas to 96/72);
	//   SetFullSizeAndGenerateFormData(canvas);
	//}
}

function SetFullSizeAndGenerateFormData(canvas) {
	console.log("SetFullSizeAndGenerateFormData Called " + Date.now());
	//zoomInBy(canvas, 1, function() {
	//console.log("Zoom to 1");
	//var svg = canvas.toSVG(); //canvas is to create production pdfs, not recreate original design, use json from fabric for that.
	/*    if (designerVariationCode === "FullColour") {
		  //Is this redundant?
		  window.canvas.requestRenderAll.bind(canvas)();
		  var scal = SCALE_FACTOR;
		  var SCALE_FACTOR = 1;
		  var objects = window.canvas.getObjects();
		  for (var i in objects) {
			var scaleX = objects[i].scaleX;
			var scaleY = objects[i].scaleY;
			var left = objects[i].left;
			var top = objects[i].top;
			var tempScaleX = scaleX * SCALE_FACTOR;
			var tempScaleY = scaleY * SCALE_FACTOR;
			var tempLeft = left * SCALE_FACTOR;
			var tempTop = top * SCALE_FACTOR;
			objects[i].scaleX = tempScaleX;
			objects[i].scaleY = tempScaleY;
			objects[i].left = tempLeft;
			objects[i].top = tempTop;
			objects[i].setCoords();
		  }
		  window.canvas.requestRenderAll.bind(canvas)();
		}*/
	if (formData === "") {
		formData = {
			saveCode: window.saveCode,
			originalTemplateKey: window.originalTemplateKey,
			/* was only used for DPI, now that's included in canvasproperties
			tablename: productGroup,*/
			saved: window.saveDesignFlag,
			toggleSimple: window.toggleSimple,
			isCircle: canvasProperties.shape,
			cproduct: window.canvasProperties.productNumber,
			canvasProperties: JSON.stringify(canvasProperties),
			designerVariationCode: designerVariationCode,
			dataChunk: window.dataChunk,
		};
		/* Things not used ever:
  pxfactor: window.pxfactor,
  ctopMargin: canvasProperties.topMargin,
  csideMargin: canvasProperties.sideMargin,
  ctopBorder: canvasProperties.topBorder,
  csideBorder: canvasProperties.sideBorder,
  maxlines: canvasProperties.maxLines,
  IncGC: canvasProperties.greenInkAvailable,
  datew: canvasProperties.daterBoxWidth,
  dateh: canvasProperties.daterBoxHeight,
  isProstamp: canvasProperties.isProstamp,
		
		
  things I don't need in root of form now:
  cwidth: canvasProperties.width,
  cheight: canvasProperties.height,
  borderFC: canvasProperties.drawFullBorder,
  textFillColour: window.tmpHoldColor,
  svg: svgForPdfProduction || canvas.toSVG(),
  json: canvas.fullDesignSavedToJson,
		proofpng: proofImageBinary,
   */
		formData.finalPartNumber = $("select[name=Variation]").val();
		if (designerVariationCode == "SingleColour" || designerVariationCode == "Grayscale") {
			var currentColourObj = getAvailableColourByName(window.tmpHoldColor);
			if (currentColourObj != null && currentColourObj.PART != "") {
				formData.finalPartNumber = currentColourObj.PART;
			}
		}
		formData.Quantity = parseInt($("input[id=quantity]").val());
		if (isNaN(formData.Quantity) || formData.Quantity < 1) {
			formData.Quantity = 1;
		}
		if (formData.Quantity > 100) {
			formData.Quantity = 100;
		}
		formData.cartId = window.cartId || -1;
		if (formData.finalPartNumber === undefined) {
			formData.finalPartNumber = window.canvasProperties.productNumber;
		}
		if (designerVariationCode === "EngravedPlastic") {
			formData.Colour = canvasProperties.materialColour;
		} else if (designerVariationCode === "FullColour") {
			formData.Colour = "white";
			if ($("select[name=Variation] :selected").text().toLocaleLowerCase().indexOf("brass") === 0) {
				formData.Colour = "brass";
			} else if ($("select[name=Variation] :selected").text().toLocaleLowerCase().indexOf("silver") === 0) {
				formData.Colour = "silver";
			}
			formData.BColour = canvas.backgroundColor; //$('#canvasBackgroundColourDropdown').val();
			//formData.thePos = window.thePos;
			formData.scal = window.scal;
		}
		formData.pages = [];
	}
	canvas.formDataForPage = {
		cwidth: canvasProperties.width,
		cheight: canvasProperties.height,
		borderFC: canvasProperties.drawFullBorder,
		textFillColour: window.tmpHoldColor,
		//svg: svgForPdfProduction || canvas.toSVG(),
		json: canvas.fullDesignSavedToJson,
		proofpng: proofImageBinary,
		BColour: canvas.backgroundColor,
	};
	var numberOfLinesOffset = 0;
	for (j = 0; j < canvas.textObjects.length; j++) {
		canvas.formDataForPage["fontStyle" + (j + 1)] = canvas.textObjects[j].get("fontStyle");
		canvas.formDataForPage["y" + (j + 1)] = canvas.textObjects[j].get("top");
		canvas.formDataForPage["x" + (j + 1)] = canvas.textObjects[j].get("left");
		canvas.formDataForPage["fontUnderline" + (j + 1)] = canvas.textObjects[j].get("underline");
		canvas.formDataForPage["fontWeight" + (j + 1)] = canvas.textObjects[j].get("fontWeight");
		canvas.formDataForPage["textAn" + (j + 1)] = canvas.textObjects[j].sterlingAlign;
		canvas.formDataForPage["fontFace" + (j + 1)] = canvas.textObjects[j].get("fontFamily");
		canvas.formDataForPage["fontSize" + (j + 1)] = canvas.textObjects[j].get("fontSize");
		canvas.formDataForPage["message" + (j + 1)] = canvas.textObjects[j].get("text");
		canvas.formDataForPage["Colour" + (j + 1)] = canvas.textObjects[j].get("fill");
		numberOfLinesOffset += 1;
	}
	for (j = 0; j < canvas.textContainers.length; j++) {
		canvas.formDataForPage["fontStyle" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("fontStyle");
		canvas.formDataForPage["y" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("top");
		canvas.formDataForPage["x" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("left");
		canvas.formDataForPage["fontUnderline" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("underline");
		canvas.formDataForPage["fontWeight" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("fontWeight");
		canvas.formDataForPage["textAn" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.sterlingAlign;
		canvas.formDataForPage["fontFace" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("fontFamily");
		canvas.formDataForPage["fontSize" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("fontSize");
		canvas.formDataForPage["message" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("text");
		canvas.formDataForPage["Colour" + (j + 1) + numberOfLinesOffset] = canvas.textContainers[j].containedText.get("fill");
	}
	canvas.formDataForPage.page = canvas.page;
	SaveFullSizeAndSubmit(canvas, canvasProperties);
	//});
}

function SaveFullSizeAndSubmit(canvas, canvasProperties) {
	console.log("SaveFullSizeAndSubmit Called " + Date.now());
	hideGuides(canvas);
	//clipCanvasToPath(canvas, canvas.clipToPathString, true);
	canvas.requestRenderAll.bind(canvas)();
	/*	for(var i=0; i<canvases.length; i++){
			canvases[i].clipTo = null;
			canvases[i].requestRenderAll.bind(canvases[i])();
		}*/
	var DPI = 300;
	if (canvasProperties.productionDpi > 0) {
		DPI = canvasProperties.productionDpi;
	}
	/*
	//Changed to just grab DPI from canvasProperties
	if (window.productGroup === "prostamp") {
		DPI = 900;
	} else if (window.productGroup === "rubberstamp" || designerVariationCode === "EngravedPlastic") {
		DPI = 450;
	} else {
		DPI = 300;
	}*/
	if (canvas.width / canvas.getZoom() > 1000 || canvas.height / canvas.getZoom() > 1000) {
		DPI = 72;
	}
	canvas.productionImage = setPngDpi(canvas.toDataURL({
		multiplier: DPI / renderingDpi / canvas.getZoom(),
	}), DPI);
	//downloadURI(formData.proofpng); testing to compare server file with browser file.
	console.log("Production image " + canvas.page + " created " + Date.now());
	canvas.finished = true;
	var allfinished = true;
	for (var i = 0; i < canvases.length; i++) {
		if (canvases[i] !== void 0 && canvases[i].finished === false) {
			allfinished = false;
			break;
		}
	}
	if (allfinished === true) {
		window._productionExport = false;
		for (var i = 0; i < canvases.length; i++) {
			if (canvases[i] !== void 0 && canvases[i].finished === true) {
				canvases[i].formDataForPage.productionImage = canvases[i].productionImage;
				canvases[i].formDataForPage.proofImage = canvases[i].proofImageBinary;
				canvases[i].formDataForPage.svgForPdfProduction = canvases[i].svgForPdfProduction;
				canvases[i].formDataForPage.fullDesignSavedToJson = canvases[i].fullDesignSavedToJson;
				formData.pages.push(canvases[i].formDataForPage);
			}
		}
		var jsondata = $.stringify(formData);
		if (window.saveDesignFlag && (saveToCartFlag == false || window.toggleSimple == true)) {
			var sendData = {
				designJSON: jsondata,
			};
			$.ajax({
				url: "designerSubmit.cfm",
				type: "POST",
				data: sendData,
				dataType: "json",
			}).done(function(data, textStatus, jqXHR) {
				console.log("design saved, page reloaded" + Date.now());
				var simplestring;
				if (window.toggleSimple) {
					simplestring = (!simpleMode).toString();
					simplestring += "&hide=true";
				} else {
					simplestring = simpleMode.toString();
				}
				window.location.href = "Designer.cfm?design=" + data.KEY + "&simple=" + simplestring + "&link=" + data.PERMALINK;
			}).fail(function(jqXHR, textStatus, errorThrown) {
				deactivateModal();
				if (languageCode === "fr") {
					activateModal("Nous sommes désolés, nous n'avons pas pu enregistrer votre conception, un rapport a été envoyé au support technique", true);
				} else {
					activateModal("We're sorry, we were unable to save your design, a report has been sent to technical support", true);
				}
				if (JL != null) {
					JL().fatalException("saveDesign Failed and locked up the app: " + jqXHR.responseText, errorThrown);
				}
			});
		} else {
			var newForm = $("<form>", {
				action: "designerSubmit.cfm",
				target: "_self",
				method: "post",
				id: "SaveDesignForm",
				css: {
					display: "none",
				},
			});
			newForm.append($("<input>", {
				name: "designJSON",
				value: jsondata,
				type: "hidden",
			}));
			newForm.append($("<input>", {
				name: "submitTheForm",
				value: "Saving Design",
				type: "submit",
				id: "SubmitDesignButton",
			}));
			console.log("design added to cart Called " + Date.now());
			newForm.appendTo("body").submit(); //forms need a submit button, need to be attached to the body, and need to have the submit button NOT named/id'd "submit"
		}
	}
}

function getQueryVariable(variable) {
	var query = window.location.search.substring(1);
	var vars = query.split("&");
	for (var i = 0; i < vars.length; i++) {
		var pair = vars[i].split("=");
		if (pair[0] === variable) {
			return pair[1];
		}
	}
	return false;
}

function reloadAllImages(canvas, redraw, callback) {
	//override and load all images.
	console.log("Request reload all images, redraw " + redraw + ", callback " + (typeof callback === "function" ? callback.name || "IE can't get function names" : "false").toString() + " " + Date.now());
	if (canvas.imageObjects.length === 0) {
		if (redraw) {
			console.log("No Images redraw called " + Date.now());
			drawScreenAsync(function() {
				if (typeof callback === "function") {
					callback();
				}
			}, canvas);
		} else {
			console.log("No Images redraw false " + Date.now());
			if (typeof callback === "function") {
				callback();
			}
		}
	} else {
		imageLoadEvents = [];
		if (!saveDialogOpen) {
			activateModal("Please wait while loading all images", true);
		}
		for (var i = 0; i < canvas.imageObjects.length; i++) {
			imageLoadEvents[i] = false;
		}
		for (i = 0; i < canvas.imageObjects.length; i++) {
			if (canvas.imageObjects[i].fabricImage && canvas.imageObjects[i].fabricImage.fill && canvas.imageObjects[i].fabricImage.fill !== textFillColour) {
				if (redraw === true && i === canvas.imageObjects.length - 1) {
					imageFromImageKey(canvas, canvas.imageObjects[i].fabricImage, canvas.imageObjects[i].imageKey, canvas.imageObjects[i].imageOptions.pageNumber, canvas.imageObjects[i].imageOptions, true, callback);
				} else if (redraw === true && typeof callback === "function") {
					imageFromImageKey(canvas, canvas.imageObjects[i].fabricImage, canvas.imageObjects[i].imageKey, canvas.imageObjects[i].imageOptions.pageNumber, canvas.imageObjects[i].imageOptions, true, callback);
				} else {
					imageFromImageKey(canvas, canvas.imageObjects[i].fabricImage, canvas.imageObjects[i].imageKey, canvas.imageObjects[i].imageOptions.pageNumber, canvas.imageObjects[i].imageOptions, false, callback);
				}
			}
		}
	}
	return true;
}

function zoomPlus(canvas) {
	zoomInBy(canvas, canvas.getZoom() * 1.25);
}

function zoomMinus(canvas) {
	zoomInBy(canvas, canvas.getZoom() * 0.75);
}

function zoomInBy(canvas, scaleFactor, callback) {
	var minSize = 30;
	var maxSize = 2000;
	var zoomPercent;
	console.log("zoom " + canvas.page + " called with " + scaleFactor);
	if (canvas.getZoom() === scaleFactor) {
		console.log("zoom " + canvas.page + " skipped, already " + scaleFactor);
		zoomPercent = scaleFactor * 100;
		if (zoomPercent > 30) {
			zoomPercent = Math.round(zoomPercent);
		} else {
			zoomPercent = Math.round(zoomPercent * 100) / 100;
		}
		zoomPercent += "%";
		$("#zoomPercent").html(zoomPercent);
		if (typeof callback === "function") {
			callback();
		}
		return;
	}
	/*	if (scaleFactor >= 2) {
			scaleFactor = Math.floor(scaleFactor);
		} else if (scaleFactor > 0.25) { //&& scaleFactor !== 96 / renderingDpi
			scaleFactor = Math.floor(scaleFactor * 100) / 100;
		} else if (scaleFactor <= 0.25) {
			scaleFactor = 0.25;
		}*/
	console.log("zoom:" + scaleFactor);
	var newHeight = (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) * scaleFactor;
	var newWidth = (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) * scaleFactor;
	if (newHeight < minSize) {
		scaleFactor = minSize / (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom);
		newHeight = (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) * scaleFactor;
		newWidth = (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) * scaleFactor;
	}
	if (newWidth < minSize) {
		scaleFactor = minSize / (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight);
		newHeight = (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) * scaleFactor;
		newWidth = (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) * scaleFactor;
	}
	if (newHeight > maxSize) {
		scaleFactor = maxSize / (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom);
		newHeight = (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) * scaleFactor;
		newWidth = (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) * scaleFactor;
	}
	if (newWidth > maxSize) {
		scaleFactor = maxSize / (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight);
		newHeight = (canvasProperties.height + canvasProperties.bleedTop + canvasProperties.bleedBottom) * scaleFactor;
		newWidth = (canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight) * scaleFactor;
	}
	// TOoDO limit the max canvas zoom in
	canvas.setZoom(scaleFactor);
	//canvas.setWidth(canvas.get("width") * canvas.getZoom());
	//canvas.setHeight(canvas.get("height") * canvas.getZoom());  //canvas dimensions are absolute on the page, not relative to the starting canvas
	//removed Math.round on canvas sizes
	canvas.setWidth(newWidth);
	canvas.setHeight(newHeight);
	canvas.requestRenderAll.bind(canvas)();
	backgroundCanvas.setZoom(scaleFactor);
	backgroundCanvas.setWidth(newWidth);
	backgroundCanvas.setHeight(newHeight);
	backgroundCanvas.requestRenderAll.bind(backgroundCanvas)();
	$("#designZoom").val(scaleFactor);
	$("#canvdim").height(canvas.getHeight()).width(canvas.getWidth());
	redrawRulers();
	zoomPercent = scaleFactor * 100;
	if (zoomPercent > 30) {
		zoomPercent = Math.round(zoomPercent);
	} else {
		zoomPercent = Math.round(zoomPercent * 100) / 100;
	}
	zoomPercent += "%";
	$("#zoomPercent").html(zoomPercent);
	if (typeof callback === "function") {
		callback();
		//drawScreenAsync(callback, canvas);
	}
	if (showGuides) {
		drawGuides(canvas);
	}
}

function centerCanvasObject(canvas, object, fuzz) {
	fuzz = fuzz || false;
	//TODO: do I need this, can I get rid of it?
	fitToScreen(canvas);
	if (canvas.getZoom() === 1) {
		object.center().setCoords();
	} else {
		/*var prevZoom = canvas.getZoom();
		zoomInBy(1);
		object.center();
		zoomInBy(prevZoom);*/
		//object.setPositionByOrigin(new fabric.Point((canvas.get("width") / canvas.getZoom()) / 2, (canvas.get("height") / canvas.getZoom()) / 2), 'center', 'center');
		object.setPositionByOrigin(new fabric.Point(
			(canvas.get("width") / canvas.getZoom() - canvasProperties.bleedLeft - canvasProperties.bleedRight) / 2 + canvasProperties.bleedLeft,
			(canvas.get("height") / canvas.getZoom() - canvasProperties.bleedTop - canvasProperties.bleedBottom) / 2 + canvasProperties.bleedTop), "center", "center");
		object.setCoords();
	}
	if (fuzz) {
		var heightscale = Math.random() * (canvas.get("height") / canvas.getZoom() / 2) * 0.0125;
		var widthscale = Math.random() * (canvas.get("width") / canvas.getZoom() / 2) * 0.0125;
		if (Math.random() > 0.5) {
			object.setPositionByOrigin(new fabric.Point(
				(canvas.get("width") / canvas.getZoom() - canvasProperties.bleedLeft - canvasProperties.bleedRight) / 2 + canvasProperties.bleedLeft - widthscale,
				(canvas.get("height") / canvas.getZoom() - canvasProperties.bleedTop - canvasProperties.bleedBottom) / 2 + canvasProperties.bleedTop + heightscale), "center", "center");
		} else {
			object.setPositionByOrigin(new fabric.Point(
				(canvas.get("width") / canvas.getZoom() - canvasProperties.bleedLeft - canvasProperties.bleedRight) / 2 + canvasProperties.bleedLeft + widthscale,
				(canvas.get("height") / canvas.getZoom() - canvasProperties.bleedTop - canvasProperties.bleedBottom) / 2 + canvasProperties.bleedTop - heightscale), "center", "center");
		}
		object.setCoords();
	}
	storeState(canvas);
	canvas.requestRenderAll.bind(canvas)();
}

function selectFontName(activeFont) {
	var fontSelector = document.getElementById("fontDropDown"); //.msDropDown().data("dd");
	fontSelector.selectedIndex = -1;
	fontSelector.value = activeFont;
	if (fontSelector.value !== activeFont) {
		var closestFont = activeFont.trim().toLowerCase().replace(" bold", "").replace(" roman", "").replace(" regular", "").replace(" normal", "").replace(" oblique", "").replace(" bold", "").replace(" italic", "").replace(/\s/g, "");
		for (var i = 0; i < fontSelector.options.length; i++) {
			var currentOption = fontSelector.options[i].value.trim().toLowerCase().replace(" bold", "").replace(" roman", "").replace(" regular", "").replace(" normal", "").replace(" oblique", "").replace(" bold", "").replace(" italic", "").replace(/\s/g, "");
			if (currentOption === closestFont) {
				fontSelector.selectedIndex = i;
				break;
			}
		}
		if (fontSelector.selectedIndex === -1) {
			fontSelector.selectedIndex = 0;
		}
	}
	if (currentCanvas.getActiveObject() !== null && typeof currentCanvas.getActiveObject() !== "undefined" && fontSelector.value !== currentCanvas.getActiveObject().get("fontFamily")) {
		currentCanvas.getActiveObject().set("fontFamily", fontSelector.value);
	}
}

function toggleBorder() {
	canvasProperties.drawFullBorder = canvasProperties.drawFullBorder ? false : true;
	drawScreen(currentCanvas);
}
//Actually run the thing
jQuery.extend({
	stringify: function stringify(obj) {
		if ("JSON" in window) {
			return JSON.stringify(obj);
		}
		var t = typeof obj;
		if (t !== "object" || obj === null) {
			// simple data type
			if (t === "string") {
				obj = '"' + obj + '"';
			}
			return String(obj);
		} else {
			// recurse array or object
			var n,
				v,
				json = [],
				arr = obj && obj.constructor === Array;
			for (n in obj) {
				v = obj[n];
				t = typeof v;
				if (obj.hasOwnProperty(n)) {
					if (t === "string") {
						v = '"' + v + '"';
					} else if (t === "object" && v !== null) {
						v = jQuery.stringify(v);
					}
					json.push((arr ? "" : '"' + n + '":') + String(v));
				}
			}
			return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
		}
	},
});
/*
//This breaks background images, use onobjectselected to change these or use a different object class.
fabric.Object.prototype.set({
	transparentCorners: false,
	borderColor: '#ff00ff',
	cornerColor: '#ff0000',
	borderScaleFactor: 5,
	selectionBackgroundColor: 'rgb(207, 247, 213)'
});*/
var modalEl = document.createElement("div");

function modalOpen() {
	return document.getElementsByClassName("modalEl").length == 1;
}

function activateModal(content, blocking, onclose) {
	console.log("activateModal");
	/*	if (keepOverlayOpen) {
			return;
		}*/
	blocking = defaultFor(blocking, false);
	var options = {};
	if (blocking) {
		options.keyboard = false;
		options.static = true;
	}
	if (typeof onclose === "function") {
		options.onclose = onclose;
	}
	if (document.getElementsByClassName("modalEl").length) {
		console.log("activateModal: already open");
		document.getElementsByClassName("modalEl")[0].innerHTML = content;
	} else {
		console.log("activateModal: new open");
		// initialize modal element
		modalEl.className = "modalEl";
		modalEl.innerHTML = content;
		// show modal
		mui.overlay("on", options, modalEl);
		console.log("activateModal: mui on");
	}
}

function closeSaveDialog() {
	mui.overlay("off");
	saveDialogOpen = false;
}

function deactivateModal() {
	console.log("deactivateModal");
	if (saveDialogOpen) {
		return;
	}
	if (keepOverlayOpen) {
		console.log("deactivateModal: canceled");
		keepOverlayOpen = false;
		return;
	}
	if (document.getElementById("mui-overlay") !== null) {
		mui.overlay("off");
		console.log("deactivateModal: mui off");
	}
}

function rotate(canvas, method) {
	if (!canRotate) {
		return;
	}
	method = method || "proportional";
	hideGuides(canvas);
	var currentObject;
	for (var i = 0; i < canvases.length; i++) {
		if (canvases[i].textContainers.length > 0) {
			return;
		}
		for (var j = 0; j < canvases[i].imageObjects.length; j++) {
			if (canvases[i].imageObjects[j].imageOptions.fixedImage === true) {
				return;
			}
		}
	}
	var currentHeight = canvasProperties.height + canvasProperties.bleedBottom + canvasProperties.bleedTop;
	var currentWidth = canvasProperties.width + canvasProperties.bleedLeft + canvasProperties.bleedRight;
	if (canvasProperties.angle == 90 || canvasProperties.angle == 270) {
		currentWidth = canvasProperties.width + canvasProperties.bleedBottom + canvasProperties.bleedTop;
		currentHeight = canvasProperties.height + canvasProperties.bleedLeft + canvasProperties.bleedRight;
	}
	canvasProperties.angle += 90;
	if (canvasProperties.angle === 360) {
		canvasProperties.angle = 0;
	}
	if (canvas.getHeight() === canvas.getWidth()) {
		return;
	}
	zoomInBy(canvas, 1);
	canvas.renderAll.bind(canvas)();
	var objects = [];
	objects.push.apply(objects, canvas.textObjects);
	for (var i = 0; i < canvas.imageObjects.length; i++) {
		objects.push(canvas.imageObjects[i].fabricImage);
	}
	//objects.push.apply(objects, canvas.imageObjects.fabricImage);
	canvas.discardActiveObject();
	var sel = new fabric.ActiveSelection(objects, {
		canvas: canvas,
	});
	canvas.setActiveObject(sel);
	canvas.renderAll();
	var groupWidth = sel.width + sel.left;
	var groupHeight = sel.height + sel.top;
	canvas.discardActiveObject();
	canvas.setHeight(currentWidth);
	canvas.setWidth(currentHeight);
	canvas.renderAll();
	zoomInBy(canvas, 1);
	for (i = 0; i < objects.length; i++) {
		currentObject = objects[i];
		var newRatio;
		switch (method) {
			case "shrink":
				newRatio = currentHeight / currentWidth;
				if (groupHeight > groupWidth) {
					newRatio = currentWidth / currentHeight;
				}
				currentObject.set({
					scaleX: currentObject.scaleX * newRatio,
					scaleY: currentObject.scaleY * newRatio,
					top: currentObject.top * newRatio,
					left: currentObject.left * newRatio,
				});
				break;
			default:
			case "proportional":
				newRatio = currentHeight / currentWidth;
				if (groupHeight > groupWidth) {
					newRatio = currentWidth / currentHeight;
				}
				currentObject.set({
					scaleX: (currentObject.scaleX * currentHeight) / currentWidth,
					scaleY: (currentObject.scaleY * currentWidth) / currentHeight,
					top: (currentObject.top * currentWidth) / currentHeight,
					left: (currentObject.left * currentHeight) / currentWidth,
				});
		}
		currentObject.setCoords();
	}
	//TODO: rotate things that are fixed in the design
	if (typeof canvas.backgroundImage === "object" && canvas.backgroundImage !== null) {
		canvas.backgroundImage.rotate(canvasProperties.angle);
		if (canvasProperties.angle === 90) {
			canvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "left", "bottom");
		} else if (canvasProperties.angle === 180) {
			canvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "right", "bottom");
		} else if (canvasProperties.angle === 270) {
			canvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "right", "top");
		} else {
			canvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "left", "top");
		}
	}
	backgroundCanvas.setHeight(currentWidth);
	backgroundCanvas.setWidth(currentHeight);
	if (typeof backgroundCanvas.backgroundImage === "object" && backgroundCanvas.backgroundImage !== null) {
		backgroundCanvas.backgroundImage.rotate(canvasProperties.angle);
		if (canvasProperties.angle === 90) {
			backgroundCanvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "left", "bottom");
		} else if (canvasProperties.angle === 180) {
			backgroundCanvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "right", "bottom");
		} else if (canvasProperties.angle === 270) {
			backgroundCanvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "right", "top");
		} else {
			backgroundCanvas.backgroundImage.setPositionByOrigin(new fabric.Point(0, 0), "left", "top");
		}
	}
	objects = [];
	objects.push.apply(objects, canvas.nonPrintedObjects.unnamedObjects);
	for (var property in canvas.nonPrintedObjects) {
		if (canvas.nonPrintedObjects.hasOwnProperty(property)) {
			if (canvas.contains(canvas.nonPrintedObjects[property])) {
				objects.push(canvas.nonPrintedObjects[property]);
			}
		}
	}
	for (i = 0; i < objects.length; i++) {
		currentObject = objects[i];
		var top = currentObject.top;
		var left = currentObject.left;
		currentObject.rotate(canvasProperties.angle);
		if (canvasProperties.angle === 90) {
			currentObject.setPositionByOrigin(new fabric.Point(top, left), "left", "bottom");
		} else if (canvasProperties.angle === 180) {
			currentObject.setPositionByOrigin(new fabric.Point(top, left), "right", "top");
		} else if (canvasProperties.angle === 270) {
			currentObject.setPositionByOrigin(new fabric.Point(top, left), "left", "bottom");
		} else {
			currentObject.setPositionByOrigin(new fabric.Point(top, left), "right", "top");
		}
		currentObject.setCoords();
	}
	var oldHeight = canvasProperties.height;
	var oldWidth = canvasProperties.width;
	canvasProperties.height = oldWidth;
	canvasProperties.width = oldHeight;
	backgroundCanvas.renderAll.bind(backgroundCanvas)();
	clipCanvasToPath(canvas, canvas.clipToPathString, false);
	canvas.renderAll.bind(canvas)();
	storeState(canvas);
	fitToScreen(canvas);
	if (canvasProperties.bleedMargin > 0 || canvasProperties.bleedTop > 0 || canvasProperties.bleedRight > 0 || canvasProperties.bleedLeft > 0 || canvasProperties.bleedBottom > 0) {
		drawGuides(canvas);
	}
}

function toggleTemplateEditMode() {
	var canvas;
	var j;
	var i;
	for (j = 0; j < canvases.length; j++) {
		canvases[j].discardActiveObject();
		canvases[j].requestRenderAll.bind(canvases[j])();
	}
	if (TemplateEditMode) {
		console.log("Template Edit Deactivated");
		TemplateEditMode = false;
		for (j = 0; j < canvases.length; j++) {
			canvas = canvases[j];
			for (i = 0; i < canvas.textContainers.length; i++) {
				canvas.textContainers[i].selectable = true;
				canvas.textContainers[i].set({
					lockMovementX: true,
					lockMovementY: true,
					locked: true,
				});
			}
			for (i = 0; i < canvas.imageObjects.length; i++) {
				if (canvas.imageObjects[i].fabricImage.fixedImage) {
					canvas.imageObjects[i].fabricImage.selectable = true;
				}
				canvas.imageObjects[i].fabricImage.set({
					lockMovementX: true,
					lockMovementY: true,
					locked: true,
					hasControls: false,
				});
			}
		}
	} else {
		console.log("Template Edit Activated");
		TemplateEditMode = true;
		for (j = 0; j < canvases.length; j++) {
			canvas = canvases[j];
			for (i = 0; i < canvas.textContainers.length; i++) {
				canvas.textContainers[i].selectable = true;
				canvas.textContainers[i].set({
					lockMovementX: false,
					lockMovementY: false,
					locked: false,
				});
			}
			for (i = 0; i < canvas.imageObjects.length; i++) {
				if (canvas.imageObjects[i].fabricImage.fixedImage) {
					canvas.imageObjects[i].fabricImage.selectable = true;
				}
				canvas.imageObjects[i].fabricImage.set({
					lockMovementX: false,
					lockMovementY: false,
					locked: false,
					hasControls: true,
				});
			}
		}
	}
}
/* function createPdf() {
	var zoom = canvas.getZoom();
	zoomInBy(1);
	var svg = canvas.toSVG();
	var compress = false,
		showViewport = false,
		x = 0.0,
		y = 0.0;
	var options = {
		useCSS: false,
		assumePt: true,
		width: canvas.getWidth(),
		height: canvas.getHeight()
	};
	var doc = new PDFDocument({
		compress: compress,
		size: [options.width, options.height]
	});
	if (options.useCSS) {
		let hiddenDiv = document.getElementById('hidden-div');
		hiddenDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' + svg + '</svg>';
		SVGtoPDF(doc, hiddenDiv.firstChild.firstChild, x, y, options);
	} else {
		SVGtoPDF(doc, svg, x, y, options);
	}
	let stream = doc.pipe(blobStream());
	stream.on('finish', function () {
		let blob = stream.toBlob('application/pdf');
		if (navigator.msSaveOrOpenBlob) {
			navigator.msSaveOrOpenBlob(blob, 'File.pdf');
		} else {
			document.getElementById('pdf-file').contentWindow.location.replace(URL.createObjectURL(blob));
		}
	});
	doc.end();
}
*/
function drawGuides(canvas) {
	showGuides = false;
	toggleGuides(canvas);
}

function hideGuides(canvas) {
	showGuides = true;
	toggleGuides(canvas);
}
// Extract just the first sub-path (perimeter) from an SVG path string.
// SVG paths with internal elements (e.g. fold lines) have multiple sub-paths
// starting with M commands. This returns only the first M...Z sub-path.
function getPerimeterPath(pathString) {
	if (!pathString) return pathString;
	var trimmed = pathString.trim();
	// Find the first Z/z which closes the first sub-path
	var closeIndex = trimmed.search(/[Zz]/);
	if (closeIndex === -1) return trimmed; // no Z found, return as-is
	return trimmed.substring(0, closeIndex + 1);
}

function toggleGuides(canvas) {
	if (showGuides) {
		showGuides = false;
		canvas.setOverlayImage(0, canvas.requestRenderAll.bind(canvas));
	} else {
		showGuides = true;
		var strokeWidth = 2;
		var overlayCanvas;
		canvasProperties.bleedMargin = canvasProperties.bleedMargin || 0;
		canvasProperties.bleedTop = canvasProperties.bleedTop || 0;
		canvasProperties.bleedBottom = canvasProperties.bleedBottom || 0;
		canvasProperties.bleedLeft = canvasProperties.bleedLeft || 0;
		canvasProperties.bleedRight = canvasProperties.bleedRight || 0;
		var zoomedbleedMargin = canvasProperties.bleedMargin * canvas.getZoom();
		var zoomedbleedTop = canvasProperties.bleedTop * canvas.getZoom();
		var zoomedbleedBottom = canvasProperties.bleedBottom * canvas.getZoom();
		var zoomedbleedLeft = canvasProperties.bleedLeft * canvas.getZoom();
		var zoomedbleedRight = canvasProperties.bleedRight * canvas.getZoom();
		//var zoomedTopMargin = (canvasProperties.topMargin + canvasProperties.bleedMargin) * canvas.getZoom();
		//var zoomedSideMargin = (canvasProperties.sideMargin + canvasProperties.bleedMargin) * canvas.getZoom();
		var zoomedTopMargin = (canvasProperties.marginTop + canvasProperties.bleedTop) * canvas.getZoom();
		var zoomedLeftMargin = (canvasProperties.marginLeft + canvasProperties.bleedLeft) * canvas.getZoom();
		var zoomedBottomMargin = (canvasProperties.marginBottom + canvasProperties.bleedBottom) * canvas.getZoom();
		var zoomedRightMargin = (canvasProperties.marginRight + canvasProperties.bleedRight) * canvas.getZoom();
		if (canvas.width > 300 || canvas.height > 300) {
			strokeWidth = 4;
		}
		if (canvas.width > 600 || canvas.height > 600) {
			strokeWidth = 8;
		}
		if (canvas.width > 1000 || canvas.height > 1000) {
			strokeWidth = 12;
		}
		strokeWidth = 1;
		// Single pass: find matching CLIPPATHOVERLAYS for this canvas
		var overlayPerimeterPath = null;
		var fullOverlayPath = null;
		if (productInfo !== void 0 && productInfo.CLIPPATHOVERLAYS !== void 0) {
			for (var i = 0; i < productInfo.CLIPPATHOVERLAYS.length; i++) {
				var clippath = productInfo.CLIPPATHOVERLAYS[i];
				for (var j = 0; j < canvases.length; j++) {
					if (canvases[j] !== void 0 && clippath.PATHSTRING !== "" && canvases[j] === canvas) {
						if ((clippath.PAGESTART <= j && clippath.PAGEEND >= j) || clippath.PAGESTART === -1 || (clippath.PAGESTART <= j && clippath.PAGEEND === -1)) {
							overlayPerimeterPath = getPerimeterPath(clippath.PATHSTRING);
							if (clippath.PATHSTRING.trim() !== overlayPerimeterPath) {
								fullOverlayPath = clippath.PATHSTRING;
							}
						}
					}
				}
			}
		}
		if (canvasProperties.bleedMargin !== 0 || canvasProperties.bleedTop !== 0 || canvasProperties.bleedRight !== 0 || canvasProperties.bleedLeft !== 0 || canvasProperties.bleedBottom !== 0) {
			overlayCanvas = new fabric.StaticCanvas("", {
				height: canvas.getHeight(),
				width: canvas.getWidth(),
				backgroundColor: "gray",
			});
			if (canvasProperties.shape == "circle" && canvas.getHeight() != canvas.getWidth()) {
				var designFinishedSize = new fabric.Ellipse({
					top: zoomedbleedTop,
					left: zoomedbleedLeft,
					rx: (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / 2,
					ry: (canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom)) / 2,
					fill: "black",
					selectable: false,
					stroke: "",
					globalCompositeOperation: "destination-out",
					strokeWidth: 0,
				});
				overlayCanvas.add(designFinishedSize);
				var cutlines = new fabric.Ellipse({
					top: zoomedbleedTop - strokeWidth / 2,
					left: zoomedbleedLeft - strokeWidth / 2,
					rx: (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / 2,
					ry: (canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom)) / 2,
					fill: "transparent",
					selectable: false,
					stroke: "darkred",
					strokeWidth: strokeWidth,
					strokeDashArray: [20, 20],
				});
				overlayCanvas.add(cutlines);
			} else if (canvasProperties.shape == "circle") {
				var designFinishedSize = new fabric.Circle({
					top: zoomedbleedTop,
					left: zoomedbleedLeft,
					radius: (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / 2,
					fill: "black",
					selectable: false,
					stroke: "",
					globalCompositeOperation: "destination-out",
					strokeWidth: 0,
				});
				overlayCanvas.add(designFinishedSize);
				var cutlines = new fabric.Circle({
					top: zoomedbleedTop - strokeWidth / 2,
					left: zoomedbleedLeft - strokeWidth / 2,
					radius: (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / 2,
					fill: "transparent",
					selectable: false,
					stroke: "darkred",
					strokeWidth: strokeWidth,
					strokeDashArray: [20, 20],
				});
				overlayCanvas.add(cutlines);
			} else {
				var designFinishedSize = null;
				if (overlayPerimeterPath !== null) {
					// Use the perimeter-only path for the knockout
					designFinishedSize = new fabric.Path(overlayPerimeterPath, {
						top: zoomedbleedTop,
						left: zoomedbleedLeft,
						fill: "black",
						selectable: false,
						stroke: "",
						globalCompositeOperation: "destination-out",
						strokeWidth: 0,
					});
					designFinishedSize.scaleX = (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / designFinishedSize.width;
					designFinishedSize.scaleY = (canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom)) / designFinishedSize.height;
				} else {
					designFinishedSize = new fabric.Rect({
						top: zoomedbleedTop,
						left: zoomedbleedLeft,
						width: canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight),
						height: canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom),
						fill: "black",
						selectable: false,
						stroke: "",
						globalCompositeOperation: "destination-out",
						strokeWidth: 0,
					});
				}
				overlayCanvas.add(designFinishedSize);
				// Cutlines: use perimeter path if available, otherwise default Rect
				if (overlayPerimeterPath !== null) {
					var cutlines = new fabric.Path(overlayPerimeterPath, {
						top: zoomedbleedTop - strokeWidth / 2,
						left: zoomedbleedLeft - strokeWidth / 2,
						fill: "transparent",
						selectable: false,
						stroke: "darkred",
						strokeWidth: strokeWidth,
						strokeDashArray: [20, 20],
						strokeUniform: true,
					});
					cutlines.scaleX = (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / cutlines.width;
					cutlines.scaleY = (canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom)) / cutlines.height;
					overlayCanvas.add(cutlines);
				} else {
					var cutlines = new fabric.Rect({
						top: zoomedbleedTop - strokeWidth / 2,
						left: zoomedbleedLeft - strokeWidth / 2,
						width: canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight),
						height: canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom),
						fill: "transparent",
						selectable: false,
						stroke: "darkred",
						strokeWidth: strokeWidth,
						strokeDashArray: [20, 20],
					});
					overlayCanvas.add(cutlines);
				}
			}
		} else {
			overlayCanvas = new fabric.StaticCanvas("", {
				height: canvas.getHeight(),
				width: canvas.getWidth(),
				backgroundColor: "transparent",
			});
			if (canvasProperties.shape == "circle" && canvas.getHeight() != canvas.getWidth()) {
				var designFinishedSize = new fabric.Ellipse({
					top: 0,
					left: 0,
					rx: (canvas.getWidth() - strokeWidth) / 2,
					ry: (canvas.getHeight() - strokeWidth) / 2,
					fill: "transparent",
					selectable: false,
					stroke: "black",
					strokeWidth: strokeWidth,
				});
				overlayCanvas.add(designFinishedSize);
			} else if (canvasProperties.shape == "circle") {
				var designFinishedSize = new fabric.Circle({
					top: 0,
					left: 0,
					radius: (canvas.getWidth() - strokeWidth) / 2,
					fill: "transparent",
					selectable: false,
					stroke: "black",
					strokeWidth: strokeWidth,
				});
				overlayCanvas.add(designFinishedSize);
			} else {
				if (overlayPerimeterPath !== null) {
					var designFinishedSize = new fabric.Path(overlayPerimeterPath, {
						top: 0,
						left: 0,
						fill: "transparent",
						selectable: false,
						stroke: "darkred",
						strokeWidth: strokeWidth,
						strokeDashArray: [20, 20],
						strokeUniform: true,
					});
					designFinishedSize.scaleX = (canvas.getWidth() - strokeWidth) / designFinishedSize.width;
					designFinishedSize.scaleY = (canvas.getHeight() - strokeWidth) / designFinishedSize.height;
					overlayCanvas.add(designFinishedSize);
				} else {
					var designFinishedSize = new fabric.Rect({
						top: 0,
						left: 0,
						width: canvas.getWidth() - strokeWidth,
						height: canvas.getHeight() - strokeWidth,
						fill: "transparent",
						selectable: false,
						stroke: "black",
						strokeWidth: strokeWidth,
					});
					overlayCanvas.add(designFinishedSize);
				}
			}
		}
		if (canvasProperties.topMargin > 0 || canvasProperties.sideMargin > 0 || canvasProperties.marginTop > 0 || canvasProperties.marginLeft > 0 || canvasProperties.marginRight > 0 || canvasProperties.marginBottom > 0) {
			if (canvasProperties.shape == "circle") {
				var safeoutline = new fabric.Circle({
					top: zoomedTopMargin - strokeWidth / 2,
					left: zoomedLeftMargin - strokeWidth / 2,
					radius: (canvas.getWidth() - (zoomedLeftMargin + zoomedRightMargin)) / 2,
					fill: "transparent",
					selectable: false,
					stroke: "green",
					strokeWidth: strokeWidth,
				});
				overlayCanvas.add(safeoutline);
			} else {
				var safeoutline = null;
				if (overlayPerimeterPath !== null) {
					safeoutline = new fabric.Path(overlayPerimeterPath, {
						top: zoomedTopMargin - strokeWidth / 2,
						left: zoomedLeftMargin - strokeWidth / 2,
						fill: "transparent",
						selectable: false,
						stroke: "green",
						strokeWidth: strokeWidth,
						strokeUniform: true,
					});
					safeoutline.scaleX = (canvas.getWidth() - (zoomedLeftMargin + zoomedRightMargin)) / safeoutline.width;
					safeoutline.scaleY = (canvas.getHeight() - (zoomedBottomMargin + zoomedTopMargin)) / safeoutline.height;
				} else {
					safeoutline = new fabric.Rect({
						top: zoomedTopMargin - strokeWidth / 2,
						left: zoomedLeftMargin - strokeWidth / 2,
						width: canvas.getWidth() - (zoomedLeftMargin + zoomedRightMargin),
						height: canvas.getHeight() - (zoomedBottomMargin + zoomedTopMargin),
						fill: "transparent",
						selectable: false,
						stroke: "green",
						strokeWidth: strokeWidth,
					});
				}
				overlayCanvas.add(safeoutline);
			}
		}
		// If there are internal elements (fold lines, etc.) beyond the perimeter,
		// draw the full path as a gray overlay scaled to the cutline area
		if (fullOverlayPath) {
			var internalOverlay = new fabric.Path(fullOverlayPath, {
				top: zoomedbleedTop,
				left: zoomedbleedLeft,
				fill: "transparent",
				selectable: false,
				stroke: "gray",
				strokeWidth: strokeWidth,
				strokeUniform: true,
			});
			internalOverlay.scaleX = (canvas.getWidth() - (zoomedbleedLeft + zoomedbleedRight)) / internalOverlay.width;
			internalOverlay.scaleY = (canvas.getHeight() - (zoomedbleedTop + zoomedbleedBottom)) / internalOverlay.height;
			overlayCanvas.add(internalOverlay);
		}
		var overlayImgURL = overlayCanvas.toDataURL({});
		overlayCanvas.dispose();
		canvas.setOverlayImage(overlayImgURL, function(img) {
			console.log("canvas: " + canvas.getHeight() + "," + canvas.getWidth() + " img: " + img.height + "," + img.width + ", zoom: " + canvas.getZoom() + " scaleX: " + canvas.getWidth() / canvas.getZoom() / img.width + ", scaleY: " + canvas.getHeight() / canvas.getZoom() / img.height);
			canvas.overlayImage.set({
				//width: canvas.getWidth()/canvas.getZoom(),
				//height: canvas.getHeight()/canvas.getZoom(),
				scaleX: canvas.getWidth() / canvas.getZoom() / img.width, //new update
				scaleY: canvas.getHeight() / canvas.getZoom() / img.height, //new update
				originX: "left",
				originY: "top",
				left: 0,
				top: 0,
				opacity: 0.75,
			});
			console.log("Setting overlay image of canvas " + Date.now());
			canvas.requestRenderAll.bind(canvas)();
		});
	}
}
//TODO: make this better, assumes #xxyyzz colour format, add a utility that will convert any colour to this format, then change opacity
var metalFullColourOpacity = 0.6;

function addOpacity(canvas) {
	/*var newColour;
	var oldColour = canvas.backgroundColor;
	if(oldColour.substring(0,1) === "#" ){
		newColour = hexToRGB(oldColour);
	} else if (oldColour.substring(0,4) === "rgb("){
		oldColour = oldColour.replace(/[rgb() ]/gi, '');
		newColour = "rgba(" + oldColour + ",1)";
	}
	//assert colour is rgba here
	var opacity = newColour.replace(/[rgb() ]/gi, '').split(",")[3];
	canvas.oldBackgroundOpacity = opacity;
	if(opacity > metalFullColourOpacity){
		canvas.setBackgroundColor(newColour.replace((opacity + ")"), ((opacity-metalFullColourOpacity)+")")), canvas.requestRenderAll.bind(canvas));	
	}
  canvas.getObjects().forEach(function(obj){
		if(!obj.oldOpacity & obj.opacity > metalFullColourOpacity){

			obj.oldOpacity = obj.opacity;
			obj.opacity = obj.opacity - metalFullColourOpacity;
		}
	});
	*/
	canvas.lowerCanvasEl.style.opacity = metalFullColourOpacity;
}

function removeEvents(canvas) {
	canvas.isDrawingMode = false;
	canvas.selection = false;
	canvas.off("mouse:down");
	canvas.off("mouse:up");
	canvas.off("mouse:move");
	// canvas.on("mouse:dblclick", addEvents(canvas));
}

function changeObjectSelection(canvas, value) {
	canvas.forEachObject(function(obj) {
		obj.selectable = value;
	});
	canvas.renderAll();
}

function closeEvents(canvas) {
	// //zoomInBy(96 / 72);  //changed to zoom to screen size
	// canvas.on("object:scaling", onObjectScaling);
	// canvas.on("object:moving", onObjectMoving);
	// canvas.on("object:modified", onObjectModified);
	// canvas.on("object:added", onObjectAdded);
	// canvas.on("object:removed", onObjectRemoved);
	// canvas.on("path:created", onPathCreated);
	// //canvas.on("object:selected", onObjectSelected); //deprecated in v2.0.0
	// canvas.on("selection:created", onObjectSelected);
	// canvas.on("selection:updated", onObjectSelected);
	// canvas.on("object:rotating", onObjectRotating);
	// canvas.on("mouse:dblclick", onObjectDoubleClicked);
	// canvas.on("text:changed", itextChanged);
	// canvas.on("text:selection:changed", itextSelectionChanged);
	// canvas.on("text:editing:entered", itextEditingEntered);
	// canvas.on("text:editing:exited", itextEditingExited);
	removeEvents(canvas);
	// canvas.isDrawingMode = true;
	canvas.selection = true;
	changeObjectSelection(canvas, false);
	// canvas.discardActiveObject();
	canvas.renderAll();
	// instance.pause();
}

function escTemp(canvas) {
	// canvas.isDrawingMode = false;
	// canvas.selection = true;
	closeEvents(canvas);
}

function onClickShape(element, canvas) {
	// element.className += " active";
	$(element).addClass("active");
}
$("[data-shapes]").on("click", function(val) {
	thisShape = $(this).attr("data-tools").toString().toLowerCase();
	val = thisShape;
	if (!$("[data-tools].active").is(":visible")) {
		$(this).addClass("active");
		openToolsMenu(val);
	} else {
		$(this).each(function(i) {
			// if you are remove the class
			if ($("[data-tools].active").attr("data-tools").toString().toLowerCase() === thisTool) {
				$("[data-tools].active").removeClass("active");
				closeToolsMenu();
				// if not remove the class from the original and then add it
			} else {
				$("[data-tools].active").removeClass("active");
				$(this).addClass("active");
				openToolsMenu(val);
			}
		});
	}
});

function addShape(canvas, shapeName) {
	canvas.parsingObjects = true;
	if (canvas == void 0 || canvas == null) {
		return;
	}
	// if (ur){
	// }
	const params = new URLSearchParams(window.location.search);
	const simpleValue = params.get("simple");
	console.log("simpleValue", simpleValue);
	const shapeOptions = {
		width: Math.max(
			(50 * canvasProperties.width) / 1728,
			(50 * canvasProperties.height) / 1152),
		height: Math.max(
			(50 * canvasProperties.width) / 1728,
			(50 * canvasProperties.height) / 1152),
		left: 0,
		top: 0,
		originX: "center",
		originY: "center",
		objectCaching: false,
		flipX: false,
		flipY: false,
		lockRotation: false,
		lockUniScaling: false,
		stroke: colourStandards[textFillColour].inkColour,
		fill: "transparent",
		sterlingType: "shape",
		cropX: 0,
		cropY: 0,
		typeImage: "shapes",
		strokeWidth: 2,
		strokeUniform: true,
	};
	let shapeObject;
	console.log(shapeName);
	switch (shapeName) {
		case "rect":
			shapeObject = new fabric.Rect(shapeOptions);
			break;
		case "circle":
			shapeOptions.radius = Math.max(
				(25 * canvasProperties.width) / 1728,
				(25 * canvasProperties.height) / 1152);
			shapeOptions.lockUniScaling = true;
			shapeObject = new fabric.Circle(shapeOptions);
			break;
		case "triangle":
			shapeObject = new fabric.Triangle(shapeOptions);
			break;
		case "ellipse":
			shapeOptions.rx = Math.max(
				(25 * canvasProperties.width) / 1728,
				(25 * canvasProperties.height) / 1152);
			shapeOptions.ry = Math.max(
				(40 * canvasProperties.width) / 1728,
				(40 * canvasProperties.height) / 1152);
			shapeObject = new fabric.Ellipse(shapeOptions);
			break;
			// case "star":
			//   shapeObject = new fabric.Star(shapeOptions);
			//   break;
		case "line":
			shapeOptions.lockScalingY = true;
			shapeOptions.strokeWidth = Math.max(2, canvasProperties.height * 0.005),
				shapeObject = new fabric.Line(
					[
						0,
						0,
						Math.max(75, canvasProperties.width * 0.1),
						0,
					], shapeOptions);
			shapeObject.setControlsVisibility({
				// corners
				tl: false,
				tr: false,
				bl: false,
				br: false,
				// side controls
				ml: true,
				mr: true,
				// top/bottom middle controls
				mt: false,
				mb: false,
				// rotation control (middle top rotate)
				mtr: true,
			});
			break;
		default:
			return;
	}
	// Add the shape to the canvas and set its properties
	// shapeObject.set({
	//   padding: 0,
	//   cornerSize: 50, // Resize handle size
	//   cornerColor: "blue", // Color of the resize handles
	//   borderColor: "green", // Border color of the selection box
	//   transparentCorners: false, // Visible corners (when selected)
	// });
	// shapeObject.setCoords();
	// canvas.imageObjects.push(shapeObject);
	canvas.shapeObjects.push(shapeObject);
	canvas.parsingObjects = false;
	canvas.add(shapeObject);
	centerCanvasObject(canvas, shapeObject, true);
	// console.log(canvas.textObjects);
	// console.log(canvas.textObjects[insertAt]);
	console.log(canvas.imageObjects);
	console.log(canvas.shapeObjects);
	// shapeObject.set({
	//   padding: 0, // Reduce the gap between the object and its bounding box (selection box)
	//   cornerSize: 10, // Optionally adjust the corner size to make it smaller
	//   transparentCorners: false, // Visible corners
	// });
	canvas.requestRenderAll.bind(canvas)();
	canvas.setActiveObject(shapeObject);
	// onObjectSelected({
	//   target: shapeObject,
	// });
	// onObjectSelected(shapeObject);
	// canvas.requestRenderAll();
}

function removeOpacity(canvas) {
	canvas.lowerCanvasEl.style.opacity = 1;
}

function changeBackgroundColour(canvas) {
	if (designerVariationCode === "EngravedPlastic") {
		console.log("clearing background image of canvas " + Date.now());
		canvas.setBackgroundColor("transparent");
		canvas.setBackgroundImage(0, function() {
			console.log("Clearing background image of canvas " + Date.now());
			canvas.requestRenderAll.bind(canvas)();
		});
		canvas.nonPrintedObjects.boundingBox.set("opacity", 0);
		colourChanged(false, null, canvas);
		if (colourStandards[textFillColour].backgroundImage) {
			canvas.setBackgroundColor("transparent");
			backgroundCanvas.setBackgroundColor("rgb(255,255,255)", canvas.requestRenderAll.bind(canvas));
			console.log("Start change background image of canvas " + Date.now());
			backgroundCanvas.setBackgroundImage(colourStandards[textFillColour].backgroundImage, function(img) {
				console.log("canvas: " + canvas.getHeight() + "," + canvas.getWidth() + " img: " + img.height + "," + img.width + ", zoom: " + canvas.getZoom() + " scaleX: " + canvas.getWidth() / canvas.getZoom() / img.width + ", scaleY: " + canvas.getHeight() / canvas.getZoom() / img.height);
				var options;
				if (canvasProperties.angle === 90) {
					options = {
						scaleX: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "left",
						originY: "bottom",
						left: 0,
						top: 0,
						angle: 90,
					};
				} else if (canvasProperties.angle === 180) {
					options = {
						scaleX: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "right",
						originY: "bottom",
						left: 0,
						top: 0,
						angle: 180,
					};
				} else if (canvasProperties.angle === 270) {
					options = {
						scaleX: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "right",
						originY: "top",
						left: 0,
						top: 0,
						angle: 270,
					};
				} else {
					options = {
						//width: canvas.getWidth(),
						//height: canvas.getHeight(),
						scaleX: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "left",
						originY: "top",
						left: 0,
						top: 0,
						angle: 0,
					};
				}
				backgroundCanvas.backgroundImage.set(options);
				console.log("Setting background image of canvas " + Date.now());
				backgroundCanvas.requestRenderAll.bind(backgroundCanvas)();
				canvas.requestRenderAll.bind(canvas)();
			}, {
				selectionBackgroundColor: null,
				crossOrigin: "anonymous",
			});
		} else {
			console.log("clearing background image of canvas " + Date.now());
			backgroundCanvas.setBackgroundImage(0, function() {
				console.log("Clearing background image of canvas " + Date.now());
				canvas.requestRenderAll.bind(canvas)();
			});
			backgroundCanvas.setBackgroundColor(colourStandards[textFillColour].backgroundColour, backgroundCanvas.requestRenderAll.bind(backgroundCanvas));
			//canvas.nonPrintedObjects.boundingBox.set("opacity",0);
		}
	} else if (designerVariationCode === "FullColour") {
		//var fullBackgroundColour = $('#canvasBackgroundColourDropdown').val().toLowerCase();
		var backImageColour = null;
		//Can I delete this line?
		//colourChanged(false);
		if ($("select[name=Variation] :selected").text().toLocaleLowerCase().indexOf("brass") === 0) {
			backImageColour = 21;
		} else if ($("select[name=Variation] :selected").text().toLocaleLowerCase().indexOf("silver") === 0) {
			backImageColour = 22;
		}
		if (backImageColour) {
			addOpacity(canvas);
			backgroundCanvas.setBackgroundImage(colourStandards[backImageColour].backgroundImage, function(img) {
				console.log("canvas: " + backgroundCanvas.getHeight() + "," + backgroundCanvas.getWidth() + " img: " + img.height + "," + img.width + ", zoom: " + backgroundCanvas.getZoom() + " scaleX: " + canvas.getWidth() / canvas.getZoom() / img.width + ", scaleY: " + backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.height);
				var options;
				if (canvasProperties.angle === 90) {
					options = {
						scaleX: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "left",
						originY: "bottom",
						left: 0,
						top: 0,
						angle: 90,
					};
				} else if (canvasProperties.angle === 180) {
					options = {
						scaleX: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "right",
						originY: "bottom",
						left: 0,
						top: 0,
						angle: 180,
					};
				} else if (canvasProperties.angle === 270) {
					options = {
						scaleX: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "right",
						originY: "top",
						left: 0,
						top: 0,
						angle: 270,
					};
				} else {
					options = {
						//width: canvas.getWidth(),
						//height: canvas.getHeight(),
						scaleX: backgroundCanvas.getWidth() / backgroundCanvas.getZoom() / img.width, //new update
						scaleY: backgroundCanvas.getHeight() / backgroundCanvas.getZoom() / img.height, //new update
						originX: "left",
						originY: "top",
						left: 0,
						top: 0,
						angle: 0,
					};
				}
				backgroundCanvas.backgroundImage.set(options);
				console.log("Setting background image of canvas " + Date.now());
				backgroundCanvas.requestRenderAll.bind(backgroundCanvas)();
			}, {
				crossOrigin: "anonymous",
			});
		} else {
			removeOpacity(canvas);
			backgroundCanvas.setBackgroundImage(0, backgroundCanvas.requestRenderAll.bind(backgroundCanvas));
		}
		if ((canvas.backgroundColourStore === "white" || canvas.backgroundColourStore === "#ffffff" || canvas.backgroundColourStore === "#fff" || canvas.backgroundColourStore === "rgb(255,255,255)") && backImageColour !== null && colourStandards[backImageColour].backgroundImage) {
			//canvas.nonPrintedObjects.boundingBox.set("opacity", 0);
			canvas.setBackgroundColor("", canvas.requestRenderAll.bind(canvas));
			//canvas.setBackgroundImage(0, canvas.requestRenderAll.bind(canvas));
			//canvas.setBackgroundColor("rgb(255,255,255)", canvas.requestRenderAll.bind(canvas));
			console.log("Start change background image of canvas " + Date.now());
			/*			canvas.setBackgroundImage(colourStandards[backImageColour].backgroundImage,
							function (img) {
								console.log("canvas: " + canvas.getHeight() + "," + canvas.getWidth() + " img: " + img.height + "," + img.width + ", zoom: " + canvas.getZoom() + " scaleX: " + ((canvas.getWidth() / canvas.getZoom()) / img.width) + ", scaleY: " + ((canvas.getHeight() / canvas.getZoom()) / img.height));
								canvas.backgroundImage.set({
									//width: canvas.getWidth(),
									//height: canvas.getHeight(),
									scaleX: (canvas.getWidth() / canvas.getZoom()) / img.width, //new update
									scaleY: (canvas.getHeight() / canvas.getZoom()) / img.height, //new update
									originX: 'left',
									originY: 'top',
									left: 0,
									top: 0
								});
								console.log("Setting background image of canvas " + Date.now());
								canvas.requestRenderAll.bind(canvas)();
							});*/
		} else {
			console.log("clearing background image of canvas " + Date.now());
			canvas.setBackgroundImage(0, function() {
				console.log("Clearing background image of canvas " + Date.now());
				canvas.requestRenderAll.bind(canvas)();
			});
			canvas.setBackgroundColor(canvas.backgroundColourStore, canvas.requestRenderAll.bind(canvas));
			//canvas.setBackgroundColor(colourStandards[backgroundColour].cmykColour, canvas.requestRenderAll.bind(canvas));
			//nonPrintedObjects.boundingBox.set("opacity",0);
		}
	} else if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale") {
		var useColor = "";
		if (canvasProperties.shape === "circle") {
			useColor = "#E5E4E2";
		}
		if (canvasProperties.drawFullBorder) {
			useColor = colourStandards[textFillColour].inkColour;
		}
		if (canvasProperties.shape === "circle") {
			canvas.setBackgroundColor("transparent");
			backgroundCanvas.setBackgroundColor("transparent");
			if (canvas.nonPrintedObjects.boundingBox.isType("rect")) {
				canvas.remove(canvas.nonPrintedObjects.boundingBox);
				canvas.nonPrintedObjects.boundingBox = null;
			}
			if (canvas.nonPrintedObjects.boundingBox !== null && typeof canvas.nonPrintedObjects.boundingBox !== "undefined" && canvas.contains(canvas.nonPrintedObjects.boundingBox)) {
				canvas.nonPrintedObjects.boundingBox.set({
					radius: (canvasProperties.height - canvasProperties.borderTop - canvasProperties.borderBottom) / 2,
					fill: "rgb(255,255,255)",
					strokeWidth: canvasProperties.borderWidth,
					stroke: useColor,
					selectable: false,
					evented: false,
					sterlingType: "nonPrintedObject",
					zIndex: -1,
					objectName: "boundingBox",
				});
			} else {
				canvas.nonPrintedObjects.boundingBox = new fabric.Circle({
					radius: (canvasProperties.height - canvasProperties.borderTop - canvasProperties.borderBottom) / 2,
					fill: "rgb(255,255,255)",
					left: canvasProperties.marginLeft,
					top: canvasProperties.marginTop,
					strokeWidth: canvasProperties.borderWidth,
					stroke: useColor,
					id: 0,
					selectable: false,
					sterlingType: "nonPrintedObject",
					zIndex: -1,
					objectName: "boundingBox",
				});
				canvas.add(canvas.nonPrintedObjects.boundingBox);
				canvas.nonPrintedObjects.boundingBox.zIndex = canvas.nonPrintedObjects.boundingBox.getZIndex();
			}
			centerCanvasObject(canvas, canvas.nonPrintedObjects.boundingBox);
			canvas.requestRenderAll.bind(canvas)();
			//canvas.calcOffset();
		} else if (canvasProperties.shape === "rect") {
			//TODO: why does it do this, use same bounding box for border.
			canvas.nonPrintedObjects.boundingBox.set({
				strokeWidth: canvasProperties.borderWidth,
				stroke: useColor,
			});
			canvas.requestRenderAll.bind(canvas)();
		}
		if (canvasProperties.daterBoxWidth !== 0) {
			if (canvas.nonPrintedObjects.dateBox !== null && typeof canvas.nonPrintedObjects.dateBox !== "undefined" && canvas.contains(canvas.nonPrintedObjects.dateBox)) {
				//if it's there, it's already in place, isn't it?
			} else {
				canvas.nonPrintedObjects.dateBox = new fabric.Rect({
					fill: "lightgray",
					width: canvasProperties.daterBoxWidth,
					height: canvasProperties.daterBoxHeight,
					selectable: false,
					evented: false,
					id: 199,
					sterlingType: "nonPrintedObject",
					zIndex: -1,
					objectName: "dateBox",
				});
				canvas.add(canvas.nonPrintedObjects.dateBox);
				canvas.nonPrintedObjects.dateBox.zIndex = canvas.nonPrintedObjects.dateBox.getZIndex();
				centerCanvasObject(canvas, canvas.nonPrintedObjects.dateBox);
				//canvas.calcOffset();
			}
			if (canvas.nonPrintedObjects.dateText !== null && typeof canvas.nonPrintedObjects.dateText !== "undefined" && canvas.contains(canvas.nonPrintedObjects.dateText)) {
				//if it's there, it's already in place, isn't it?
				canvas.nonPrintedObjects.dateText.set({
					fill: colourStandards[textFillColour].dateColour,
				});
			} else {
				var dateCode = canvasProperties.bandString.trim();
				if (dateCode == "") {
					dateCode = "JAN 21 20XX";
					if (canvasProperties.customerPartNumber.toUpperCase().endsWith("F")) {
						dateCode = "21 JAN 20XX";
					}
					if (canvasProperties.customerPartNumber.toUpperCase().endsWith("I")) {
						dateCode = "20XX-01-21";
					}
					if (canvasProperties.customerPartNumber.toUpperCase().endsWith("L") || canvasProperties.customerPartNumber.toUpperCase().endsWith("M")) {
						dateCode = "JAN 21 20XX";
					}
				}
				canvas.nonPrintedObjects.dateText = new fabric.Text(dateCode, {
					fontFamily: "Courier New",
					fontSize: canvasProperties.daterBoxHeight,
					fill: colourStandards[textFillColour].dateColour,
					hasControls: false,
					selectable: false,
					evented: false,
					lockMovementX: true,
					lockMovementY: true,
					visible: true,
					id: 200,
					sterlingType: "nonPrintedObject",
					zIndex: -1,
					objectName: "dateText",
				});
				canvas.add(canvas.nonPrintedObjects.dateText);
				canvas.nonPrintedObjects.dateText.zIndex = canvas.nonPrintedObjects.dateText.getZIndex();
				if (canvas.nonPrintedObjects.dateText.width > canvas.nonPrintedObjects.dateBox.width) {
					canvas.nonPrintedObjects.dateText.scaleX = canvas.nonPrintedObjects.dateBox.width / canvas.nonPrintedObjects.dateText.width;
				}
				centerCanvasObject(canvas, canvas.nonPrintedObjects.dateText);
				//canvas.calcOffset();
			}
		}
	}
	storeState(canvas);
}

function clickedABackgroundColour(e) {
	clickedAColour(e, false);
}

function clickedATextColour(e) {
	clickedAColour(e, true);
}

function clickedAShapeColour(e) {
	clickedAColour(e, "shape");
	e.stopPropagation();
}

function clickedAColour(e, textOrBack) {
	var colour = $(e.target).data("color");
	//var textOrBack = $("input[name='colourselector']:checked").val();
	console.log("Changed colour value:", colour);
	if (textOrBack === "shape") {
		$("#customShapeColour").val(colour);
		shapeColourChanged(false, colour, currentCanvas);
	} else if (textOrBack) {
		// $("#customTextColour").val(colour);
		$("#customTextColour").val(colour);
		colourChanged(false, colour, currentCanvas);
	} else {
		$("#customBackgroundColour").val(colour);
		currentCanvas.backgroundColourStore = colour;
		changeBackgroundColour(currentCanvas);
	}
}

function clickedCustomBackgroundColour(e) {
	clickedCustomColour(e, false);
}

function clickedCustomTextColour(e) {
	clickedCustomColour(e, true);
}

function clickedCustomShapeColour(e) {
	clickedCustomColour(e, "shape");
}
var MenuSelectedType = null;

function clickedAColourMenu(e) {
	// Get the "data-selectedType" attribute
	MenuSelectedType = e.currentTarget.getAttribute("data-selectedType");
	let currentObject;
	if (currentCanvas.getActiveObject()) {
		currentObject = currentCanvas.getActiveObject();
		activeLine = currentObject;
	} else {
		currentObject = activeLine;
	}
	if (currentObject) {
		// Remove 'active' class from all buttons with .colorMenuButton
		document.querySelectorAll('.colorMenuButton').forEach(btn => {
			btn.classList.remove('active');
		});
		// Add 'active' class to the clicked Fill/Stroke button
		e.currentTarget.classList.add('active');
		if (currentObject.sterlingType === 'shape') {
			console.log(currentObject.type);
			// Show the color menu
			const colorMenu = document.getElementById('colorMenu');
			colorMenu.style.display = 'block';
			// Get all .textColourButton elements in #colorMenu and replace with .shapeColourButton
			const textButtons = document.querySelectorAll('#colorMenu .textColourButton');
			textButtons.forEach(button => {
				button.classList.remove('textColourButton');
				button.classList.add('shapeColourButton');
			});
			// Get all .customTextColour elements in #colorMenu and replace with .customShapeColour
			const customTextButtons = document.querySelectorAll('#colorMenu .customTextColour');
			customTextButtons.forEach(button => {
				if (button.classList.contains('customTextColour')) {
					button.classList.remove('customTextColour');
					button.classList.add('customShapeColour');
				}
			});
		} else if (currentObject.type === 'i-text') {
			// Show the color menu
			const colorMenu = document.getElementById('colorMenu');
			colorMenu.style.display = 'block';
			// Get all .shapeColourButton elements in #colorMenu and replace with .textColourButton
			const shapeButtons = document.querySelectorAll('#colorMenu .shapeColourButton');
			shapeButtons.forEach(button => {
				button.classList.remove('shapeColourButton');
				button.classList.add('textColourButton');
			});
			// Get all .customShapeColour elements in #colorMenu and replace with .customTextColour
			const customShapeButtons = document.querySelectorAll('#colorMenu .customShapeColour');
			customShapeButtons.forEach(button => {
				if (button.classList.contains('customShapeColour')) {
					button.classList.remove('customShapeColour');
					button.classList.add('customTextColour');
				}
			});
		}
	}
	e.stopPropagation();
}

function clickedCustomColour(e, textOrBack) {
	var colour = e.target.value;
	//var textOrBack = $("input[name='colourselector']:checked").val();
	if (textOrBack === "shape") {
		$("#customShapeColour").val(colour);
		shapeColourChanged(false, colour, currentCanvas);
	} else if (textOrBack === true) {
		colourChanged(false, colour, currentCanvas);
	} else {
		currentCanvas.backgroundColourStore = colour;
		changeBackgroundColour(currentCanvas);
	}
}

function clickedAShapeWeight(e) {
	// console.log(e);
	var strokeWeightValue = Number(e.target.value);
	console.log(strokeWeightValue);
	var currentObject;
	if (currentCanvas.getActiveObject()) {
		currentObject = currentCanvas.getActiveObject();
		activeLine = currentObject;
	} else {
		currentObject = activeLine;
	}
	var canvas = currentCanvas;
	var height = currentObject.height;
	var width = currentObject.width;
	currentObject.set("strokeWidth", strokeWeightValue);
	//currentObject.set("strokeUniform", true);
	//currentObject.set("height", height);
	//currentObject.set("width", width);
	currentObject.setCoords();
	canvas.requestRenderAll.bind(canvas)();
	storeState(canvas);
}
$(window).on("load", function(e) {
	if (!keepOverlayOpen) {
		if (languageCode === "fr") {
			activateModal("Veuillez patienter pendant que nous chargeons votre modèle.", true);
		} else {
			activateModal("Please wait while we load your template.", true);
		}
	}
	/*	
	//code to test replacing background
	document.getElementById('bg_image').addEventListener('change', function (e) {
			canvas.setBackgroundColor('', canvas.renderAll.bind(canvas));
			canvas.setBackgroundImage(0, canvas.renderAll.bind(canvas));
			var file = e.target.files[0];
			var reader = new FileReader();
			reader.onload = function (f) {
				var data = f.target.result;
				fabric.Image.fromURL(data, function (img) {
					img.set({
						width: canvas.getWidth(),
						height: canvas.getHeight(),
						originX: 'left',
						scaleX: (canvas.getWidth() / canvas.getZoom()) / img.width, //new update
						scaleY: (canvas.getHeight() / canvas.getZoom()) / img.height, //new update
						originY: 'top'
					});
					canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
				});
			};
			reader.readAsDataURL(file);
		});*/
	SmpDesignerInit();
	document.onkeydown = function(e) {
		if (e.target.tagName === "INPUT") {
			return;
		}
		if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
			undo(currentCanvas);
			return;
		}
		if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
			redo(currentCanvas);
			return;
		}
		switch (e.keyCode) {
			case 38:
				/* Up arrow */
				if (currentCanvas.getActiveObject()) {
					currentCanvas.getActiveObject().top -= 5;
					currentCanvas.renderAll();
				}
				break;
			case 40:
				/* Down arrow  */
				if (currentCanvas.getActiveObject()) {
					currentCanvas.getActiveObject().top += 5;
					currentCanvas.renderAll();
				}
				break;
			case 37:
				/* Left arrow  */
				if (currentCanvas.getActiveObject()) {
					currentCanvas.getActiveObject().left -= 5;
					currentCanvas.renderAll();
				}
				break;
			case 39:
				/* Right arrow  */
				if (currentCanvas.getActiveObject()) {
					currentCanvas.getActiveObject().left += 5;
					currentCanvas.renderAll();
				}
				break;
			case 46:
				/* delete */
				if (currentCanvas.getActiveObject() && !currentCanvas.getActiveObject().isEditing) {
					if (simpleMode) {
						if (currentCanvas.getActiveObject() && (currentCanvas.getActiveObject().type === "i-text" || currentCanvas.getActiveObject().type === "text") && currentCanvas.getActiveObject().sterlingType === "textObject") {
							currentCanvas.getActiveObject().text = "";
							textBoxChangedOnCanvas({
								target: currentCanvas.getActiveObject(),
							});
						} else if (document.getElementById("curvedTextBox") === document.activeElement) {
							return;
						} else {
							deleteObject(currentCanvas);
						}
					} else if (document.getElementById("curvedTextBox") === document.activeElement) {
						return;
					} else {
						deleteObject(currentCanvas);
					}
				}
				break;
		}
	};
	$(".backColourButton").on("click", clickedABackgroundColour);
	$(".customBackgroundColour").on("input click change", clickedCustomBackgroundColour);
	$(".colors").on("click", ".textColourButton", clickedATextColour);
	var sweightEl = document.querySelector('#sweight');
	if (sweightEl != null) {
		$(".colors").on("click", ".shapeColourButton", clickedAShapeColour);
		// $(".textColourButton").on("click", clickedATextColour);
		// $(".shapeColourButton").on("click", clickedAShapeColour);
		//Old code
		// $("#customTextColour").on("input click change", clickedCustomTextColour);
		/*$(".customTextColour").on("input click change", clickedCustomTextColour);
		$(".customShapeColour").on("input click change", clickedCustomShapeColour);
		$(".colorMenuButton").on("click", clickedAColourMenu);
		$("#sweight").on("input click change", clickedAShapeWeight);*/
		document.querySelectorAll('.customTextColour').forEach(el => {
			['input', 'click', 'change'].forEach(evt => {
				el.addEventListener(evt, clickedCustomTextColour);
			});
		});
		// 2. Attach multiple events to .customShapeColour elements
		document.querySelectorAll('.customShapeColour').forEach(el => {
			['input', 'click', 'change'].forEach(evt => {
				el.addEventListener(evt, clickedCustomShapeColour);
			});
		});
		// 3. Attach a click event to .colorMenuButton elements
		document.querySelectorAll('.colorMenuButton').forEach(el => {
			el.addEventListener('click', clickedAColourMenu);
		});
		// 4. Attach multiple events to the #sweight element (IDs are usually unique, so querySelector is enough)
		['input', 'click', 'change'].forEach(evt => {
			document.querySelector('#sweight').addEventListener(evt, clickedAShapeWeight);
		});
		const colorMenuButton = $(".colorMenuButton");
		const colorMenu = $("#colorMenu");
		$(document).on("click", function(event) {
			if (!colorMenuButton.is(event.target) && !colorMenu.is(event.target)) {
				document.querySelectorAll('.colorMenuButton').forEach(btn => {
					btn.classList.remove('active');
				});
				colorMenu.hide();
				var currentObject = currentCanvas.getActiveObject();
				if (currentObject) {
					console.log("currentCanvas Type");
					console.log(currentObject.type);
					console.log(currentObject);
					console.log(currentObject.fill);
					if (currentObject.fill) {
						$("#fillColorSelect").css("background-color", currentObject.fill);
					} else {
						currentObject.set("fill", 'transparent');
						$("#fillColorSelect").css("background-color", currentObject.fill);
					}
					if (currentObject.stroke) {
						$("#strokeColorSelect").css("background-color", currentObject.stroke);
					} else {
						currentObject.set("stroke", 'transparent');
						$("#strokeColorSelect").css("background-color", currentObject.stroke);
					}
				}
			}
		});
	}
}); //moved to function called after page loads.
function populateTextBoxes(canvas) {
	if (!simpleMode) {
		return;
	}
	console.log("populateTextBoxes");
	var numberOfLines = productInfo.MAXLINES;
	if (canvas.textObjects.length > numberOfLines) {
		numberOfLines = canvas.textObjects.length;
	}
	$("#tabs").tabs("option", "active", 1);
	for (var i = 0; i < numberOfLines; i++) {
		if (canvas.textObjects[i] === void 0) {
			addTextLine(canvas, "");
		}
		var DOMtextBoxLI = document.getElementById("textBoxLI_" + i);
		if (DOMtextBoxLI === void 0 || DOMtextBoxLI === null) {
			DOMtextBoxLI = document.createElement("li");
			DOMtextBoxLI.id = "textBoxLI_" + i;
			var textBox = document.createElement("input");
			textBox.type = "text";
			textBox.id = "textBox_" + i;
			textBox.value = canvas.textObjects[i].text;
			textBox.onchange = textBoxChanged;
			textBox.onfocus = textBoxChanged;
			textBox.onkeyup = textBoxChanged;
			textBox.classList.add("simpleTextBox");
			DOMtextBoxLI.appendChild(textBox);
			var clearBtn = document.createElement("button");
			clearBtn.classList.add("btn_x");
			clearBtn.id = "clearb_" + i;
			clearBtn.innerHTML = "X";
			clearBtn.onclick = clearTextBox;
			DOMtextBoxLI.appendChild(clearBtn);
			document.getElementById("textBoxes").appendChild(DOMtextBoxLI);
			//document.getElementById('textMenu').click();
		}
	}
	$("#tabs").tabs("option", "active", 1);
	canvas.discardActiveObject();
	//bestFit(canvas);
}

function textBoxChanged(e) {
	var textboxValue = e.target.value;
	activeLine = currentCanvas.textObjects[e.target.id.split("_")[1]];
	$("#textSize").val(fontSizePixToPnt(activeLine.get("fontSize")));
	var canvas = activeLine.canvas;
	console.log("textBoxChanged");
	if (activeLine.canvas === void 0 && textboxValue.trim() !== "") {
		activeLine.text = textboxValue;
		bestFit(currentCanvas);
		$("#textSize").val(fontSizePixToPnt(activeLine.get("fontSize")));
		return;
	} else if (activeLine.canvas === void 0) {
		return;
	}
	if (canvas.getActiveObject() !== activeLine) {
		canvas.setActiveObject(activeLine);
		$("#textSize").val(fontSizePixToPnt(activeLine.get("fontSize")));
	}
	if (activeLine === null || typeof activeLine === "undefined") {
		addTextLine(textboxValue);
		if (activeLine === null || typeof activeLine === "undefined") {
			$("#textSize").val(fontSizePixToPnt(activeLine.get("fontSize")));
		}
	}
	if (!(activeLine.isType("text") || activeLine.isType("i-text"))) {
		return;
	}
	activeLine.set("text", textboxValue);
	if (e.type != "focus") {
		bestFit(activeLine.canvas);
	}
	$("#textSize").val(fontSizePixToPnt(activeLine.get("fontSize")));
	/*	itextChanged({
			target: activeLine
		});
		if (textboxValue === "") {
			bestFit(activeLine.canvas);
		} 
		*/
	/*	
	//bestFit(); TODO: change this to only bestfit this line, don't adjust other lines!!
		//textObjects[lineNumber].set("text",$("#textBox" + lineNumber).val());
		//activeLine = lineNumber;
		//$("#curLine").html(dlnvar + " " + (lineNumber + 1));*/
	//$("#textSize").val(activeLine.get("fontSize"));
	//if (designerVariationCode === "FullColour" || designerVariationCode === "FullColourFixedImagePosition") {
	//	$("#textColourDropdown").val(getColourByCMYK(activeLine.get("fill")).name);
	//}
	/*	//$("#textBX>div>input").css('background-color', 'inherit');
		//$("#textBX>#numb_" + activeLine + ">input").css('background-color', 'lightblue');
		//if (canvas.getActiveObject() === textObjects[lineNumber]) return;
		//canvas.setActiveObject(textObjects[lineNumber]);*/
	//selectFontName(activeLine.get("fontFamily"));
	//canvas.setActiveObject(activeLine);
	canvas.requestRenderAll.bind(canvas)();
}

function curvedTextBoxChanged(e) {
	var textboxValue = e.target.value;
	console.log("curvedTextBoxChanged");
	if (activeLine === null || activeLine === void 0) {
		return;
		//addCurvedText(currentCanvas,textboxValue);
	}
	if (!activeLine.isType("curvedText")) {
		return;
	}
	if (textboxValue === activeLine.text) {
		return;
	}
	activeLine.set("text", textboxValue);
	activeLine.canvas.requestRenderAll.bind(activeLine.canvas)();
}

function clearTextBox(e) {
	activeLine = null;
	console.log("clearTextBox");
	var textBox = document.getElementById("textBox_" + e.target.id.split("_")[1]);
	textBox.value = "";
	textBoxChanged({
		target: textBox,
	});
}

function textBoxChangedOnCanvas(e, skipBestFit) {
	var skipBestFit = skipBestFit || false;
	console.log("textBoxChangedOnCanvas");
	if (!simpleMode) {
		return;
	}
	var activeObject = e.target;
	console.log(activeObject.width);
	var textBoxIndex = -1;
	if (activeObject.canvas !== null && activeObject.canvas !== void 0) {
		for (var x = 0; x < activeObject.canvas.textObjects.length; x++) {
			if (activeObject === activeObject.canvas.textObjects[x]) {
				textBoxIndex = x;
				break;
			}
		}
	}
	if (textBoxIndex > -1) {
		document.getElementById("textBox_" + textBoxIndex).value = activeObject.text;
		//if (activeObject.text === "") {
		if (!skipBestFit) {
			activeObject.set({
				scaleX: 1,
				scaleY: 1,
			});
			bestFit(activeObject.canvas);
		}
	}
}

function calcModeFromArray(array, parameterToCheck, filter) {
	const count = {};
	var filter = filter || ((word) => true);
	array.filter(filter).forEach((e) => {
		if (!(e[parameterToCheck] in count)) {
			count[e[parameterToCheck]] = 0;
		}
		count[e[parameterToCheck]]++;
	});
	let bestElement;
	let bestCount = 0;
	Object.entries(count).forEach(([k, v]) => {
		if (v > bestCount) {
			bestElement = k;
			bestCount = v;
		}
	});
	return bestElement;
}

function bestFit(canvas) {
	if (canvas === void 0 || canvas === null || canvas.nonPrintedObjects.boundingBox === null || canvas.nonPrintedObjects.boundingBox === void 0) {
		return;
	}
	console.log("bestFit");
	//TODO: impliment best fit, account for dater boxes and images.  maintain proportions of font sizes rounding down to whole numbers
	//also account for fitting without stretch if possible.  otherwise apply stretch to all text.
	//reinstall apply to all button, which does best fit.
	var LinesWithText = [];
	/*	if (designerVariationCode === "FullColour") {
			return;
		}*/
	var j;
	var newLineHeight;
	var newFontSize;
	var bestFitTop = canvas.nonPrintedObjects.boundingBox.get("top") + (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0);
	var bestFitBottom = canvas.nonPrintedObjects.boundingBox.get("top") + canvas.nonPrintedObjects.boundingBox.get("height") * canvas.nonPrintedObjects.boundingBox.get("scaleY") - (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0);
	var bestFitLeft = canvas.nonPrintedObjects.boundingBox.get("left") + (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0);
	var bestFitRight = canvas.nonPrintedObjects.boundingBox.get("left") + canvas.nonPrintedObjects.boundingBox.get("width") * canvas.nonPrintedObjects.boundingBox.get("scaleX") - (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0);
	// determine number of lines on stamp
	//determine ratio of line heights in stamp and store in textObj
	var modeFontSize = calcModeFromArray(canvas.textObjects, "fontSize", (x) => x.canvas != null && x.canvas != void 0 && x.text.trim() != "");
	if (modeFontSize == void 0) {
		modeFontSize = document.getElementById("font-size").options[0].value;
	}
	for (j = 0; j < canvas.textObjects.length; j++) {
		canvas.textObjects[j].simpleScale = canvas.textObjects[j].fontSize / modeFontSize;
	}
	for (j = 0; j < canvas.textObjects.length; j++) {
		//canvas.textObjects[j].set("scaleX",1);
		canvas.textObjects[j].saveState();
		canvas.textObjects[j].set({
			scaleX: 1,
			scaleY: 1,
		});
		if (canvas.textObjects[j].text.trim() !== "") {
			if (canvas.textObjects[j].canvas !== canvas) {
				canvas.textObjects[j].set({
					fontSize: modeFontSize,
				});
				canvas.textObjects[j].simpleScale = canvas.textObjects[j].fontSize / modeFontSize;
				canvas.discardActiveObject();
				canvas.add(canvas.textObjects[j]);
				canvas.setActiveObject(canvas.textObjects[j]);
			}
			LinesWithText.push({
				textObject: canvas.textObjects[j],
				fontSize: canvas.textObjects[j].fontSize,
			});
		} else {
			canvas.remove(canvas.textObjects[j]);
		}
	}
	if (LinesWithText.length === 0) {
		canvas.requestRenderAll.bind(canvas)();
		return;
	}
	// the below is to fit lines around images left to right.  it ignores top and bottom.
	if (simpleMode) {
		for (var i = 0; i < canvas.imageObjects.length; i++) {
			var currentImage = canvas.imageObjects[i].fabricImage;
			var leftImageSpace = currentImage.get("left");
			var rightImageSpace = canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight) - (currentImage.get("left") + currentImage.get("width") * currentImage.get("scaleX"));
			if (rightImageSpace >= leftImageSpace) {
				if (rightImageSpace > 30 && rightImageSpace > bestFitLeft) {
					bestFitLeft = currentImage.get("left") + currentImage.get("width") * currentImage.get("scaleX");
				}
			} else if (leftImageSpace > rightImageSpace) {
				if (canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight) - leftImageSpace > 30 && leftImageSpace < bestFitRight) {
					bestFitRight = currentImage.get("left");
				}
			}
		}
		for (var i = 0; i < canvas.shapeObjects.length; i++) {
			var currentImage = canvas.shapeObjects[i];
			var leftImageSpace = currentImage.get("left") - (currentImage.get("width") * currentImage.get("scaleX")) / 2;
			var rightImageSpace = canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight) - (currentImage.get("left") - canvasProperties.marginLeft + currentImage.get("width") * currentImage.get("scaleX"));
			if (rightImageSpace >= leftImageSpace) {
				if (rightImageSpace > 30 && rightImageSpace > bestFitLeft) {
					bestFitLeft = currentImage.get("left") + 0.5 * (currentImage.get("width") * currentImage.get("scaleX")) + canvasProperties.marginLeft;
				}
			} else if (leftImageSpace > rightImageSpace) {
				if (canvasProperties.width - (canvasProperties.marginLeft + canvasProperties.marginRight) - leftImageSpace > 30 && leftImageSpace < bestFitRight) {
					bestFitRight = currentImage.get("left") - 0.5 * (currentImage.get("width") * currentImage.get("scaleX")) - canvasProperties.marginLeft;
				}
			}
		}
	}
	// determine max height for lines
	var availableHeight = bestFitBottom - bestFitTop - canvasProperties.daterBoxHeight;
	if (currentCanvas.nonPrintedObjects.boundingBox.type === "circle") {
		availableHeight = availableHeight * 0.9;
	}
	//canvasProperties.height - canvasProperties.daterBoxHeight - (canvasProperties.topMargin * 2);
	//var availableWidth = canvasProperties.width - (canvasProperties.sideMargin * 2);
	var availableWidth = bestFitRight - bestFitLeft;
	var maxLineHeight = availableHeight / LinesWithText.length; // line max. height
	if (canvasProperties.daterBoxHeight > 0 && LinesWithText.length > 1) {
		maxLineHeight = availableHeight / 2 / Math.ceil(LinesWithText.length / 2);
	} else if (canvasProperties.daterBoxHeight > 0 && LinesWithText.length === 1) {
		maxLineHeight = availableHeight / 2;
	}
	var freeSpace = 0;
	var cumulativeLineHeight = 0; // accumlated total line height
	for (j = 0; j < LinesWithText.length; j++) {
		newFontSize = +$("#font-size option:first").val();
		do {
			newLineHeight = newFontSize;
			LinesWithText[j].textObject.set({
				fontSize: newFontSize * LinesWithText[j].textObject.simpleScale,
			});
			LinesWithText[j].textObject.setCoords();
			LinesWithText[j].textObject.initDimensions();
			//LinesWithText[j].textObject.setLineHeight(1);
			newLineHeight = LinesWithText[j].textObject.get("height") * LinesWithText[j].textObject.get("scaleY");
			if (currentCanvas.nonPrintedObjects.boundingBox.type === "circle") {
				var height = LinesWithText[j].textObject.get("top") - canvas.nonPrintedObjects.boundingBox.get("top");
				if (LinesWithText[j].textObject.get("top") > canvasProperties.height / 2) {
					height += LinesWithText[j].textObject.get("height") * LinesWithText[j].textObject.get("scaleY");
				} //after halfway down the circle measure at bottom of box.
				var radius = canvas.nonPrintedObjects.boundingBox.get("radius");
				var WidthAtCircleHeight = 2 * Math.sqrt(2 * height * radius - height * height);
				if (LinesWithText[j].textObject.get("width") * LinesWithText[j].textObject.get("scaleX") >= WidthAtCircleHeight) {
					break;
				}
			} else if (LinesWithText[j].textObject.get("width") * LinesWithText[j].textObject.get("scaleX") >= availableWidth) {
				break;
			}
			if (newLineHeight >= maxLineHeight) {
				break;
			}
			newFontSize++;
			//if (newFontSize > +$("#font-size option:last").val()) {
			if (newFontSize > availableHeight) {
				break;
			}
		} while (true);
		canvas.textObjects[j].set({
			fontSize: (newFontSize - 1) * canvas.textObjects[j].simpleScale,
		});
		if (designerVariationCode === "EngravedPlastic") {
			if (canvas.textObjects[j].fontSize <= 12) {
				canvas.textObjects[j].set({
					fontSize: 12,
				});
			}
		}
	}
	var theSize = 999;
	// determine smallest font size
	for (j = 0; j < LinesWithText.length; j++) {
		if (LinesWithText[j].textObject.fontSize < theSize) {
			theSize = LinesWithText[j].textObject.get("fontSize");
		}
	}
	// set font size to all lines
	if (designerVariationCode === "SingleColour" || designerVariationCode === "Grayscale" || designerVariationCode === "EngravedPlastic") {
		for (j = 0; j < LinesWithText.length; j++) {
			LinesWithText[j].textObject.set({
				fontSize: theSize * LinesWithText[j].textObject.simpleScale,
			});
			LinesWithText[j].textObject.initDimensions();
		}
	}
	// accumulate total height of text lines
	for (j = 0; j < LinesWithText.length; j++) {
		cumulativeLineHeight = cumulativeLineHeight + LinesWithText[j].textObject.get("height") * LinesWithText[j].textObject.get("scaleY");
	}
	if (canvasProperties.daterBoxHeight > 0 && LinesWithText.length % 2 === 1) {
		//add a placeholder
		cumulativeLineHeight = cumulativeLineHeight + LinesWithText[j - 1].textObject.get("height") * LinesWithText[j - 1].textObject.get("scaleY");
	}
	freeSpace = (availableHeight - cumulativeLineHeight) / (LinesWithText.length + 1);
	var collapsedFreeSpace = (availableHeight - cumulativeLineHeight) / 2; //top and bottom
	// one line of text
	if (LinesWithText.length === 1) {
		if (canvasProperties.daterBoxHeight > 0) {
			LinesWithText[0].textObject.set({
				top: (canvas.nonPrintedObjects.boundingBox.height - canvasProperties.daterBoxHeight) / 4 - (LinesWithText[0].textObject.get("height") * LinesWithText[0].textObject.get("scaleY")) / 2 + canvas.nonPrintedObjects.boundingBox.top,
			});
		} else {
			LinesWithText[0].textObject.set({
				top: (canvas.nonPrintedObjects.boundingBox.height - canvasProperties.daterBoxHeight) / 2 - (LinesWithText[0].textObject.get("height") * LinesWithText[0].textObject.get("scaleY")) / 2 + canvas.nonPrintedObjects.boundingBox.top,
			});
		}
		LinesWithText[0].textObject.setCoords();
	} else if (LinesWithText.length > 1) {
		if (canvasProperties.daterBoxHeight > 0) {
			freeSpace = (availableHeight - cumulativeLineHeight) / (LinesWithText.length + 2);
		} else {
			freeSpace = (availableHeight - cumulativeLineHeight) / (LinesWithText.length + 1);
		}
		LinesWithText[0].textObject.set({
			top: collapsedFreeSpace + canvas.nonPrintedObjects.boundingBox.top + (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0),
		});
		if (currentCanvas.nonPrintedObjects.boundingBox.type === "circle") {
			LinesWithText[0].textObject.set({
				top: freeSpace + canvas.nonPrintedObjects.boundingBox.top + canvas.nonPrintedObjects.boundingBox.height * 0.05 + (canvasProperties.drawFullBorder ? canvasProperties.borderWidth * 2 : 0),
			});
		}
		LinesWithText[0].textObject.setCoords();
		var daterBoxSpacer = false;
		for (j = 1; j < LinesWithText.length; j++) {
			if (canvasProperties.daterBoxHeight > 0 && j >= LinesWithText.length / 2 && daterBoxSpacer !== true) {
				LinesWithText[j].textObject.set({
					top: LinesWithText[j - 1].textObject.get("top") + 0 * 2 + canvasProperties.daterBoxHeight + LinesWithText[j - 1].textObject.get("height") * LinesWithText[j - 1].textObject.get("scaleY"),
				});
				daterBoxSpacer = true;
			} else {
				LinesWithText[j].textObject.set({
					top: LinesWithText[j - 1].textObject.get("top") + 0 + LinesWithText[j - 1].textObject.get("height") * LinesWithText[j - 1].textObject.get("scaleY"),
				});
			}
			LinesWithText[j].textObject.setCoords();
		}
	}
	for (j = 0; j < LinesWithText.length; j++) {
		LinesWithText[j].textObject.setCoords();
		/*if (LinesWithText[j].textObject.isContainedWithinObject(canvas.nonPrintedObjects.boundingBox) === false) {
			LinesWithText[j].textObject.sterlingAlign = "center";
		}*/
		objectAlign(canvas, LinesWithText[j].textObject.sterlingAlign, LinesWithText[j].textObject, bestFitTop, bestFitLeft, bestFitRight, bestFitBottom);
		itextChanged({
			target: LinesWithText[j].textObject
		}, true);
	}
	canvas.requestRenderAll.bind(canvas)();
}

function allLines(canvas, activeLine) {
	var styleArray = ["stroke", "strokeWidth", "fill", "fontFamily", "fontSize", "fontWeight", "fontStyle", "underline", "overline", "linethrough", "deltaY", "textBackgroundColor", "sterlingAlign", ];
	//fontSize = activeLine.getFontSize();
	for (var j = 0; j < canvas.textObjects.length; j++) {
		if (j !== activeLine) {
			for (var i = 0; i < styleArray.length; i++) {
				canvas.textObjects[j].set(styleArray[i], activeLine.get(styleArray[i]));
			}
		}
	}
	if (simpleMode) {
		bestFit(canvas);
	}
	canvas.requestRenderAll.bind(canvas)();
}