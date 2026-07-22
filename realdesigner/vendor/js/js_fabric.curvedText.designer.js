/*
 * CurvedText object for fabric.js
 * @author Arjan Haverkamp (av01d)
 * @date January 2018
 */
fabric.CurvedText = fabric.util.createClass(fabric.Text, {
	characterData: [],
	type: 'curvedText',
	radius: 0,
	originAngle: 0,
	maxAngleSubtended: 360,
	spacing: 0,
	text: '',
	reverse: false,
	cacheProperties: fabric.Object.prototype.cacheProperties.concat('radius', 'spacing', 'reverse'),
	initialize: function(text, options) {
		options = Object.assign({
			left: 0,
			top: 0,
			radius: 0,
			originAngle: 0,
			maxAngleSubtended: 360,
			spacing: 1, //1 = width of a space, 2 = 2 spaces, etc
			minspacing: 0.01, // 1 one hundredth of a space (note: characters have native spacing inside bounding box)
			text: text || ''
		}, options);
		this.originX = 'center';
		this.originY = 'center';
		this.set('text', text);
		this.callSuper('initialize', this.text, options);
		this.set('lockUniScaling', true);
		// Calculate the bounding box and set the width and height
		this._updateBounds();
	},
	_getFontDeclaration: function() {
		return [
			// node-canvas needs "weight style", while browsers need "style weight"
			(fabric.isLikelyNode ? this.fontWeight : this.fontStyle),
			(fabric.isLikelyNode ? this.fontStyle : this.fontWeight),
			this.fontSize + 'px',
			(fabric.isLikelyNode ? ('"' + this.fontFamily + '"') : this.fontFamily)
		].join(' ');
	},
	_getTextBounds: function() {
		// Create a temporary canvas to measure the text bounds
		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
		canvas.width = this.radius * 2;
		canvas.height = this.radius * 2;
		// Draw the curved text onto the temporary canvas
		this._drawCurvedText(ctx);
		// Get the image data to calculate the bounding box
		var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		var minX = canvas.width,
			minY = canvas.height,
			maxX = 0,
			maxY = 0;
		for (var y = 0; y < canvas.height; y++) {
			for (var x = 0; x < canvas.width; x++) {
				if (imageData.data[((y * canvas.width + x) * 4) + 3] > 0) {
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
		}
		// Calculate the width and height of the bounding box
		var width = maxX - minX;
		var height = maxY - minY;
		return {
			width: width,
			height: height,
			minX: minX,
			minY: minY
		};
	},
	_updateBounds: function() {
		// Calculate the bounding box
		var bounds = this._getTextBounds();
		// Set the width, height, left, and top properties
		this.set({
			width: bounds.width,
			height: bounds.height,
		});
		this.setCoords();
	},
	_drawCurvedText: function(ctx) {
		var text = this.text,
			radius = this.radius,
			reverse = this.reverse,
			spacing = this.spacing,
			fill = this.fill,
			inwardFacing = true,
			startAngle = 0,
			clockwise = -1; // draw clockwise for aligned right. Else Anticlockwise
		if (reverse) {
			startAngle = 180;
			inwardFacing = false;
		}
		startAngle *= Math.PI / 180; // convert to radians
		// Calc height of text in selected font:
		var d = document.createElement('div');
		d.style.fontFamily = this.fontFamily;
		d.style.whiteSpace = 'nowrap';
		d.style.fontSize = this.fontSize + 'px';
		d.style.fontWeight = this.fontWeight;
		d.style.fontStyle = this.fontStyle;
		d.textContent = text;
		document.body.appendChild(d);
		var textHeight = d.offsetHeight;
		document.body.removeChild(d);
		ctx.font = this._getFontDeclaration();
		var xHeight = ctx.measureText('x').actualBoundingBoxAscent;
		var baselineOffset = (textHeight / 2 - xHeight / 2);
		// Reverse letters for center inward.
		if (inwardFacing) {
			text = text.split('').reverse().join('');
		}
		// Setup letters and positioning
		ctx.translate(radius, radius); // Move to center
		startAngle += (Math.PI * !inwardFacing); // Rotate 180 if outward
		ctx.textBaseline = 'middle'; // Ensure we draw in exact center
		ctx.textAlign = 'center'; // Ensure we draw in exact center
		// rotate 50% of total angle for center alignment, change logic for other anchor points.
		for (var x = 0; x < text.length; x++) {
			var cw = ctx.measureText(text[x]).width;
			startAngle += ((cw + (x == text.length - 1 ? 0 : spacing)) / (radius - textHeight)) / 2 * -clockwise;
		}
		// Phew... now rotate into final start position
		ctx.rotate(startAngle);
		// Clear previous character data
		this.characterData = [];
		var arcAngle = startAngle;
		if (inwardFacing) {
			arcAngle = arcAngle + Math.PI;
		}
		// Now for the fun bit: draw, rotate, and repeat
		for (var i = 0; i < text.length; i++) {
			var cw = ctx.measureText(text[i]).width;
			// rotate half letter
			ctx.rotate((cw / 2) / (radius - textHeight) * clockwise);
			arcAngle += (cw / 2) / (radius - textHeight) * clockwise;
			// draw the character at "top" or "bottom"
			// depending on inward or outward facing
			// Stroke
			if (this.strokeStyle && this.strokeWidth) {
				ctx.strokeStyle = this.strokeStyle;
				ctx.lineWidth = this.strokeWidth;
				ctx.miterLimit = 2;
				ctx.strokeText(text[i], 0, (inwardFacing ? 1 : -1) * (0 - radius + textHeight / 2));
			}
			// Actual text
			ctx.fillStyle = fill;
			ctx.fillText(text[i], 0, (inwardFacing ? 1 : -1) * (0 - radius + textHeight / 2));
			/*temporary dots
			ctx.fillStyle = 'red';
			ctx.beginPath();
			ctx.arc(0, (inwardFacing ? 1 : -1) * (0 - radius + textHeight / 2), .3, 0, 2 * Math.PI);
			ctx.fill();*/
			var adjustedRadius = radius - textHeight / 2;
			var charX = adjustedRadius * Math.sin(-arcAngle);
			var charY = adjustedRadius * Math.cos(-arcAngle) + (inwardFacing ? adjustedRadius : -adjustedRadius);
			this.characterData.push({
				char: text[i],
				x: charX,
				y: charY,
				rotation: inwardFacing ? arcAngle + Math.PI : arcAngle,
				baselineOffset: baselineOffset,
			});
			ctx.rotate((cw / 2 + spacing) / (radius - textHeight) * clockwise); // rotate half letter
			arcAngle += (cw / 2 + spacing) / (radius - textHeight) * clockwise;
		}
	},
	_render: function(ctx) {
		ctx.save();
		var bounds = this._getTextBounds();
		ctx.translate(0 - (bounds.width / 2) - bounds.minX, 0 - (bounds.height / 2) - bounds.minY);
		this._drawCurvedText(ctx);
		ctx.restore();
		this._updateBounds();
	},
	toObject: function(propertiesToInclude) {
		return this.callSuper('toObject', ['text', 'radius', 'spacing', 'reverse', 'fill', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'strokeStyle', 'strokeWidth'].concat(propertiesToInclude));
	},
	toSVG: function(reviver) {
		var inwardFacing = true;
		if (this.reverse) {
			inwardFacing = false;
		}
		var transform = [`translate(${this.left}, ${this.top + (inwardFacing ?  -1: 1) * (this.height*this.scaleY)/2})`, `rotate(${this.angle || 0})`, `scale(${this.scaleX}, ${this.scaleY})`].join(' ');
		var characterElements = this.characterData.map(data => `<text
      transform="translate(${data.x}, ${data.y + (inwardFacing ? data.baselineOffset : -data.baselineOffset)/2}) rotate(${data.rotation * 180 / Math.PI})"
      fill="${this.fill}"
      font-family="${this.fontFamily}"
      font-size="${this.fontSize}"
      font-weight="${this.fontWeight}"
      font-style="${this.fontStyle}"
      text-anchor="middle"
			dominant-baseline="central"
      ${this.strokeStyle ? `stroke="${this.strokeStyle}"` : ''}
      ${this.strokeWidth ? `stroke-width="${this.strokeWidth}"` : ''}
    >${data.char}</text>`);
		return reviver ? reviver(`<g transform="${transform}">${characterElements.join('')}</g>`) : `<g transform="${transform}">${characterElements.join('')}</g>`;
	},
});
fabric.CurvedText.fromObject = function(object, callback) {
	return fabric.Object._fromObject('CurvedText', object, callback, 'text');
};