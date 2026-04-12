import React, { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Menu, X, Info, ArrowUpRight, Github, Instagram, Twitter, BookOpen, User, LogOut, CheckCircle, Award, AlertTriangle, Search, ArrowLeft, Lock, ChevronRight, ChevronLeft, Check, Download, LayoutDashboard, Play, Pause, Volume2, VolumeX, ArrowRight, ExternalLink } from 'lucide-react';
import * as Tone from 'tone';
import { ARTWORKS, type Artwork, COURSES, type Course, type Lesson } from './data';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs,
  handleFirestoreError, OperationType, type FirebaseUser
} from './firebase';

type View = 'gallery' | 'courses' | 'login' | 'live' | 'artists' | 'sonora' | 'podcast' | 'admin' | 'privacidade' | 'termos';

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
      className="font-mono text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight uppercase cursor-pointer hover:bg-black hover:text-white hover:drop-shadow-[0_0_15px_rgba(204,255,0,0.8)] px-2 py-1 md:px-3 md:py-2 rounded-2xl transition-all duration-300 flex items-center gap-1 md:gap-2 group shrink-0"
    >
      <span>{text1}</span> <span className="text-accent group-hover:text-white transition-colors duration-300">{text2}</span>
    </h1>
  );
};

const ScrambleNavItem = ({ text, subText, onClick, isActive, as: Component = 'button', 'aria-label': ariaLabel, 'aria-pressed': ariaPressed, className, layoutId = 'nav-indicator' }: { text: string, subText?: string, onClick: () => void, isActive: boolean, as?: any, 'aria-label'?: string, 'aria-pressed'?: boolean, className?: string, layoutId?: string }) => {
  const [displayText, setDisplayText] = useState(text);
  const [displaySubText, setDisplaySubText] = useState(subText || '');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  useEffect(() => {
    setDisplayText(text);
    setDisplaySubText(subText || '');
  }, [text, subText]);

  const handleMouseOver = () => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    const maxLen = Math.max(text.length, (subText || '').length);

    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if(char === ' ' || char === '"') return char;
            if(index < iteration) return text[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("")
      );

      if (subText) {
        setDisplaySubText(
          subText
            .split("")
            .map((char, index) => {
              if(char === ' ' || char === '"') return char;
              if(index < iteration) return subText[index];
              return letters[Math.floor(Math.random() * 26)];
            })
            .join("")
        );
      }

      if(iteration >= maxLen){
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
      className={`font-mono text-[10px] sm:text-xs md:text-sm lg:text-base uppercase tracking-wider md:tracking-widest px-2 md:px-4 xl:px-6 py-2 md:py-3 rounded-xl transition-all duration-300 hover:bg-black hover:text-white hover:drop-shadow-[0_0_15px_rgba(204,255,0,0.8)] whitespace-nowrap cursor-pointer flex flex-col items-center justify-center leading-tight ${isActive ? 'text-accent' : 'text-white'} ${className || ''}`}
      role={Component !== 'button' ? 'button' : undefined}
      tabIndex={Component !== 'button' ? 0 : undefined}
      onKeyDown={Component !== 'button' ? (e: any) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      <span>{displayText}</span>
      {subText && <span className="text-[8px] sm:text-[9px] md:text-[10px] opacity-70 mt-0.5">{displaySubText}</span>}
    </Component>
  );
};

const ScramblePageTitle = ({ text, subText, className, noMargin = false }: { text: string, subText?: string, className?: string, noMargin?: boolean }) => {
  const [displayText, setDisplayText] = useState(text);
  const [displaySubText, setDisplaySubText] = useState(subText || '');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const handleMouseOver = () => {
    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    const maxLen = Math.max(text.length, (subText || '').length);

    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if(char === ' ' || char === '.' || char === 'Ⓐ' || char === '"' || char === '_' || char === '-' || char === ':') return char;
            if(index < iteration) return text[index];
            return letters[Math.floor(Math.random() * 26)];
          })
          .join("")
      );

      if (subText) {
        setDisplaySubText(
          subText
            .split("")
            .map((char, index) => {
              if(char === ' ' || char === '.' || char === 'Ⓐ' || char === '"' || char === '_' || char === '-' || char === ':') return char;
              if(index < iteration) return subText[index];
              return letters[Math.floor(Math.random() * 26)];
            })
            .join("")
        );
      }

      if(iteration >= maxLen){
        if (intervalRef.current) clearInterval(intervalRef.current);
      }

      iteration += 1 / 3;
    }, 30);
  };

  useEffect(() => {
    handleMouseOver();
  }, [text, subText]);

  return (
    <div className={noMargin ? "" : "my-8 py-4"}>
      <h2 
        onMouseEnter={handleMouseOver}
        className={`${className} cursor-crosshair transition-all duration-300 hover:bg-black hover:text-white hover:drop-shadow-[0_0_15px_rgba(204,255,0,0.8)] px-4 py-2 -ml-4 rounded-2xl inline-flex flex-col`}
      >
        <span>{displayText}</span>
        {subText && <span className="text-2xl md:text-3xl lg:text-4xl opacity-80 mt-2 font-mono tracking-widest">{displaySubText}</span>}
      </h2>
    </div>
  );
};

