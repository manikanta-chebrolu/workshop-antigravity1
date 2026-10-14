/**
 * Nexus AI - Audio & Voice Subsystem
 * Web Audio API synthesizer for UI sound effects,
 * SpeechSynthesis (TTS) and Web Speech Recognition (STT)
 */

const NexusAudio = {
  ctx: null,
  soundEnabled: true,
  speechSynth: window.speechSynthesis || null,
  recognition: null,
  isRecording: false,
  activeUtterance: null,

  // Initialize Web Audio context on user gesture
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // Soft ascending futuristic chime on send
  playSendSound() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      // Audio autoplay policy
    }
  },

  // Celestial sparkle chime on response completion
  playReceiveSound() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Note 1
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.08); // B5
      gain2.gain.setValueAtTime(0.05, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);
    } catch (e) {
      // Ignore
    }
  },

  // Subtle tap sound
  playClickSound() {
    if (!this.soundEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  },

  // Text to Speech
  speak(text, onStart, onEnd) {
    if (!this.speechSynth) {
      alert('Speech synthesis is not supported in your browser.');
      return;
    }

    this.stopSpeech();

    // Strip markdown tags and code blocks for clean voice reading
    let cleanText = text
      .replace(/```[\s\S]*?```/g, ' [Code omitted] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#\[\]()]/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick a natural voice if available
    const voices = this.speechSynth.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      this.activeUtterance = utterance;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    this.speechSynth.speak(utterance);
  },

  stopSpeech() {
    if (this.speechSynth && this.speechSynth.speaking) {
      this.speechSynth.cancel();
      this.activeUtterance = null;
    }
  },

  isSpeaking() {
    return this.speechSynth && this.speechSynth.speaking;
  },

  // Speech Recognition (Voice to text)
  initSpeechRecognition(onResult, onStateChange) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      return null;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      this.isRecording = true;
      if (onStateChange) onStateChange(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (onResult) {
        onResult(finalTranscript || interimTranscript, Boolean(finalTranscript));
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      this.isRecording = false;
      if (onStateChange) onStateChange(false);
    };

    recognition.onend = () => {
      this.isRecording = false;
      if (onStateChange) onStateChange(false);
    };

    this.recognition = recognition;
    return recognition;
  },

  toggleVoiceInput(onResult, onStateChange) {
    if (!this.recognition) {
      this.initSpeechRecognition(onResult, onStateChange);
    }
    if (!this.recognition) {
      alert('Speech Recognition is not supported by this browser. Try Google Chrome or Edge.');
      return;
    }

    if (this.isRecording) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn(e);
      }
    }
  }
};

window.NexusAudio = NexusAudio;
