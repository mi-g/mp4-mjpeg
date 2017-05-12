/*
 * mp4-mjpeg <https://github.com/mi-g/mp4-mjpeg>
 *
 * Copyright (c) 2017, Michel Gutierrez.
 * Licensed under the MIT License.
 */
const sizeOf = require('image-size');
const MP4 = require('./mp4');

class MP4MJPEG extends MP4 {

	appendImageBuffer(buffer) {
		var self = this;
		if (!self.width || !self.height) {
			var dimensions = sizeOf(buffer);
			self.width = dimensions.width;
			self.height = dimensions.height;
		}
		return self.AppendFrame(buffer);
	}

	appendImageDataUrl(dataUrl) {
		var base64image = dataUrl.split(";base64,").pop();
		var buffer = new Buffer(base64image, 'base64');
		return this.appendImageBuffer(buffer);
	}
}

module.exports = (options) => {
	var mp4mjpeg = new MP4MJPEG();
	return mp4mjpeg.init(options)
		.then(() => {
			return Promise.resolve(mp4mjpeg);
		})
}
