export interface HorarioMissa {
  horario: string;
  observacao: string;
}

export interface Aviso {
  texto: string;
  link: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  date: string;
  summary: string;
  category: string;
  coverUrl: string | null;
}

export interface DiaConfig {
  abrev: string;
  destaque: boolean;
}
