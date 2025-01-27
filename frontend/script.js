window.addEventListener("load", (event) => {
    console.log("Hello Gemini Realtime Demo!");

    // Initialize camera and microphone options
    setAvailableCamerasOptions();
    setAvailableMicrophoneOptions();
});

// WebSocket configuration
const PROXY_URL = "wss://3.21.98.219:8080"; // Use wss for secure WebSocket connection
const PROJECT_ID = "physician-ai-chat-project-v3";
const MODEL = "gemini-2.0-flash-exp";
const API_HOST = "us-central1-aiplatform.googleapis.com";

// DOM elements
const accessTokenInput = document.getElementById("token");
const projectInput = document.getElementById("project");
const systemInstructionsInput = document.getElementById("systemInstructions");

// Initialize CookieJar for token, project, and system instructions
CookieJar.init("token");
CookieJar.init("project");
CookieJar.init("systemInstructions");

// UI state elements
const disconnected = document.getElementById("disconnected");
const connecting = document.getElementById("connecting");
const connected = document.getElementById("connected");
const speaking = document.getElementById("speaking");

// Buttons and controls
const micBtn = document.getElementById("micBtn");
const micOffBtn = document.getElementById("micOffBtn");
const cameraBtn = document.getElementById("cameraBtn");
const screenBtn = document.getElementById("screenBtn");

const cameraSelect = document.getElementById("cameraSource");
const micSelect = document.getElementById("audioSource");

// Initialize Gemini Live API
const geminiLiveApi = new GeminiLiveAPI(PROXY_URL, PROJECT_ID, MODEL, API_HOST);

// Error handling for Gemini Live API
geminiLiveApi.onErrorMessage = (message) => {
    showDialogWithMessage(message);
    setAppStatus("disconnected");
};

// Get the selected response modality (audio or text)
function getSelectedResponseModality() {
    const radioButtons = document.querySelectorAll('md-radio[name="responseModality"]');
    let selectedValue;
    for (const radioButton of radioButtons) {
        if (radioButton.checked) {
            selectedValue = radioButton.value;
            break;
        }
    }
    return selectedValue;
}

// Get system instructions from the input field
function getSystemInstructions() {
    return systemInstructionsInput.value;
}

// Handle connect button click
function connectBtnClick() {
    setAppStatus("connecting");

    geminiLiveApi.responseModalities = getSelectedResponseModality();
    geminiLiveApi.systemInstructions = getSystemInstructions();

    geminiLiveApi.onConnectionStarted = () => {
        setAppStatus("connected");
        startAudioInput();
    };

    geminiLiveApi.setProjectId(projectInput.value);
    geminiLiveApi.connect(accessTokenInput.value);
}

// Initialize LiveAudioOutputManager for playing audio responses
const liveAudioOutputManager = new LiveAudioOutputManager();

// Handle responses from Gemini Live API
geminiLiveApi.onReceiveResponse = (messageResponse) => {
    if (messageResponse.type == "AUDIO") {
        liveAudioOutputManager.playAudioChunk(messageResponse.data);
    } else if (messageResponse.type == "TEXT") {
        console.log("Gemini said: ", messageResponse.data);
        newModelMessage(messageResponse.data);
    }
};

// Initialize LiveAudioInputManager for capturing microphone input
const liveAudioInputManager = new LiveAudioInputManager();

// Handle new audio chunks from the microphone
liveAudioInputManager.onNewAudioRecordingChunk = (audioData) => {
    geminiLiveApi.sendAudioMessage(audioData);
};

// Add a message to the chat window
function addMessageToChat(message) {
    const textChat = document.getElementById("text-chat");
    const newParagraph = document.createElement("p");
    newParagraph.textContent = message;
    textChat.appendChild(newParagraph);
}

// Add a model response to the chat window
function newModelMessage(message) {
    addMessageToChat(">> " + message);
}

// Add a user message to the chat window
function newUserMessage() {
    const textMessage = document.getElementById("text-message");
    addMessageToChat("User: " + textMessage.value);
    geminiLiveApi.sendTextMessage(textMessage.value);

    textMessage.value = "";
}

// Start capturing audio input
function startAudioInput() {
    liveAudioInputManager.connectMicrophone();
}

