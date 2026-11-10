import React from "react";
import {AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame} from "remotion";
import manifest from "./manifest.json";
import {EndScene, FlowScene, GateScene, LiveScene, TitleScene} from "./scenes";
import type {Scene} from "./types";

const OVERLAP = 12;

const Host: React.FC<{scene: Scene; lead: number}> = ({scene, lead}) => {
  const frame = useCurrentFrame();
  const opacity =
    lead === 0
      ? 1
      : interpolate(frame, [0, lead], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
  const audioFrame = Math.max(0, frame - lead);
  const props = {scene, audioFrame};
  let body: React.ReactNode = null;
  if (scene.id === "title") body = <TitleScene {...props} />;
  if (scene.id === "flow") body = <FlowScene {...props} />;
  if (scene.id === "gate") body = <GateScene {...props} />;
  if (scene.id === "key") body = <LiveScene {...props} focus="key" />;
  if (scene.id === "tool") body = <LiveScene {...props} focus="tool" />;
  if (scene.id === "hold") body = <LiveScene {...props} focus="hold" />;
  if (scene.id === "end") body = <EndScene {...props} />;
  return <AbsoluteFill style={{opacity}}>{body}</AbsoluteFill>;
};

const Caption: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 28,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 14px",
        padding: "16px 28px 18px",
        borderRadius: 18,
        background: "rgba(12,14,18,0.82)",
        border: "1px solid rgba(244,240,230,0.14)",
      }}
    >
      {words.map((word, index) => {
        const start = index * 3;
        const opacity = interpolate(frame, [start, start + 7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(frame, [start, start + 8], [18, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${y}px)`,
              color: "#f4f0e6",
              fontSize: 34,
              fontFamily: "DejaVu Sans, sans-serif",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const Demo: React.FC = () => {
  let audioCursor = 0;
  const visuals: React.ReactNode[] = [];
  const tracks: React.ReactNode[] = [];
  manifest.scenes.forEach((scene, index) => {
    const audioFrom = audioCursor;
    const lead = index === 0 ? 0 : OVERLAP;
    visuals.push(
      <Sequence key={`v-${scene.id}`} from={audioFrom - lead} durationInFrames={scene.frames + lead}>
        <Host scene={scene as Scene} lead={lead} />
      </Sequence>,
    );
    scene.lines.forEach((line, lineIndex) => {
      const lineFrom = scene.lines.slice(0, lineIndex).reduce((sum, item) => sum + item.frames, 0);
      tracks.push(
        <Sequence key={line.file} from={audioFrom + lineFrom} durationInFrames={line.frames}>
          <Audio src={staticFile(line.file)} />
          <Caption text={line.caption} />
        </Sequence>,
      );
    });
    audioCursor += scene.frames;
  });
  return (
    <AbsoluteFill style={{background: "#101318"}}>
      {visuals}
      {tracks}
    </AbsoluteFill>
  );
};
