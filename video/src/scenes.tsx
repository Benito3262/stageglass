import React from "react";
import {AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import type {Scene} from "./types";

const INK = "#f4f0e6";
const MUTED = "#a7b0bd";
const ACCENT = "#e15d5d";

const lineStart = (scene: Scene, index: number) =>
  scene.lines.slice(0, index).reduce((sum, line) => sum + line.frames, 0);

const Background: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const drift = 28 + Math.sin(frame / 28) * 10;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(980px 520px at ${drift}% -8%, rgba(225,93,93,0.18), transparent 58%), #101318`,
        fontFamily: "DejaVu Sans, sans-serif",
        color: INK,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const LogoMark: React.FC<{size: number; pop: number}> = ({size, pop}) => {
  const frame = useCurrentFrame();
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame / 7));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect x="6" y="8" width="52" height="48" rx="12" fill="#161b22" stroke={ACCENT} strokeWidth={3 * pop} />
      <circle cx="46" cy="22" r={4.2} fill={ACCENT} opacity={pulse} />
      <rect x="16" y="30" width={26 * pop} height="3.2" rx="1.6" fill={INK} />
      <rect x="16" y="38" width={16 * pop} height="3.2" rx="1.6" fill="#9aa3b2" />
    </svg>
  );
};

export const TitleScene: React.FC<{scene: Scene; audioFrame: number}> = ({audioFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: audioFrame, fps, config: {damping: 13, mass: 0.7, stiffness: 90}});
  const float = Math.sin(frame / 16) * 8;
  const letters = "STAGEGLASS".split("");
  return (
    <Background>
      <AbsoluteFill style={{alignItems: "center", justifyContent: "center"}}>
        <div style={{transform: `translateY(${(1 - enter) * 48 + float}px) scale(${0.72 + enter * 0.28})`, textAlign: "center"}}>
          <LogoMark size={168} pop={enter} />
          <div style={{marginTop: 28, fontSize: 78, letterSpacing: 10, fontWeight: 700}}>
            {letters.map((letter, index) => {
              const local = audioFrame - 8 - index * 2;
              const y = interpolate(local, [0, 10], [22, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
              const opacity = interpolate(local, [0, 8], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
              return (
                <span key={index} style={{display: "inline-block", transform: `translateY(${y}px)`, opacity}}>
                  {letter}
                </span>
              );
            })}
          </div>
          <div style={{marginTop: 16, color: MUTED, fontSize: 30, letterSpacing: 0.4, opacity: interpolate(audioFrame, [18, 36], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}}>
            A one-way glass for a Hermes session
          </div>
        </div>
      </AbsoluteFill>
    </Background>
  );
};

const Node: React.FC<{label: string; x: number; delay: number; hot?: boolean}> = ({label, x, delay, hot}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 14, stiffness: 120}});
  const idle = Math.sin((frame + delay) / 14) * 7;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 430 + (1 - enter) * 36 + idle,
        width: 250,
        height: 84,
        borderRadius: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hot ? "#3a1c22" : "#161b22",
        border: `2px solid ${hot ? ACCENT : "rgba(244,240,230,0.16)"}`,
        color: hot ? "#ffd0d0" : INK,
        fontSize: 28,
        opacity: enter,
        transform: `scale(${0.84 + enter * 0.16})`,
      }}
    >
      {label}
    </div>
  );
};

