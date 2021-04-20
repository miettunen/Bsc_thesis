/*
d3 graph based on "https://www.d3-graph-gallery.com/graph/heatmap_basic.html"
Svg graph responsiveness based on "http://bl.ocks.org/enactdev/a647e60b209e67602304"
Recording based on "https://blog.addpipe.com/using-recorder-js-to-capture-wav-audio-in-your-html5-web-site/"
*/



let listenTimer; // Timer variable for listen interval

const uploadButton = document.querySelector("#uploadButton");
const listenButton = document.getElementById("listenButton");
const stopButton = document.getElementById("stopButton");

uploadButton.addEventListener('change', uploadFile);
listenButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

var framelength = 1 // Used in graph and listening interval
var is_drawn = false; // Redraw chart on window size change if drawn

var graph_data = []; // Graph data in form {group: frame_label, variable: class_label, value: predicted value}
var frame_labels = []; // Array of frame labels
var class_labels = [];// Array of class labels

var rt_sed_counter = -framelength; // Current frame in listening mode

var rt_frames = 5; // Number of frames shown in listen mode
var rt_n_best = 4; // How many classes per frame in listening mode

// Default ratio of the graph
var default_width = 750;
var default_height = 350;
var default_ratio = default_width / default_height;

// Margin and calculated width and height of graph
var margin = {top: 30, right: 30, bottom: 50, left: 200},
    width = default_width - margin.left - margin.right,
    height = default_height - margin.top - margin.bottom;

set_graph_size();

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode being recorded

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record




// Calculates and sets graph size based on current window size
function set_graph_size() {

	current_width = document.querySelector("#actionContainer").offsetWidth;
	current_height = window.innerHeight - document.querySelector("#actionContainer").offsetHeight;
  	current_ratio = current_width / current_height;
  
	// Check if height is limiting factor
	if ( current_ratio > default_ratio ){
	  h = current_height;
	  w = h * default_ratio;
	// Else width is limiting
	} else {
	  w = current_width;
	  h = w / default_ratio;
	}
  
	// Set new width and height based on graph dimensions
	width = w - margin.left - margin.right;
	height = h - margin.top - margin.bottom;
	document.querySelector("#my_dataviz")
  
  };
  

async function uploadFile(event){
	const file = event.target.files[0];
    const url = "/upload_sed"

    var fd = new FormData();
    fd.append('file', file);


    var res = await fetch(url, {
        method: 'post',
        body: fd /* or aFile[0]*/
      }); // returns a promise
	
	clear_data();

    matrix = await res.json();
	class_labels = matrix.pop();
	heatmap_to_d3(class_labels, matrix);
	draw_graph();
}


function startRecording() {
	console.log("recordButton clicked");

    var constraints = { audio: true, video:false }

	listenButton.disabled = true;
	stopButton.disabled = false;
	uploadButton.disabled  =true;


	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		
		console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device
		*/
		audioContext = new AudioContext();
		//update the format 

		/*  assign to gumStream for later use  */
		gumStream = stream;
		
		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);

		/* 
			Create the Recorder object and configure to record mono sound (1 channel)
			Recording 2 channels  will double the file size
		*/
		rec = new Recorder(input,{numChannels:1, sampleRate:16000})

		//start the recording process
		rec.record()
		
		// Clear graph data from previous use
		clear_data();

		listenTimer = setInterval(timer, 1000*framelength)

		// Sets current frame labels in format: [... -3*framelength, -2*framelength, -1*framelength]
		frame_labels = Array.from(Array(rt_frames).keys())
		frame_labels = frame_labels.map(function(x){return Math.round((x * framelength * 100) / 100)})
		let max_value = frame_labels[frame_labels.length -1];
		frame_labels = frame_labels.map(function(element){
			return element - max_value - 1;
		})
		

		console.log("Recording started");

	}).catch(function(err) {
	  	//enable the record button if getUserMedia() fails
    	listenButton.disabled = false;
    	stopButton.disabled = true;
		uploadButton.disabled = false;
	});
}

function stopRecording() {
	console.log("stopButton clicked");

	stopButton.disabled = true;
	listenButton.disabled = false;
	uploadButton.disabled = false;

	//tell the recorder to stop the recording
	rec.stop();

	//stop microphone access
	gumStream.getAudioTracks()[0].stop();

	//clear recording and interval, incomplete frame is not used
	rec.clear()
	clearInterval(listenTimer);
}

