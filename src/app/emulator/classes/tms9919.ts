import {Log} from '../../classes/log';
import {SN76489} from './sn76489';
import {State} from '../interfaces/state';
import {Util} from '../util';
import {PSG} from '../interfaces/psg';

export class TMS9919 implements PSG {

    private sn76489: SN76489;
    private sampleRate: number;
    private log: Log;

    constructor () {
        this.sn76489 = new SN76489();
        this.sampleRate = SN76489.SAMPLE_FREQUENCY;
        this.log = Log.getLog();
    }

    reset() {
        this.mute();
        this.sn76489.init(SN76489.CLOCK_3_58MHZ, this.sampleRate);
    }

    setSampleRate(sampleRate: number) {
        this.sampleRate = sampleRate;
        this.reset();
    }

    writeData(b: number) {
        this.sn76489.write(b);
    }

    mute() {
        this.writeData(0x9F);
        this.writeData(0xBF);
        this.writeData(0xDF);
        this.writeData(0xFF);
    }

    setGROMClock(gromClock: number) {
        this.log.info("GROM clock set to " + Util.toHexByte(gromClock));
        let divider;
        if (gromClock === 0xD6) {
            divider = 1;
        } else {
            divider = gromClock / 112;
        }
        this.sn76489.init(SN76489.CLOCK_3_58MHZ / divider, this.sampleRate);
    }

    update(buffer: Int8Array, length: number) {
        this.sn76489.update(buffer, 0, length);
    }

    getState(): object {
        return {
            sn76489: this.sn76489.getState()
        };
    }

    restoreState(state: any) {
        this.sn76489.restoreState(state.sn76489);
    }
}
