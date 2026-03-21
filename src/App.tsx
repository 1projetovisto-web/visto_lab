import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Menu, X, Info, ArrowUpRight, Github, Instagram, Twitter, BookOpen, User, LogOut, CheckCircle, Award, AlertTriangle, Search, ArrowLeft } from 'lucide-react';
import { ARTWORKS, Artwork, COURSES, Course, Lesson } from './data';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where,
  handleFirestoreError, OperationType, FirebaseUser
} from './firebase';

type View = 'gallery' | 'courses' | 'login' | 'live';

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
      <h1 className="w-full">
        {contentLines.map((line, lineIdx) => {
          const words = line.text.split(' ');
          return (
            <div key={lineIdx} className={line.className || className}>
            {words.map((word, wordIdx) => {
              const isHighlighted = highlights.some(h => word.toLowerCase().includes(h.toLowerCase()));
              return (
                <span key={wordIdx} className="inline-block mr-[0.3em] whitespace-nowrap" style={{ transformStyle: 'preserve-3d' }}>
                  {word.split('').map((char, charIdx) => (
                    <motion.span
                      key={charIdx}
                      initial={{ opacity: 0, filter: 'blur(20px)', rotateY: 60, rotateX: 45, z: -150, y: 20 }}
                      whileInView={{ opacity: 1, filter: 'blur(0px)', rotateY: 0, rotateX: 0, z: 0, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ 
                        delay: (lineIdx * 0.1) + (wordIdx * 0.05) + (charIdx * 0.03),
                        duration: 1.4,
                        ease: [0.2, 0.8, 0.2, 1]
                      }}
                      className={`relative inline-block cursor-default group ${isHighlighted ? 'text-accent italic' : 'text-white'} transition-all duration-300 ease-in-out`}
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
                        {char}
                      </span>
                      {/* Secondary Depth Layer */}
                      <span 
                        className="absolute inset-0 opacity-0 group-hover:opacity-20 blur-[8px] pointer-events-none transition-opacity duration-500"
                        style={{ transform: 'translateZ(-60px)' }}
                      >
                        {char}
                      </span>
                      {/* Tertiary Depth Layer */}
                      <span 
                        className="absolute inset-0 opacity-0 group-hover:opacity-10 blur-[12px] pointer-events-none transition-opacity duration-700"
                        style={{ transform: 'translateZ(-90px)' }}
                      >
                        {char}
                      </span>
                      {/* Quaternary Depth Layer */}
                      <span 
                        className="absolute inset-0 opacity-0 group-hover:opacity-5 blur-[16px] pointer-events-none transition-opacity duration-1000"
                        style={{ transform: 'translateZ(-120px)' }}
                      >
                        {char}
                      </span>
                      {char}
                    </motion.span>
                  ))}
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
      className="font-mono text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight uppercase cursor-pointer hover:bg-black hover:text-white px-3 py-2 rounded-2xl transition-all duration-300 flex items-center gap-2 group"
    >
      <span>{text1}</span> <span className="text-accent group-hover:text-white transition-colors duration-300">{text2}</span>
    </h1>
  );
};

const ScrambleNavItem = ({ text, onClick, isActive }: { text: string, onClick: () => void, isActive: boolean }) => {
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
    <button 
      onClick={onClick}
      onMouseEnter={handleMouseOver}
      className={`font-mono text-xs sm:text-sm md:text-base uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-all duration-300 hover:bg-black hover:text-white ${isActive ? 'text-accent' : 'text-white'}`}
    >
      {displayText}
    </button>
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
    className="fixed top-0 left-0 w-full z-50 px-6 py-6 flex justify-between items-center transition-colors duration-300 border-b border-white/5"
  >
    <div className="pointer-events-auto flex items-center gap-8 lg:gap-16">
      <ScrambleTitle onClick={() => setView('gallery')} />
      <nav className="hidden sm:flex gap-4 md:gap-8">
        <ScrambleNavItem text="Galeria" onClick={() => setView('gallery')} isActive={currentView === 'gallery'} />
        <ScrambleNavItem text="Workshops" onClick={() => setView('courses')} isActive={currentView === 'courses'} />
        <ScrambleNavItem text="Ao Vivo" onClick={() => setView('live')} isActive={currentView === 'live'} />
      </nav>
    </div>
    <div className="pointer-events-auto flex items-center gap-4">
      {user ? (
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase opacity-50 hidden sm:inline">Olá, {user.displayName || 'Usuário'}</span>
          <button onClick={onLogout} className="p-2 hover:text-accent"><LogOut size={20} /></button>
        </div>
      ) : (
        <button onClick={() => setView('login')} className="p-2 hover:text-accent"><User size={24} /></button>
      )}
      <button 
        onClick={onToggleMenu}
        className="p-2 hover:text-accent transition-colors"
      >
        {isMenuOpen ? <X size={32} /> : <Menu size={32} />}
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
    { label: 'Ao Vivo', view: 'live' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[100] bg-bg flex flex-col justify-center items-center p-12"
        >
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-2 hover:text-accent transition-colors"
          >
            <X size={40} />
          </button>

          <nav className="flex flex-col gap-8 text-center">
            {menuItems.map((item) => (
              <motion.button
                key={item.view}
                onClick={() => { setView(item.view); onClose(); }}
                className={`font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter hover:text-accent transition-colors ${currentView === item.view ? 'text-accent' : ''}`}
                whileHover={{ x: 20 }}
              >
                {item.label}
              </motion.button>
            ))}
          </nav>
          
          <div className="absolute bottom-12 left-12 right-12 flex flex-col md:flex-row justify-between items-center gap-8">
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
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
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
  <footer className="w-full px-[2%] py-[40px] bg-[#CCFF00] flex justify-center transition-all duration-500 ease-in-out group overflow-hidden">
    <img 
      src="https://lh3.googleusercontent.com/d/1fs54ghIfUMm9DmJ0Yp-FqC0Dug-JOaDg" 
      alt="Logos Institucionais" 
      className="w-full max-w-[1920px] h-auto block group-hover:scale-105 transition-all duration-500 ease-in-out" 
      referrerPolicy="no-referrer"
    />
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
      setView('courses');
    } catch (error) {
      console.error("Login Error", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('gallery');
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
        setView={setView}
        user={user}
        onLogout={handleLogout}
        y={headerY}
        bg={headerBg}
        blur={headerBlur}
      />
      
      <MenuOverlay 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        setView={setView}
        currentView={view}
      />
      
      {view === 'login' && <LoginView onLogin={handleLogin} />}

      {view === 'gallery' && (
        <main className="pt-32 pb-24 px-6 md:px-12">
          {/* Intro Section */}
          <motion.section 
            style={{ y: introY, opacity: introOpacity }}
            className="mb-24 w-full bg-black py-12 px-4 rounded-xl border border-white/5 mx-auto flex flex-col items-center justify-center text-center"
          >
            <InteractiveTitle 
              lines={[
                { text: "V.I.S.T.O: OCUPAÇÕES", className: "font-display text-[1.8rem] sm:text-[3rem] md:text-[4rem] lg:text-[5rem] font-bold leading-tight tracking-tight" },
                { text: "VÍDEO_COREOGRÁFICAS", className: "font-display text-[1.6rem] sm:text-[2.8rem] md:text-[3.5rem] lg:text-[4.5rem] font-bold leading-tight tracking-tight mb-2" },
                { text: "REABRINDO O LUGARZINHO NO 4º DISTRITO/POA.", className: "font-display text-[1.2rem] sm:text-[1.8rem] md:text-[2rem] lg:text-[2.5rem] font-medium leading-tight tracking-tight" }
              ]}
              highlights={['LUGARZINHO']}
            />
          </motion.section>

          {/* Search and Advanced Filters */}
          <div className="mb-12 space-y-6">
            <div className={`flex flex-col gap-4 transition-all duration-500 ${isSearchActive ? 'opacity-100' : 'max-w-xs'}`}>
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
                      ? 'border-accent text-accent' 
                      : 'border-white/10 opacity-60 hover:opacity-100'
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
                    <div className="flex flex-wrap gap-2 items-center py-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest opacity-40 mr-2 text-accent">Filtrar resultado com:</span>
                      {(['OBRAS', 'ARTISTAS', 'DATA', 'TAGS'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSearchFilterType(type)}
                          className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border transition-all ${
                            searchFilterType === type 
                              ? 'bg-accent text-bg border-accent' 
                              : 'border-accent/20 text-accent/60 hover:border-accent/60'
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

            {/* Categories - Only show if search is not active to keep it clean, or keep them as secondary */}
            {!isSearchActive && (
              <div className="flex flex-wrap gap-3 border-t border-white/5 pt-6">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`font-mono text-[9px] uppercase tracking-[0.2em] px-4 py-2 border transition-all ${
                      filter === cat 
                        ? 'bg-accent text-bg border-accent' 
                        : 'border-white/10 hover:border-white/40'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
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
            onClick={() => setView('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <InteractiveTitle 
              text="VISTO LAB"
              className="font-display text-6xl md:text-8xl lg:text-[8rem] xl:text-[10rem] font-bold uppercase tracking-tighter mb-6"
            />
            <p className="font-sans opacity-60 max-w-2xl text-lg leading-relaxed">Oficinas e laboratórios focados em performance, improvisação e presença intermediada por tecnologia.</p>
          </section>

          {!user && (
            <div className="mb-12 p-8 border border-accent/30 bg-accent/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="font-display text-xl uppercase tracking-tight">Faça login para salvar seu progresso e obter certificados.</p>
              <button onClick={() => setView('login')} className="px-8 py-3 bg-accent text-bg font-mono text-[10px] uppercase tracking-widest font-bold">Entrar Agora</button>
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
            onClick={() => setView('gallery')}
            className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-accent hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft size={14} /> Voltar para Galeria
          </button>
          <section className="mb-16">
            <h2 className="font-display text-6xl font-bold uppercase tracking-tighter mb-4">Transmissões ao Vivo</h2>
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
