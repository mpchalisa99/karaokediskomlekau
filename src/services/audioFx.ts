/**
 * Synthesized Karaoke Sound Effects using Web Audio API
 * No external audio files or network requests needed!
 */

class AudioFxEngine {
  private ctx: AudioContext | null = null;
  private gentleMasterGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Master Output Bus Efek Sorak & Suara Reaksi:
   * Dikalibrasi pada tingkat ~0.58 (~ -4.7 dB) sehingga suara sorak (tepuk tangan, sorak komando, dsb.)
   * terdengar jelas, mantap, dan semarak di speaker TV / master, namun tetap berada aman di bawah
   * level musik karaoke (~75-100%) agar tidak menenggelamkan lagu atau mengganggu vokal penyanyi.
   */
  private masterFxVolume: number = 0.58;

  private getGentleMasterOutput(): AudioNode {
    const ctx = this.getContext();
    if (!this.gentleMasterGain) {
      // 1. Dynamics compressor untuk menjaga puncak suara tidak distorsi dan stabil di bawah musik
      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-14, ctx.currentTime);
      this.compressorNode.knee.setValueAtTime(14, ctx.currentTime);
      this.compressorNode.ratio.setValueAtTime(4.0, ctx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
      this.compressorNode.release.setValueAtTime(0.20, ctx.currentTime);
      this.compressorNode.connect(ctx.destination);

      // 2. Calibrated master gain: 0.58 (lantang, semarak, tetapi selalu di bawah volume musik)
      this.gentleMasterGain = ctx.createGain();
      this.gentleMasterGain.gain.setValueAtTime(this.masterFxVolume, ctx.currentTime);
      this.gentleMasterGain.connect(this.compressorNode);
    }
    return this.gentleMasterGain;
  }

  /** Atur volume master sound FX secara dinamis jika diperlukan (0.0 - 1.0) */
  setMasterVolume(vol: number) {
    this.masterFxVolume = Math.max(0, Math.min(1, vol));
    if (this.gentleMasterGain && this.ctx) {
      this.gentleMasterGain.gain.setValueAtTime(this.masterFxVolume, this.ctx.currentTime);
    }
  }

  getMasterVolume(): number {
    return this.masterFxVolume;
  }

  /** Bus volume kompatibilitas yang terhubung ke master lembut */
  private getCheerOutput(): AudioNode {
    return this.getGentleMasterOutput();
  }

  /** Bus volume jingle penilaian yang terhubung ke master lembut */
  private getScoreOutput(): AudioNode {
    return this.getGentleMasterOutput();
  }

  // 👏 Crowd Applause (Tepuk Tangan Ramai & Hangat - Jelas terdengar, di bawah lagu)
  playApplause(durationSeconds: number = 3.0) {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * durationSeconds);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate natural collective clapping with random transient claps
      for (let i = 0; i < bufferSize; i++) {
        const white = (Math.random() * 2 - 1) * 0.42;
        // Spikes simulating distinct human claps in audience
        const clapSpike = Math.random() > 0.965 ? (Math.random() * 2 - 1) * 0.85 : 0;
        data[i] = white + clapSpike;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass 1: Body tepuk tangan (1050 Hz)
      const filterBody = ctx.createBiquadFilter();
      filterBody.type = 'bandpass';
      filterBody.frequency.setValueAtTime(1050, now);
      filterBody.Q.setValueAtTime(1.4, now);

      // Bandpass 2: Snap tepuk tangan (2400 Hz)
      const filterSnap = ctx.createBiquadFilter();
      filterSnap.type = 'bandpass';
      filterSnap.frequency.setValueAtTime(2400, now);
      filterSnap.Q.setValueAtTime(2.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.48, now + 0.22);
      gain.gain.setValueAtTime(0.46, now + durationSeconds - 0.7);
      gain.gain.exponentialRampToValueAtTime(0.005, now + durationSeconds);

      noise.connect(filterBody);
      noise.connect(filterSnap);
      filterBody.connect(gain);
      filterSnap.connect(gain);
      gain.connect(cheerOut);

      noise.start(now);
      noise.stop(now + durationSeconds);
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  }

  // 📢 Reggae / DJ Airhorn (Lembut & Tidak Menusuk)
  playAirhorn() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;
      const pitches = [466.16, 554.37, 622.25]; // Bb4, Db5, Eb5 chord
      const bursts = [
        { start: 0, dur: 0.14 },
        { start: 0.16, dur: 0.14 },
        { start: 0.32, dur: 0.16 },
        { start: 0.52, dur: 0.38 },
      ];

      bursts.forEach(({ start, dur }) => {
        pitches.forEach((freq) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + start);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.94, now + start + dur);

          // Warm lowpass filter to remove harsh bite
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1200, now + start);