export const FlowScene: React.FC<{scene: Scene; audioFrame: number}> = ({scene, audioFrame}) => {
  const frame = useCurrentFrame();
  const nodes = [
    {label: "Hermes", x: 120, at: lineStart(scene, 0)},
    {label: "Hooks", x: 470, at: lineStart(scene, 1)},
    {label: "Redact", x: 820, at: lineStart(scene, 2)},
    {label: "HOLD", x: 1170, at: lineStart(scene, 2) + 18},
    {label: "OBS", x: 1520, at: lineStart(scene, 3)},
  ];
  return (
    <Background>
      <div style={{position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily: "DejaVu Serif, serif", fontSize: 64}}>
        Hermes stays in charge
      </div>
      <svg width="1920" height="1080" style={{position: "absolute", inset: 0}}>
        {nodes.slice(0, -1).map((node, index) => {
          const next = nodes[index + 1];
          const progress = interpolate(audioFrame, [node.at + 8, next.at + 10], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
          const x1 = node.x + 250;
          const x2 = next.x;
          const length = x2 - x1;
          const march = (frame * 1.4) % 28;
          return (
            <line
              key={node.label}
              x1={x1}
              y1={472}
              x2={x1 + length * progress}
              y2={472}
              stroke={ACCENT}
              strokeWidth={3}
              strokeDasharray="10 8"
              strokeDashoffset={-march}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {nodes.map((node) => (
        <Node key={node.label} label={node.label} x={node.x} delay={node.at} hot={node.label === "HOLD" || node.label === "OBS"} />
      ))}
    </Background>
  );
};

export const GateScene: React.FC<{scene: Scene; audioFrame: number}> = ({scene, audioFrame}) => {
  const frame = useCurrentFrame();
  const morphStart = lineStart(scene, 0) + 4;
  const morphEnd = lineStart(scene, 2);
  const gateStart = lineStart(scene, 2);
  const gateEnd = lineStart(scene, 3) + 40;
  const morph = interpolate(audioFrame, [morphStart, morphEnd], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const close = interpolate(audioFrame, [gateStart, gateEnd], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const chip = spring({frame: audioFrame - gateEnd + 4, fps: 30, config: {damping: 12, stiffness: 140}});
  const pulse = 0.7 + 0.3 * Math.sin(frame / 6);
  return (
    <Background>
      <div style={{position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily: "DejaVu Serif, serif", fontSize: 64}}>
        Redact, or hold
      </div>
      <div style={{position: "absolute", top: 390, left: 0, right: 0, height: 90, textAlign: "center", fontFamily: "DejaVu Sans Mono, monospace", fontSize: 42}}>
        <div style={{opacity: 1 - morph, transform: `scale(${1 - morph * 0.08})`, color: ACCENT, letterSpacing: morph * 6}}>
          sk-proj-FAKESTAGEGLASSKEY1234567890
        </div>
        <div style={{position: "absolute", left: 0, right: 0, top: 0, opacity: Math.min(1, morph * 1.15), clipPath: `inset(0 ${(1 - morph) * 100}% 0 0)`}}>
          [REDACTED]
        </div>
      </div>
      <div style={{position: "absolute", left: 0, top: 300, bottom: 180, width: "50%", background: "rgba(12,14,18,0.94)", borderRight: "3px solid #e15d5d", transform: `translateX(${(1 - close) * -100}%)`}} />
      <div style={{position: "absolute", right: 0, top: 300, bottom: 180, width: "50%", background: "rgba(12,14,18,0.94)", borderLeft: "3px solid #e15d5d", transform: `translateX(${(1 - close) * 100}%)`}} />
      <div style={{position: "absolute", left: "50%", top: 470, transform: `translate(-50%, 0) scale(${0.8 + chip * 0.2})`, opacity: chip * pulse, background: "#3a1c22", color: "#ffd0d0", borderRadius: 999, padding: "12px 28px", letterSpacing: 3, fontSize: 28}}>
        HOLD
      </div>
    </Background>
  );
};

const CLIPS = {
  key: {from: 110, to: 280, still: "freeze-key.png"},
  tool: {from: 430, to: 520, still: "freeze-tool.png"},
  hold: {from: 560, to: 670, still: "freeze-hold.png"},
} as const;

export const LiveScene: React.FC<{scene: Scene; audioFrame: number; focus: "key" | "tool" | "hold"}> = ({audioFrame, focus, scene}) => {
  const t = scene.frames <= 1 ? 1 : audioFrame / scene.frames;
  const focusMap = {
    key: {scale: [1.08, 1.02], x: [-18, 0], y: [10, 0], origin: "50% 58%"},
    tool: {scale: [1.08, 1.02], x: [14, 0], y: [-6, 0], origin: "64% 48%"},
    hold: {scale: [1.05, 1.015], x: [0, 0], y: [4, 0], origin: "50% 56%"},
  }[focus];
  const scale = interpolate(t, [0, 1], focusMap.scale);
  const x = interpolate(t, [0, 1], focusMap.x);
  const y = interpolate(t, [0, 1], focusMap.y);
  const clip = CLIPS[focus];
  const span = clip.to - clip.from;
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    transformOrigin: focusMap.origin,
  };
  const callouts = {
    key: [
      {label: "Fake key, still visible", x: 70, y: 470, at: 8},
      {label: "Audience copy", x: 1040, y: 150, at: lineStart(scene, 2)},
    ],
    tool: [{label: "Tool name updates", x: 1040, y: 120, at: 8}],
    hold: [
      {label: "Unfinished private key", x: 70, y: 220, at: 10},
      {label: "Feed fails closed", x: 1040, y: 130, at: lineStart(scene, 1)},
    ],
  }[focus];
  return (
    <AbsoluteFill style={{background: "#101318"}}>
      <div style={{position: "absolute", inset: 0, overflow: "hidden"}}>
        {audioFrame < span ? (
          <OffthreadVideo src={staticFile("proof.mp4")} trimBefore={clip.from} trimAfter={clip.to} style={mediaStyle} />
        ) : (
          <Img src={staticFile(clip.still)} style={mediaStyle} />
        )}
      </div>
      <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "linear-gradient(transparent, #101318 55%)"}} />
      {callouts.map((callout) => {
        const enter = interpolate(audioFrame, [callout.at, callout.at + 12], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
        const bob = Math.sin((audioFrame + callout.at) / 12) * 4;
        return (
          <div
            key={callout.label}
            style={{
              position: "absolute",
              left: callout.x,
              top: callout.y + (1 - enter) * 16 + bob,
              opacity: enter,
              background: "rgba(22,27,34,0.92)",
              border: "1px solid rgba(225,93,93,0.85)",
              color: INK,
              borderRadius: 999,
              padding: "10px 16px",
              fontSize: 24,
              fontFamily: "DejaVu Sans, sans-serif",
            }}
          >
            {callout.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const EndScene: React.FC<{scene: Scene; audioFrame: number}> = ({scene, audioFrame}) => {
  const {fps} = useVideoConfig();
  const showLoop = audioFrame >= lineStart(scene, 1);
  const showInstall = audioFrame >= lineStart(scene, 2);
  const showLinks = audioFrame >= lineStart(scene, 3);
  const card = spring({frame: audioFrame, fps, config: {damping: 14, stiffness: 100}});
  const float = Math.sin(audioFrame / 14) * 6;
  return (
    <Background>
      <AbsoluteFill style={{alignItems: "center", justifyContent: "center"}}>
        <div style={{transform: `translateY(${(1 - card) * 30 + float}px)`, textAlign: "center", width: 1500}}>
          <LogoMark size={92} pop={card} />
          <div style={{marginTop: 18, fontFamily: "DejaVu Serif, serif", fontSize: 68, opacity: card}}>
            {showInstall ? "Install" : "For the audience"}
          </div>
          {showLoop ? (
            <div style={{marginTop: 18, color: MUTED, fontSize: 30, opacity: interpolate(audioFrame - lineStart(scene, 1), [0, 10], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}}>
              127.0.0.1 only, on this machine
            </div>
          ) : null}
          {showInstall ? (
            <div style={{marginTop: 26, background: "#161b22", border: "1px solid rgba(244,240,230,0.16)", borderRadius: 16, padding: "18px 22px", fontFamily: "DejaVu Sans Mono, monospace", fontSize: 26}}>
              hermes plugins install https://github.com/Benito3262/stageglass --enable
            </div>
          ) : null}
          {showLinks ? (
            <div style={{marginTop: 26}}>
              <div style={{fontSize: 34}}>github.com/Benito3262/stageglass</div>
              <div style={{fontSize: 34, color: ACCENT, marginTop: 8}}>benito3262.github.io/stageglass</div>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </Background>
  );
};
