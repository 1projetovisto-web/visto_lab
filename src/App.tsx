import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Menu, X, Info, ArrowUpRight, Github, Instagram, Twitter, BookOpen, User, LogOut, CheckCircle, Award, AlertTriangle, Search, ArrowLeft } from 'lucide-react';
import { ARTWORKS, Artwork, COURSES, Course, Lesson } from './data';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where,
  handleFirestoreError, OperationType, FirebaseUser
} from './firebase';

type View = 'gallery' | 'courses' | 'login' | 'live' | 'artists' | 'sonora' | 'podcast';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-center">
          <div className="max-w-md p-12 border border-accent/30 bg-accent/5">
            <AlertTriangle className="mx-auto mb-6 text-accent" size={48} />
            <h2 className="font-display text-2xl font-bold uppercase mb-4">Algo deu errado</h2>
            <p className="font-sans text-sm opacity-70 mb-8">
              Ocorreu um erro inesperado. Se for um problema de permissão, verifique se você está logado corretamente.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-accent text-bg font-mono text-[10px] uppercase tracking-widest font-bold"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const Magnetic = ({ children, strength = 0.5 }: { children: ReactNode; strength?: number }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const x = (clientX - centerX) * strength;
    const y = (clientY - centerY) * strength;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
};

const ConstellationBackground = ({ isSoundEnabled = true }: { isSoundEnabled?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio state refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  
  // Drone state refs
  const droneOscRef = useRef<OscillatorNode | null>(null);
  const droneFilterRef = useRef<BiquadFilterNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);

  const isAudioInitialized = useRef(false);
  
  // Interaction tracking
  const smoothedSpeedRef = useRef(0);
  const lastMousePosRef = useRef({ x: -1000, y: -1000 });
  
  // Sequencer state
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const tempoRef = useRef(90);
  const previousConnectionsRef = useRef<Set<string>>(new Set());
  const currentMarkovStateRef = useRef(3); // Start at index 3 (E4)

  const initAudio = () => {
    if (isAudioInitialized.current) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    isAudioInitialized.current = true;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const convolver = ctx.createConvolver();
    const reverbGain = ctx.createGain();

    masterGain.gain.value = isSoundEnabled ? 0.4 : 0; // Volume geral

    // --- CONVOLUTION REVERB (Caverna/Catedral) ---
    // Gerando uma Resposta de Impulso (IR) sintética de 3 segundos
    const sampleRate = ctx.sampleRate;
    const duration = 3.0;
    const decay = 3.0; // Cauda longa
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const envelope = Math.pow(1 - i / length, decay);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }
    convolver.buffer = impulse;
    reverbGain.gain.value = 0.8; // Volume do Reverb (Wet)
    
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);
    convolverNodeRef.current = convolver;

    // Compressor para proteger contra picos
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    masterGainRef.current = masterGain;

    // --- DRONE LAYER (Ambient Background) ---
    const droneOsc = ctx.createOscillator();
    const droneOsc2 = ctx.createOscillator(); // Segundo oscilador para efeito "Chorus" etéreo
    const droneFilter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();

    droneOsc.type = 'sine'; // Som puro e suave
    droneOsc.frequency.value = 150; // Frequência base
    
    droneOsc2.type = 'sine';
    droneOsc2.frequency.value = 152; // Levemente desafinado para criar batimento (beating) espacial

    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 800; // Filtro base

    droneGain.gain.value = 0; // Começa mudo

    droneOsc.connect(droneFilter);
    droneOsc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain); // Conecta ao master (antes do compressor)
    if (convolverNodeRef.current) {
        droneGain.connect(convolverNodeRef.current); // Envia o drone para a caverna também
    }

    droneOsc.start();
    droneOsc2.start();

    droneOscRef.current = droneOsc;
    droneFilterRef.current = droneFilter;
    droneGainRef.current = droneGain;
  };

  const playPulse = (speed: number, type: 'kick' | 'tick' | 'bass', time: number) => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    const convolver = convolverNodeRef.current;
    if (!ctx || !master) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'kick') {
      osc.type = 'sine';
      const baseFreq = 60 + (speed / 50) * 20; // Mais grave
      osc.frequency.setValueAtTime(baseFreq, time);
      osc.frequency.exponentialRampToValueAtTime(20, time + 0.2);

      // Ataque mais suave (thud profundo em vez de click)
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      
      osc.connect(gain);
      gain.connect(master);
      osc.start(time);
      osc.stop(time + 0.5);
      
    } else if (type === 'tick') {
      // Substituindo o "tick" áspero por um "chime" etéreo de alta frequência
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000 + Math.random() * 500, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.02, time + 0.02); // Bem baixinho
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      
      osc.connect(gain);
      gain.connect(master);
      if (convolver) gain.connect(convolver); // Eco no chime
      osc.start(time);
      osc.stop(time + 0.15);
      
    } else if (type === 'bass') {
      osc.type = 'sine'; // Trocado de triangle para sine para ficar mais aveludado
      const bassNotes = [55.00, 65.41, 73.42, 82.41, 98.00]; // A1, C2, D2, E2, G2
      const freq = bassNotes[Math.floor(Math.random() * bassNotes.length)];
      osc.frequency.setValueAtTime(freq, time);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150 + speed * 10, time);
      filter.frequency.exponentialRampToValueAtTime(80, time + 0.3);

      // Ataque bem lento para o baixo pulsar suavemente
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      if (convolver) gain.connect(convolver);
      osc.start(time);
      osc.stop(time + 0.6);
    }
  };

  const playPentatonicNote = (opacity: number) => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    const convolver = convolverNodeRef.current;
    if (!ctx || !master) return;

    // --- CADEIA DE MARKOV (Música Generativa) ---
    // Escala Pentatônica (A menor: A3, C4, D4, E4, G4, A4, C5)
    const PENTATONIC_NOTES = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
    
    // Matriz de Transição (Probabilidades)
    const MARKOV_MATRIX = [
      [0.1, 0.4, 0.2, 0.1, 0.1, 0.1, 0.0], // De A3
      [0.3, 0.1, 0.4, 0.1, 0.1, 0.0, 0.0], // De C4
      [0.1, 0.3, 0.1, 0.4, 0.1, 0.0, 0.0], // De D4
      [0.1, 0.1, 0.3, 0.1, 0.3, 0.1, 0.0], // De E4
      [0.0, 0.1, 0.1, 0.3, 0.1, 0.3, 0.1], // De G4
      [0.1, 0.0, 0.1, 0.1, 0.3, 0.1, 0.3], // De A4
      [0.0, 0.0, 0.0, 0.2, 0.2, 0.5, 0.1], // De C5
    ];

    // Escolhe a próxima nota baseada na probabilidade da nota atual
    const currentState = currentMarkovStateRef.current;
    const probabilities = MARKOV_MATRIX[currentState];
    const rand = Math.random();
    let cumulative = 0;
    let nextState = currentState;

    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (rand <= cumulative) {
        nextState = i;
        break;
      }
    }
    
    currentMarkovStateRef.current = nextState;
    const freq = PENTATONIC_NOTES[nextState];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine'; // Som suave e harmonioso
    osc.frequency.value = freq;

    // Volume baseado na opacidade da linha (força da conexão)
    const volume = Math.max(0.02, Math.min(0.15, opacity)); // Reduzido um pouco para o reverb não embolar

    // Envelope etéreo (ataque lento, release muito longo)
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.15); // 150ms attack (pad/swell)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5); // 1.5s release

    osc.connect(gain);
    gain.connect(master);
    if (convolver) gain.connect(convolver); // Envia para a Caverna (Reverb)

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;
    
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseRadius: number;
      life: number;
      maxLife: number;

      constructor(x?: number, y?: number, isTemporary: boolean = false) {
        this.x = x ?? Math.random() * width;
        this.y = y ?? Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.baseRadius = Math.random() * 2 + 1.5; // 3px to 7px diameter
        this.radius = this.baseRadius;
        this.maxLife = isTemporary ? Math.random() * 100 + 100 : Infinity;
        this.life = this.maxLife;
      }

      update(mouseX: number, mouseY: number, isHovering: boolean) {
        // Gravitational pull towards mouse
        if (isHovering) {
          const dx = mouseX - this.x;
          const dy = mouseY - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 250) {
            const force = (250 - dist) / 250;
            this.vx += (dx / dist) * force * 0.05;
            this.vy += (dy / dist) * force * 0.05;
          }
        }

        // Friction / Speed limit
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.5) {
          this.vx = (this.vx / speed) * 1.5;
          this.vy = (this.vy / speed) * 1.5;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Wrap around
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

        if (this.maxLife !== Infinity) {
          this.life--;
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        const opacity = this.maxLife !== Infinity ? (this.life / this.maxLife) * 0.6 : 0.6;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 253, 231, ${opacity})`; // Ocre Suave core
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#CCFF00'; // Accent color glow
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    let particles: Particle[] = [];
    const initParticles = () => {
      particles = [];
      const numParticles = Math.min(Math.floor((width * height) / 12000), 100); // Optimized count
      for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
      }
    };
    initParticles();

    let animationFrameId: number;
    let mouseX = -1000;
    let mouseY = -1000;
    let isHovering = false;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      // --- AUDIO LOGIC: Sequencer ---
      try {
        if (isHovering && isAudioInitialized.current && audioCtxRef.current?.state === 'running') {
          const now = audioCtxRef.current.currentTime;
          
          // Initialize nextNoteTime if it's 0 or too far in the past
          if (nextNoteTimeRef.current === 0 || nextNoteTimeRef.current < now) {
            nextNoteTimeRef.current = now + 0.05;
          }

          // Lookahead scheduling (schedule notes slightly ahead of time)
          while (nextNoteTimeRef.current < now + 0.1) {
            const speed = Math.min(smoothedSpeedRef.current, 50);
            
            // Dynamic tempo: 70 BPM (idle) to 160 BPM (fast)
            const targetTempo = 70 + (speed / 50) * 90;
            tempoRef.current = tempoRef.current * 0.95 + targetTempo * 0.05;
            
            const secondsPerBeat = 60.0 / tempoRef.current;
            const secondsPerSixteenth = secondsPerBeat / 4;
            
            const step = currentStepRef.current;
            let playKick = false;
            let playTick = false;
            let playBass = false;
            
            // Rhythmic variations based on speed
            if (speed < 5) {
               // Very slow: Ambient heartbeat
               if (step === 0) playKick = true;
               if (step === 8) playBass = true;
            } else if (speed < 20) {
               // Medium: Steady groove
               if (step === 0 || step === 8) playKick = true;
               if (step === 4 || step === 12) playTick = true;
               if (step === 10) playBass = true; // Syncopated bass
            } else {
               // Fast: Urgent, syncopated techno/glitch feel
               if (step === 0 || step === 3 || step === 8 || step === 11) playKick = true;
               if (step % 2 === 1) playTick = true;
               if (step === 6 || step === 14) playBass = true;
            }

            const scheduleTime = nextNoteTimeRef.current;
            if (playKick) playPulse(speed, 'kick', scheduleTime);
            if (playTick) playPulse(speed, 'tick', scheduleTime);
            if (playBass) playPulse(speed, 'bass', scheduleTime);
            
            nextNoteTimeRef.current += secondsPerSixteenth;
            currentStepRef.current = (step + 1) % 16;
          }
        }
      } catch (e) {
        console.error("Audio sequencer error:", e);
      }

      // Trail effect
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Dark background fade for motion blur
      ctx.fillRect(0, 0, width, height);

      // Smooth merging
      ctx.globalCompositeOperation = 'screen';

      let currentConnections = new Set<string>();

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update(mouseX, mouseY, isHovering);
        p.draw(ctx);

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Constellation connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = (1 - dist / 120) * 0.4;
            ctx.strokeStyle = `rgba(204, 255, 0, ${opacity * 0.8})`; // Accent color tint
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // --- AUDIO LOGIC: Connection Notes ---
            const pairId = `${i}-${j}`;
            currentConnections.add(pairId);

            // Check if this is a NEW connection near the mouse
            if (isHovering && isAudioInitialized.current && audioCtxRef.current?.state === 'running') {
              const distToMouse = Math.sqrt(Math.pow(p.x - mouseX, 2) + Math.pow(p.y - mouseY, 2));
              if (distToMouse < 150 && !previousConnectionsRef.current.has(pairId)) {
                // Throttle note generation slightly to avoid overwhelming
                if (Math.random() > 0.5) {
                  playPentatonicNote(opacity);
                }
              }
            }
          }
        }
      }

      previousConnectionsRef.current = currentConnections;
      
      // Decay speed
      smoothedSpeedRef.current *= 0.95;
    };

    draw();

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    const updateInteraction = (clientX: number, clientY: number, target: HTMLElement) => {
      if (!isAudioInitialized.current) {
        initAudio();
      }

      const parent = canvas.parentElement;
      if (!parent) return;
      
      const rect = parent.getBoundingClientRect();
      const newMouseX = clientX - rect.left;
      const newMouseY = clientY - rect.top;
      
      // Calculate speed
      if (isHovering) {
        const dx = newMouseX - lastMousePosRef.current.x;
        const dy = newMouseY - lastMousePosRef.current.y;
        const speed = Math.sqrt(dx*dx + dy*dy);
        smoothedSpeedRef.current = smoothedSpeedRef.current * 0.8 + speed * 0.2;
      }

      mouseX = newMouseX;
      mouseY = newMouseY;
      lastMousePosRef.current = { x: mouseX, y: mouseY };
      isHovering = true;

      // Update Audio
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        // Attempt to resume on move (browser might block until first tap/click, but we try)
        audioCtxRef.current.resume().catch(() => {});
      }

      // --- DRONE LAYER MODULATION ---
      if (audioCtxRef.current && droneOscRef.current && droneFilterRef.current && droneGainRef.current) {
        const now = audioCtxRef.current.currentTime;
        
        // Mapeamento de Frequência (Tom): X -> Frequência (grave à esquerda, agudo à direita)
        const xRatio = Math.max(0, Math.min(1, mouseX / width));
        const minFreq = 100; // Grave profundo
        const maxFreq = 400; // Médio suave
        const targetFreq = minFreq * Math.pow(maxFreq / minFreq, xRatio);
        droneOscRef.current.frequency.setTargetAtTime(targetFreq, now, 0.5);

        // Mapeamento de Filtro (Brilho/Timbre): Y -> Cutoff (brilhante no topo, abafado embaixo)
        const yRatio = Math.max(0, Math.min(1, mouseY / height));
        const minCutoff = 200;
        const maxCutoff = 2500;
        // Invert Y so top is bright (high cutoff) and bottom is muffled (low cutoff)
        const targetCutoff = maxCutoff * Math.pow(minCutoff / maxCutoff, yRatio);
        droneFilterRef.current.frequency.setTargetAtTime(targetCutoff, now, 0.5);

        // Fade in volume when hovering (suave e atmosférico)
        droneGainRef.current.gain.setTargetAtTime(0.15, now, 0.8);
      }
      
      if (target.closest('h1') || target.closest('input')) {
        // Inject new temporary particles on hover movement
        if (Math.random() > 0.7 && particles.length < 250) {
          for(let i = 0; i < 2; i++) {
            particles.push(new Particle(
              mouseX + (Math.random() - 0.5) * 40, 
              mouseY + (Math.random() - 0.5) * 40,
              true
            ));
          }
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateInteraction(e.clientX, e.clientY, e.target as HTMLElement);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateInteraction(e.touches[0].clientX, e.touches[0].clientY, e.target as HTMLElement);
      }
    };

    const handleInteractionEnd = () => {
      isHovering = false;
      mouseX = -1000;
      mouseY = -1000;

      // Fade out drone
      if (audioCtxRef.current && droneGainRef.current) {
        droneGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 1.0);
      }
    };

    const handleGlobalInteraction = () => {
      if (!isAudioInitialized.current) initAudio();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    // Global listeners to unlock audio on any interaction
    window.addEventListener('click', handleGlobalInteraction);
    window.addEventListener('touchstart', handleGlobalInteraction);
    window.addEventListener('keydown', handleGlobalInteraction);
    window.addEventListener('mousemove', handleGlobalInteraction);
    window.addEventListener('touchmove', handleGlobalInteraction);

    const parent = canvas.parentElement;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleInteractionEnd);
      parent.addEventListener('touchmove', handleTouchMove, { passive: true });
      parent.addEventListener('touchend', handleInteractionEnd);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleGlobalInteraction);
      window.removeEventListener('touchstart', handleGlobalInteraction);
      window.removeEventListener('keydown', handleGlobalInteraction);
      window.removeEventListener('mousemove', handleGlobalInteraction);
      window.removeEventListener('touchmove', handleGlobalInteraction);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleInteractionEnd);
        parent.removeEventListener('touchmove', handleTouchMove);
        parent.removeEventListener('touchend', handleInteractionEnd);
      }
    };
  }, []);

  useEffect(() => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    const gain = isSoundEnabled ? 0.4 : 0;
    masterGainRef.current.gain.setTargetAtTime(
      gain,
      audioCtxRef.current.currentTime,
      0.1
    );
  }, [isSoundEnabled]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full opacity-100 pointer-events-none rounded-xl z-0"
    />
  );
};

const SCRAMBLE_CHARS = '!<>-_\\\\/[]{}—=+*^?#01';

const ScrambleChar: React.FC<{ 
  char: string; 
  delay: number; 
  isHighlighted: boolean; 
}> = ({ char, delay, isHighlighted }) => {
  const [displayChar, setDisplayChar] = useState(char === ' ' ? ' ' : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);

  useEffect(() => {
    if (char === ' ') return;

    let iteration = 0;
    const maxIterations = delay * 20; // 50ms interval = 20 iterations per second

    const scrambleInterval = setInterval(() => {
      setDisplayChar(SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
      iteration++;
      
      if (iteration >= maxIterations) {
        clearInterval(scrambleInterval);
        setDisplayChar(char);
      }
    }, 50);

    return () => clearInterval(scrambleInterval);
  }, [char, delay]);

  return (
    <motion.span
      className={`relative inline-block cursor-default group ${isHighlighted ? 'text-accent italic' : 'text-white'} transition-all duration-300 ease-in-out`}
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5 }}
      whileHover={{ 
        scale: 1.8,
        z: 250,
        color: '#CCFF00',
        textShadow: '0 20px 40px rgba(204, 255, 0, 0.4), 0 -10px 20px rgba(255, 255, 255, 0.1)',
        transition: { 
          type: 'spring', 
          stiffness: 500, 
          damping: 15 
        }
      }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Depth Layer (Ghost) */}
      <span 
        className="absolute inset-0 opacity-0 group-hover:opacity-40 blur-[4px] pointer-events-none transition-opacity duration-300"
        style={{ transform: 'translateZ(-30px)' }}
      >
        {displayChar}
      </span>
      {/* Secondary Depth Layer */}
      <span 
        className="absolute inset-0 opacity-0 group-hover:opacity-20 blur-[8px] pointer-events-none transition-opacity duration-500"
        style={{ transform: 'translateZ(-60px)' }}
      >
        {displayChar}
      </span>
      {/* Tertiary Depth Layer */}
      <span 
        className="absolute inset-0 opacity-0 group-hover:opacity-10 blur-[12px] pointer-events-none transition-opacity duration-700"
        style={{ transform: 'translateZ(-90px)' }}
      >
        {displayChar}
      </span>
      {/* Quaternary Depth Layer */}
      <span 
        className="absolute inset-0 opacity-0 group-hover:opacity-5 blur-[16px] pointer-events-none transition-opacity duration-1000"
        style={{ transform: 'translateZ(-120px)' }}
      >
        {displayChar}
      </span>
      {displayChar}
    </motion.span>
  );
};

const InteractiveTitle = ({ 
  text, 
  lines,
  className, 
  highlights = [] 
}: { 
  text?: string; 
  lines?: { text: string; className?: string }[];
  className?: string; 
  highlights?: string[] 
}) => {
  const contentLines = lines || (text ? [{ text, className }] : []);
  
  return (
    <div className="perspective-[1000px] w-full flex flex-col items-center justify-center text-center">
      <h1 className="w-full flex flex-col gap-2 md:gap-4">
        {contentLines.map((line, lineIdx) => {
          const words = line.text.split(' ');
          return (
            <div key={lineIdx} className={`py-2 ${line.className || className}`}>
            {words.map((word, wordIdx) => {
              const isHighlighted = highlights.some(h => word.toLowerCase().includes(h.toLowerCase()));
              return (
                <span key={wordIdx} className="inline-block mr-[0.3em] whitespace-nowrap" style={{ transformStyle: 'preserve-3d' }}>
                  {word.split('').map((char, charIdx) => {
                    const delay = (lineIdx * 0.6) + (wordIdx * 0.15) + (charIdx * 0.08) + 0.5;
                    return (
                      <ScrambleChar 
                        key={charIdx} 
                        char={char} 
                        delay={delay} 
                        isHighlighted={isHighlighted} 
                      />
                    );
                  })}
                </span>
              );
            })}
            </div>
          );
        })}
      </h1>
    </div>
  );
};

const ScrambleTitle = ({ onClick }: { onClick: () => void }) => {
  const [text1, setText1] = useState("V.I.S.T.O");
  const [text2, setText2] = useState("LAB");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const handleMouseOver = () => {
    let iteration = 0;
    const target1 = "V.I.S.T.O";
    const target2 = "LAB";
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setText1(
        target1
          .split("")
          .map((letter, index) => {
            if(letter === '.') return '.';
            if(index < iteration) return target1[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("")
      );
      
      setText2(
        target2
          .split("")
          .map((letter, index) => {
            if(index < iteration) return target2[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("")
      );

      if(iteration >= Math.max(target1.length, target2.length)){
        if (intervalRef.current) clearInterval(intervalRef.current);
      }

      iteration += 1 / 3;
    }, 30);
  };

  return (
    <h1 
      onClick={onClick}
      onMouseEnter={handleMouseOver}
      className="font-mono text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight uppercase cursor-pointer hover:bg-black hover:text-white hover:drop-shadow-[0_0_15px_rgba(204,255,0,0.8)] px-2 py-1 md:px-3 md:py-2 rounded-2xl transition-all duration-300 flex items-center gap-1 md:gap-2 group shrink-0"
    >
      <span>{text1}</span> <span className="text-accent group-hover:text-white transition-colors duration-300">{text2}</span>
    </h1>
  );
};

const ScrambleNavItem = ({ text, onClick, isActive, as: Component = 'button', 'aria-label': ariaLabel, 'aria-pressed': ariaPressed, className, layoutId = 'nav-indicator' }: { text: string, onClick: () => void, isActive: boolean, as?: any, 'aria-label'?: string, 'aria-pressed'?: boolean, className?: string, layoutId?: string }) => {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  const handleMouseOver = () => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if(char === ' ') return ' ';
            if(index < iteration) return text[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("")
      );

      if(iteration >= text.length){
        if (intervalRef.current) clearInterval(intervalRef.current);
      }

      iteration += 1 / 3;
    }, 30);
  };

  return (
    <Component 
      onClick={onClick}
      onMouseEnter={handleMouseOver}
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
      className={`font-mono text-[10px] sm:text-xs md:text-sm lg:text-base uppercase tracking-wider md:tracking-widest px-2 md:px-3 xl:px-4 py-1.5 md:py-2 rounded-xl transition-all duration-300 hover:bg-black hover:text-white hover:drop-shadow-[0_0_15px_rgba(204,255,0,0.8)] whitespace-nowrap cursor-pointer ${isActive ? 'text-accent' : 'text-white'} ${className || ''}`}
      role={Component !== 'button' ? 'button' : undefined}
      tabIndex={Component !== 'button' ? 0 : undefined}
      onKeyDown={Component !== 'button' ? (e: any) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {displayText}
    </Component>
  );
};

const ScramblePageTitle = ({ text, className }: { text: string, className?: string }) => {
  const [displayText, setDisplayText] = useState(text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const handleMouseOver = () => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if(char === ' ' || char === '.' || char === 'Ⓐ') return char;
            if(index < iteration) return text[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("")
      );

      if(iteration >= text.length){
        if (intervalRef.current) clearInterval(intervalRef.current);
      }

      iteration += 1 / 3;
    }, 30);
  };

  useEffect(() => {
    handleMouseOver();
  }, [text]);

  return (
    <h2 
      onMouseEnter={handleMouseOver}
      className={`${className} cursor-crosshair transition-all duration-300 hover:bg-black hover:text-white hover:drop-shadow-[0_0_15px_rgba(204,255,0,0.8)] px-4 py-2 -ml-4 rounded-2xl inline-block`}
    >
      {displayText}
    </h2>
  );
};

const Header = ({ onToggleMenu, isMenuOpen, currentView, setView, user, onLogout, y, bg, blur }: { 
  onToggleMenu: () => void; 
  isMenuOpen: boolean; 
  currentView: View; 
  setView: (v: View) => void;
  user: FirebaseUser | null;
  onLogout: () => void;
  y?: any;
  bg?: any;
  blur?: any;
}) => (
  <motion.header 
    style={{ y, backgroundColor: bg, backdropFilter: blur }}
    className="fixed top-0 left-0 w-full z-50 px-4 sm:px-6 py-4 flex justify-between items-center transition-colors duration-300 border-b border-white/5 overflow-hidden"
  >
    <div className="pointer-events-auto flex items-center gap-4 xl:gap-8 flex-1 overflow-hidden">
      <div className="shrink-0">
        <ScrambleTitle onClick={() => setView('gallery')} />
      </div>
      <nav className="hidden sm:flex items-center gap-1 md:gap-2 xl:gap-4 overflow-hidden">
        <ScrambleNavItem text="Galeria" onClick={() => setView('gallery')} isActive={currentView === 'gallery'} className="font-bold" />
        <ScrambleNavItem text="Workshops" onClick={() => currentView === 'courses' ? setView('gallery') : setView('courses')} isActive={currentView === 'courses'} className="font-bold" />
        <ScrambleNavItem text="Ao Vivo" onClick={() => currentView === 'live' ? setView('gallery') : setView('live')} isActive={currentView === 'live'} className="font-bold" />
        <ScrambleNavItem text="Artistas" onClick={() => currentView === 'artists' ? setView('gallery') : setView('artists')} isActive={currentView === 'artists'} className="font-bold" />
        <ScrambleNavItem as="h2" text="SONORA_VISTA PODCAST" onClick={() => currentView === 'podcast' ? setView('gallery') : setView('podcast')} isActive={currentView === 'podcast'} aria-label="Sonora Vista Podcast" className="font-bold" />
      </nav>
    </div>
    <div className="pointer-events-auto flex items-center gap-2 md:gap-4 shrink-0 ml-auto pl-2 sm:pl-4">
      {user ? (
        <div className="flex items-center gap-2 md:gap-4">
          <span className="font-mono text-[9px] md:text-[10px] uppercase opacity-50 hidden lg:inline whitespace-nowrap">Olá, {user.displayName || 'Usuário'}</span>
          <button onClick={onLogout} className="p-2 hover:text-accent" aria-label="Logout"><LogOut size={18} className="md:w-5 md:h-5" /></button>
        </div>
      ) : (
        <button onClick={() => setView('login')} className="p-2 hover:text-accent" aria-label="Login"><User size={20} className="md:w-6 md:h-6" /></button>
      )}
      <button 
        onClick={onToggleMenu}
        className="p-2 hover:text-accent transition-colors sm:hidden shrink-0"
        aria-label="Menu"
      >
        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
  </motion.header>
);

// ... MenuOverlay remains similar ...

const CourseCard: React.FC<{ course: Course; onOpen: () => void }> = ({ course, onOpen }) => (
  <motion.div 
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="relative bg-white/5 border border-white/10 overflow-hidden group hover:border-accent/40 transition-all duration-700"
  >
    {/* Scanline Effect */}
    <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    
    <div className="aspect-video overflow-hidden relative">
      <img 
        src={course.thumbnailUrl} 
        alt={course.title} 
        className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000 ease-out" 
        referrerPolicy="no-referrer" 
      />
      <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay" />
      
      {/* Floating Label */}
      <div className="absolute top-4 left-4 z-20">
        <span className="bg-accent text-bg px-3 py-1 font-mono text-[8px] uppercase font-bold tracking-widest">
          {course.lessons.length} Módulos
        </span>
      </div>
    </div>
    
    <div className="p-8 relative">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-display text-2xl font-bold uppercase tracking-tighter group-hover:text-accent transition-colors duration-500">{course.title}</h3>
        <span className="font-mono text-[10px] opacity-20 group-hover:opacity-100 transition-opacity">0{course.id}</span>
      </div>
      
      <p className="font-sans text-sm opacity-60 mb-8 line-clamp-3 leading-relaxed group-hover:opacity-80 transition-opacity">
        {course.description}
      </p>
      
      <div className="flex flex-col gap-4">
        <button 
          onClick={onOpen}
          className="relative w-full py-4 border border-white/10 overflow-hidden group/btn"
        >
          <span className="absolute inset-0 bg-accent translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
          <span className="relative z-10 font-mono text-[10px] uppercase tracking-[0.3em] font-bold group-hover/btn:text-bg transition-colors">
            Iniciar Laboratório
          </span>
        </button>
        
        {course.classroomUrl && (
          <a 
            href={course.classroomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 border border-white/5 hover:border-white/20 transition-all font-mono text-[9px] uppercase tracking-[0.2em] text-center flex items-center justify-center gap-2 opacity-40 hover:opacity-100"
          >
            Google Classroom <ArrowUpRight size={12} />
          </a>
        )}
      </div>
    </div>
    
    {/* Decorative Corner */}
    <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
      <div className="absolute bottom-2 right-2 w-1 h-1 bg-accent/40 rounded-full group-hover:scale-[4] group-hover:bg-accent transition-all duration-700" />
    </div>
  </motion.div>
);

const CourseViewer = ({ course, onClose, completedLessons, toggleLesson, user }: { 
  course: Course; 
  onClose: () => void;
  completedLessons: string[];
  toggleLesson: (id: string) => void;
  user: FirebaseUser | null;
}) => {
  const [activeLesson, setActiveLesson] = useState<Lesson>(course.lessons[0]);
  const progress = (completedLessons.filter(id => course.lessons.some(l => l.id === id)).length / course.lessons.length) * 100;

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col md:flex-row overflow-hidden">
      <div className="w-full md:w-3/4 flex flex-col h-full">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="font-display text-xl font-bold uppercase">{course.title} / {activeLesson.title}</h2>
          <button onClick={onClose} className="flex items-center gap-2 p-2 hover:text-accent font-mono text-[10px] uppercase tracking-widest">
            <X size={24} /> Voltar
          </button>
        </div>
        <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <div className="aspect-video bg-white/5 border border-white/10 mb-12 flex items-center justify-center">
              <p className="font-mono opacity-30 uppercase tracking-widest">Video Player Placeholder</p>
            </div>
            <h3 className="font-display text-3xl font-bold mb-6 uppercase tracking-tighter">{activeLesson.title}</h3>
            <p className="font-sans text-lg leading-relaxed opacity-80 mb-12">{activeLesson.content}</p>
            
            <div className="flex flex-col gap-8">
              <button 
                onClick={() => toggleLesson(activeLesson.id)}
                className={`px-8 py-4 font-mono text-xs uppercase tracking-widest transition-all flex items-center gap-3 self-start ${
                  completedLessons.includes(activeLesson.id) 
                    ? 'bg-accent text-bg' 
                    : 'border border-white/20 hover:border-accent hover:text-accent'
                }`}
              >
                {completedLessons.includes(activeLesson.id) ? <CheckCircle size={18} /> : null}
                {completedLessons.includes(activeLesson.id) ? 'Aula Concluída' : 'Marcar como Concluída'}
              </button>

              {progress === 100 && user && (
                <SubmissionForm 
                  user={user} 
                  course={course} 
                  onSuccess={() => alert('Sua experimentação foi enviada para a galeria!')} 
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="w-full md:w-1/4 border-l border-white/10 flex flex-col h-full bg-white/[0.02]">
        <div className="p-6 border-b border-white/10">
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mb-2">Progresso</p>
          <div className="h-1 w-full bg-white/10">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="font-mono text-[10px] mt-2 text-right">{Math.round(progress)}%</p>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {course.lessons.map((lesson, idx) => (
            <button
              key={lesson.id}
              onClick={() => setActiveLesson(lesson)}
              className={`w-full p-6 text-left border-b border-white/5 transition-colors flex items-start gap-4 ${
                activeLesson.id === lesson.id ? 'bg-white/5' : 'hover:bg-white/[0.03]'
              }`}
            >
              <span className="font-mono text-[10px] opacity-30 mt-1">{String(idx + 1).padStart(2, '0')}</span>
              <div className="flex-1">
                <p className={`font-display text-sm font-bold uppercase tracking-tight mb-1 ${activeLesson.id === lesson.id ? 'text-accent' : ''}`}>
                  {lesson.title}
                </p>
                <p className="font-mono text-[9px] opacity-40 uppercase">{lesson.duration}</p>
              </div>
              {completedLessons.includes(lesson.id) && <CheckCircle size={14} className="text-accent mt-1" />}
            </button>
          ))}
        </div>
        {progress === 100 && (
          <div className="p-6 bg-accent text-bg">
            <div className="flex items-center gap-3 mb-4">
              <Award size={24} />
              <p className="font-display font-bold uppercase tracking-tighter">Certificado Disponível</p>
            </div>
            <button className="w-full py-3 bg-bg text-fg font-mono text-[10px] uppercase tracking-widest hover:opacity-90 transition-opacity">
              Emitir Certificado
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const SubmissionForm = ({ user, course, onSuccess }: { user: FirebaseUser; course: Course; onSuccess: () => void }) => {
  const [title, setTitle] = useState('');
  const [opId, setOpId] = useState('');
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const submissionRef = doc(collection(db, 'submissions'));
      await setDoc(submissionRef, {
        title,
        artist: user.displayName || 'Anonymous Student',
        description: desc,
        openProcessingId: opId,
        imageUrl: `https://openprocessing.org/sketch/${opId}/thumbnail/`, // OpenProcessing thumbnail URL pattern
        studentUid: user.uid,
        workshopId: course.id,
        createdAt: new Date().toISOString()
      });
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-12 p-8 border border-white/10 bg-white/5">
      <h3 className="font-display text-2xl font-bold uppercase mb-6">Enviar sua Experimentação</h3>
      <div className="space-y-4">
        <input 
          type="text" 
          placeholder="Título da Obra" 
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-bg border border-white/20 p-4 font-mono text-sm focus:border-accent outline-none"
        />
        <input 
          type="text" 
          placeholder="ID do Sketch no OpenProcessing (ex: 123456)" 
          required
          value={opId}
          onChange={e => setOpId(e.target.value)}
          className="w-full bg-bg border border-white/20 p-4 font-mono text-sm focus:border-accent outline-none"
        />
        <textarea 
          placeholder="Breve descrição do seu processo criativo" 
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="w-full bg-bg border border-white/20 p-4 font-mono text-sm h-32 focus:border-accent outline-none"
        />
        <button 
          disabled={isSubmitting}
          className="w-full py-4 bg-accent text-bg font-display font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Enviando...' : 'Publicar na Galeria Virtual'}
        </button>
      </div>
    </form>
  );
};

