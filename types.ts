
export interface User {
  username: string;
  name: string;
  role: 'member' | 'admin' | 'super-admin';
  password?: string;
  whatsapp?: string;
  photoURL?: string;
  voicePreference?: string; // New field for AI Voice persistence
  customPermissions?: string[]; // Array of permission strings "module:action"
}

export const PERMISSION_MODULES = {
  REPERTORY: 'repertory',
  LITURGY: 'liturgy',
  SCALES: 'scales',
  USERS: 'users',
  ATTENDANCE: 'attendance',
  SYSTEM: 'system'
} as const;

export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete'
} as const;

export interface Member {
  id: string;
  name: string;
  totalPoints: number;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  eventType: string;
  date: string;
  status: 'Presente' | 'Ausente';
  points: number;
  justification?: string;
  createdAt?: any;
  eventId?: string; // Link to the specific Rehearsal/Event ID
}

export interface AttendanceSettings {
  pointsMissa: number;          // Ausência em Missa/Celebração (5 pontos)
  pointsEnsaio: number;         // Ausência em Ensaios (4 pontos)
  pointsGeral: number;          // Faltas Injustificadas Gerais (10 pontos)
  pointsCompromisso: number;    // Falta de Compromisso (3 pontos)
  pointsGravissima: number;     // Maior Gravidade (15 pontos)
}

export interface Song {
  id: string;
  type: string;
  title: string;
  lyrics: string;
  link: string;
  artist?: string;
  key?: string;
}

export interface Repertory {
  id?: string;
  date: string;
  theme: string;
  songs: Song[];
  createdBy: string;
  isPrivate: boolean;
  coverImage?: string;
  createdAt?: any;
}

export interface Playlist {
  id: string;
  url: string;
  title?: string; // New field for real title
  image?: string; // New field for cover image
  addedBy: string;
  createdAt?: any;
}

export interface AuditLog {
  id: string;
  user: string;         // Username/Email
  userName?: string;    // Nome legível
  role?: string;        // Role do usuário no momento
  action: 'LOGIN' | 'LOGOUT' | 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'ERROR' | 'VOTE' | 'JUSTIFY';
  module: string;       // Ex: 'Auth', 'Repertory', 'Users'
  details: string;      // Descrição humana
  userAgent?: string;   // Browser info
  timestamp: any;       // Firestore Timestamp ou ISO String
}

export interface Rehearsal {
  id?: string;
  type?: string;    // 'Missa' | 'Ensaio' | Custom string
  date: string;     // YYYY-MM-DD
  time: string;     // HH:mm
  topic: string;    // Tema do Ensaio
  location?: string; // Local do Ensaio (Novo campo)
  notes: string;    // Estrutura/Pauta
  repertoryId?: string; // Link opcional para repertório
  playlistIds?: string[]; // Links opcionais para playlists
  participants: string[]; // Lista de usernames/IDs
  createdBy: string;
  createdAt?: any;
}

export interface ScheduleItem {
  date: string;       // Formatted string "Fevereiro 2"
  salmista: string;
  substituto: string;
  fullDate: string;   // ISO string YYYY-MM-DDTHH:mm:ss.sssZ for storage
}

// --- NEW INTERFACES FOR JUSTIFICATIONS AND POLLS ---

export interface Justification {
  id?: string;
  userId: string;
  userName: string;
  eventId?: string; // Optional: Link to specific rehearsal ID
  eventDate: string;
  eventType: string; // 'Ensaio', 'Missa', etc.
  reason: 'Trabalho' | 'Doença' | 'Viagem' | 'Luto' | 'Transporte' | 'Outros';
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  adminNotes?: string;
  createdAt: string;
}

export interface Poll {
  id?: string;
  title: string;
  description: string;
  options: string[]; // Array of option texts
  deadline: string; // ISO Date String
  createdBy: string;
  createdAt: any;
  status: 'OPEN' | 'CLOSED';
  votes?: PollVote[]; // Sub-collection or array in NoSQL
}

export interface PollVote {
  userId: string;
  userName: string;
  optionIndex: number;
  timestamp: any;
}

export interface BibleVerse {
  text: string;
  reference: string;
  liturgicalContext?: string;
  curiosity?: string;
}
