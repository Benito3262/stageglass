export type Word = {
  text: string;
  start: number;
  end: number;
  scene: string;
  emphasis: boolean;
};

export type Sentence = {
  scene: string;
  start: number;
  end: number;
  clip: string | null;
  text: string;
};

export type Scene = {
  id: string;
  headline: string;
  start: number;
  end: number;
};

export type Timings = {
  fps: number;
  duration: number;
  wpm: number;
  voice: string;
  scenes: Scene[];
  sentences: Sentence[];
  words: Word[];
};