// Stop capturing audio input
function stopAudioInput() {
    liveAudioInputManager.disconnectMicrophone();
}

// Handle microphone button click
function micBtnClick() {
    console.log("micBtnClick");
    stopAudioInput();
    micBtn.hidden = true;
    micOffBtn.hidden = false;
}

// Handle microphone off button click
function micOffBtnClick() {
    console.log("micOffBtnClick");
    startAudioInput();

    micBtn.hidden = false;
    micOffBtn.hidden = true;
}

// Initialize LiveVideoManager and LiveScreenManager for video and screen sharing
const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");

const liveVideoManager = new LiveVideoManager(videoElement, canvasElement);
const liveScreenManager = new LiveScreenManager(videoElement, canvasElement);

// Handle new frames from the video or screen
liveVideoManager.onNewFrame = (b64Image) => {
    geminiLiveApi.sendImageMessage(b64Image);
};

liveScreenManager.onNewFrame = (b64Image) => {
    geminiLiveApi.sendImageMessage(b64Image);
};

// Start capturing video from the camera
function startCameraCapture() {
    liveScreenManager.stopCapture();
    liveVideoManager.startWebcam();
}

// Start capturing the screen
function startScreenCapture() {
    liveVideoManager.stopWebcam();
    liveScreenManager.startCapture();
}

// Handle camera button click
function cameraBtnClick() {
    startCameraCapture();
    console.log("cameraBtnClick");
}

// Handle screen share button click
function screenShareBtnClick() {
    startScreenCapture();
    console.log("screenShareBtnClick");
}

// Handle new camera selection
function newCameraSelected() {
    console.log("newCameraSelected ", cameraSelect.value);
    liveVideoManager.updateWebcamDevice(cameraSelect.value);
}

// Handle new microphone selection
function newMicSelected() {
    console.log("newMicSelected", micSelect.value);
    liveAudioInputManager.updateMicrophoneDevice(micSelect.value);
}

// Handle disconnect button click
function disconnectBtnClick() {
    setAppStatus("disconnected");
    geminiLiveApi.disconnect();
    stopAudioInput();
}

// Show a dialog with a message
function showDialogWithMessage(messageText) {
    const dialog = document.getElementById("dialog");
    const dialogMessage = document.getElementById("dialogMessage");
    dialogMessage.innerHTML = messageText;
    dialog.show();
}

// Get available media devices
async function getAvailableDevices(deviceType) {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const devices = [];
    allDevices.forEach((device) => {
        if (device.kind === deviceType) {
            devices.push({
                id: device.deviceId,
                name: device.label || device.deviceId,
            });
        }
    });
    return devices;
}

// Get available cameras
async function getAvailableCameras() {
    return await getAvailableDevices("videoinput");
}

// Get available audio input devices
async function getAvailableAudioInputs() {
    return await getAvailableDevices("audioinput");
}

// Populate a select element with options
function setMaterialSelect(allOptions, selectElement) {
    allOptions.forEach((optionData) => {
        const option = document.createElement("md-select-option");
        option.value = optionData.id;

        const slotDiv = document.createElement("div");
        slotDiv.slot = "headline";
        slotDiv.innerHTML = optionData.name;
        option.appendChild(slotDiv);

        selectElement.appendChild(option);
    });
}

// Set available camera options in the select element
async function setAvailableCamerasOptions() {
    const cameras = await getAvailableCameras();
    const videoSelect = document.getElementById("cameraSource");
    setMaterialSelect(cameras, videoSelect);
}

// Set available microphone options in the select element
async function setAvailableMicrophoneOptions() {
    const mics = await getAvailableAudioInputs();
    const audioSelect = document.getElementById("audioSource");
    setMaterialSelect(mics, audioSelect);
}

// Update the application status UI
function setAppStatus(status) {
    disconnected.hidden = true;
    connecting.hidden = true;
    connected.hidden = true;
    speaking.hidden = true;

    switch (status) {
        case "disconnected":
            disconnected.hidden = false;
            break;
        case "connecting":
            connecting.hidden = false;
            break;
        case "connected":
            connected.hidden = false;
            break;
        case "speaking":
            speaking.hidden = false;
            break;
        default:
    }
}