          gain.gain.setValueAtTime(0.12, now + start);
          gain.gain.exponentialRampToValueAtTime(0.005, now + start + dur);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(cheerOut);

          osc.start(now + start);
          osc.stop(now + start + dur);
        });
      });
    } catch (e) {
      console.warn('Airhorn error:', e);
    }
  }

  // 🎉 Crowd Cheers & Whistle (Sorak Gempar Penonton & Peluit Ceria - Semarak & Jelas, Di Bawah Lagu)
  playCheer() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;
      const cheerDuration = 3.2;

      // 1. Tepuk tangan penonton sebagai alas sorak (applause bed)
      this.playApplause(cheerDuration);

      // 2. Crowd Vocal Roar ("Woooo! / Yaaay! / Horeee!" gempar penonton)
      // Dihasilkan dari noise beresonansi formant vokal manusia
      const roarBufferSize = Math.floor(ctx.sampleRate * cheerDuration);
      const roarBuffer = ctx.createBuffer(1, roarBufferSize, ctx.sampleRate);
      const roarData = roarBuffer.getChannelData(0);
      for (let i = 0; i < roarBufferSize; i++) {
        roarData[i] = (Math.random() * 2 - 1) * 0.40;
      }
      const roarSource = ctx.createBufferSource();
      roarSource.buffer = roarBuffer;

      // Formant A: Vokal rendah tubuh penonton "Ooo/Wooo" (480 Hz)
      const formantA = ctx.createBiquadFilter();
      formantA.type = 'bandpass';
      formantA.frequency.setValueAtTime(460, now);
      formantA.frequency.linearRampToValueAtTime(560, now + 0.5);
      formantA.frequency.linearRampToValueAtTime(480, now + cheerDuration);
      formantA.Q.setValueAtTime(2.2, now);

      // Formant B: Vokal semangat penonton "Yaaay/Aah" (1150 Hz)
      const formantB = ctx.createBiquadFilter();
      formantB.type = 'bandpass';
      formantB.frequency.setValueAtTime(1100, now);
      formantB.frequency.linearRampToValueAtTime(1350, now + 0.4);
      formantB.frequency.linearRampToValueAtTime(1050, now + cheerDuration);
      formantB.Q.setValueAtTime(2.0, now);

      const roarGain = ctx.createGain();
      roarGain.gain.setValueAtTime(0.01, now);
      roarGain.gain.linearRampToValueAtTime(0.38, now + 0.25);
      roarGain.gain.setValueAtTime(0.35, now + cheerDuration - 0.9);
      roarGain.gain.exponentialRampToValueAtTime(0.005, now + cheerDuration);

      roarSource.connect(formantA);
      roarSource.connect(formantB);
      formantA.connect(roarGain);
      formantB.connect(roarGain);
      roarGain.connect(cheerOut);

      roarSource.start(now);
      roarSource.stop(now + cheerDuration);

      // 3. Harmonik vokal massa (chord vokal penonton bernada hangat)
      const vocalHarmonics = [220, 277.18, 329.63, 440];
      vocalHarmonics.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const vGain = ctx.createGain();
        const vFilter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        // Sedikit vibrato & drift nada alami
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 0.35);
        osc.frequency.linearRampToValueAtTime(freq * 0.98, now + cheerDuration);

        vFilter.type = 'lowpass';
        vFilter.frequency.setValueAtTime(850 + idx * 150, now);

        vGain.gain.setValueAtTime(0.005, now);
        vGain.gain.linearRampToValueAtTime(0.08, now + 0.2);
        vGain.gain.setValueAtTime(0.07, now + cheerDuration - 1.0);
        vGain.gain.exponentialRampToValueAtTime(0.001, now + cheerDuration);

        osc.connect(vFilter);
        vFilter.connect(vGain);
        vGain.connect(cheerOut);

        osc.start(now);
        osc.stop(now + cheerDuration);
      });

      // 4. Peluit ceria penonton (Whistle glissandi - semarak & manis)
      const whistles = [
        { start: now + 0.12, baseF: 1450, peakF: 2250, endF: 1850, dur: 0.42, vol: 0.18 },
        { start: now + 0.48, baseF: 1650, peakF: 2450, endF: 2050, dur: 0.45, vol: 0.16 },
        { start: now + 1.05, baseF: 1380, peakF: 2150, endF: 1750, dur: 0.40, vol: 0.15 },
      ];

      whistles.forEach(({ start, baseF, peakF, endF, dur, vol }) => {
        const osc = ctx.createOscillator();
        const wGain = ctx.createGain();
        const wFilter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseF, start);
        osc.frequency.exponentialRampToValueAtTime(peakF, start + dur * 0.45);
        osc.frequency.exponentialRampToValueAtTime(endF, start + dur);

        // Lowpass agar tidak melengking pedas di telinga
        wFilter.type = 'lowpass';
        wFilter.frequency.setValueAtTime(3200, start);

        wGain.gain.setValueAtTime(0.005, start);
        wGain.gain.linearRampToValueAtTime(vol, start + 0.08);
        wGain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(wFilter);
        wFilter.connect(wGain);
        wGain.connect(cheerOut);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (e) {
      console.warn('Cheer error:', e);
    }
  }

  // 🪑 Lempar Kursi! (Comical Swoosh & Soft Wooden Clatter/Tumble yang Lembut & Lucu)
  playDing() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;

      // 1. Ayunan lempar kartun lembut (whoosh slide down)
      const whooshOsc = ctx.createOscillator();
      const whooshGain = ctx.createGain();
      const whooshFilter = ctx.createBiquadFilter();

      whooshOsc.type = 'sine';
      whooshOsc.frequency.setValueAtTime(650, now);
      whooshOsc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

      whooshFilter.type = 'lowpass';
      whooshFilter.frequency.setValueAtTime(900, now);

      whooshGain.gain.setValueAtTime(0.005, now);
      whooshGain.gain.linearRampToValueAtTime(0.15, now + 0.04);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      whooshOsc.connect(whooshFilter);
      whooshFilter.connect(whooshGain);
      whooshGain.connect(cheerOut);

      whooshOsc.start(now);
      whooshOsc.stop(now + 0.22);

      // 2. Comical wooden bounce & clatter kursi kayu mendarat empuk & lembut
      const bounces = [
        { f: 280, t: 0.16, d: 0.12, vol: 0.16 },
        { f: 220, t: 0.24, d: 0.14, vol: 0.13 },
        { f: 180, t: 0.34, d: 0.18, vol: 0.09 },
      ];

      bounces.forEach(({ f, t, d, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f * 1.2, now + t);
        osc.frequency.exponentialRampToValueAtTime(f, now + t + 0.03);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(f * 1.5, now + t);
        filter.Q.setValueAtTime(2.2, now + t);

        gain.gain.setValueAtTime(0.005, now + t);
        gain.gain.linearRampToValueAtTime(vol, now + t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(cheerOut);

        osc.start(now + t);
        osc.stop(now + t + d);
      });
    } catch (e) {
      console.warn('Lempar kursi sound error:', e);
    }
  }

  // 🥁 Drum Roll / Rimshot (Lembut & Halus)
  playRimshot() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;

      // Dua ketukan drum lembut
      [0, 0.14].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now + t);
        osc.frequency.exponentialRampToValueAtTime(55, now + t + 0.08);

        gain.gain.setValueAtTime(0.16, now + t);
        gain.gain.exponentialRampToValueAtTime(0.01, now + t + 0.08);

        osc.connect(gain);
        gain.connect(cheerOut);
        osc.start(now + t);
        osc.stop(now + t + 0.08);
      });

      // Cymbal crash lembut
      const bufferSize = Math.floor(ctx.sampleRate * 0.6);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.16));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4500, now + 0.28);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, now + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(cheerOut);

      noise.start(now + 0.28);
      noise.stop(now + 0.85);
    } catch (e) {
      console.warn('Rimshot error:', e);
    }
  }

  // 👎 Playful Crowd Booing / Huuu (Humor Lembut)
  playBoo(durationSeconds: number = 2.2) {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;

      // Formant lembut crowd "Huuu..."
      const pitches = [196, 220, 246, 261];
      pitches.forEach((baseFreq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        const startFreq = baseFreq + (idx % 2 === 0 ? 8 : -8);
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.linearRampToValueAtTime(startFreq * 1.04, now + 0.22);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 0.74, now + durationSeconds);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);
        filter.frequency.exponentialRampToValueAtTime(350, now + durationSeconds);
        filter.Q.setValueAtTime(3.0, now);

        gain.gain.setValueAtTime(0.005, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
        gain.gain.setValueAtTime(0.15, now + durationSeconds - 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(cheerOut);

        osc.start(now);
        osc.stop(now + durationSeconds);
      });

      // Background crowd murmur noise lembut
      const bufferSize = Math.floor(ctx.sampleRate * durationSeconds);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.25;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(400, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(300, now + durationSeconds);
      noiseFilter.Q.setValueAtTime(1.8, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.005, now);
      noiseGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
      noiseGain.gain.setValueAtTime(0.12, now + durationSeconds - 0.5);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(cheerOut);

      noise.start(now);
      noise.stop(now + durationSeconds);
    } catch (e) {
      console.warn('Boo audio error:', e);
    }
  }

  // 😂 Chuckle / Crowd Laughter (Tawa Lembut)
  playLaugh() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;
      const bursts = [0, 0.16, 0.32, 0.48, 0.64, 0.82];
      bursts.forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        const pitch = 330 - i * 15 + Math.random() * 20;
        osc.frequency.setValueAtTime(pitch * 1.15, now + t);
        osc.frequency.exponentialRampToValueAtTime(pitch, now + t + 0.12);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(750, now + t);
        filter.Q.setValueAtTime(2.5, now + t);

        gain.gain.setValueAtTime(0.005, now + t);
        gain.gain.linearRampToValueAtTime(0.14, now + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.13);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(cheerOut);

        osc.start(now + t);
        osc.stop(now + t + 0.14);
      });
    } catch (e) {
      console.warn('Laugh error:', e);
    }
  }

  // 💸 Sawer Dulu! (Gemerincing Koin Lembut)
  playSawer() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;

      // 1. Nada register lembut (Two soft bell tones)
      const bells = [
        { freq: 2489, time: 0, dur: 0.5 },
        { freq: 3729, time: 0.08, dur: 0.6 },
      ];
      bells.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        gain.gain.setValueAtTime(0.18, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
        osc.connect(gain);
        gain.connect(cheerOut);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });

      // 2. Cascade chimes gemerincing koin lembut
      const coinFrequencies = [1864, 2093, 2349, 2793, 3135, 3729];
      for (let i = 0; i < 10; i++) {
        const coinTime = now + 0.10 + i * 0.05 + Math.random() * 0.02;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const f = coinFrequencies[Math.floor(Math.random() * coinFrequencies.length)];

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, coinTime);
        osc.frequency.exponentialRampToValueAtTime(f * 0.98, coinTime + 0.18);

        gain.gain.setValueAtTime(0.14, coinTime);
        gain.gain.exponentialRampToValueAtTime(0.001, coinTime + 0.18);

        osc.connect(gain);
        gain.connect(cheerOut);
        osc.start(coinTime);
        osc.stop(coinTime + 0.18);
      }
    } catch (e) {
      console.warn('Sawer sound error:', e);
    }
  }

  // 🫡 Beri Hormat! (Military Fanfare TNI AU yang Lembut & Wibawa)
  playHormat() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;

      // Bugle notes in Bb major: Bb4 (466Hz), D5 (587Hz), F5 (698Hz), Bb5 (932Hz)
      const marchNotes = [
        { f: 466.16, t: 0, d: 0.14 },
        { f: 587.33, t: 0.15, d: 0.14 },
        { f: 698.46, t: 0.30, d: 0.16 },
        { f: 932.33, t: 0.48, d: 0.50 },
      ];

      marchNotes.forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(f * 2.8, now + t);
        filter.Q.setValueAtTime(1.5, now + t);

        gain.gain.setValueAtTime(0.005, now + t);
        gain.gain.linearRampToValueAtTime(0.16, now + t + 0.025);
        gain.gain.setValueAtTime(0.14, now + t + d - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(cheerOut);

        osc.start(now + t);
        osc.stop(now + t + d);
      });
    } catch (e) {
      console.warn('Hormat sound error:', e);
    }
  }

  // 🥚 Kasih Telor! (Comical Pop Lembut)
  playTelor() {
    try {
      const ctx = this.getContext();
      const cheerOut = this.getCheerOutput();
      const now = ctx.currentTime;

      // 1. Splat noise lembut
      const bufferSize = Math.floor(ctx.sampleRate * 0.28);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(1800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(320, now + 0.25);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.16, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(cheerOut);
      noise.start(now);
      noise.stop(now + 0.28);

      // 2. Cartoon slide down lembut
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(cheerOut);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch (e) {
      console.warn('Telor sound error:', e);
    }
  }

  private lastScoreRevealTime: number = 0;

  // 🎺 Penilaian Musik Karaoke / Jingle Skor (Dinonaktifkan: Hening saat skor muncul)
  playScoreReveal(_score: number = 90) {
    // Hening total: Suara & musik saat skor muncul dihilangkan sesuai permintaan user
    return;
  }

  // 🎙️ Suara Smart MC Diskomlekau (Menggunakan bus audio yang sama dengan suara sorak di Smart TV Samsung)
  playSmartMc(tier: 'low' | 'medium' | 'high' | 'manual' = 'manual') {
    try {
      if (tier === 'high') {
        this.playHormat();
        this.playCheer();
      } else if (tier === 'low') {
        this.playRimshot();
        this.playLaugh();
      } else if (tier === 'medium') {
        this.playHormat();
        this.playApplause(2.6);
      } else {
        this.playHormat();
        this.playCheer();
      }
    } catch (e) {
      console.warn('Smart MC AudioFx error:', e);
    }
  }
}

export const audioFx = new AudioFxEngine();