const UserProfileMenu = ({ user, isAdmin, currentView, setView, onLogout }: {
  user: any;
  isAdmin?: boolean;
  currentView: View;
  setView: (v: View) => void;
  onLogout: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:text-accent transition-colors flex items-center gap-2"
        aria-label="Menu do Usuário"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="Avatar" className="w-6 h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
        ) : (
          <div className="relative">
            <User size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 top-full mt-2 w-48 bg-bg border border-white/10 shadow-xl z-50 py-2"
          >
            <div className="px-4 py-2 border-b border-white/10 mb-2">
              <span className="font-mono text-[10px] uppercase opacity-50 block truncate">
                Olá, {user.displayName || 'Usuário'}
              </span>
            </div>
            
            {isAdmin && (
              <button
                onClick={() => { setView('admin'); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 ${currentView === 'admin' ? 'text-accent' : ''}`}
              >
                <LayoutDashboard size={14} />
                Painel do Professor
              </button>
            )}
            
            <button
              onClick={() => { onLogout(); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 text-red-400 hover:text-red-300"
            >
              <LogOut size={14} />
              Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Header = ({ onToggleMenu, isMenuOpen, currentView, setView, user, onLogout, y, bg, blur, isAdmin }: { 
  onToggleMenu: () => void; 
  isMenuOpen: boolean; 
  currentView: View; 
  setView: (v: View) => void;
  user: FirebaseUser | null;
  onLogout: () => void;
  y?: any;
  bg?: any;
  blur?: any;
  isAdmin?: boolean;
}) => (
  <motion.header 
    style={{ y, backgroundColor: bg, backdropFilter: blur }}
    className="fixed top-0 left-0 w-full z-50 transition-colors duration-300 border-b border-white/5"
  >
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex justify-between items-center w-full">
      <div className="pointer-events-auto flex items-center gap-8 xl:gap-16 flex-1 min-w-0">
        <div className="shrink-0">
          <ScrambleTitle onClick={() => setView('gallery')} />
        </div>
        <nav className="hidden sm:flex items-center gap-2 md:gap-4 lg:gap-6 xl:gap-8 flex-nowrap overflow-x-auto hide-scrollbar py-4 -my-4 px-4 -mx-4">
          <ScrambleNavItem text="Galeria" onClick={() => setView('gallery')} isActive={currentView === 'gallery'} className="font-bold text-xs md:text-sm lg:text-lg xl:text-xl" />
          <ScrambleNavItem text="Workshops" onClick={() => currentView === 'courses' ? setView('gallery') : setView('courses')} isActive={currentView === 'courses'} className="font-bold text-xs md:text-sm lg:text-lg xl:text-xl" />
          <ScrambleNavItem text="AO VIVO" onClick={() => currentView === 'live' ? setView('gallery') : setView('live')} isActive={currentView === 'live'} className="font-bold text-xs md:text-sm lg:text-lg xl:text-xl" />
          <ScrambleNavItem text="Artistas" onClick={() => currentView === 'artists' ? setView('gallery') : setView('artists')} isActive={currentView === 'artists'} className="font-bold text-xs md:text-sm lg:text-lg xl:text-xl" />
          <ScrambleNavItem as="h2" text="SONORA_VISTA" onClick={() => currentView === 'podcast' ? setView('gallery') : setView('podcast')} isActive={currentView === 'podcast'} aria-label="Sonora Vista Podcast" className="font-bold text-xs md:text-sm lg:text-lg xl:text-xl whitespace-nowrap" />
        </nav>
      </div>
      <div className="pointer-events-auto flex items-center gap-2 md:gap-4 shrink-0 ml-auto pl-2 sm:pl-4">
        {user ? (
          <UserProfileMenu user={user} isAdmin={isAdmin} currentView={currentView} setView={setView} onLogout={onLogout} />
        ) : (
          <button onClick={() => setView('login')} className="p-2 hover:text-accent" aria-label="Login"><User size={20} className="md:w-6 md:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8" /></button>
        )}
        <button 
          onClick={onToggleMenu}
          className="p-2 hover:text-accent transition-colors sm:hidden shrink-0"
          aria-label="Menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </div>
  </motion.header>
);

// ... MenuOverlay remains similar ...

const CourseCard: React.FC<{ course: Course; onOpen: () => void }> = ({ course, onOpen }) => (
  <motion.div 
    onClick={onOpen}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="relative bg-white/5 border border-white/10 overflow-hidden group hover:border-accent/40 transition-all duration-700 cursor-pointer flex flex-col h-full"
  >
    {/* Scanline Effect */}
    <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    
    <div className="aspect-video overflow-hidden relative bg-black/40">
      <img 
        src={course.thumbnailUrl} 
        alt={course.title} 
        className="w-full h-full object-contain grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000 ease-out" 
        referrerPolicy="no-referrer" 
      />
      <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay" />
    </div>
    
    <div className="p-6 flex flex-col flex-grow justify-between relative z-20 bg-bg/80 backdrop-blur-sm">
      <div>
        <h3 className="font-display text-xl font-bold mb-2 uppercase tracking-tight group-hover:text-accent transition-colors">{course.title}</h3>
        <p className="font-sans text-sm opacity-60 mb-4">{course.instructor}</p>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="bg-[#00FF00] text-black px-3 py-1 font-mono text-[10px] uppercase font-bold tracking-widest shadow-[0_0_10px_rgba(0,255,0,0.6)]">
          10 UNIDADES
        </span>
        <span className="text-accent text-sm font-bold uppercase tracking-wider flex items-center">
          Acessar <ArrowRight size={16} className="ml-2 group-hover:translate-x-2 transition-transform" />
        </span>
      </div>
    </div>
  </motion.div>
);

const EnrollmentModal = ({ course, user, onClose, onSuccess }: {
  course: Course;
  user: FirebaseUser;
  onClose: () => void;
  onSuccess: (courseId: string) => void;
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user.displayName || '',
    email: user.email || '',
    whatsapp: '',
    birthdate: '',
    cityState: '',
    gender: '',
    race: '',
    accessibility: '',
    experience: '',
    motivation: '',
    agreedToTerms: false,
    agreedToImageUse: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.whatsapp || !formData.birthdate) {
        alert("Por favor, preencha todos os campos obrigatórios do Passo 1.");
        return;
      }
    } else if (step === 2) {
      if (!formData.cityState || !formData.gender || !formData.race) {
        alert("Por favor, preencha todos os campos obrigatórios do Passo 2.");
        return;
      }
    }
    setStep(s => Math.min(3, s + 1));
  };

  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNext();
      return;
    }

    if (!formData.experience || !formData.motivation) {
      alert("Por favor, preencha todos os campos obrigatórios do Passo 3.");
      return;
    }

    if (!formData.agreedToTerms || !formData.agreedToImageUse) {
      alert("Você precisa aceitar os termos para continuar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const enrollmentId = `${user.uid}_${course.id}`;
      await setDoc(doc(db, 'enrollments', enrollmentId), {
        userId: user.uid,
        courseId: course.id,
        ...formData,
        createdAt: new Date().toISOString()
      });
      
      // Update user enrolled courses
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        await updateDoc(userRef, {
          enrolledCourses: [...(userData.enrolledCourses || []), course.id]
        });
      }
      
      onSuccess(course.id);
    } catch (error: any) {
      console.error("Error submitting enrollment:", error);
      alert("Erro ao enviar inscrição: " + (error.message || error));
      handleFirestoreError(error, OperationType.WRITE, 'enrollments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-bg/90 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
      <div className="bg-bg border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={24} />
        </button>

        <div className="p-8 md:p-12">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-widest opacity-50 mb-2">Inscrição</p>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tighter">{course.title}</h2>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 mb-12">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-1 flex-1 ${step >= i ? 'bg-accent' : 'bg-white/10'}`} />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6">
                <h3 className="font-mono text-sm uppercase tracking-widest text-accent mb-2">Passo 1: Dados Básicos</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Nome Completo *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="bg-white/5 border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">E-mail *</label>
                  <input type="email" name="email" value={formData.email} readOnly className="bg-white/5 border border-white/10 p-4 font-sans opacity-50 cursor-not-allowed" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">WhatsApp / Telefone *</label>
                  <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="(00) 00000-0000" className="bg-white/5 border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Data de Nascimento *</label>
                  <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} className="bg-white/5 border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors [color-scheme:dark]" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6">
                <h3 className="font-mono text-sm uppercase tracking-widest text-accent mb-2">Passo 2: Perfil (PNAB)</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Cidade e Estado *</label>
                  <input type="text" name="cityState" value={formData.cityState} onChange={handleChange} placeholder="Ex: São Paulo - SP" className="bg-white/5 border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Como você se identifica? (Gênero) *</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className="bg-bg border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors">
                    <option value="">Selecione...</option>
                    <option value="Mulher Cis">Mulher Cis</option>
                    <option value="Homem Cis">Homem Cis</option>
                    <option value="Mulher Trans">Mulher Trans</option>
                    <option value="Homem Trans">Homem Trans</option>
                    <option value="Não-binário">Não-binário</option>
                    <option value="Prefiro não informar">Prefiro não informar</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Cor/Raça *</label>
                  <select name="race" value={formData.race} onChange={handleChange} className="bg-bg border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors">
                    <option value="">Selecione...</option>
                    <option value="Branca">Branca</option>
                    <option value="Preta">Preta</option>
                    <option value="Parda">Parda</option>
                    <option value="Amarela">Amarela</option>
                    <option value="Indígena">Indígena</option>
                    <option value="Prefiro não informar">Prefiro não informar</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Possui alguma deficiência ou necessidade de acessibilidade?</label>
                  <textarea name="accessibility" value={formData.accessibility} onChange={handleChange} placeholder="Se sim, descreva aqui. Caso contrário, pode deixar em branco." rows={2} className="bg-white/5 border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors resize-none" />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6">
                <h3 className="font-mono text-sm uppercase tracking-widest text-accent mb-2">Passo 3: Expectativas</h3>
                
                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Nível de experiência com Arte/Tecnologia *</label>
                  <select name="experience" value={formData.experience} onChange={handleChange} className="bg-bg border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors">
                    <option value="">Selecione...</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Avançado">Avançado</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-sans text-sm opacity-70">Por que você quer participar desta oficina? *</label>
                  <textarea name="motivation" value={formData.motivation} onChange={handleChange} rows={3} className="bg-white/5 border border-white/10 p-4 font-sans focus:outline-none focus:border-accent transition-colors resize-none" />
                </div>

                <div className="flex flex-col gap-4 mt-4">
                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input type="checkbox" name="agreedToTerms" checked={formData.agreedToTerms} onChange={handleChange} className="peer sr-only" />
                      <div className="w-5 h-5 border border-white/30 peer-checked:bg-accent peer-checked:border-accent transition-colors flex items-center justify-center">
                        <Check size={14} className="opacity-0 peer-checked:opacity-100 text-bg" />
                      </div>
                    </div>
                    <span className="font-sans text-sm opacity-80 group-hover:opacity-100 transition-opacity">
                      Estou ciente de que as vagas são limitadas, que a oficina tem duração máxima de 90 dias e me comprometo a participar ativamente.
                    </span>
                  </label>

                  <label className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-1">
                      <input type="checkbox" name="agreedToImageUse" checked={formData.agreedToImageUse} onChange={handleChange} className="peer sr-only" />
                      <div className="w-5 h-5 border border-white/30 peer-checked:bg-accent peer-checked:border-accent transition-colors flex items-center justify-center">
                        <Check size={14} className="opacity-0 peer-checked:opacity-100 text-bg" />
                      </div>
                    </div>
                    <span className="font-sans text-sm opacity-80 group-hover:opacity-100 transition-opacity">
                      Autorizo a exibição dos trabalhos artísticos gerados na oficina na Galeria Pública do Projeto Visto.
                    </span>
                  </label>
                </div>
              </motion.div>
            )}

            <div className="flex justify-between mt-8 pt-8 border-t border-white/10">
              {step > 1 ? (
                <button type="button" onClick={handlePrev} className="px-6 py-3 border border-white/20 font-mono text-xs uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center gap-2">
                  <ChevronLeft size={16} /> Voltar
                </button>
              ) : <div></div>}
              
              <button 
                type="button" 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-3 bg-accent text-bg font-mono text-xs uppercase tracking-widest font-bold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Enviando...' : step < 3 ? (
                  <>Próximo <ChevronRight size={16} /></>
                ) : (
                  <>Garantir Vaga <Check size={16} /></>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const CourseViewer = ({ course, onClose, completedLessons, toggleLesson, user, userData, isAdmin, onEnroll, onLogin }: { 
  course: Course; 
  onClose: () => void;
  completedLessons: string[];
  toggleLesson: (id: string) => void;
  user: FirebaseUser | null;
  userData: AppUser | null;
  isAdmin: boolean;
  onEnroll: (courseId: string) => void;
  onLogin: () => void;
}) => {
  const [activeLesson, setActiveLesson] = useState<Lesson>(course.lessons[0]);
  const isEnrolled = userData?.enrolledCourses?.includes(course.id) || isAdmin;
  const progress = isEnrolled ? (completedLessons.filter(id => course.lessons.some(l => l.id === id)).length / course.lessons.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[70] bg-bg flex flex-col md:flex-row overflow-hidden pointer-events-auto">
      <div className="w-full md:w-3/4 flex flex-col h-full">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="font-display text-xl font-bold uppercase">{course.title} / {activeLesson.title}</h2>
          <button onClick={onClose} className="flex items-center gap-2 p-2 hover:text-accent font-mono text-[10px] uppercase tracking-widest">
            <X size={24} /> Voltar
          </button>
        </div>
        <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <div className="aspect-video bg-black/40 border border-white/10 mb-8 overflow-hidden">
              <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-contain" />
            </div>
            
            <div className="mb-12">
              <h3 className="font-display text-3xl font-bold mb-6 uppercase tracking-tighter">{course.title}</h3>
              <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-4 bg-white/5 border border-white/10 p-6">
                <p className="font-sans text-sm md:text-base leading-relaxed opacity-80 whitespace-pre-wrap">{course.description}</p>
              </div>
            </div>

            {!isEnrolled ? (
              <div className="p-12 bg-white/5 border border-white/10 text-center flex flex-col items-center justify-center">
                <Lock size={48} className="mb-6 opacity-50" />
                <h3 className="font-display text-3xl font-bold mb-4 uppercase tracking-tighter">Conteúdo Exclusivo</h3>
                <p className="font-sans opacity-60 mb-8 max-w-md text-lg">Matricule-se neste workshop para ter acesso a todas as aulas, materiais complementares e certificado de conclusão.</p>
                <button
                  onClick={() => user ? onEnroll(course.id) : onLogin()}
                  className="px-8 py-4 bg-[#00FF00] text-black font-mono text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-opacity shadow-[0_0_10px_rgba(0,255,0,0.6)]"
                >
                  Acessar Unidades
                </button>
              </div>
            ) : (
              <>
                <h4 className="font-display text-2xl font-bold mb-6 uppercase tracking-tighter">{activeLesson.title}</h4>
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
              </>
            )}
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
          {isEnrolled && course.classroomUrl && (
            <div className="p-6 border-b border-white/10">
              <a 
                href={course.classroomUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-3 px-4 bg-[#00FF00] text-black hover:bg-white hover:text-black border border-[#00FF00] hover:border-white transition-all duration-300 font-mono text-[10px] uppercase tracking-widest font-bold shadow-[0_0_10px_rgba(0,255,0,0.4)]"
              >
                <ExternalLink size={14} className="mr-2" />
                Google Classroom
              </a>
            </div>
          )}
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
    if (!title || !opId || !desc) {
      alert("Por favor, preencha todos os campos para enviar sua experimentação.");
      return;
    }
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
          placeholder="Título da Obra *" 
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-bg border border-white/20 p-4 font-mono text-sm focus:border-accent outline-none"
        />
        <input 
          type="text" 
          placeholder="ID do Sketch no OpenProcessing (ex: 123456) *" 
          value={opId}
          onChange={e => setOpId(e.target.value)}
          className="w-full bg-bg border border-white/20 p-4 font-mono text-sm focus:border-accent outline-none"
        />
        <textarea 
          placeholder="Breve descrição do seu processo criativo *" 
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

const AdminView = ({ onNavigate }: { onNavigate: (v: View) => void }) => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        const q = query(collection(db, 'enrollments'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Sort by date descending
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEnrollments(data);
      } catch (error) {
        console.error("Error fetching enrollments", error);
        handleFirestoreError(error, OperationType.LIST, 'enrollments');
      } finally {
        setLoading(false);
      }
    };
    fetchEnrollments();
  }, []);

  const exportToCSV = () => {
    if (enrollments.length === 0) return;

    const headers = [
      'Data de Inscrição',
      'Nome',
      'Email',
      'WhatsApp',
      'Data de Nascimento',
      'Cidade/Estado',
      'Gênero',
      'Raça/Cor',
      'Oficina',
      'Experiência',
      'Motivação',
      'Acessibilidade'
    ];

    const csvRows = [
      headers.join(','),
      ...enrollments.map(e => {
        const courseTitle = COURSES.find(c => c.id === e.courseId)?.title || e.courseId;
        const row = [
          new Date(e.createdAt).toLocaleDateString('pt-BR'),
          `"${e.name || ''}"`,
          `"${e.email || ''}"`,
          `"${e.whatsapp || ''}"`,
          `"${e.birthdate || ''}"`,
          `"${e.cityState || ''}"`,
          `"${e.gender || ''}"`,
          `"${e.race || ''}"`,
          `"${courseTitle}"`,
          `"${(e.experience || '').replace(/"/g, '""')}"`,
          `"${(e.motivation || '').replace(/"/g, '""')}"`,
          `"${(e.accessibility || '').replace(/"/g, '""')}"`
        ];
        return row.join(',');
      })
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LISTA_INSCRITOS_VISTO_LAB_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="pt-32 pb-24 px-6 md:px-12 min-h-screen">
      <button 
        onClick={() => onNavigate('gallery')}
        className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
      >
        <ArrowLeft size={14} /> Voltar para Galeria
      </button>
      <section className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <ScramblePageTitle text="Gestão de Oficinas - VISTO LAB" className="font-display text-6xl font-bold uppercase tracking-tighter mb-4" />
          <p className="font-sans opacity-60 max-w-2xl">Gerenciamento de inscrições e alunos.</p>
        </div>
        <button 
          onClick={exportToCSV}
          disabled={enrollments.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-bg font-mono text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} /> Baixar Lista de Inscritos (CSV)
        </button>
      </section>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-white/5 font-mono text-[10px] uppercase tracking-widest opacity-60">
              <tr>
                <th className="p-4 border-b border-white/10">Data</th>
                <th className="p-4 border-b border-white/10">Nome</th>
                <th className="p-4 border-b border-white/10">Email</th>
                <th className="p-4 border-b border-white/10">Oficina</th>
                <th className="p-4 border-b border-white/10">Telefone</th>
                <th className="p-4 border-b border-white/10">Cidade/Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center opacity-50">Carregando inscrições...</td>
                </tr>
              ) : enrollments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center opacity-50">Nenhuma inscrição encontrada.</td>
                </tr>
              ) : (
                enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4 opacity-70">{new Date(enrollment.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 font-bold">{enrollment.name}</td>
                    <td className="p-4 opacity-70">{enrollment.email}</td>
                    <td className="p-4 text-accent">{COURSES.find(c => c.id === enrollment.courseId)?.title || enrollment.courseId}</td>
                    <td className="p-4 opacity-70">{enrollment.whatsapp || '-'}</td>
                    <td className="p-4 opacity-70">{enrollment.cityState || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

const LoginView = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10 pointer-events-auto">
      <div className="w-full max-w-md p-12 border border-white/10 bg-white/5 shadow-2xl">
        <h2 className="font-display text-4xl font-bold uppercase tracking-tighter mb-8">Acesso ao <span className="text-accent">Lab</span></h2>
        <p className="font-sans opacity-60 mb-8 text-sm">Conecte-se com sua conta Google para acessar os workshops e salvar seu progresso na nuvem.</p>
        <button 
          onClick={() => {
            console.log("Botão de login clicado!");
            onLogin();
          }}
          className="w-full py-4 bg-white text-bg font-display font-bold uppercase tracking-widest hover:bg-accent transition-colors flex items-center justify-center gap-3 cursor-pointer"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Entrar com Google
        </button>
        <button 
          onClick={() => window.location.reload()} 
          className="w-full mt-4 py-3 border border-white/10 hover:border-white/40 font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer"
        >
          Voltar para o Início
        </button>
      </div>
    </div>
  );
};

// ... ArtworkCard and ArtworkModal remain similar ...

const PrivacyPolicyView = ({ onNavigate }: { onNavigate: (v: View) => void }) => (
  <main className="pt-32 pb-24 px-6 md:px-12 min-h-screen max-w-4xl mx-auto">
    <button 
      onClick={() => onNavigate('gallery')}
      className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
    >
      <ArrowLeft size={14} /> Voltar para Galeria
    </button>
    <div className="mb-16 md:mb-24">
      <ScramblePageTitle text="Política de Privacidade" className="font-display text-4xl md:text-6xl font-bold uppercase tracking-tighter" />
    </div>
    <div className="font-sans text-sm md:text-base opacity-80 space-y-6 leading-relaxed">
      <p>Bem-vindo ao <strong>VISTO_LAB</strong>. A sua privacidade é fundamental para nós. Esta política descreve como tratamos as informações no contexto de nossas práticas de educação aberta e creative coding.</p>
      
      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">1. Coleta de Dados e Uso de Câmeras</h3>
      <p>O VISTO_LAB utiliza tecnologias como <strong>p5.js</strong> e <strong>ml5.js</strong> para criar experiências interativas de arte digital. Algumas dessas experiências (sketches) podem solicitar acesso à sua <strong>webcam</strong> ou microfone para interações em tempo real (ex: rastreamento de movimento ou som).</p>
      <p><strong>Importante:</strong> Todo o processamento de imagem e som feito via ml5.js ou p5.js ocorre <strong>localmente no seu navegador (client-side)</strong>. Nós não gravamos, não armazenamos e não enviamos imagens ou vídeos da sua webcam para nossos servidores.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">2. Obras e Sketches no OpenProcessing</h3>
      <p>Muitos dos nossos sketches originais são hospedados na plataforma <strong>OpenProcessing</strong> e incorporados (embedded) em nosso site. Ao interagir com essas obras, você também está sujeito aos termos e políticas de privacidade do OpenProcessing. O OpenProcessing é uma plataforma de código aberto voltada para a comunidade de creative coding.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">3. Autenticação e Dados do Usuário</h3>
      <p>Para acessar os workshops e salvar seu progresso, utilizamos o login social do Google via Firebase Authentication. Coletamos apenas as informações básicas fornecidas pelo Google (nome, e-mail e foto de perfil) estritamente para criar sua conta de estudante/professor e gerenciar suas inscrições e certificados.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">4. Educação Aberta e Código Aberto</h3>
      <p>O VISTO_LAB é fundamentado na filosofia de educação aberta. Os códigos-fonte dos nossos sketches são abertos para estudo e remixagem. Incentivamos o compartilhamento e a colaboração, respeitando as licenças de código aberto aplicáveis.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">5. Contato</h3>
      <p>Se você tiver alguma dúvida sobre esta Política de Privacidade, entre em contato através do e-mail: <strong>core0gam3@gmail.com</strong>.</p>
      
      <p className="mt-12 opacity-50 font-mono text-xs">Última atualização: Abril de 2026</p>
    </div>
  </main>
);

const TermsOfServiceView = ({ onNavigate }: { onNavigate: (v: View) => void }) => (
  <main className="pt-32 pb-24 px-6 md:px-12 min-h-screen max-w-4xl mx-auto">
    <button 
      onClick={() => onNavigate('gallery')}
      className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
    >
      <ArrowLeft size={14} /> Voltar para Galeria
    </button>
    <div className="mb-16 md:mb-24">
      <ScramblePageTitle text="Termos de Serviço" className="font-display text-4xl md:text-6xl font-bold uppercase tracking-tighter" />
    </div>
    <div className="font-sans text-sm md:text-base opacity-80 space-y-6 leading-relaxed">
      <p>Ao acessar e utilizar o <strong>VISTO_LAB</strong>, você concorda com os seguintes termos e condições. Se não concordar com algum destes termos, por favor, não utilize nossa plataforma.</p>
      
      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">1. Natureza do Projeto</h3>
      <p>O VISTO_LAB é um espaço de experimentação em arte digital, performance e creative coding. Oferecemos workshops, galerias virtuais e sketches interativos baseados em tecnologias web (p5.js, ml5.js).</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">2. Uso de Tecnologias Interativas</h3>
      <p>Algumas obras requerem o uso de periféricos como webcam e microfone. O usuário é responsável por conceder as permissões no navegador. O VISTO_LAB garante que o processamento dessas mídias ocorre localmente, sem armazenamento não autorizado.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">3. Propriedade Intelectual e Código Aberto</h3>
      <p>Os sketches hospedados no OpenProcessing e disponibilizados no VISTO_LAB seguem os princípios do código aberto. Você é livre para estudar, modificar e remixar os códigos para fins educacionais, desde que atribua os devidos créditos aos artistas originais (ex: Chico Machado, Roberta Savian Rosa) e ao projeto VISTO_LAB.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">4. Conduta do Usuário</h3>
      <p>Ao participar dos nossos workshops ou submeter experimentações para a Galeria Virtual, você se compromete a manter um ambiente de respeito mútuo. Não serão tolerados conteúdos ofensivos, discriminatórios ou que violem direitos de terceiros.</p>

      <h3 className="text-xl font-bold text-accent mt-8 mb-4 uppercase font-mono">5. Modificações</h3>
      <p>O VISTO_LAB reserva-se o direito de modificar estes termos a qualquer momento. O uso contínuo da plataforma após tais alterações constitui a sua aceitação dos novos termos.</p>

      <p className="mt-12 opacity-50 font-mono text-xs">Última atualização: Abril de 2026</p>
    </div>
  </main>
);

const MenuOverlay = ({ isOpen, onClose, setView, currentView, isAdmin }: { isOpen: boolean; onClose: () => void; setView: (v: View) => void; currentView: View; isAdmin?: boolean }) => {
  const menuItems: { label: string; view: View }[] = [
    { label: 'Galeria', view: 'gallery' },
    { label: 'Workshops', view: 'courses' },
    { label: 'Ao Vivo', view: 'live' },
    { label: 'Artistas', view: 'artists' },
    { label: 'SONORA_VISTA PODCAST', view: 'podcast' }
  ];

  if (isAdmin) {
    menuItems.push({ label: 'Painel do Professor', view: 'admin' });
  }

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
            <div className="flex flex-col items-center md:items-end gap-2">
              <p className="font-mono text-[10px] opacity-50 uppercase tracking-[0.3em] text-center md:text-right">
                © 2026 V.I.S.T.O: OCUPAÇÕES VÍDEO_COREOGRÁFICAS
              </p>
              <div className="flex gap-4 font-mono text-[10px] uppercase tracking-widest opacity-50">
                <button onClick={() => { setView('privacidade'); onClose(); }} className="hover:text-accent hover:opacity-100 transition-colors">Privacidade</button>
                <button onClick={() => { setView('termos'); onClose(); }} className="hover:text-accent hover:opacity-100 transition-colors">Termos</button>
              </div>
            </div>
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

const LogosFooter = ({ onNavigate }: { onNavigate: (v: View) => void }) => (
  <footer className="relative w-full px-[2%] py-[40px] bg-[#CCFF00] hover:bg-black flex flex-col items-center overflow-hidden group cursor-crosshair transition-colors duration-500">
    {/* CRT Scanline Overlay */}
    <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 z-20 transition-opacity duration-500 bg-[linear-gradient(rgba(204,255,0,0)_50%,rgba(204,255,0,0.1)_50%)] bg-[length:100%_4px]" />
    
    {/* Top Neon Border Glow */}
    <div className="absolute top-0 left-0 w-full h-[1px] bg-[#CCFF00] shadow-[0_0_15px_#CCFF00] z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

    <div className="relative w-full max-w-[1920px] transition-transform duration-700 group-hover:scale-[1.01]">
      {/* Normal Image (Colorida) */}
      <img 
        src="https://drive.google.com/thumbnail?id=1ZXJ1MQ-KW89XY23H5Qywt-yRlaxTDo4x&sz=w2000" 
        alt="Logos Institucionais" 
        className="w-full h-auto object-contain block relative z-10 transition-opacity duration-500 opacity-100 group-hover:opacity-0" 
        referrerPolicy="no-referrer"
      />
      
      {/* Hover Image (Negativa) */}
      <img 
        src="https://drive.google.com/thumbnail?id=1wiuKVl7TTphuQhoCUX0S6cxFdZ5HZw-I&sz=w2000" 
        alt="Logos Institucionais Negativo" 
        className="absolute inset-0 w-full h-full object-contain z-10 transition-all duration-500 opacity-0 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(204,255,0,0.6)]" 
        referrerPolicy="no-referrer"
      />
    </div>

    <div className="relative z-30 mt-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-8 font-mono text-[10px] uppercase tracking-widest text-black group-hover:text-[#CCFF00] transition-colors duration-500">
      <a href="/privacidade" onClick={(e) => { e.preventDefault(); onNavigate('privacidade'); }} className="hover:underline">Política de Privacidade</a>
      <a href="/termos" onClick={(e) => { e.preventDefault(); onNavigate('termos'); }} className="hover:underline">Termos de Serviço</a>
      <span className="opacity-50">© 2026 V.I.S.T.O</span>
    </div>
  </footer>
);

const ARTISTS_DATA = [
  {
    id: 'chico-machado',
    name: 'Chico Machado',
    photo: '/1.webp',
    bio: `Chico Machado (João Carlos Machado) é <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">artista, performer e professor</span> do Departamento de Arte Dramática do Instituto de Artes da <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Universidade Federal do Rio Grande do Sul</span> e do <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Programa de Pós-Graduação em Artes Visuais da UFRGS</span>. Bacharel em Pintura e em Desenho, Especialista em Teatro Contemporâneo, com Mestrado e Doutorado em Poéticas Visuais pela UFRGS. É fundador e coordenador do Grupo Insubordinado de Pesquisa (GRIPE). Residente em Porto Alegre, atua desde o final da década de 1980 nas áreas das artes visuais, da performance, do teatro e da arte sonora. Trabalhou com HQ (comics), bandas de música pop (como baixista e compositor) e desenvolve trabalhos em pintura, desenho, escultura, objetos cinéticos, objetos sonoros, cenografia, direção teatral e vídeo. Realizou dezenas de exposições coletivas e individuais e participou de diversos espetáculos cênicos em diversas funções. Recebeu diversas premiações regionais e nacionais na área de artes visuais e de teatro. Em 2025 foi um dos artistas selecionados com trabalho comissionado para a <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">14ª Bienal do Mercosul</span>.`
  },
  {
    id: 'roberta-savian-rosa',
    name: 'Roberta Savian Rosa',
    photo: '/2.webp',
    bio: `<span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Bailatriz, pesquisadora, educadora e artista de código</span> em práticas de <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">creative coding</span>, atua na interseção entre <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">corpo, tecnologias digitais de código aberto e educação</span>. Doutora em Informática na Educação (UFRGS, 2024), mestra em Artes Cênicas (UFRGS, 2017), licenciada em Dança (UERGS, 2009) e especialista em Mídias Integradas na Educação (IFSC, 2021).
Desde 2008, investiga práticas corpóreo-digitais em tempo real, com foco em pesquisa-criação, cognição incorporada e pedagogias críticas. Desenvolveu obras autorais como <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Migrações Temporárias: Fronteiras Reais e Imaginárias do Brasil</span> (2009–2012, <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Prêmio Funarte Klauss Vianna</span>) e <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">V.I.S.T.O: Ocupações Vídeo-Coreográficas</span> (2012–2015, <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Prêmio Funarte Klauss Vianna 2012</span>; <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">VISTO: REABRINDO O LUGARzinho no 4º Distrito Poa PNAB–SEDAC/RS 2024–2026</span>), além do projeto <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Is@.coreo: Dança e Mediação Tecnológica</span> (2014–2015, <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">FUMPROARTE</span>).
É criadora do <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">CORE0GAM3</span>, framework de programação criativa em código aberto para formação de professores-artistas, baseado em <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">p5.js e ml5.js</span>. Em 2021, integrou a equipe vencedora do <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">2º CubeDesign Virtual/INPE</span> (categoria ArtSat), experiência que desdobrou sua participação na obra <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Templo Orbital</span>, concebida pelo artista Edson Pavoni e apresentada na <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">13ª Bienal do Mercosul (2022)</span>, na qual atuou na equipe de pesquisa artística e mediação educacional.
Seus trabalhos integram circuitos nacionais e internacionais, com exibição no <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Festival Internacional de Videodança DVDANZA (Havana, Cuba)</span>.
Pesquisadora colaboradora do <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">NEECD/UFRGS</span>, articula dança, tecnologias abertas e formação, compreendendo a cultura digital como campo crítico e poético. Membro do <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Conselho Internacional de Dança da UNESCO (CID)</span>, mantém redes de colaboração na <span class="text-[#00FF00] font-bold drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">América Latina e Europa</span>.`
  }
];

const ArtistCard: React.FC<{ artist: typeof ARTISTS_DATA[0] }> = ({ artist }) => {
  const [hasScrolled, setHasScrolled] = React.useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 10) {
      if (!hasScrolled) setHasScrolled(true);
    } else {
      if (hasScrolled) setHasScrolled(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-start w-full">
      {/* Left Side: 40% */}
      <div className="w-full md:w-[40%] flex justify-center items-start relative shrink-0">
        {/* Glow Background */}
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-start justify-center pointer-events-none">
          <div className="mt-0 w-[250px] h-[250px] md:w-[400px] md:h-[400px] rounded-2xl bg-[#ff00ff]/10 blur-3xl" />
        </div>
        
        {/* Image */}
        <div className="relative w-[250px] h-[250px] md:w-[400px] md:h-[400px] rounded-2xl overflow-hidden border-2 border-[#ff00ff] shadow-[0_0_30px_rgba(255,0,255,0.3)] z-10 aspect-square">
          <img 
            src={artist.photo} 
            alt={artist.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Right Side: 60% */}
      <div className="w-full md:w-[60%] flex flex-col">
        <div className="mb-8 md:mb-12 flex items-start justify-center md:justify-start shrink-0">
          <ScramblePageTitle 
            text={artist.name} 
            noMargin={true}
            className="font-archivo text-4xl md:text-6xl lg:text-[5rem] leading-none uppercase text-white text-center md:text-left drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
          />
        </div>
        
        <div className="relative w-full h-[250px] md:h-[300px] overflow-hidden">
          <div 
            onScroll={handleScroll}
            className="h-full overflow-y-auto pr-2 md:pr-4 custom-scrollbar-magenta font-space text-sm md:text-base text-gray-300 leading-relaxed"
          >
            {artist.bio.split('\n').map((paragraph, i) => {
              if (!paragraph.trim()) return null;
              return (
                <p 
                  key={i} 
                  className="mb-4 last:mb-0 text-left"
                  dangerouslySetInnerHTML={{ __html: paragraph }}
                />
              );
            })}
            {/* Extra padding at the bottom so the last line isn't hidden by the gradient if it stays */}
            <div className="h-12"></div>
          </div>

          {/* Fade-out Gradient Mask (Option 1) */}
          <div 
            className={`absolute bottom-0 left-0 right-4 h-24 bg-gradient-to-t from-bg via-bg/90 to-transparent pointer-events-none transition-opacity duration-500 ${hasScrolled ? 'opacity-0' : 'opacity-100'}`}
          />

          {/* Terminal Indicator (Option 2) */}
          <div 
            className={`absolute bottom-2 right-8 font-mono text-[#ff00ff] text-xs md:text-sm animate-pulse pointer-events-none transition-opacity duration-500 bg-bg px-3 py-1 rounded-md shadow-[0_0_10px_rgba(10,10,10,0.8)] ${hasScrolled ? 'opacity-0' : 'opacity-100'}`}
          >
            [ scroll ↓ ]
          </div>
        </div>
      </div>
    </div>
  );
};

const ArtistsView = () => {
  return (
    <div className="flex flex-col w-full mt-12 bg-[#000000]">
      {ARTISTS_DATA.map((artist, index) => {
        const isLast = index === ARTISTS_DATA.length - 1;
        
        return (
          <React.Fragment key={artist.id}>
            <div className={`w-full max-w-7xl mx-auto px-4 md:px-0 ${isLast ? '' : 'mb-32'}`}>
              <ArtistCard artist={artist} />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  enrolledCourses?: string[];
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

  const [view, setView] = useState<View>(() => {
    const path = window.location.pathname.replace('/', '');
    if (['gallery', 'courses', 'login', 'live', 'artists', 'sonora', 'podcast', 'admin', 'privacidade', 'termos'].includes(path)) {
      return path as View;
    }
    const hash = window.location.hash.replace('#', '');
    if (['gallery', 'courses', 'login', 'live', 'artists', 'sonora', 'podcast', 'admin', 'privacidade', 'termos'].includes(hash)) {
      return hash as View;
    }
    return 'gallery';
  });

  useEffect(() => {
    if (view === 'gallery') {
      window.history.pushState(null, '', '/');
    } else {
      window.history.pushState(null, '', `/${view}`);
    }
  }, [view]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace('/', '');
      if (['gallery', 'courses', 'login', 'live', 'artists', 'sonora', 'podcast', 'admin', 'privacidade', 'termos'].includes(path)) {
        setView(path as View);
      } else {
        setView('gallery');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchFilterType, setSearchFilterType] = useState<'OBRAS' | 'ARTISTAS' | 'DATA' | 'TAGS'>('OBRAS');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isAdmin = userData?.role === 'admin' || user?.email?.toLowerCase() === 'core0gam3@gmail.com';
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
      login: 'LOGIN',
      admin: 'PAINEL DO PROFESSOR',
      privacidade: 'POLÍTICA DE PRIVACIDADE',
      termos: 'TERMOS DE SERVIÇO'
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
      try {
        handleFirestoreError(error, OperationType.GET, 'submissions');
      } catch (e) {
        // Ignorar o erro lançado para evitar "Uncaught Error in snapshot listener"
      }
    });
    return () => unsubscribe();
  }, []);

  // Auth State Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] Mudança de estado detectada. Usuário:", firebaseUser?.email || "Deslogado");
      setUser(firebaseUser);
      if (firebaseUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            const isInitialAdmin = firebaseUser.email?.toLowerCase() === 'core0gam3@gmail.com';
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              role: isInitialAdmin ? 'admin' : 'student',
              enrolledCourses: [],
              createdAt: new Date().toISOString()
            });
          } else {
            // Upgrade existing user to admin if email matches
            if (firebaseUser.email?.toLowerCase() === 'core0gam3@gmail.com' && userDoc.data()?.role !== 'admin') {
              await updateDoc(userRef, { role: 'admin' });
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }

        // Listen to user data
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as AppUser);
          }
        }, (error) => {
          console.error("[Auth] Erro no snapshot do usuário:", error);
          try {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          } catch (e) {
            // Ignoramos o erro de permissão aqui pois ele pode ocorrer brevemente durante o logout
          }
        });

        // Check for pending enrollment after login
        const pendingCourseId = sessionStorage.getItem('pendingEnrollmentCourseId');
        if (pendingCourseId) {
          sessionStorage.removeItem('pendingEnrollmentCourseId');
          const isUserAdmin = firebaseUser.email?.toLowerCase() === 'core0gam3@gmail.com';
          
          // We need to check if the user is already enrolled.
          // Since userData might not be loaded yet, we fetch the user doc directly.
          const userDoc = await getDoc(userRef);
          const isEnrolled = userDoc.exists() && userDoc.data().enrolledCourses?.includes(pendingCourseId);

          if (isUserAdmin || isEnrolled) {
            const course = COURSES.find(c => c.id === pendingCourseId);
            if (course) setSelectedCourse(course);
            handleNavigate('courses');
          } else {
            setEnrollmentCourseId(pendingCourseId);
            handleNavigate('courses');
          }
        }
      } else {
        console.log("[Auth] Estado null detectado. Limpando dados locais...");
        setCompletedLessons([]);
        setUserData(null);
        setEnrollmentCourseId(null);
        setPendingEnrollmentCourseId(null);
        if (unsubscribeUser) unsubscribeUser();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubscribeUser) unsubscribeUser();
    };
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
    }, (error: any) => {
      console.error("Error in progress snapshot:", error);
      try {
        handleFirestoreError(error, OperationType.GET, `progress/${progressId}`);
      } catch (e) {
        // Ignorar o erro lançado para evitar "Uncaught Error in snapshot listener"
      }
    });

    return () => unsubscribe();
  }, [user, selectedCourse]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      console.log("[Auth] Iniciando login com Google...");
      
      // Força a seleção de conta, matando o "fantasma" da sessão anterior
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, googleProvider);
      console.log("[Auth] Login bem-sucedido:", result.user.email);
      const isUserAdmin = result.user.email?.toLowerCase() === 'core0gam3@gmail.com';
      
      if (isUserAdmin) {
        if (pendingEnrollmentCourseId) {
          const course = COURSES.find(c => c.id === pendingEnrollmentCourseId);
          if (course) setSelectedCourse(course);
          setPendingEnrollmentCourseId(null);
          handleNavigate('courses');
        } else {
          handleNavigate('admin');
        }
      } else {
        handleNavigate('courses');
        if (pendingEnrollmentCourseId) {
          // We need to wait for userData to load to know if they are enrolled.
          // The onAuthStateChanged listener handles this logic now.
          // We just leave the pending ID in state.
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log("[Auth] Popup fechado pelo usuário ou requisição cancelada.");
      } else {
        console.error("[Auth] Erro crítico durante o login:", error);
        alert(`Erro ao fazer login: ${error.message || 'Erro desconhecido'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("[Auth] Iniciando logout (Hard Reset)...");
      await signOut(auth);
      
      // Limpeza forçada de todo o estado global
      setUser(null);
      setUserData(null);
      setCompletedLessons([]);
      setEnrollmentCourseId(null);
      setPendingEnrollmentCourseId(null);
      
      // Limpeza rigorosa do cache do navegador
      sessionStorage.clear();
      
      console.log("[Auth] Logout concluído. Estado e cache limpos.");
      handleNavigate('gallery');
    } catch (error) {
      console.error("[Auth] Erro crítico durante o logout:", error);
    }
  };

  const [enrollmentCourseId, setEnrollmentCourseId] = useState<string | null>(null);
  const [pendingEnrollmentCourseId, setPendingEnrollmentCourseId] = useState<string | null>(null);

  const handleEnrollClick = (courseId: string) => {
    if (!user) {
      sessionStorage.setItem('pendingEnrollmentCourseId', courseId);
      setPendingEnrollmentCourseId(courseId);
      handleNavigate('login');
      return;
    }
    
    // Check if user is already enrolled in THIS SPECIFIC course
    const isEnrolled = userData?.enrolledCourses?.includes(courseId) || isAdmin;
    
    if (isEnrolled) {
      const course = COURSES.find(c => c.id === courseId);
      if (course) {
        setSelectedCourse(course);
      }
    } else {
      setEnrollmentCourseId(courseId);
    }
  };

  const handleEnrollSuccess = (courseId: string) => {
    setEnrollmentCourseId(null);
    const course = COURSES.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
    }
    alert('Inscrição realizada com sucesso! Bem-vindo(a) à oficina.');
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
      await setDoc(progressRef, {
        userId: user.uid,
        courseId: selectedCourse.id,
        completedLessons: newProgress,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error: any) {
      console.error("Error toggling lesson:", error);
      alert("Erro ao marcar progresso: " + (error.message || error));
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
        isAdmin={isAdmin}
      />
      
      <MenuOverlay 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        setView={handleNavigate}
        currentView={view}
        isAdmin={isAdmin}
      />
      
      {view === 'login' && <LoginView onLogin={handleLogin} />}
      {view === 'admin' && <AdminView onNavigate={handleNavigate} />}
      {view === 'privacidade' && <PrivacyPolicyView onNavigate={handleNavigate} />}
      {view === 'termos' && <TermsOfServiceView onNavigate={handleNavigate} />}

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
              text="WORKSHOPS"
              className="font-display text-6xl md:text-8xl lg:text-[8rem] xl:text-[10rem] font-bold uppercase tracking-tighter mb-6"
            />
            <p className="font-sans opacity-60 max-w-2xl text-lg leading-relaxed">Oficinas e laboratórios focados em performance, improvisação e presença intermediada por tecnologia.</p>
          </section>

          {!user && (
            <div className="mb-12 p-8 border border-accent/30 bg-accent/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="font-display text-xl uppercase tracking-tight">Faça login com sua conta Google para poder se inscrever nas oficinas.</p>
              <button onClick={() => handleNavigate('login')} className="px-8 py-3 bg-accent text-bg font-mono text-[10px] uppercase tracking-widest font-bold">Fazer Login com Google para Inscrição</button>
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
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#00FF41] hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-start w-full max-w-7xl mx-auto">
            {/* Left Side: Image */}
            <div className="w-full md:w-[40%] flex justify-center items-center relative shrink-0">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-[250px] h-[250px] md:w-[400px] md:h-[400px] rounded-2xl bg-[#00FF41]/10 blur-3xl" />
              </div>
              <div className="relative w-full aspect-square md:w-[400px] md:h-[400px] rounded-2xl overflow-hidden border-2 border-[#00FF41] shadow-[0_0_30px_rgba(0,255,65,0.3)] z-10">
                <img 
                  src="/espera_ao_vivo.webp" 
                  alt="AO VIVO — SESSÕES DE CASA ABERTA" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Right Side: Content */}
            <div className="w-full md:w-[60%] flex flex-col">
              <div className="mb-6 flex flex-col items-start justify-center md:justify-start shrink-0 min-h-[180px]">
                <ScramblePageTitle 
                  text="AO VIVO — SESSÕES DE CASA ABERTA" 
                  className="font-display text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                />
                <p className="font-sans text-lg md:text-xl opacity-80 text-[#00FF41] mt-2">
                  Um laboratório em fluxo contínuo onde corpo, código e som se atravessam. Acompanhe processos em tempo real e acesse a criação no instante em que ela acontece.
                </p>
              </div>
              
              <div className="relative w-full h-[350px] md:h-[450px] overflow-hidden border border-white/10 rounded-xl bg-white/5 pointer-events-auto">
                <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
                
                <div className="w-full h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
                  <div className="font-sans text-sm md:text-base opacity-80 space-y-6 leading-relaxed pb-8">
                    <p className="font-mono text-xs text-[#00FF41] uppercase tracking-widest">[LOG_SESSÃO]: CASA ABERTA #01 a #08</p>
                    <p>As Sessões de Casa Aberta são dispositivos de exposição de processo — momentos em que o V.I.S.T.O abre seu espaço e compartilha, em tempo real, as dinâmicas de criação que atravessam seu laboratório.</p>
                    <p>Realizadas no LugarZinho, no 4º Distrito de Porto Alegre, as sessões configuram uma série de ocupações vídeo-coreográficas que investigam o encontro entre corpo, código e matéria sonora.</p>
                    <p>A artista Roberta Savian Rosa conduz a pesquisa em vídeo-coreografia a partir da programação criativa como prática coreográfica expandida. Seus objetos digitais interativos operam como extensões do gesto, produzindo visualidades generativas em constante mutação.</p>
                    <p>Em diálogo, Chico Machado ativa um campo sonoro híbrido, combinando objetos analógicos e sistemas abertos para construir texturas acústicas que respondem e tensionam o ambiente visual.</p>
                    <p>Este laboratório performativo se organiza como um ecossistema sensível onde corpo, sinal e matéria se afetam mutuamente. A cada sessão, uma nova configuração emerge — instável, processual e irrepetível.</p>
                    <p>Transmitidas ao vivo, as sessões expandem o espaço físico para o ambiente digital, convidando o público a acompanhar e interagir com o processo em fluxo contínuo. O que se compartilha não é uma obra finalizada, mas um campo de experimentação aberto, onde criação e recepção se contaminam.</p>
                    
                    <div className="mt-8 p-6 border border-[#00FF41]/30 bg-[#00FF41]/5 rounded-lg">
                      <h3 className="font-mono text-sm text-[#00FF41] uppercase tracking-widest mb-4">Matriz do Processo</h3>
                      <ul className="space-y-2 font-mono text-xs md:text-sm">
                        <li><span className="text-white/50">Corpo & Creative Coding:</span> Roberta Savian Rosa</li>
                        <li><span className="text-white/50">Objetos Low Tech & Arte Sonora:</span> Chico Machado</li>
                        <li><span className="text-white/50">Sistemas:</span> Objetos Digitais Interativos & Código Aberto</li>
                        <li><span className="text-white/50">Formato:</span> 8 sessões de 30 minutos (4 horas de material original)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <a 
                  href="https://www.youtube.com/@PROJETOVISTO/streams" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-[#00FF41] border-2 border-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-all duration-300 font-mono text-xs md:text-sm uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(0,255,65,0.4)] hover:shadow-[0_0_25px_rgba(0,255,65,0.8)]"
                >
                  <ExternalLink size={16} className="mr-3" />
                  [ AGENDAR LEMBRETE NA TRANSMISSÃO ]
                </a>
              </div>
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
          <section className="mb-20">
            <ScramblePageTitle text="ARTISTAS" className="font-display text-7xl md:text-8xl lg:text-9xl font-bold uppercase tracking-tighter mb-8" />
          </section>
          <ArtistsView />
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
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#00FF41] hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-start w-full max-w-7xl mx-auto">
            {/* Left Side: Image */}
            <div className="w-full md:w-[40%] flex justify-center items-center relative shrink-0">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-[250px] h-[250px] md:w-[400px] md:h-[400px] rounded-2xl bg-[#00FF41]/10 blur-3xl" />
              </div>
              <div className="relative w-full aspect-square md:w-[400px] md:h-[400px] rounded-2xl overflow-hidden border-2 border-[#00FF41] shadow-[0_0_30px_rgba(0,255,65,0.3)] z-10">
                <img 
                  src="/espera_sonora_vista.webp" 
                  alt="SONORA_VISTA PODCAST" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Right Side: Content */}
            <div className="w-full md:w-[60%] flex flex-col">
              <div className="mb-6 flex flex-col items-start justify-center md:justify-start shrink-0 min-h-[220px] md:min-h-[180px]">
                <ScramblePageTitle 
                  text="SONORA_VISTA PODCAST" 
                  className="font-display text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tighter text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] h-[140px] md:h-[120px] lg:h-[140px] justify-center"
                />
                <p className="font-sans text-lg md:text-xl opacity-80 text-[#00FF41] mt-2">
                  Uma escuta dos bastidores — onde ideias, práticas e experimentações ganham voz.
                </p>
              </div>
              
              <div className="relative w-full h-[350px] md:h-[450px] overflow-hidden border border-white/10 rounded-xl bg-white/5 pointer-events-auto">
                <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
                
                <div className="w-full h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
                  <div className="font-sans text-sm md:text-base opacity-80 space-y-6 leading-relaxed pb-8">
                    <p>O SONORA_VISTA PODCAST é a extensão sonora do ecossistema criativo do V.I.S.T.O — um espaço de escuta onde processos, ideias e experimentações ganham corpo em forma de conversa.</p>
                    <p>Inserido em um território de intersecção entre a presença do corpo e as texturas das tecnologias digitais e analógicas, o podcast acompanha a reabertura do atelier como um laboratório vivo. Cada episódio revela camadas do fazer artístico que atravessam a vídeo-coreografia, a arte generativa e a arte sonora, não como linguagens isoladas, mas como campos em constante contaminação.</p>
                    <p>Mais do que registrar, o SONORA_VISTA documenta deslocamentos: o retorno ao espaço físico como gesto de memória e, simultaneamente, como plataforma de projeção para novas visualidades e modos de existência sensível.</p>
                    <p>🎙️ Bastidores e processos criativos conduzem a narrativa — com os idealizadores e convidados compartilhando percursos, dúvidas, estratégias e fabulações que sustentam suas práticas.</p>
                    <p>Entre o ensaio e a escuta, o íntimo e o técnico, o podcast se estabelece como um arquivo em movimento: um espaço onde o pensamento artístico acontece em tempo real.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <a 
                  href="https://open.spotify.com/user/31lgtcyqypbtxgsvzrczwlndwt74?si=1e2e8f075d0841a1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-[#00FF41] border-2 border-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-all duration-300 font-mono text-xs md:text-sm uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(0,255,65,0.4)] hover:shadow-[0_0_25px_rgba(0,255,65,0.8)]"
                >
                  <ExternalLink size={16} className="mr-3" />
                  OUVIR NO SPOTIFY
                </a>
              </div>
            </div>
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
          userData={userData}
          isAdmin={isAdmin}
          onEnroll={handleEnrollClick}
          onLogin={() => {
            sessionStorage.setItem('pendingEnrollmentCourseId', selectedCourse.id);
            setPendingEnrollmentCourseId(selectedCourse.id);
            setSelectedCourse(null);
            handleNavigate('login');
          }}
        />
      )}

      {enrollmentCourseId && user && (
        <EnrollmentModal
          course={COURSES.find(c => c.id === enrollmentCourseId)!}
          user={user}
          onClose={() => setEnrollmentCourseId(null)}
          onSuccess={handleEnrollSuccess}
        />
      )}

      {/* Footer Info */}
      <LogosFooter onNavigate={handleNavigate} />
    </div>
  );
}
