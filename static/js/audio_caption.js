/*
Recording based on "https://blog.addpipe.com/using-recorder-js-to-capture-wav-audio-in-your-html5-web-site/"
*/

let timeVar;

let alertMessageLenght = 5; // how many seconds alert message is shown
let alertTimer;

let maxFileSize = 15 // MiB

const uploadButton = document.querySelector("#uploadButton");
const listenButton = document.querySelector("#listenButton");
const stopButton = document.querySelector("#stopButton");

uploadButton.addEventListener('change', uploadFile)
listenButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

let listenFrameLength = 15 //seconds
let listenFrameCounter = -1

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record

resizeCaptionBox();


async function uploadFile(event){
	clear_data();

    const file = event.target.files[0];
    const url = "/caption"

    var fd = new FormData();
    fd.append('file', file);
	
	if(file.size > maxFileSize*1024*1024){
		alert_message("Maximum file size is " + maxFileSize.toString() + " megabytes", false)
		this.value = "";
		return;
	 };


    var res = await fetch(url, {
        method: 'post',
        body: fd /* or aFile[0]*/
      }); // returns a promise

	if (!res.ok){
		let e = await res.json();
		alert_message(e.error, false);
		return;
	}

    var results = await res.json();

	let captions = results.captions;
	let audio_part_lenght = results.frame_length;

	insert_captions(captions, audio_part_lenght);
}



function startRecording() {
	console.log("recordButton clicked");

	clear_data();

    var constraints = { audio: true, video:false }

	uploadButton.disabled = true
	listenButton.disabled = true;
	stopButton.disabled = false;

	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

		audioContext = new AudioContext();
		//update the format 

		/*  assign to gumStream for later use  */
		gumStream = stream;
		
		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);

		rec = new Recorder(input,{numChannels:1})

		//start the recording process
		rec.record()

		timeVar = setInterval(timer, 1000*listenFrameLength)
		console.log("Recording started");

	}).catch(function(err) {
	  	//enable the record button if getUserMedia() fails
		uploadButton.disabled = false;
    	listenButton.disabled = false;
    	stopButton.disabled = true;
	});
}

function stopRecording() {
	console.log("stopButton clicked");

	//disable the stop button, enable the record too allow for new recordings
	stopButton.disabled = true;
	listenButton.disabled = false;
	uploadButton.disabled = false;

	//tell the recorder to stop the recording
	rec.stop();

	//stop microphone access
	gumStream.getAudioTracks()[0].stop();

	rec.clear()
	clearInterval(timeVar);
}

async function handleFrame(blob) {
	//name of .wav file to use during upload and download (without extendion)
	var filename = "frame.wav";
	const url = "/caption"
	// upload link
	var fd=new FormData();
	fd.append("file",blob, filename);
	var res = await fetch(url, {
		method: 'post',
		body: fd /* or aFile[0]*/
	}); // returns a promise

	if (!res.ok){
		let e = await res.json();
		alert_message(e.error, false);
		return;
	}

	let results = await res.json();

	let captions = results.captions;
	//remove unnecessary array lenght variable
	listenFrameCounter += 1;

	let timestamp = ( "<span class=\"timeStamp\">"
		+ "["
		+ (listenFrameLength*listenFrameCounter).toString()
		+ "-"
		+ (listenFrameLength*(listenFrameCounter+1)).toString()
		+ "s]"
		+ "</span>");
	
	add_to_list(timestamp + " " + captions[0])
	
}


async function timer(){
	rec.stop();
	await rec.exportWAV(handleFrame);
	rec.clear();
	rec.record();
}


function insert_captions(preds, audio_part_lenght){
	for (i = 0; i < preds.length; i++){
		let timestamp = ("<span class=\"timeStamp\">"
		+ "["
		+ (audio_part_lenght*i).toString()
		+ "-"
		+ (audio_part_lenght*(i+1)).toString()
		+ "s]"
		+ "</span>");
		preds[i] = timestamp + " " + preds[i]
		
	}
	preds.forEach(item => (add_to_list(item)));
}


function add_to_list(item){
	var list = document.querySelector('#caption_box');
	var asd = document.createElement('li');
	asd.innerHTML = item
	list.prepend(asd);
}


function clear_data(){
	listenFrameCounter = -1

	var list = document.querySelector('#caption_box');
	list.innerHTML = "";
}

// Use a timer so the chart is not constantly redrawn while window is being resized.
var resizeTimer;
window.onresize = function(event) {
 clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCaptionBox, 100);
}

function resizeCaptionBox(){
    let captionBox = document.querySelector("#caption_box");
	let actionBox = document.querySelector("#actionContainer");
	let footer = document.querySelector("#footerContainer")

	let padding = 80;

	let height = window.innerHeight - actionBox.offsetHeight - footer.offsetHeight - padding; 

	// Limit the height/width ratio to 1
	if (height > window.innerWidth){
		height = window.innerWidth;
	}

	captionBox.style.height = height.toString() + "px";
	}

function alert_message(message, success=true){

	let messageBox = document.querySelector("#alertMessageBox");

	if (messageBox.innerHTML !== ""){
		clearTimeout(alertTimer);
		messageBox.innerHTML = "";
	};


	let messageElement = document.createElement("p");
	messageElement.classList.add("alertMessage")

	let node = document.createTextNode(message);
	messageElement.appendChild(node);

	if (success){
		messageElement.classList.add("success")
	}
	else{
		messageElement.classList.add("failure")
	}

	messageBox.appendChild(messageElement);

	alertTimer = setTimeout(clear_alert_message, 1000*alertMessageLenght)
}

function clear_alert_message(){
	let messageBox = document.querySelector("#alertMessageBox");
	messageBox.innerHTML = "";
}