import React from "react";
import {AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import timings from "./timings.json";
import {EndScene, HowScene, IdeaScene, Kinetic, ProblemScene, ProofScene, UseScene} from "./scenes";
import type {Scene} from "./types";

const LEAD = 8;

const Host: React.FC<{scene: Scene; lead: number}> = ({scene, lead}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = scene.start + (frame - lead) / fps;
  const opacity =
    lead === 0
      ? 1
      : interpolate(frame, [0, lead], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
  const props = {time, lead, sceneStart: scene.start};
  let body: React.ReactNode = null;
  if (scene.id === "problem") body = <ProblemScene {...props} />;
  if (scene.id === "idea") body = <IdeaScene {...props} />;
  if (scene.id === "how") body = <HowScene {...props} />;
  if (scene.id === "use") body = <UseScene {...props} />;
  if (scene.id === "proof") body = <ProofScene {...props} />;
  if (scene.id === "end") body = <EndScene {...props} />;
  return <AbsoluteFill style={{opacity}}>{body}</AbsoluteFill>;
};

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: "#101318"}}>
      {timings.scenes.map((scene, index) => {
        const lead = index === 0 ? 0 : LEAD;
        const from = Math.max(0, Math.round(scene.start * timings.fps) - lead);
        const dur = Math.round((scene.end - scene.start) * timings.fps) + lead;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={dur}>
            <Host scene={scene} lead={lead} />
          </Sequence>
        );
      })}
      <Audio src={staticFile("bed.wav")} />
      <Kinetic />
    </AbsoluteFill>
  );
};
