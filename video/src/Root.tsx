import React from "react";
import {Composition} from "remotion";
import {Demo} from "./Demo";
import manifest from "./manifest.json";

const frames = manifest.scenes.reduce((sum, scene) => sum + scene.frames, 0);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      durationInFrames={frames}
      fps={manifest.fps}
      width={1920}
      height={1080}
    />
  );
};
