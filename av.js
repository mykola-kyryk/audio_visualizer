var AV_OPTIONS = {
    canvasWidth: 80,
    canvasHeight: 130,
    smoothingTimeConstantLow: 0.3,
    smoothingTimeConstantHigh: 0.3,
    fftSize: 1024
};

var canvas = $('#canvas');
canvas.width(AV_OPTIONS.canvasWidth);
canvas.height(AV_OPTIONS.canvasHeight);

var AudioVisualizer = function () {
    var self = this;

    self.canvas = null;
    self.ctx = null;
    self.context = null;
    self.audioBuffer = null;
    self.sourceNode = null;
    self.splitter = null;
    self.analysers = [];
    self.javascriptNode = null;
    self.gradient = null;

    self.init = function (canvas, filePath) {
        if (!canvas) {
            canvas = $('#canvas');
        }

        if (!filePath) {
            filePath = "wagner-short.ogg";
        }
        self.canvas = canvas;

        // get the context from the canvas to draw on
        self.ctx = self.canvas.get()[0].getContext("2d");

        self.gradient = self.ctx.createLinearGradient(0, 0, 0, 130);
        self.gradient.addColorStop(1,'#000000');
        self.gradient.addColorStop(0.75,'#ff0000');
        self.gradient.addColorStop(0.25,'#ffff00');
        self.gradient.addColorStop(0,'#ffffff');

        if (window.AudioContext || window.webkitAudioContext) {
            self.context = new (window.AudioContext || window.webkitAudioContext)();
        } else {
            console.log('no audio context found');
        }

        // load the sound
        self.setupAudioNodes();
        self.loadSound(filePath);

        // when the javascript node is called
        // we use information from the analyzer node
        // to draw the volume
        self.javascriptNode.onaudioprocess = self.processAudio;
    };

    self.setupAudioNodes = function () {
        // setup a javascript node
        self.javascriptNode = self.context.createScriptProcessor(2048, 1, 1);
        // connect to destination, else it isn't called
        self.javascriptNode.connect(self.context.destination);


        // setup a analyzer
        self.analysers[0] = self.context.createAnalyser();
        self.analysers[0].smoothingTimeConstant = AV_OPTIONS.smoothingTimeConstantLow;
        self.analysers[0].fftSize = AV_OPTIONS.fftSize;

        self.analysers[1] = self.context.createAnalyser();
        self.analysers[1].smoothingTimeConstant = AV_OPTIONS.smoothingTimeConstantHigh;
        self.analysers[1].fftSize = AV_OPTIONS.fftSize;

        // create a buffer source node
        self.sourceNode = self.context.createBufferSource();
        self.splitter = self.context.createChannelSplitter();

        // connect the source to the analyser and the splitter
        self.sourceNode.connect(self.splitter);

        // connect one of the outputs from the splitter to
        // the analyser
        self.splitter.connect(self.analysers[0], 0, 0);
        self.splitter.connect(self.analysers[1], 1, 0);

        // connect the splitter to the javascriptnode
        // we use the javascript node to draw at a
        // specific interval.
        self.analysers[0].connect(self.javascriptNode);

        // splitter.connect(context.destination,0,0);
        // splitter.connect(context.destination,0,1);

        // and connect to destination
        self.sourceNode.connect(self.context.destination);
    };

    // load the specified sound
    self.loadSound = function (url) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';

        // When loaded decode the data
        request.onload = function() {
            // decode the data
            self.context.decodeAudioData(request.response, function(buffer) {
                // when the audio is decoded play the sound
                self.playSound(buffer);
            }, self.onError);
        };
        request.send();
    };

    // log if an error occurs
    self.onError = function (error) {
        console.log(error);
    };

    self.playSound = function (buffer) {
        self.sourceNode.buffer = buffer;
        self.start();
    };

    self.start = function (offset) {
        self.sourceNode.start(offset || 0);
    };

    self.stop = function () {
        self.sourceNode.stop();
    };

    self.getAverageVolume = function (array) {
        var values = 0;
        var average;

        var length = array.length;

        // get all the frequency amplitudes
        for (var i = 0; i < length; i++) {
            values += array[i];
        }

        average = values / length;
        return average;
    };

    self.processAudio = function() {
        var array;
        var averages = [];
        // get the average for the first channel
        array = new Uint8Array(self.analysers[0].frequencyBinCount);
        self.analysers[0].getByteFrequencyData(array);
        averages[0] = self.getAverageVolume(array);

        // get the average for the second channel
        array = new Uint8Array(self.analysers[1].frequencyBinCount);
        self.analysers[1].getByteFrequencyData(array);
        averages[1] = self.getAverageVolume(array);

        // clear the current state
        self.ctx.clearRect(0, 0, 60, 130);

        // set the fill style
        self.ctx.fillStyle = self.gradient;

        // create the meters
        self.ctx.fillRect(0, 130-averages[0], 25, 130);
        self.ctx.fillRect(30, 130-averages[1], 25, 130);
    }
};

var audioVisualizer = new AudioVisualizer();
audioVisualizer.init(canvas, "wagner-short.ogg");
