/*
 * mp4-mjpeg <https://github.com/mi-g/mp4-mjpeg>
 *
 * Copyright (c) 2017, Michel Gutierrez.
 * Licensed under the MIT License.
 */
/* jslint bitwise: true */
const fs = require('fs');
const crypto = require('crypto');
const bits = require('./bits');

class MP4 {

	init(options) {
		var self = this;
		self.options = Object.assign({
			reuseLastFrame: true,
			ignoreIdenticalFrames: 30
		}, options);
		self.streams = {};
		self.filePos = 0;
		return self.WriteFileHeader();
	}

	Box(boxType, data) {
		var length = this.Length(data);
		var boxLengthData = new Uint8Array(4);
		bits.WriteInt32(boxLengthData, 0, 8 + length);
		boxType = (boxType + "    ").substr(0, 4);
		return [boxLengthData, this.String2Buffer(boxType), data]
	}

	BoxTkhd(esi) {
		var self = this;
		var data = new Uint8Array(84);
		bits.WriteInt24(data, 1, 0x3);
		bits.WriteInt32(data, 4, 0);

		bits.WriteInt32(data, 8, 0);

		bits.WriteInt32(data, 12, esi.streamId);
		// reserved 4 bytes
		var duration = Math.ceil(esi.dataOffsets.length * 1000 / 30); // fps 30, unit ms ?
		bits.WriteInt32(data, 20, duration);
		// reserved 8 bytes

		bits.WriteInt16(data, 32, 0);
		bits.WriteInt16(data, 34, 0);
		if (esi.streamType == "audio")
			bits.WriteInt16(data, 36, 0x0100);
		bits.WriteInt16(data, 38, 0);

		self.MakeDefaultMatrix(data, 40);

		if (esi.streamType == "video") {
			bits.WriteInt16(data, 76, self.width);
			bits.WriteInt16(data, 80, self.height);
		}

		return self.Box("tkhd", data);
	}

	BoxMdia(esi) {
		var self = this;
		var mdhdBox = self.BoxMdhd(esi);
		var hdlrBox = self.BoxHdlr(esi);
		var minfBox = self.BoxMinf(esi);
		return self.Box("mdia", [mdhdBox, hdlrBox, minfBox]);
	}

	BoxMdhd(esi) {
		var self = this;

		var data = new Uint8Array(24);
		var duration;
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 0);
		bits.WriteInt32(data, 8, 0);
		if (esi.streamType == "video") {
			bits.WriteInt32(data, 12, 1200000);
			duration = Math.ceil(esi.dataOffsets.length * 1000 / 30); // fps 30, unit ms ?
			bits.WriteInt32(data, 16, duration * 1200);
		} else {
			bits.WriteInt32(data, 12, 44000); // !!! fix this for audio
			duration = esi.dataOffsets.length * 1024;
			bits.WriteInt32(data, 16, duration);
		}
		bits.WriteInt16(data, 20, 0x55c4); // default lang
		bits.WriteInt16(data, 22, 0);

