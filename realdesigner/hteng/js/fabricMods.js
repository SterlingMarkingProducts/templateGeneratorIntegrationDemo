// for fabric 2.4.4
// place overrides of prototype here
fabric.Canvas.prototype.toSVG = function(options, reviver) {
	options || (options = {});
	options.reviver = reviver;
	var markup = [];
	this._setSVGPreamble(markup, options);
	this._setSVGHeader(markup, options);
	if (this.clipPath) {
		markup.push('<g clip-path="url(#' + this.clipPath.clipPathId + ')" >\n');
	}
	this._setSVGBgOverlayColor(markup, 'background');
	this._setSVGBgOverlayImage(markup, 'backgroundImage', reviver);
	this._setSVGObjects(markup, reviver);
	if (this.clipPath) {
		markup.push('</g>\n');
	}
	this._setSVGBgOverlayColor(markup, 'overlay');
	this._setSVGBgOverlayImage(markup, 'overlayImage', reviver);
	markup.push('</svg>');
	return markup.join('');
};
fabric.Path.prototype._createBaseClipPathSVGMarkup = function(objectMarkup, options) {
	options = options || {};
	var reviver = options.reviver,
		additionalTransform = options.additionalTransform || '',
		commonPieces = [
			this.getSvgTransform(true, additionalTransform),
			this.getSvgCommons(),
		].join(''),
		// insert commons in the markup, style and svgCommons
		index = objectMarkup.indexOf('COMMON_PARTS');
	objectMarkup[index] = commonPieces;
	if (commonPieces.substring(0, 9) === "transform") {
		for (var i = objectMarkup.length - 1; i >= 0; i--) {
			if (objectMarkup[i].substring(0, 9) === "transform" && i !== index) {
				objectMarkup.splice(i, 1);
			}
		}
	}
	return reviver ? reviver(objectMarkup.join('')) : objectMarkup.join('');
}
/*fabric.StaticCanvas.prototype.getCanonicalHeight = function() {
	return this.vptCoords.br.y;
}
fabric.StaticCanvas.prototype.getCanonicalWidth = function() {
	return this.vptCoords.br.x;
}*/
fabric.util.groupSVGElementsAsGroup = function(elements, options, path) {
	var object;
	if (options) {
		if (options.width && options.height) {
			options.centerPoint = {
				x: options.width / 2,
				y: options.height / 2
			};
		} else {
			delete options.width;
			delete options.height;
		}
	}
	object = new fabric.Group(elements, options);
	if (typeof path !== 'undefined') {
		object.sourcePath = path;
	}
	return object;
}
fabric.Group.fromObject = function(object, callback) {
	if (typeof object.objects === 'string') {
		object.sourcePath = object.objects;
	}
	if (typeof object.sourcePath === 'string') {
		var options = fabric.util.object.clone(object, true);
		var sourcePath = object.sourcePath;
		fabric.loadSVGFromURL(sourcePath, function(elements) {
			elements.forEach(function(obj, i) {
				obj._setObject(object.objects[i]);
			});
			/* I don't see how this would be usefull.  opacity on the group should fix it.
	
	changing fill on a group doesn't affect the objects in the group either.
	fabric.loadSVGFromURL(pathUrl, function (objects, options) {
	//if fill of object changed in design
    if(object.fill!='rgb(0,0,0)'){
      $.each(objects, function (index, value) {
          value.set({'fill':object.fill});
      });
    }        //opacity of object is changed in design
  if(object.opacity!='1'){
      $.each(objects, function (index, value) {
          value.set({'opacity':value.opacity*object.opacity});
      });
    }
*/
			var path = fabric.util.groupSVGElementsAsGroup(elements, options, sourcePath);
			path.setOptions(options);
			callback && callback(path);
		});
	} else {
		fabric.util.enlivenObjects(object.objects, function(enlivenedObjects) {
			var options = fabric.util.object.clone(object, true);
			delete options.objects;
			callback && callback(new fabric.Group(enlivenedObjects, options, true));
		});
	}
};