async function handleFrame(blob) {

	//name of .wav file to use during upload (without extendion)
	var filename = new Date().toISOString();
	const url = "/listen"

	var fd=new FormData();
	fd.append("file",blob, filename);
	var res = await fetch(url, {
		method: 'post',
		body: fd 
	}); 
	got_data = await res.json();

	// labels are last element of the data
	got_labels = got_data.pop();

	rt_sed_counter += framelength;

	frame_labels = frame_labels.map(function(element){
		return element + framelength;
	})

	add_data(got_labels, got_data);

	add_labels(got_labels);

	update_data();

	draw_graph();
}

// Listen mode timer
async function timer(){
	rec.stop();
	await rec.exportWAV(handleFrame);
	rec.clear();
	rec.record();
}

function draw_graph(){

	is_drawn = true;

	// set the dimensions and margins of the graph

	var container = d3.select("#my_dataviz");
	container.selectAll("*").remove();

	// append the svg object to the body of the page
	var svg = d3.select("#my_dataviz")
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.append("g")
	.attr("transform",
			"translate(" + margin.left + "," + margin.top + ")");


	
	// Build X scales and axis:
	var x = d3.scaleLinear()
	.range([ 0, width ])
	.domain([frame_labels[0], frame_labels[frame_labels.length-1]+framelength])
	svg.append("g")
	.attr("transform", "translate(0," + height + ")")
	.call(d3.axisBottom(x))
	var x_bandwith = x(frame_labels[1]) - x(frame_labels[0])

	// Create axis labels
	svg.append("text")
    .attr("class", "x_label")
    .attr("text-anchor", "middle")
    .attr("x", width/2)
    .attr("y", height+35)
    .text("Time (seconds)");

	svg.append("text")
    .attr("class", "y_label")
    .attr("text-anchor", "end")
    .attr("x", -10)
    .attr("y", -10)
    .text("Class");

	var y_labels = class_labels.slice(0);
	var placeholder_count = rt_n_best*rt_frames - class_labels.length

	for(i = 1; i < placeholder_count+1; i++){
		y_labels.push(" ".repeat(i))
	}
	
	// Build Y scales and axis:
	var y = d3.scaleBand()
	.range([ height, 0 ])
	.domain(y_labels)
	.padding(0.02);
	svg.append("g")
	.call(d3.axisLeft(y));

	// Build color scale
	var myColor = d3.scaleLinear()
	.range(["white", "#E67E22"])
	.domain([0,1])

	var padding = 0.5;

	svg.selectAll()
		.data(graph_data, function(d) {return d.group+':'+d.variable;})
		.enter()
		.append("rect")
		.attr("x", function(d) { return x(d.group)+padding})
		.attr("y", function(d) { return y(d.variable)+padding })
		.attr("width", x_bandwith-2*padding)
		.attr("height", y.bandwidth() )
		.style("fill", function(d) { return myColor(d.value)} )

}



// Use a timer so the chart is not constantly redrawn while window is being resized.
var resizeTimer;
window.onresize = function(event) {
 clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function()
  {
    var s = d3.selectAll('svg');
    s = s.remove();
    set_graph_size();
	if(is_drawn){
		draw_graph();
	}
  }, 100);
}

function heatmap_to_d3(classes, data){
	frame_labels = Array.from(Array(data[0].length).keys())
	// frame_labels = frame_labels.map(function(x){return Math.round((x*(framelength/2)+(framelength/2)) * 100) / 100})
	class_labels = classes

	// Converts heatmap from matrix form to "{group: frame label, variable: class, value: predicted value}" data objects
	for (i=0;i < frame_labels.length; i++){
		for (j=0; j < class_labels.length; j++){
			var u = class_labels[j]
			var t = frame_labels[i];
			var v = data[j][i]
			graph_data.push({group: t, variable: u, value: v});
		}
	}
}

function add_data(classes, data){

	// only uses the first frame from data
	for (j=0; j < classes.length; j++){
		var t = rt_sed_counter;
		var u = classes[j];
		var v = data[j][0];
		graph_data.push({group: t, variable: u, value:v});
	}
}

function update_data(){
	// remove data from oldest frame
	graph_data = graph_data.filter(element => element.group >= rt_sed_counter - ((rt_frames-1)*framelength))

	//find and remove classes that are no longer in data
	classes_not_found = [];
	class_labels.forEach(label => {
		if (!graph_data.some(element => element.variable === label)){
			classes_not_found.push(label);
		}
	})
	class_labels = class_labels.filter(function(el) {
		return !classes_not_found.includes(el);
	});
	

}

function add_labels(new_labels){
	new_labels.forEach(element => {
		if (!class_labels.includes(element)){
			class_labels.push(element);
		}
	});
};

function clear_data(){
	graph_data = [];
	frame_labels = [];
	class_labels = [];
	rt_sed_counter = -1;
}