class LiveVideoManager {
    /**
     * @class LiveVideoManager
     * @classdesc Manages video streams from the camera or screen sharing.
     * @param {HTMLVideoElement} videoElement - The video element to display the stream.
     * @param {HTMLCanvasElement} canvasElement - The canvas element for capturing frames.
     */
    constructor(videoElement, canvasElement) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.stream = null;
        this.onNewFrame = null; // Callback for new frames
    }

    /**
     * @method startWebcam
     * @description Starts capturing video from the user's webcam.
     * @param {string} [deviceId=null] - The device ID of the camera to use.
     */
    async startWebcam(deviceId = null) {
        const constraints = {
            video: { deviceId: deviceId ? { exact: deviceId } : undefined }
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            this.videoElement.play();

            // Start capturing frames
            this.captureFrames();
        } catch (error) {
            console.error('Error starting webcam:', error);
            throw error;
        }
    }

    /**
     * @method stopWebcam
     * @description Stops the webcam stream and releases resources.
     */
    stopWebcam() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
            this.stream = null;
        }
    }

    /**
     * @method updateWebcamDevice
     * @description Updates the webcam device being used.
     * @param {string} deviceId - The device ID of the new camera.
     */
    async updateWebcamDevice(deviceId) {
        this.stopWebcam();
        await this.startWebcam(deviceId);
    }

    /**
     * @method captureFrames
     * @description Captures frames from the video stream and triggers the onNewFrame callback.
     */
    captureFrames() {
        const captureFrame = () => {
            if (this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
                this.canvasElement.width = this.videoElement.videoWidth;
                this.canvasElement.height = this.videoElement.videoHeight;

                const context = this.canvasElement.getContext('2d');
                context.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);

                // Trigger the onNewFrame callback with the base64 image
                if (this.onNewFrame) {
                    const imageData = this.canvasElement.toDataURL('image/jpeg');
                    this.onNewFrame(imageData);
                }
            }
            requestAnimationFrame(captureFrame);
        };

        captureFrame();
    }
}

class LiveScreenManager {
    /**
     * @class LiveScreenManager
     * @classdesc Manages screen sharing streams.
     * @param {HTMLVideoElement} videoElement - The video element to display the stream.
     * @param {HTMLCanvasElement} canvasElement - The canvas element for capturing frames.
     */
    constructor(videoElement, canvasElement) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        this.stream = null;
        this.onNewFrame = null; // Callback for new frames
    }

    /**
     * @method startCapture
     * @description Starts capturing the user's screen.
     */
    async startCapture() {
        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            this.videoElement.srcObject = this.stream;
            this.videoElement.play();

            // Start capturing frames
            this.captureFrames();
        } catch (error) {
            console.error('Error starting screen capture:', error);
            throw error;
        }
    }

    /**
     * @method stopCapture
     * @description Stops the screen capture stream and releases resources.
     */
    stopCapture() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
            this.stream = null;
        }
    }

    /**
     * @method captureFrames
     * @description Captures frames from the screen stream and triggers the onNewFrame callback.
     */
    captureFrames() {
        const captureFrame = () => {
            if (this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
                this.canvasElement.width = this.videoElement.videoWidth;
                this.canvasElement.height = this.videoElement.videoHeight;

                const context = this.canvasElement.getContext('2d');
                context.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);

                // Trigger the onNewFrame callback with the base64 image
                if (this.onNewFrame) {
                    const imageData = this.canvasElement.toDataURL('image/jpeg');
                    this.onNewFrame(imageData);
                }
            }
            requestAnimationFrame(captureFrame);
        };

        captureFrame();
    }
}

class LiveAudioInputManager {
    /**
     * @class LiveAudioInputManager
     * @classdesc Manages audio input from the user's microphone.
     */
    constructor() {
        this.stream = null;
        this.onNewAudioRecordingChunk = null; // Callback for new audio chunks
    }

    /**
     * @method connectMicrophone
     * @description Connects to the user's microphone and starts capturing audio.
     * @param {string} [deviceId=null] - The device ID of the microphone to use.
     */
    async connectMicrophone(deviceId = null) {
        const constraints = {
            audio: { deviceId: deviceId ? { exact: deviceId } : undefined }
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Start processing audio chunks
            this.processAudioStream();
        } catch (error) {
            console.error('Error connecting microphone:', error);
            throw error;
        }
    }

    /**
     * @method disconnectMicrophone
     * @description Disconnects the microphone and stops capturing audio.
     */
    disconnectMicrophone() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    /**
     * @method updateMicrophoneDevice
     * @description Updates the microphone device being used.
     * @param {string} deviceId - The device ID of the new microphone.
     */
    async updateMicrophoneDevice(deviceId) {
        this.disconnectMicrophone();
        await this.connectMicrophone(deviceId);
    }

    /**
     * @method processAudioStream
     * @description Processes the audio stream and triggers the onNewAudioRecordingChunk callback.
     */
    processAudioStream() {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(this.stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
            if (this.onNewAudioRecordingChunk) {
                const audioData = event.inputBuffer.getChannelData(0);
                this.onNewAudioRecordingChunk(audioData);
            }
        };
    }
}