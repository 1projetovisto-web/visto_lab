export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: string;
  description: string;
  imageUrl: string;
  category: string;
  medium: string;
  openProcessingId?: string; // New field for OpenProcessing sketches
  isStudentSubmission?: boolean;
  studentUid?: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  videoUrl?: string;
  content: string;
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  description: string;
  thumbnailUrl: string;
  lessons: Lesson[];
  classroomUrl?: string;
}

export const COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Performance e Criação Operativa',
    instructor: 'Equipe V.I.S.T.O',
    description: 'Exploração de processos performáticos e criação em tempo real com dispositivos digitais.',
    thumbnailUrl: 'https://picsum.photos/seed/performance/800/600',
    classroomUrl: 'https://classroom.google.com/u/3/c/Njg5NjM3ODIwNDg2',
    lessons: [
      { id: 'l1', title: 'Introdução à Performance Digital', duration: '20 min', content: 'Fundamentos da performance mediada por tecnologia.' }
    ]
  },
  {
    id: 'c2',
    title: 'Oficina de Improvisação Coreográfica Intermediada por Computador',
    instructor: 'Equipe V.I.S.T.O',
    description: 'Práticas de improvisação corporal integradas a sistemas computacionais e resposta visual.',
    thumbnailUrl: 'https://picsum.photos/seed/improvisacao/800/600',
    classroomUrl: 'https://classroom.google.com/u/3/c/Njg5NjA1MDYyNzc5',
    lessons: [
      { id: 'l2', title: 'Sistemas de Resposta em Tempo Real', duration: '30 min', content: 'Como o computador pode atuar como parceiro de improvisação.' }
    ]
  },
  {
    id: 'c3',
    title: 'Lab V.I.S.T.O: Dispositivos de Presença Intermediada',
    instructor: 'Equipe V.I.S.T.O',
    description: 'Explore as intersecções entre corpo, vídeo e presença mediada por tecnologia.',
    thumbnailUrl: 'https://picsum.photos/seed/visto-lab/800/600',
    classroomUrl: 'https://classroom.google.com/u/3/c/Njg5NjM4NzE1ODYy',
    lessons: [
      { id: 'l4', title: 'Corpo e Imagem', duration: '30 min', content: 'Introdução aos conceitos de presença intermediada.' },
      { id: 'l5', title: 'Dispositivos de Captura', duration: '40 min', content: 'Como usar câmeras e sensores para criar diálogos vídeo-coreográficos.' }
    ]
  }
];

export const ARTWORKS: Artwork[] = [
  {
    id: '1',
    title: 'VST_0 CAM',
    artist: 'V.I.S.T.O_Ocupações Vídeo_Coreográficas',
    year: '2024',
    description: 'Dispositivo de presença intermediada desenvolvido por Vj Ada Error (Roberta Savian Rosa). Explora a intersecção entre corpo e imagem em tempo real. Licença: CreativeCommons Attribution NonCommercial ShareAlike (BY-NC-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2891931/thumbnail/',
    category: 'Vídeo-Coreografia',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2891931'
  },
  {
    id: '2',
    title: 'PANOPTICON_01',
    artist: 'VJ Ada Error (Roberta Savian Rosa)',
    year: '2024',
    description: 'Exploração visual sobre vigilância e percepção digital. Desenvolvido para o ecossistema V.I.S.TO.',
    imageUrl: 'https://openprocessing.org/sketch/2894881/thumbnail/',
    category: 'Arte Generativa',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2894881'
  },
  {
    id: '3',
    title: 'Text mirror',
    artist: 'Core0gam3 (vj Ada Error _RSR)',
    year: '2024',
    description: 'Espelho tipográfico que processa a imagem da câmera em caracteres ASCII. Licença: CreativeCommons Attribution NonCommercial ShareAlike (BY-NC-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2559503/thumbnail/',
    category: 'ASCII Art',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2559503'
  },
  {
    id: '4',
    title: 'IRIS PULSE v.02',
    artist: 'V.I.S.T.O_Ocupações Vídeo_Coreográficas',
    year: '2024',
    description: 'Exploração visual de pulsação e íris digital. Licença: CreativeCommons Attribution NonCommercial ShareAlike (BY-NC-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2895171/thumbnail/',
    category: 'Vídeo-Coreografia',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2895171'
  },
  {
    id: '5',
    title: 'LATÊNCIA CINÉTICA',
    artist: 'V.I.S.T.O_Ocupações Vídeo_Coreográficas',
    year: '2024',
    description: 'Estudo sobre o atraso e a persistência do movimento na imagem digital. Licença: CreativeCommons Attribution NonCommercial ShareAlike (BY-NC-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2894622/thumbnail/',
    category: 'Vídeo-Coreografia',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2894622'
  },
  {
    id: '6',
    title: 'camm',
    artist: 'V.I.S.T.O_Ocupações Vídeo_Coreográficas VJ Ada Error',
    year: '2024',
    description: 'Dispositivo de captura e processamento visual. Licença: CreativeCommons Attribution ShareAlike (BY-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2804433/thumbnail/',
    category: 'Vídeo-Coreografia',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2804433'
  },
  {
    id: '7',
    title: 'V.I.S.T.O_01',
    artist: 'V.I.S.T.O_Ocupações Vídeo_Coreográficas',
    year: '2024',
    description: 'Composição visual explorando a identidade do projeto V.I.S.T.O. Licença: CreativeCommons Attribution NonCommercial ShareAlike (BY-NC-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2891853/thumbnail/',
    category: 'Vídeo-Coreografia',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2891853'
  },
  {
    id: '8',
    title: 'Glitch Horizon',
    artist: 'David Smith',
    year: '2023',
    description: 'The edge of the digital world where the rendering engine fails.',
    imageUrl: 'https://picsum.photos/seed/glitch/1100/800',
    category: 'Glitch Art',
    medium: 'Circuit Bending'
  }
];
