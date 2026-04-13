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
    title: 'OFICINA 01 _ Performance e Criação Operativa',
    instructor: 'com Chico Machado',
    description: 'Nesta oficina, criamos a partir do que está diante de nós: um objeto, um gesto, uma ação concreta. Não esperamos pela inspiração — operamos. O processo criativo que vamos explorar juntos parte da materialidade e da ação direta como geradores de sentido, propondo uma alternativa às abordagens que colocam a ideia antes do corpo e o conceito antes da experiência. Ao longo das 10 unidades, você será convidado(a) a experimentar procedimentos — pequenas partituras de ação — que funcionam como disparadores do seu processo criativo. Não se trata de seguir um roteiro, mas de descobrir o que emerge quando o corpo e os materiais entram em relação.\nComo vamos trabalhar:\n10 unidades com propostas criativas e desafios práticos, organizadas em blocos — uma entrega a cada 3 unidades.\n3 encontros ao vivo, e um sábado de imersão prática .\nLeituras, vídeos e autoavaliações para aprofundar o que foi experienciado na prática. Atenção: sua participação no ambiente virtual — nas atividades, registros e interações — faz parte da sua trajetória de aprendizagem e conta para a certificação.',
    thumbnailUrl: '/oficina1_capa.webp',
    classroomUrl: 'https://classroom.google.com/c/Njg5NjM3ODIwNDg2?cjc=lhaqmsn',
    lessons: Array.from({ length: 10 }, (_, i) => ({
      id: `c1_l${i + 1}`,
      title: `Unidade ${i + 1}`,
      duration: '3 horas',
      content: `Conteúdo da Unidade ${i + 1}.`
    }))
  },
  {
    id: 'c2',
    title: 'OFICINA 02 _ Improvisação Coreográfica Intermediada por Computador',
    instructor: 'com Roberta Savian',
    description: 'O que acontece quando o seu movimento deixa de ser apenas dança e passa a ser dado? Nesta oficina, vamos explorar exatamente essa fronteira: a interseção entre o corpo que improvisa e a máquina que escuta, processa e responde. Usando ferramentas de código aberto como p5.js e ml5.js, você vai aprender a criar situações coreográficas em que imagem e som respondem ao seu movimento em tempo real. Não é preciso ter experiência com programação para começar — a oficina parte do zero na relação com o código. O que é necessário é a disposição para experimentar, errar e descobrir novas perguntas sobre o que pode ser uma cena.\nPercurso da oficina:\n10 unidades temáticas.\nEncontros ao vivo e dois turnos práticos no sábado.\nEstudos dirigidos, leituras e vídeos para aprofundar a relação corpo/tecnologia. Atenção: acompanhe a trilha de aprendizagem e participe das atividades no AVA — sua interação aqui é parte da experiência e conta para a certificação.',
    thumbnailUrl: '/oficina2_capa.webp',
    classroomUrl: 'https://classroom.google.com/c/Njg5NjA1MDYyNzc5?cjc=sv7tkzo',
    lessons: Array.from({ length: 10 }, (_, i) => ({
      id: `c2_l${i + 1}`,
      title: `Unidade ${i + 1}`,
      duration: '4.5 horas',
      content: `Conteúdo da Unidade ${i + 1}.`
    }))
  },
  {
    id: 'c3',
    title: 'OFICINA 03 _ Lab V.I.S.T.O: Dispositivos de Presença Intermediada',
    instructor: 'Professor@ Vj Ada Error com participação do Dj Mister J',
    description: 'Este é o nosso espaço de investigação prática. Aqui, vamos habitar a intermediação por computador para criar micronarrativas vídeocoreográficas e videoperformances — e faremos isso através de uma operação chamada Fork: a arte de entrar em um código existente, desviar o seu percurso e fazê-lo responder ao seu corpo. Você não vai começar do zero. Você vai receber partituras de código — sketches desenvolvidos em p5.js e ml5.js, disponíveis no OpenProcessing — e aprender a operar esses sistemas: lê-los, intervir neles e customizá-los até que dancem com o seu movimento. O computador, aqui, não é suporte: é parceiro de cena.\nO que vamos explorar:\nOperação por Fork: Como ler, desviar e apropriar-se de códigos no ecossistema p5.js e ml5.js.\nIntervenção de fluxos: O movimento corporal como motor que altera variáveis pré-existentes no sistema.\nIntermediação sonora: Acoplar o áudio do seu ambiente ao comportamento dos sketches.\nVideoperformances intermediadas: Transformar o código-base em uma obra autoral — da partitura à cena. Detalhes: 10 unidades assíncronas, 3 encontros ao vivo, 30h carga horária total. Atenção: toda a comunicação, os materiais de apoio e os exercícios estarão nesta sala. Sua participação e interação no AVA também contam para fins de certificação.',
    thumbnailUrl: '/oficina3_capa.webp',
    classroomUrl: 'https://classroom.google.com/c/Njg5NjM4NzE1ODYy?cjc=rfsr4jc',
    lessons: Array.from({ length: 10 }, (_, i) => ({
      id: `c3_l${i + 1}`,
      title: `Unidade ${i + 1}`,
      duration: '5 horas',
      content: `Conteúdo da Unidade ${i + 1}.`
    }))
  }
];

export const ARTWORKS: Artwork[] = [
  {
    id: '1',
    title: 'VST_0 CAM',
    artist: 'V.I.S.T.O_Ocupações Vídeo_Coreográficas',
    year: '2024',
    description: 'Dispositivo de presença intermediada desenvolvido por Vj Ada Error (Roberta Savian). Explora a intersecção entre corpo e imagem em tempo real. Licença: CreativeCommons Attribution NonCommercial ShareAlike (BY-NC-SA 3.0).',
    imageUrl: 'https://openprocessing.org/sketch/2891931/thumbnail/',
    category: 'Vídeo-Coreografia',
    medium: 'OpenProcessing / p5.js',
    openProcessingId: '2891931'
  },
  {
    id: '2',
    title: 'PANOPTICON_01',
    artist: 'VJ Ada Error (Roberta Savian)',
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
    artist: 'Core0gam3 (vj Ada Error - Roberta Savian)',
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
