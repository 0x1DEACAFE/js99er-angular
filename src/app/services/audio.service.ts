import {Injectable} from '@angular/core';
import {Tape} from '../emulator/classes/tape';
import {TMS5220} from '../emulator/classes/tms5220';
import {PSG} from '../emulator/interfaces/psg';
import {Speech} from '../emulator/interfaces/speech';
import {Log} from '../classes/log';

@Injectable()
export class AudioService {

    static USE_SPEECH_SAMPLE_INTERPOLATION = true;

    static audioContext: AudioContext;

    private enabled: boolean;
    private psgDev: PSG;
    private speechDev: Speech;
    private tape: Tape;
    private sampleRate: number;
    private bufferSize: number;
    private vdpSampleBuffer: Int8Array;
    private vdpScriptProcessor: ScriptProcessorNode;
    private speechScale: number;
    private speechSampleBuffer: Int16Array;
    private speechScriptProcessor: ScriptProcessorNode;
    private speechFilter: BiquadFilterNode;
    private tapeScriptProcessor: ScriptProcessorNode;
    private tapeFilter: BiquadFilterNode;

    private log: Log = Log.getLog();

    static resumeSound() {
        if (AudioService.audioContext && AudioService.audioContext.state !== "running") {
            console.log("Resume sound");
            AudioService.audioContext.resume();
        }
    }

    constructor() { }

    init(enabled: boolean, psgDev: PSG, speechDev: Speech, tape: Tape) {
        this.psgDev = psgDev;
        this.speechDev = speechDev;
        this.tape = tape;
        if (!AudioService.audioContext && AudioContext) {
            AudioService.audioContext = new AudioContext();
        }
        if (AudioService.audioContext) {
            this.log.info("Web Audio API detected");
            this.sampleRate = AudioService.audioContext.sampleRate;
            this.log.info('AudioContext: sample rate is ' + this.sampleRate);
            this.bufferSize = 1024;
            const that = this;
            if (psgDev) {
                psgDev.setSampleRate(this.sampleRate);
                this.vdpSampleBuffer = new Int8Array(this.bufferSize);
                this.vdpScriptProcessor = AudioService.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
                this.vdpScriptProcessor.onaudioprocess = function (event) { that.onPSGAudioProcess(event); };
            }
            if (speechDev) {
                const speechSampleRate = TMS5220.SAMPLE_RATE;
                this.speechScale = this.sampleRate / speechSampleRate;
                this.speechSampleBuffer = new Int16Array(Math.floor(this.bufferSize / this.speechScale) + 1);
                this.speechScriptProcessor = AudioService.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
                this.speechScriptProcessor.onaudioprocess = function (event) { that.onSpeechAudioProcess(event); };
                this.speechFilter = AudioService.audioContext.createBiquadFilter();
                this.speechFilter.type = "lowpass";
                this.speechFilter.frequency.value = speechSampleRate / 2;
            }
            if (tape) {
                this.tapeScriptProcessor = AudioService.audioContext.createScriptProcessor(this.bufferSize, 0, 1);
                this.tapeScriptProcessor.onaudioprocess = function (event) { that.onTapeAudioProcess(event); };
                this.tapeFilter = AudioService.audioContext.createBiquadFilter();
                this.tapeFilter.type = "lowpass";
                this.tapeFilter.frequency.value = 4000;
            }
            this.setSoundEnabled(enabled);
        } else {
            this.log.warn("Web Audio API not supported by this browser.");
        }
    }

    onPSGAudioProcess(event) {
        // Get Float32Array output buffer
        const out = event.outputBuffer.getChannelData(0);
        // Get Int8Array input buffer
        this.psgDev.update(this.vdpSampleBuffer, this.bufferSize);
        // Process buffer conversion
        for (let i = 0; i < this.bufferSize; i++) {
            out[i] = this.vdpSampleBuffer[i] / 256.0;
        }
    }

    onSpeechAudioProcess(event) {
        // Get Float32Array output buffer
        const out = event.outputBuffer.getChannelData(0);
        // Get Int16Array input buffer
        this.speechDev.update(this.speechSampleBuffer, this.speechSampleBuffer.length);
        // Process buffer conversion
        let s = 0;
        let r = 0;
        for (let i = 0; i < this.speechSampleBuffer.length; i++) {
            r += this.speechScale;
            let sample = this.speechSampleBuffer[i] / 32768.0;
            let step = 0;
            if (AudioService.USE_SPEECH_SAMPLE_INTERPOLATION) {
                const nextSample = i < this.speechSampleBuffer.length - 1 ? this.speechSampleBuffer[i + 1] / 32768.0 : sample;
                step = (nextSample - sample) / r;
            }
            while (r >= 1) {
                out[s++] = sample;
                sample += step;
                r--;
            }
        }
    }

    onTapeAudioProcess(event) {
        const out = event.outputBuffer.getChannelData(0);
        this.tape.updateSoundBuffer(out);
    }

    setSoundEnabled(enabled) {
        AudioService.resumeSound();
        const oldEnabled = this.enabled;
        if (AudioService.audioContext) {
            if (enabled && !this.enabled) {
                if (this.vdpScriptProcessor) {
                    this.vdpScriptProcessor.connect(AudioService.audioContext.destination);
                }
                if (this.speechScriptProcessor) {
                    this.speechScriptProcessor.connect(this.speechFilter);
                    this.speechFilter.connect(AudioService.audioContext.destination);
                }
                if (this.tapeScriptProcessor) {
                    this.tapeScriptProcessor.connect(this.tapeFilter);
                    this.tapeFilter.connect(AudioService.audioContext.destination);
                }
            } else if (!enabled && this.enabled) {
                if (this.vdpScriptProcessor) {
                    this.vdpScriptProcessor.disconnect();
                }
                if (this.speechScriptProcessor) {
                    this.speechScriptProcessor.disconnect();
                    this.speechFilter.disconnect();
                }
                if (this.tapeScriptProcessor) {
                    this.tapeScriptProcessor.disconnect();
                }
            }
        }
        this.enabled = enabled;
        return oldEnabled;
    }
}
