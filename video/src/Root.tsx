import React from "react";
import {Composition} from "remotion";
import {Demo} from "./Demo";
import timings from "./timings.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      durationInFrames={Math.round(timings.duration * timings.fps)}
      fps={timings.fps}
      width={1920}
      height={1080}
    />
  );
};