		return self.Box("mdhd", data);
	}

	BoxHdlr(esi) {
		var self = this;
		var componentName = "VideoHandler";
		var data = new Uint8Array(25 + componentName.length);
		bits.WriteInt32(data, 0, 0);
		if (esi.streamType == 'audio')
			self.String2Buffer("mhlr", data, 4);
		if (esi.streamType == "audio")
			self.String2Buffer("soun", data, 8);
		else if (esi.streamType == "video")
			self.String2Buffer("vide", data, 8);
		bits.WriteInt32(data, 12, 0);
		bits.WriteInt32(data, 16, 0);
		bits.WriteInt32(data, 20, 0);
		self.String2Buffer(componentName, data, 24);
		return self.Box("hdlr", data);
	}

	BoxMinf(esi) {
		var self = this;
		var vmhdBox = esi.streamType == "video" ? self.BoxVmhd(esi) : [];
		var smhdBox = esi.streamType == "audio" ? self.BoxSmhd(esi) : []; // audio not implemented
		var dinfBox = self.BoxDinf(esi);
		var stblBox = self.BoxStbl(esi);

		return self.Box("minf", [vmhdBox, smhdBox, dinfBox, stblBox]);
	}

	BoxVmhd(esi) {
		var self = this;
		var data = new Uint8Array(12);
		bits.WriteInt32(data, 0, 0x1);
		bits.WriteInt16(data, 4, 0);
		bits.WriteInt16(data, 6, 0);
		bits.WriteInt16(data, 8, 0);
		bits.WriteInt16(data, 10, 0);

		return self.Box("vmhd", data);
	}

	BoxDref(esi) {
		var self = this;
		var data = new Uint8Array(8);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 0x1);
		var urlBox = self.BoxUrl(esi);
		return self.Box("dref", [data, urlBox]);
	}

	BoxDinf(esi) {
		var self = this;
		var drefBox = self.BoxDref(esi);
		return self.Box("dinf", drefBox);
	}

	BoxUrl(esi) {
		var self = this;
		var data = new Uint8Array(4);
		bits.WriteInt32(data, 0, 0x1);
		return self.Box("url ", data);
	}

	BoxStbl(esi) {
		var self = this;
		var stsdBox = self.BoxStsd(esi);
		var stszBox = self.BoxStsz(esi);
		var sttsBox = self.BoxStts(esi);
		var stscBox = self.BoxStsc(esi);
		// only 32bits offsets for now
		var stcoBox = self.BoxStco(esi);

		return self.Box("stbl", [stsdBox, sttsBox, stscBox, stszBox, stcoBox]);
	}

	BoxStsd(esi) {
		var self = this;
		// mjpeg specific
		var data = new Uint8Array(8);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 0x1);

		var sampDescr = [];
		if (esi.streamType == "audio") { // audio not supported
			if (esi.codec.strTag == "mp4a")
				sampDescr = self.BoxMp4a(esi);
		} else if (esi.streamType == "video") {
			if (esi.codec && esi.codec.strTag == "avc1")
				sampDescr = self.BoxAvc1(esi); // avc1 not supported
			else
				sampDescr = self.BoxMp4v(esi);
		}
		return self.Box('stsd', [data, sampDescr]);
	}

	BoxMp4v(esi) {
		var self = this;
		var data = new Uint8Array(78);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 0x1);
		bits.WriteInt32(data, 8, 0);
		bits.WriteInt32(data, 12, 0);
		bits.WriteInt32(data, 16, 0);
		bits.WriteInt32(data, 20, 0);
		bits.WriteInt16(data, 24, self.width);
		bits.WriteInt16(data, 26, self.height);
		bits.WriteInt32(data, 28, 0x480000);
		bits.WriteInt32(data, 32, 0x480000);
		bits.WriteInt32(data, 36, 0);
		bits.WriteInt32(data, 40, 0x10000);
		bits.WriteInt32(data, 44, 0);
		bits.WriteInt32(data, 48, 0);
		bits.WriteInt32(data, 52, 0);
		bits.WriteInt32(data, 56, 0);
		bits.WriteInt32(data, 60, 0);
		bits.WriteInt32(data, 64, 0);
		bits.WriteInt32(data, 68, 0);
		bits.WriteInt32(data, 72, 0x18);
		bits.WriteInt16(data, 76, 0xffff);

		var esds = self.BoxEsds(esi);

		return self.Box('mp4v', [data, esds]);
	}

	BoxEsds(esi) {
		var self = this;
		var data = new Uint8Array(36);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 0x03808080);
		bits.WriteInt32(data, 8, 0x1b000100);
		bits.WriteInt32(data, 12, 0x04808080);
		bits.WriteInt32(data, 16, 0x0d6c1100);
		bits.WriteInt32(data, 20, 0x00000040);
		bits.WriteInt32(data, 24, 0x4d620040);
		bits.WriteInt32(data, 28, 0x4d620680);
		bits.WriteInt32(data, 32, 0x80800102);

		return self.Box('esds', [data]);
	}

	BoxStsz(esi) {
		var self = this;
		var sameSize = true;
		var sampleSize = esi.sampleSizes[0];
		for (var i = 1; i < esi.sampleSizes.length; i++)
			if (esi.sampleSizes[i] != sampleSize) {
				sameSize = false;
				break;
			}
		var data;
		if (sameSize) {
			data = new Uint8Array(12);
			bits.WriteInt32(data, 4, sampleSize);
		} else {
			data = new Uint8Array(12 + 4 * esi.sampleSizes.length);
			for (i = 0; i < esi.sampleSizes.length; i++)
				bits.WriteInt32(data, 12 + i * 4, esi.sampleSizes[i]);
		}
		bits.WriteInt32(data, 8, esi.sampleSizes.length);
		return self.Box('stsz', [data]);
	}

	BoxStts(esi) {
		var self = this;
		var data = new Uint8Array(16);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 1);
		bits.WriteInt32(data, 8, esi.dataOffsets.length);
		bits.WriteInt32(data, 12, 40000); // 30fps, unit 1200000
		return self.Box("stts", data);
	}

	BoxStsc(esi) {
		var self = this;
		var data = new Uint8Array(20);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 0x1);
		bits.WriteInt32(data, 8, 0x1);
		bits.WriteInt32(data, 12, 0x1);
		bits.WriteInt32(data, 16, 0x1);
		return self.Box('stsc', data);
	}

	BoxStco(esi) {
		var self = this;
		var data = new Uint8Array(8 + esi.dataOffsets.length * 4);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, esi.dataOffsets.length);
		for (var i = 0; i < esi.dataOffsets.length; i++) {
			bits.WriteInt32(data, 8 + i * 4, esi.dataOffsets[i]);
		}
		return self.Box('stco', data);
	}

	BoxElst(esi) {
		var self = this;
		var data = new Uint8Array(20);
		bits.WriteInt32(data, 0, 0);
		bits.WriteInt32(data, 4, 1);
		var duration = Math.ceil(self.streams[1].dataOffsets.length * 1000 / 30);
		bits.WriteInt32(data, 8, duration);
		bits.WriteInt32(data, 12, 0);
		bits.WriteInt16(data, 16, 1);
		bits.WriteInt16(data, 18, 0);

		return self.Box("elst", data);
	}

	BoxEdts(esi) {
		var self = this;
		var elstBox = self.BoxElst(esi);
		return self.Box("edts", elstBox);
	}

	BoxMvhd() {
		var self = this;
		var data = new Uint8Array(100);
		bits.WriteInt8(data, 0, 0);
		bits.WriteInt24(data, 1, 0);
		bits.WriteInt32(data, 4, 0);
		bits.WriteInt32(data, 8, 0);
		bits.WriteInt32(data, 12, 1000); // millisecs
		var duration = Math.ceil(self.streams[1].dataOffsets.length * 1000 / 30);
		bits.WriteInt32(data, 16, duration);

		bits.WriteInt32(data, 20, 0x00010000);
		bits.WriteInt16(data, 24, 0x0100);
		self.MakeDefaultMatrix(data, 36)
		bits.WriteInt32(data, 72, 0);
		bits.WriteInt32(data, 76, 0);
		bits.WriteInt32(data, 80, 0);
		bits.WriteInt32(data, 84, 0);
		bits.WriteInt32(data, 88, 0);
		bits.WriteInt32(data, 92, 0);

		var nextTrackId = parseInt(Object.keys(self.streams).sort().reverse()[0]) + 1;
		bits.WriteInt32(data, 96, nextTrackId);

		return self.Box("mvhd", data);
	}

	MakeDefaultMatrix(data, offset) {
		[0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].forEach(function (val, index) {
			bits.WriteInt32(data, offset + 4 * index, val);
		});
	}

	String2Buffer(str, buffer, offset) {
		buffer = buffer || new Uint8Array(str.length);
		offset = offset || 0;
		for (var i = 0, l = str.length; i < l; i++)
			buffer[offset + i] = str.charCodeAt(i) & 0xff;
		return buffer;
	}

	Length(data) {
		if (Array.isArray(data)) {
			var size = 0;
			for (var i = 0, l = data.length; i < l; i++)
				size += this.Length(data[i]);
			return size;
		} else
			return data.length;
	}

	Flatten(data) {
		if (Array.isArray(data)) {
			var FlattenData = function (data) {
				if (Array.isArray(data)) {
					for (var i = 0, l = data.length; i < l; i++)
						FlattenData(data[i]);
				} else {
					buffer.set(data, offset);
					offset += data.length;
				}
			}
			var buffer = new Uint8Array(this.Length(data));
			var offset = 0;
			FlattenData(data);
			return buffer;
		} else
			return data;
	}

	AppendFrame(data, options) {
		var self = this;
		data = self.Flatten(data);
		options = Object.assign({
			stream: 1
		}, options || {});
		self.streams[options.stream] = self.streams[options.stream] || {
			dataOffsets: [],
			sampleSizes: [],
			streamId: options.stream,
			streamType: "video",
			identicalFrames: 0
		}
		var esi = self.streams[options.stream];

		var reused = false;
		if (self.options.reuseLastFrame || self.options.ignoreIdenticalFrames) {
			var hash = crypto.createHash("RSA-MD4").update(data).digest("base64");
			if (esi.lastHash == hash && esi.lastFrameLength == data.length) {
				if (self.options.ignoreIdenticalFrames) {
					esi.identicalFrames++;
					if (esi.identicalFrames >= self.options.ignoreIdenticalFrames)
						return Promise.resolve();
				}
				reused = true;
				esi.dataOffsets.push(esi.lastFrameOffset);
			} else {
				esi.identicalFrames = 0;
				esi.lastFrameOffset = self.filePos;
				esi.lastHash = hash;
				esi.lastFrameLength = data.length;
			}
		}

		esi.sampleSizes.push(data.length);

		if (reused) {
			return Promise.resolve();
		} else {
			self.mdatSize += data.length;
			esi.dataOffsets.push(self.filePos);
			return self.WriteMulti(data);
		}
	}

	WriteMulti(data) {
		var self = this;
		data = self.Flatten(data);
		return new Promise((resolve, reject) => {
			fs.write(self.fd, data, 0, data.length, self.filePos, (err) => {
				if (err)
					return reject(err);
				self.filePos += data.length;
				resolve();
			})
		})
	}

	WriteFileHeader() {
		var self = this;
		var ftypExtra = new Uint8Array(4);
		bits.WriteInt32(ftypExtra, 0, 0x00000200);
		var ftypBox = self.Box("ftyp", [self.String2Buffer("isom"), ftypExtra, self.String2Buffer("isomiso2mp41")]);
		var freeBox = self.Box("free", []);
		return new Promise((resolve, reject) => {

			fs.open(self.options.fileName, "w", 0o644, (err, fd) => {
				if (err)
					return reject(err);
				self.fd = fd;
				self.WriteMulti([ftypBox, freeBox])
					.then(() => {
						self.mdatLengthPos = self.filePos;
						self.mdatSize = 8;
						var mdat = self.Box("mdat", []);
						return self.WriteMulti(mdat);
					})
					.then(resolve)
					.catch(reject);
			})

		})
	}

	Destroy() {
		var self = this;
		var fd = self.fd;
		self.fd = null;
		return new Promise((resolve, reject) => {
			fs.close(fd, (err) => {
				resolve();
			})
		})
	}

	finalize() {
		var self = this;
		return new Promise((resolve, reject) => {
			var lengthData = new Uint8Array(4);
			bits.WriteInt32(lengthData, 0, self.mdatSize);

			fs.write(self.fd, lengthData, 0, 4, self.mdatLengthPos, (err) => {
				if (err)
					return reject(err);

				var traks = [];
				Object.keys(self.streams).sort().forEach(function (streamId) {
					var esi = self.streams[streamId];
					var tkhdBox = self.BoxTkhd(esi);
					var mdiaBox = self.BoxMdia(esi);
					var edtsBox = self.BoxEdts(esi);
					var trakBox = self.Box('trak', [tkhdBox, edtsBox, mdiaBox]);
					traks.push(trakBox);
				});

				var mvhdBox = self.BoxMvhd();
				var moovBox = self.Box('moov', [mvhdBox, traks]);

				var finalizeError = null;
				self.WriteMulti(moovBox)
					.catch((err) => {
						finalizeError = err;
					})
					.then(() => {
						self.Destroy()
							.then(() => {
								if (finalizeError)
									reject(finalizeError);
								else
									resolve();
							})
					})

			})
		})
	}
}

module.exports = MP4;
