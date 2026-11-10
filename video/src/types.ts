export type Line = {
  file: string;
  frames: number;
  caption: string;
  spoken: string;
};

export type Scene = {
  id: string;
  frames: number;
  lines: Line[];
};
