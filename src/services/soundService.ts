// Basic synth sound service
export const soundService = {
    ctx: null as AudioContext | null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playTap() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },

    playStart() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    },

    playCountdown() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },

    playWin() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Victory Fanfare
        [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50].forEach((freq, i) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();

            osc.type = 'square';
            osc.frequency.value = freq;

            const time = now + (i * 0.15); // Slower melody
            if (i >= 4) { // Last two notes
                gain.gain.setValueAtTime(0.1, time);
                gain.gain.linearRampToValueAtTime(0, time + 0.4);
                osc.start(time);
                osc.stop(time + 0.4);
            } else {
                gain.gain.setValueAtTime(0.1, time);
                gain.gain.linearRampToValueAtTime(0, time + 0.1);
                osc.start(time);
                osc.stop(time + 0.1);
            }

            osc.connect(gain);
            gain.connect(this.ctx!.destination);
        });
    },

    playMenuMusic() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        // Simple ambient drone/loop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = 110; // Low A

        lfo.type = 'sine';
        lfo.frequency.value = 2; // 2Hz pulse
        lfoGain.gain.value = 50;

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.value = 0.05;

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        // Store reference to stop later if needed (simple implementation for now)
    }
};
