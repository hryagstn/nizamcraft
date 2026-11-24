// Audio synthesis utility using Web Audio API
// This avoids loading external audio files, preventing 404s and CORS issues on cPanel.

class SoundManager {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playDigSound() {
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        
        // Low thud/crack sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
        
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.16);

        // Add a bit of noise for crunch
        this.playNoise(0.08, 0.3, 0.01);
    }

    playPlaceSound() {
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        
        // Soft pop sound
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.exponentialRampToValueAtTime(90, time + 0.1);
        
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.11);
    }

    playNoise(duration, startVolume, endVolume) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        // Filter the noise to make it sound like dirt
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 300;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(startVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(endVolume, this.ctx.currentTime + duration);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        noise.start();
        noise.stop(this.ctx.currentTime + duration + 0.01);
    }

    playClickSound() {
        this.init();
        if (!this.ctx) return;
        
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, time);
        osc.frequency.setValueAtTime(400, time + 0.02);
        
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.06);
    }

    playExplosionSound() {
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        
        // Low rumble frequency
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.linearRampToValueAtTime(10, time + 0.4);
        
        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.5);

        // Noise crackle
        this.playNoise(0.4, 0.7, 0.01);
    }

    playFuseSound() {
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        const duration = 1.5;
        
        // Simulating the fuse hiss using filtered white noise
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1600;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.linearRampToValueAtTime(0.1, time + duration - 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(time);
        noise.stop(time + duration);
    }

    playHurtSound() {
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // High to low pitch growl
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.linearRampToValueAtTime(70, time + 0.15);

        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.16);
    }

    playBowSound() {
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        
        // Fast triangle pitch sweep for bow twang
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, time);
        osc.frequency.exponentialRampToValueAtTime(90, time + 0.12);
        
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.13);
    }

    playEnchantSound() {
        this.init();
        if (!this.ctx) return;

        const baseTime = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const start = baseTime + idx * 0.055;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0.18, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.34);
        });
    }

    playSwitchSound(turnOn = true) {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(turnOn ? 580 : 410, now);
        osc.frequency.exponentialRampToValueAtTime(turnOn ? 780 : 280, now + 0.045);

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.065);
    }

    playPistonSound(extending = true) {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(extending ? 110 : 155, now);
        osc.frequency.exponentialRampToValueAtTime(extending ? 175 : 75, now + 0.14);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
        this.playNoise(0.11, extending ? 620 : 420, 0.16);
    }

    playLaserSound(turnOn = true) {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(turnOn ? 320 : 720, now);
        osc.frequency.exponentialRampToValueAtTime(turnOn ? 920 : 180, now + 0.16);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
    }

    playSawHitSound() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.linearRampToValueAtTime(210, now + 0.1);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        this.playNoise(0.08, 1200, 0.14);
    }

    playMonsterRoarSound(variant = 'train') {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const profiles = {
            sea: { freqs: [72, 98], type: 'triangle', ramp: 0.72, noiseFreq: 240, gain: 0.16, duration: 0.38 },
            sky: { freqs: [320, 440], type: 'sawtooth', ramp: 0.48, noiseFreq: 860, gain: 0.14, duration: 0.34 },
            celestial: { freqs: [58, 82], type: 'sine', ramp: 0.88, noiseFreq: 180, gain: 0.2, duration: 0.5 },
            train: { freqs: [138, 185], type: 'sawtooth', ramp: 0.72, noiseFreq: 420, gain: 0.16, duration: 0.38 }
        };
        const profile = profiles[variant] || profiles.train;

        profile.freqs.forEach((baseFreq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = profile.type;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * profile.ramp, now + profile.duration);

            gain.gain.setValueAtTime(profile.gain, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration + 0.02);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + profile.duration + 0.04);
        });
        this.playNoise(0.22, profile.noiseFreq, 0.14);
    }
}

export const sounds = new SoundManager();