const LoginView = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p-12 border border-white/10 bg-white/5">
        <h2 className="font-display text-4xl font-bold uppercase tracking-tighter mb-8">Acesso ao <span className="text-accent">Lab</span></h2>
        <p className="font-sans opacity-60 mb-8 text-sm">Conecte-se com sua conta Google para acessar os workshops e salvar seu progresso na nuvem.</p>
        <button 
          onClick={onLogin}
          className="w-full py-4 bg-white text-bg font-display font-bold uppercase tracking-widest hover:bg-accent transition-colors flex items-center justify-center gap-3"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Entrar com Google
        </button>
        <button 
          onClick={() => window.location.reload()} 
          className="w-full mt-4 py-3 border border-white/10 hover:border-white/40 font-mono text-[10px] uppercase tracking-widest transition-all"
        >
          Voltar para o Início
        </button>
      </div>
    </div>
  );
};

// ... ArtworkCard and ArtworkModal remain similar ...

const MenuOverlay = ({ isOpen, onClose, setView, currentView }: { isOpen: boolean; onClose: () => void; setView: (v: View) => void; currentView: View }) => {
  const menuItems: { label: string; view: View }[] = [
    { label: 'Galeria', view: 'gallery' },
    { label: 'Workshops', view: 'courses' },
    { label: 'Ao Vivo', view: 'live' },
    { label: 'Artistas', view: 'artists' },
    { label: 'SONORA_VISTA PODCAST', view: 'podcast' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[100] bg-bg flex flex-col p-6 sm:p-12 overflow-y-auto"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 sm:top-8 sm:right-8 p-2 hover:text-accent transition-colors z-10"
          >
            <X size={40} />
          </button>

          <div className="flex-1 flex flex-col justify-center items-center py-12">
            <nav className="flex flex-col gap-4 sm:gap-6 text-center w-full">
              {menuItems.map((item) => (
                <motion.button
                  key={item.view}
                  onClick={() => { setView(item.view); onClose(); }}
                  className={`font-display text-[clamp(1.5rem,6vw,3rem)] font-bold uppercase tracking-tighter hover:text-accent transition-colors ${currentView === item.view ? 'text-accent' : ''}`}
                  whileHover={{ x: 20 }}
                >
                  {item.label}
                </motion.button>
              ))}
            </nav>
          </div>
          
          <div className="mt-auto pt-8 flex flex-col md:flex-row justify-between items-center gap-8 w-full">
            <div className="flex gap-8">
              <Instagram className="hover:text-accent cursor-pointer" size={24} />
              <Twitter className="hover:text-accent cursor-pointer" size={24} />
              <Github className="hover:text-accent cursor-pointer" size={24} />
            </div>
            <p className="font-mono text-[10px] opacity-50 uppercase tracking-[0.3em] text-center">
              © 2026 V.I.S.T.O: OCUPAÇÕES VÍDEO_COREOGRÁFICAS
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ArtworkCard: React.FC<{ artwork: Artwork; onClick: () => void }> = ({ artwork, onClick }) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    setRotateX((mouseY / (rect.height / 2)) * -10);
    setRotateY((mouseX / (rect.width / 2)) * 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      layoutId={`artwork-${artwork.id}`}
      drag
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      whileDrag={{ 
        scale: 1.05, 
        zIndex: 100,
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}
      onClick={() => {
        if (!isDragging) onClick();
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: rotateX,
        rotateY: rotateY,
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        touchAction: 'none'
      }}
      className="relative group cursor-grab active:cursor-grabbing overflow-hidden aspect-[3/4] bg-white/5 border border-white/10"
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.img
        src={artwork.openProcessingId ? `https://openprocessing.org/sketch/${artwork.openProcessingId}/thumbnail/` : artwork.imageUrl}
        alt={artwork.title}
        style={{
          x: rotateY * 0.5,
          y: rotateX * -0.5,
          scale: 1.1
        }}
        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 ease-out pointer-events-none"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 flex flex-col justify-end">
        {artwork.openProcessingId && (
          <div className="absolute top-4 right-4 flex gap-2 items-center pointer-events-auto">
            <div className="bg-accent text-bg px-2 py-1 font-mono text-[8px] uppercase tracking-widest font-bold">
              Interactive
            </div>
            <a 
              href={`https://openprocessing.org/sketch/${artwork.openProcessingId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-white/20 hover:bg-accent text-white hover:text-bg p-1.5 transition-all"
              title="Abrir no OpenProcessing"
            >
              <ArrowUpRight size={14} />
            </a>
          </div>
        )}
        <div className="pointer-events-none">
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent mb-1 transform translate-z-20">{artwork.category}</p>
          <h3 className="font-display text-xl font-bold uppercase tracking-tighter leading-none transform translate-z-30">{artwork.title}</h3>
          <p className="font-sans text-sm opacity-70 italic transform translate-z-10">{artwork.artist}</p>
        </div>
      </div>
    </motion.div>
  );
};

const ArtworkModal = ({ artwork, onClose }: { artwork: Artwork | null; onClose: () => void }) => {
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    setIsInteractive(false);
  }, [artwork]);

  return (
    <AnimatePresence>
      {artwork && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg/95 backdrop-blur-sm"
          />
          
            <motion.div
              layoutId={`artwork-${artwork.id}`}
              className="relative w-full max-w-6xl bg-bg border border-white/10 overflow-hidden flex flex-col md:flex-row shadow-2xl"
            >
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 z-10 p-2 bg-bg border border-white/10 hover:bg-accent hover:text-bg transition-colors flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"
              >
                <X size={24} /> Voltar
              </button>
            
            <div className="w-full md:w-2/3 aspect-square md:aspect-auto overflow-hidden bg-black flex items-center justify-center relative">
              {artwork.openProcessingId && isInteractive ? (
                <iframe 
                  src={`https://openprocessing.org/sketch/${artwork.openProcessingId}/embed/`}
                  className="w-full h-full border-none"
                  allow="camera; microphone; display-capture; geolocation"
                  allowFullScreen
                  sandbox="allow-same-origin allow-scripts"
                />
              ) : (
                <>
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  {artwork.openProcessingId && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setIsInteractive(true)}
                        className="px-8 py-4 bg-accent text-bg font-display font-bold uppercase tracking-widest flex items-center gap-3"
                      >
                        <ArrowUpRight size={20} />
                        Ativar Sketch Interativo
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="w-full md:w-1/3 p-8 md:p-12 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-4">
                  {artwork.category} / {artwork.year}
                </p>
                <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tighter leading-none mb-2">
                  {artwork.title}
                </h2>
                <p className="font-display text-xl italic opacity-80 mb-8">
                  by {artwork.artist}
                </p>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-2">Description</h4>
                    <p className="font-sans text-sm leading-relaxed opacity-80">
                      {artwork.description}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-2">Medium</h4>
                    <p className="font-mono text-xs uppercase tracking-wider">
                      {artwork.medium}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-12 pt-8 border-t border-white/10 flex flex-col gap-4">
                {artwork.openProcessingId && !isInteractive && (
                  <button 
                    onClick={() => setIsInteractive(true)}
                    className="w-full py-4 border border-accent text-accent hover:bg-accent hover:text-bg font-display uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2"
                  >
                    Ativar Sketch <ArrowUpRight size={16} />
                  </button>
                )}
                {artwork.openProcessingId && (
                  <a 
                    href={`https://openprocessing.org/sketch/${artwork.openProcessingId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 border border-white/10 hover:border-white/40 font-display uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 text-center"
                  >
                    Ver no OpenProcessing <ArrowUpRight size={16} />
                  </a>
                )}
                <button className="w-full py-4 border border-white/20 hover:border-white/60 font-display uppercase tracking-widest text-sm transition-all">
                  Share Artwork
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const LogosFooter = () => (
  <footer className="relative w-full px-[2%] py-[40px] bg-[#CCFF00] hover:bg-black flex justify-center overflow-hidden group cursor-crosshair transition-colors duration-500">
    {/* CRT Scanline Overlay */}
    <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 z-20 transition-opacity duration-500 bg-[linear-gradient(rgba(204,255,0,0)_50%,rgba(204,255,0,0.1)_50%)] bg-[length:100%_4px]" />
    
    {/* Top Neon Border Glow */}
    <div className="absolute top-0 left-0 w-full h-[1px] bg-[#CCFF00] shadow-[0_0_15px_#CCFF00] z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

    <div className="relative w-full max-w-[1920px] transition-transform duration-700 group-hover:scale-[1.01]">
      {/* Main Image */}
      <img 
        src="https://lh3.googleusercontent.com/d/1L1HQOljIzbSN9Pi-sdFtY-42_zoo4IHA" 
        alt="Logos Institucionais" 
        className="w-full h-auto block relative z-10 transition-all duration-500 group-hover:invert group-hover:drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]" 
        referrerPolicy="no-referrer"
      />
      
      {/* Chromatic Aberration - Cyan */}
      <img 
        src="https://lh3.googleusercontent.com/d/1L1HQOljIzbSN9Pi-sdFtY-42_zoo4IHA" 
        alt="" 
        className="absolute top-0 left-0 w-full h-auto block z-0 opacity-0 group-hover:opacity-70 transition-all duration-200 -translate-x-[2px] translate-y-[1px] group-hover:invert mix-blend-screen" 
        style={{ filter: 'drop-shadow(3px 0 0 #00FFFF)' }}
        referrerPolicy="no-referrer"
        aria-hidden="true"
      />
      
      {/* Chromatic Aberration - Magenta */}
      <img 
        src="https://lh3.googleusercontent.com/d/1L1HQOljIzbSN9Pi-sdFtY-42_zoo4IHA" 
        alt="" 
        className="absolute top-0 left-0 w-full h-auto block z-0 opacity-0 group-hover:opacity-70 transition-all duration-300 translate-x-[2px] -translate-y-[1px] group-hover:invert mix-blend-screen" 
        style={{ filter: 'drop-shadow(-3px 0 0 #FF00FF)' }}
        referrerPolicy="no-referrer"
        aria-hidden="true"
      />
    </div>
  </footer>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 100], [0, 0]);
  const headerBg = useTransform(
    scrollY,
    [0, 100],
    ['rgba(10, 10, 10, 0)', 'rgba(10, 10, 10, 0.9)']
  );
  const headerBlur = useTransform(
    scrollY,
    [0, 100],
    ['blur(0px)', 'blur(10px)']
  );
  const introY = useTransform(scrollY, [0, 500], [0, -50]);
  const introOpacity = useTransform(scrollY, [0, 200], [1, 0]);

  const [view, setView] = useState<View>('gallery');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchFilterType, setSearchFilterType] = useState<'OBRAS' | 'ARTISTAS' | 'DATA' | 'TAGS'>('OBRAS');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  const handleNavigate = (newView: View) => {
    setView(newView);
    setFilter('All');
    setSearchQuery('');
    setIsSearchActive(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const titles: Record<View, string> = {
      gallery: 'GALERIA',
      courses: 'WORKSHOP',
      live: 'AO VIVO',
      artists: 'ARTISTAS',
      sonora: 'SONORA',
      podcast: 'Sonora_Vista Podcast',
      login: 'LOGIN'
    };
    document.title = `${titles[view]} | VISTO_LAB`;
  }, [view]);

  // Fetch Submissions
  useEffect(() => {
    const q = query(collection(db, 'submissions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isStudentSubmission: true,
        year: new Date(doc.data().createdAt).getFullYear().toString(),
        medium: 'Student Experiment'
      } as Artwork));
      setStudentSubmissions(subs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'submissions');
    });
    return () => unsubscribe();
  }, []);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              role: 'student',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      } else {
        setCompletedLessons([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Progress Sync
  useEffect(() => {
    if (!user || !selectedCourse) return;

    const progressId = `${user.uid}_${selectedCourse.id}`;
    const progressRef = doc(db, 'progress', progressId);

    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        setCompletedLessons(docSnap.data().completedLessons || []);
      } else {
        setCompletedLessons([]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `progress/${progressId}`);
    });

    return () => unsubscribe();
  }, [user, selectedCourse]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      handleNavigate('courses');
    } catch (error) {
      console.error("Login Error", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleNavigate('gallery');
    } catch (error) {
      console.error("Logout Error", error);
    }
  };

  const toggleLesson = async (lessonId: string) => {
    if (!user || !selectedCourse) return;

    const progressId = `${user.uid}_${selectedCourse.id}`;
    const progressRef = doc(db, 'progress', progressId);
    
    const isCompleted = completedLessons.includes(lessonId);
    const newProgress = isCompleted
      ? completedLessons.filter(id => id !== lessonId)
      : [...completedLessons, lessonId];

    try {
      const docSnap = await getDoc(progressRef);
      if (docSnap.exists()) {
        await updateDoc(progressRef, {
          completedLessons: newProgress,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(progressRef, {
          userId: user.uid,
          courseId: selectedCourse.id,
          completedLessons: newProgress,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `progress/${progressId}`);
    }
  };

  const allArtworks = [...ARTWORKS, ...studentSubmissions];
  const categories = ['All', ...Array.from(new Set(allArtworks.map(a => a.category)))];
  
  const filteredArtworks = allArtworks.filter(a => {
    const matchesCategory = filter === 'All' || a.category === filter;
    if (!searchQuery) return matchesCategory;
    
    const query = searchQuery.toLowerCase();
    let matchesSearch = false;
    
    switch (searchFilterType) {
      case 'OBRAS':
        matchesSearch = a.title.toLowerCase().includes(query);
        break;
      case 'ARTISTAS':
        matchesSearch = a.artist.toLowerCase().includes(query);
        break;
      case 'DATA':
        matchesSearch = a.year.toLowerCase().includes(query);
        break;
      case 'TAGS':
        matchesSearch = a.category.toLowerCase().includes(query) || a.medium.toLowerCase().includes(query);
        break;
    }
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (selectedArtwork || selectedCourse || isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [selectedArtwork, selectedCourse, isMenuOpen]);

  return (
    <div className="min-h-screen grid-lines">
      <Header 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)} 
        isMenuOpen={isMenuOpen} 
        currentView={view}
        setView={handleNavigate}
        user={user}
        onLogout={handleLogout}
        y={headerY}
        bg={headerBg}
        blur={headerBlur}
      />
      
      <MenuOverlay 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        setView={handleNavigate}
        currentView={view}
      />
      
      {view === 'login' && <LoginView onLogin={handleLogin} />}

      {view === 'gallery' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          {/* Hero Section (Title + Search) */}
          <div className="relative mb-12 w-full bg-black rounded-xl border border-white/5 overflow-hidden">
            <ConstellationBackground isSoundEnabled={isSoundEnabled} />

            <div className="relative z-10 w-full px-4 py-12 md:py-20 flex flex-col items-center">
              {/* Intro Section */}
              <motion.section 
                style={{ y: introY, opacity: introOpacity }}
                className="w-full mb-16 flex flex-col items-center justify-center text-center pointer-events-auto"
              >
                <InteractiveTitle 
                  lines={[
                    { text: "V.I.S.T.O: OCUPAÇÕES", className: "font-display text-[clamp(2rem,7vw,5rem)] font-bold leading-none tracking-tight" },
                    { text: "VÍDEO_COREOGRÁFICAS", className: "font-display text-[clamp(1.8rem,6.5vw,4.5rem)] font-bold leading-none tracking-tight mb-2 md:mb-4" },
                    { text: "REABRINDO O LUGARZINHO NO 4º DISTRITO/POA.", className: "font-display text-[clamp(1.2rem,3vw,2.5rem)] font-medium leading-tight tracking-tight" }
                  ]}
                  highlights={['LUGARZINHO']}
                />
                
                {/* Sound Toggle Button */}
                <div className="mt-8 md:mt-12 flex justify-center w-full pointer-events-auto z-50 relative">
                  <button 
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className={`font-mono text-sm md:text-base xl:text-lg uppercase tracking-widest px-6 py-3 rounded-xl transition-all duration-300 border ${isSoundEnabled ? 'border-accent text-accent bg-accent/10 hover:bg-accent hover:text-black' : 'border-white/30 text-white/70 hover:bg-white/10 hover:text-white'} backdrop-blur-sm`}
                  >
                    {isSoundEnabled ? "[ SOM ON ]" : "[ SOM OFF ]"}
                  </button>
                </div>
              </motion.section>

              {/* Search and Advanced Filters */}
              <div className="w-full max-w-5xl mx-auto space-y-6 pointer-events-auto">
                <div className={`flex flex-col gap-4 transition-all duration-500 ${isSearchActive ? 'opacity-100' : 'max-w-md mx-auto'}`}>
                  <div className={`relative flex-1 group transition-all duration-300 ${isSearchActive ? 'search-focus' : ''}`}>
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSearchActive ? 'text-accent' : 'opacity-30'}`} size={18} />
                    <input 
                      type="text" 
                      placeholder="DIGITE AQUI..." 
                      value={searchQuery}
                      onFocus={() => setIsSearchActive(true)}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full bg-white/5 border py-4 pl-12 pr-4 font-mono text-xs uppercase tracking-widest outline-none transition-all duration-300 ${
                        isSearchActive 
                          ? 'border-accent text-accent bg-black/50 backdrop-blur-md' 
                          : 'border-white/10 opacity-80 hover:opacity-100 bg-black/20 backdrop-blur-sm'
                      }`}
                    />
                    {isSearchActive && (
                      <button 
                        onClick={() => {
                          setIsSearchActive(false);
                          setSearchQuery('');
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-accent hover:scale-110 transition-transform"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  
                  <AnimatePresence>
                    {isSearchActive && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-2 items-center py-2 justify-center">
                          <span className="font-mono text-[9px] uppercase tracking-widest opacity-60 mr-2 text-accent">Filtrar resultado com:</span>
                          {(['OBRAS', 'ARTISTAS', 'DATA', 'TAGS'] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() => setSearchFilterType(type)}
                              className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
                                searchFilterType === type 
                                  ? 'bg-accent text-bg border-accent' 
                                  : 'border-accent/30 text-accent/80 hover:border-accent/80 bg-black/40'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Categories */}
                {!isSearchActive && (
                  <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6 justify-center">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`font-mono text-[9px] uppercase tracking-[0.2em] px-4 py-2 border transition-all ${
                          filter === cat 
                            ? 'bg-accent text-bg border-accent' 
                            : 'border-white/10 hover:border-white/40 bg-black/20 backdrop-blur-sm'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-white/10 border border-white/10">
            {filteredArtworks.map((artwork) => (
              <ArtworkCard 
                key={artwork.id} 
                artwork={artwork} 
                onClick={() => setSelectedArtwork(artwork)} 
              />
            ))}
          </div>
        </main>
      )}

      {view === 'courses' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          <button 
            onClick={() => handleNavigate('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <ScramblePageTitle 
              text="VISTO LAB"
              className="font-display text-6xl md:text-8xl lg:text-[8rem] xl:text-[10rem] font-bold uppercase tracking-tighter mb-6"
            />
            <p className="font-sans opacity-60 max-w-2xl text-lg leading-relaxed">Oficinas e laboratórios focados em performance, improvisação e presença intermediada por tecnologia.</p>
          </section>

          {!user && (
            <div className="mb-12 p-8 border border-accent/30 bg-accent/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="font-display text-xl uppercase tracking-tight">Faça login para salvar seu progresso e obter certificados.</p>
              <button onClick={() => handleNavigate('login')} className="px-8 py-3 bg-accent text-bg font-mono text-[10px] uppercase tracking-widest font-bold">Entrar Agora</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {COURSES.map(course => (
              <CourseCard key={course.id} course={course} onOpen={() => setSelectedCourse(course)} />
            ))}
          </div>
        </main>
      )}

      <ArtworkModal 
        artwork={selectedArtwork} 
        onClose={() => setSelectedArtwork(null)} 
      />

      {view === 'live' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          <button 
            onClick={() => handleNavigate('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <ScramblePageTitle text="Transmissões ao Vivo" className="font-display text-6xl font-bold uppercase tracking-tighter mb-4" />
            <p className="font-sans opacity-60 max-w-2xl">Acompanhe as experimentações e performances em tempo real.</p>
          </section>
          
          <div className="aspect-video bg-white/5 border border-white/10 flex items-center justify-center">
            <div className="text-center">
              <div className="w-4 h-4 bg-accent rounded-full animate-pulse mx-auto mb-4" />
              <p className="font-mono text-xs uppercase tracking-widest opacity-40">Nenhuma transmissão ativa no momento</p>
            </div>
          </div>
        </main>
      )}

      {view === 'artists' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          <button 
            onClick={() => handleNavigate('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <ScramblePageTitle text="Artistas" className="font-display text-6xl font-bold uppercase tracking-tighter mb-4" />
            <p className="font-sans opacity-60 max-w-2xl">Conheça os artistas residentes e colaboradores do V.I.S.T.O.</p>
          </section>
          <div className="flex items-center justify-center p-24 border border-white/10 rounded-xl bg-white/5">
            <p className="font-mono text-xs uppercase tracking-widest opacity-40">Conteúdo em breve</p>
          </div>
        </main>
      )}

      {view === 'sonora' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          <button 
            onClick={() => handleNavigate('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <ScramblePageTitle text="SonorⒶ" className="font-display text-6xl font-bold uppercase tracking-tighter mb-4" />
            <p className="font-sans opacity-60 max-w-2xl">Experimentações sonoras e paisagens auditivas.</p>
          </section>
          <div className="flex items-center justify-center p-24 border border-white/10 rounded-xl bg-white/5">
            <p className="font-mono text-xs uppercase tracking-widest opacity-40">Conteúdo em breve</p>
          </div>
        </main>
      )}

      {view === 'podcast' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          <button 
            onClick={() => handleNavigate('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <ScramblePageTitle text="Podcast" className="font-display text-6xl font-bold uppercase tracking-tighter mb-4" />
            <p className="font-sans opacity-60 max-w-2xl">Conversas, entrevistas e reflexões sobre arte e tecnologia.</p>
          </section>
          <div className="flex items-center justify-center p-24 border border-white/10 rounded-xl bg-white/5">
            <p className="font-mono text-xs uppercase tracking-widest opacity-40">Conteúdo em breve</p>
          </div>
        </main>
      )}
      {selectedCourse && (
        <CourseViewer 
          course={selectedCourse} 
          onClose={() => setSelectedCourse(null)} 
          completedLessons={completedLessons}
          toggleLesson={toggleLesson}
          user={user}
        />
      )}

      {/* Footer Info */}
      <LogosFooter />
    </div>
  );
}
