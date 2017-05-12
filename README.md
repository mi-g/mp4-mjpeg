A pure Javascript Node module to create video files from images

Install
-------

npm install --save mp4-mjpeg

Usage
-----

````javascript
const mjpeg = require('mp4-mjpeg');

// starting a video file
mjpeg({ fileName: "path/to/my/file.mp4" })
	.then( (recorder) => {

		// append a JPEG image as a data URL to the video
		recorder.appendImageDataUrl( imageAsDataURL )
			.then( () => {
				// image added
			})
			.catch( (error) => {
				// something bad happened
			})

		// or if we have the image as a buffer
		recorder.appendImageBuffer( imageBuffer )
		// ...

		// all the images added ?
		// let finalize the MP4 file to make it playable
		recorder.finalize()
			.then( () => {
				// MP4 video file is ready
			})
			.catch( (error) {
				// too bad
			})

	})
	.catch( (error) => {
		// could not create the file
	})
````

API
---

- `<module>(options)`: creates a video recorder. Options have properties:
  * `fileName`: the path to the output MP4 video file
  * `reuseLastFrame`: if an image is the same as the previous one, it does not take more data in the MP4 file (default `true`)
  * `ignoreIdenticalFrames`: if not `0` and the number of successive identical images has reached the parameter value, recording is put on hold until a different image is appended to the video (default '30`, 1 second)

The module function returns a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise), not the actual recorder. To get the recorder:
````javascript
	(require('mp4-mpjpeg'))(options)
	    .then( (recorder) => {
			// the recorder can now be used to add images to the video
		});
````
- `<recorder>.appendImageDataUrl(dataUrl)`: add an image to the video. This image is encoded in *base64* prefixed with `data:image/png;base64, `, as what you get calling `canvas.toDataURL('image/jpeg')`<br/>The function returns a promise that is fulfilled when the image has been written

- `<recorder>.appendImageBuffer(buffer)`: add an image to the video. The image is a plain buffer that you can obtain by reading a JPEG file<br/>
The function returns a promise that is fulfilled when the image has been written

- `<recorder>.finalize()`: end the capturing process.<br/>
The function returns a promise that is fulfilled when the video file is ready to be played

Limitations
-----------
- only MJPEG encoding is supported
- generated video files have no audio
- framerate is fixed to 30 fps
- there is no cropping or scaling capbility in this library, the images should be processed before being appended, or the generated MP4 file can be worked afterwards
- there is no queue for appending images: the developer using this library is in charge of the flow control, which can be done easily using the promise returned by `appendXXX()`
- all appended images should have the same size, or weird things may happen

About
-----
This module has been written to cover a need on [JoclyBoard](https://github.com/mi-g/joclyboard): recording games being played in 3D. You can check JoclyBoard source code as an example of using this library
