/*
 * mp4-mjpeg <https://github.com/mi-g/mp4-mjpeg>
 *
 * Copyright (c) 2017, Michel Gutierrez.
 * Licensed under the MIT License.
 */
/* jslint bitwise: true */
exports.ReadString = function (data, offset) {
	var chars = [];
	while (data[offset])
		chars.push(data[offset++]);
	return {
		string: String.fromCharCode.apply(null, chars),
		length: chars.length + 1,
	}
}

exports.ReadInt64 = function (data, offset) {
	var upper = exports.ReadInt32(data, offset);
	var lower = exports.ReadInt32(data, offset + 4);
	return upper * 0x100000000 + lower;
}

exports.ReadInt32 = function (data, offset) {
	var v = (data[offset] << 24) + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3];
	return v;
}

exports.ReadInt24 = function (data, offset) {
	var v = (data[offset] << 16) + (data[offset + 1] << 8) + data[offset + 2];
	return v;
}

exports.ReadInt16 = function (data, offset) {
	var v = (data[offset] << 8) + data[offset + 1];
	return v;
}

exports.ReadInt8 = function (data, offset) {
	var v = data[offset];
	return v;
}

exports.WriteInt32 = function (data, offset, value) {
	data[offset] = ((value >>> 24) & 0xff) >>> 0;
	data[offset + 1] = ((value >>> 16) & 0xff) >>> 0;
	data[offset + 2] = ((value >>> 8) & 0xff) >>> 0;
	data[offset + 3] = (value & 0xff) >>> 0;
}

exports.WriteInt24 = function (data, offset, value) {
	data[offset] = ((value >>> 16) & 0xff) >>> 0;
	data[offset + 1] = ((value >>> 8) & 0xff) >>> 0;
	data[offset + 2] = (value & 0xff) >>> 0;
}

exports.WriteInt16 = function (data, offset, value) {
	data[offset] = ((value >>> 8) & 0xff) >>> 0;
	data[offset + 1] = (value & 0xff) >>> 0;
}

exports.WriteInt8 = function (data, offset, value) {
	data[offset] = (value & 0xff) >>> 0;
}

exports.dump = function (data, offset, length) {
	offset = offset || 0;
	length = length || data.length;
	var hex = [];
	for (var i = 0; i < length && i < data.length; i++) {
		if (i % 16 === 0)
			hex.push("\n");
		var s = data[offset + i].toString(16).toUpperCase();
		if (s.length == 1)
			s = "0" + s;

		hex.push(s);

		if ((i + 1) % 16 === 0 || i == length - 1 || i == data.length - 1) {
			for (var j = i + 1; j < ((i + 15) & 0xfffffff0); j++)
				hex.push("  ");
			s = "";
			for (j = i & 0xfffffff0; j <= i; j++) {
				var chr = data[offset + j];
				if (chr >= 0x20 && chr < 0x7f)
					s += String.fromCharCode(chr);
				else
					s += '.';
			}
			hex.push(s);
		}

	}
	return hex.join(" ");
}