import React from "react";
import {AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import timings from "./timings.json";

const INK = "#f4f0e6";
const MUTED = "#a7b0bd";
const ACCENT = "#e15d5d";
const PANEL = "#161b22";
const SANS = "StageSans, DejaVu Sans, sans-serif";
const SERIF = "StageSerif, DejaVu Serif, serif";
const MONO = "StageMono, DejaVu Sans Mono, monospace";

const CLIPS: Record<string, {from: number; max: number; still: string}> = {
  key: {from: 5.0, max: 4.2, still: "freeze-key.png"},
  tool: {from: 12.8, max: 2.5, still: "freeze-tool.png"},
  hold: {from: 19.6, max: 3.1, still: "freeze-hold.png"},
  onair: {from: 7.4, max: 2.8, still: "freeze-onair.png"},
};

type SceneProps = {time: number; lead: number; sceneStart: number};

const clean = (value: string) => value.toLowerCase().replace(/[.,?!]+$/g, "");

export const wordStart = (scene: string, text: string, nth = 0) => {
  const hits = timings.words.filter((word) => word.scene === scene && clean(word.text) === clean(text));
  return hits[nth]?.start ?? 999;
};

const pop = (time: number, at: number) => {
  if (time < at) return 0;
  return spring({
    frame: Math.max(0, (time - at) * 30),
    fps: 30,
    config: {damping: 15, stiffness: 120, mass: 0.7},
  });
};

const typed = (text: string, time: number, at: number, cps = 34) => {
  if (time < at) return "";
  return text.slice(0, Math.min(text.length, Math.floor((time - at) * cps)));
};

const Backdrop: React.FC<{time: number; children: React.ReactNode}> = ({time, children}) => {
  const drift = 30 + Math.sin(time / 1.4) * 8;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(720px 420px at ${78 - drift * 0.4}% 110%, rgba(80,110,140,0.14), transparent 60%), radial-gradient(980px 520px at ${drift}% -10%, rgba(225,93,93,0.18), transparent 58%), #101318`,
        color: INK,
        fontFamily: SANS,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Headline: React.FC<{text: string; time: number; start: number}> = ({text, time, start}) => {
  const enter = pop(time, start);
  return (
    <div style={{position: "absolute", top: 28, left: 72, right: 72}}>
      <div style={{color: ACCENT, letterSpacing: 4, fontSize: 18}}>STAGEGLASS</div>
      <div
        style={{
          marginTop: 6,
          fontFamily: SERIF,
          fontSize: 68,
          letterSpacing: 1,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 18}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const Kinetic: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const found = timings.sentences.findIndex((sentence) => time >= sentence.start && time < sentence.end);
  const index = found >= 0 ? found : timings.sentences.length - 1;
  const sentence = timings.sentences[index];
  const words = timings.words.filter((word) => word.scene === sentence.scene && word.start >= sentence.start - 0.02 && word.start < sentence.end - 0.02);
  const caret = Math.floor(time * 3) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        right: 48,
        bottom: 22,
        minHeight: 132,
        borderRadius: 22,
        background: "rgba(10,12,16,0.9)",
        border: "1px solid rgba(244,240,230,0.12)",
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        justifyContent: "center",
        gap: "8px 14px",
        padding: "18px 28px 20px",
      }}
    >
      {words.map((word, wordIndex) => {
        if (time < word.start) return null;
        const enter = pop(time, word.start);
        const live = time < word.end + 0.05;
        return (
          <span
            key={`${word.start}-${wordIndex}`}
            style={{
              display: "inline-block",
              opacity: 1,
              transform: `translateY(${(1 - enter) * 12}px)`,
              color: word.emphasis || live ? "#ffd0d0" : INK,
              fontFamily: word.text.startsWith("/") || word.text.includes("github") || word.text.includes("127.0.0.1") ? MONO : SANS,
              fontSize: 36,
              lineHeight: "44px",
              whiteSpace: "nowrap",
            }}
          >
            {word.text}
          </span>
        );
      })}
      <span style={{opacity: caret ? 1 : 0, color: ACCENT, fontSize: 36}}>|</span>
    </div>
  );
};

type Shot = {x: number; y: number; pin: "left"; zoom: [number, number]};

// Source pixels. Audience panes are pinned to the left of the audience
// window (x >= 988), past the Hermes sidebar that otherwise covers the header.
const FOCAL: Record<string, {top: Shot; bottom: Shot; topLabel: string; bottomLabel: string}> = {
  onair: {
    top: {x: 16, y: 736, pin: "left", zoom: [2.05, 2.5]},
    bottom: {x: 988, y: 226, pin: "left", zoom: [2.05, 2.5]},
    topLabel: "Your screen",
    bottomLabel: "Audience",
  },
  key: {
    top: {x: 16, y: 736, pin: "left", zoom: [2.05, 2.5]},
    bottom: {x: 988, y: 226, pin: "left", zoom: [2.05, 2.5]},
    topLabel: "Your screen",
    bottomLabel: "Audience",
  },
  tool: {
    top: {x: 16, y: 748, pin: "left", zoom: [2.05, 2.45]},
    bottom: {x: 988, y: 250, pin: "left", zoom: [2.05, 2.45]},
    topLabel: "Your screen",
    bottomLabel: "Tool name",
  },
  hold: {
    top: {x: 16, y: 700, pin: "left", zoom: [1.9, 2.15]},
    bottom: {x: 988, y: 250, pin: "left", zoom: [1.85, 2.12]},
    topLabel: "Approval",
    bottomLabel: "Audience",
  },
};

const ZoomPane: React.FC<{clip: string; shot: Shot; label: string}> = ({clip, shot, label}) => {
  const frame = useCurrentFrame();
  const local = frame / 30;
  const spec = CLIPS[clip];
  const zoom = interpolate(local, [0, Math.max(spec.max, 0.4)], shot.zoom, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const media: React.CSSProperties = {
    position: "absolute",
    width: 1920 * zoom,
    height: 1080 * zoom,
    left: -shot.x * zoom,
    top: `calc(50% - ${shot.y * zoom}px)`,
  };
  return (
    <div style={{flex: 1, position: "relative", overflow: "hidden", borderRadius: 18, background: "#0d1014", border: "1px solid rgba(244,240,230,0.12)"}}>
      {local < spec.max ? (
        <OffthreadVideo src={staticFile("proof.mp4")} trimBefore={Math.round(spec.from * 30)} trimAfter={Math.round((spec.from + spec.max) * 30)} style={media} />
      ) : (
        <Img src={staticFile(spec.still)} style={media} />
      )}
      <div style={{position: "absolute", left: shot.x > 400 ? 16 : undefined, right: shot.x > 400 ? undefined : 16, bottom: shot.x > 400 ? 12 : undefined, top: shot.x > 400 ? undefined : 12, background: "rgba(10,12,16,0.88)", border: "1px solid rgba(225,93,93,0.8)", borderRadius: 999, padding: "6px 12px", color: INK, fontFamily: SANS, fontSize: 20, lineHeight: "24px", whiteSpace: "nowrap"}}>
        {label}
      </div>
    </div>
  );
};

const ZoomStack: React.FC<{clip: string}> = ({clip}) => {
  const focal = FOCAL[clip];
  return (
    <div style={{position: "absolute", left: 36, right: 36, top: 168, bottom: 176, display: "flex", flexDirection: "column", gap: 12}}>
      <ZoomPane clip={clip} shot={focal.top} label={focal.topLabel} />
      <ZoomPane clip={clip} shot={focal.bottom} label={focal.bottomLabel} />
    </div>
  );
};

export const ProblemScene: React.FC<SceneProps> = ({time, sceneStart}) => {
  const keyAt = wordStart("problem", "API");
  const secret = "sk-proj-FAKESTAGEGLASSKEY1234567890";
  const shown = typed(secret, time, keyAt, 24);
  const flash = time > keyAt + 1.1 ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 9)) : 1;
  const live = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(time * 6));
  return (
    <Backdrop time={time}>
      <Headline text="THE PROBLEM" time={time} start={sceneStart} />
      <div style={{position: "absolute", left: 220, right: 220, top: 210, height: 560, borderRadius: 24, overflow: "hidden", background: PANEL, border: "1px solid rgba(244,240,230,0.14)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)"}}>
        <div style={{height: 64, display: "flex", alignItems: "center", gap: 16, padding: "0 22px", background: "#12161c", borderBottom: "1px solid rgba(244,240,230,0.08)"}}>
          <span style={{background: ACCENT, color: "white", borderRadius: 999, padding: "6px 12px", letterSpacing: 2, fontWeight: 700, opacity: live}}>LIVE</span>
          <span style={{color: MUTED}}>agent stream · everyone watching</span>
          <span style={{marginLeft: "auto", color: MUTED}}>{120 + Math.floor(time * 4)} viewers</span>
        </div>
        <div style={{padding: "36px 40px", fontFamily: MONO, fontSize: 26, lineHeight: 1.55}}>
          <div style={{color: MUTED}}>&gt; summarize the repo</div>
          <div style={{color: MUTED}}>Hermes is reading the project.</div>
          <div style={{color: MUTED, marginTop: 18}}>&gt; draft the reply</div>
          <div style={{marginTop: 28, color: ACCENT, opacity: flash, minHeight: 40}}>
            {shown}
            {shown && shown.length < secret.length ? <span style={{opacity: 0.8}}>|</span> : null}
          </div>
        </div>
      </div>
    </Backdrop>
  );
};

export const IdeaScene: React.FC<SceneProps> = ({time, sceneStart}) => {
  const left = pop(time, sceneStart + 0.15);
  const right = pop(time, wordStart("idea", "second"));
  return (
    <Backdrop time={time}>
      <Headline text="THE IDEA" time={time} start={sceneStart} />
      <div style={{position: "absolute", left: 90, top: 250, width: 760, height: 460, borderRadius: 24, background: PANEL, border: "1px solid rgba(244,240,230,0.12)", padding: 32, opacity: left, transform: `translateX(${(1 - left) * -50}px)`}}>
        <div style={{color: MUTED, letterSpacing: 2}}>YOUR SESSION</div>
        <div style={{marginTop: 28, fontFamily: MONO, fontSize: 24, color: ACCENT, lineHeight: 1.5}}>sk-proj-FAKESTAGEGLASSKEY1234567890</div>
        <div style={{marginTop: 18, color: MUTED, fontSize: 24}}>wallet key · email · token</div>
        <div style={{marginTop: 40, fontSize: 28}}>You keep the real conversation.</div>
      </div>
      <div style={{position: "absolute", right: 90, top: 250, width: 760, height: 460, borderRadius: 24, background: "#12181a", border: "1px solid rgba(225,93,93,0.45)", padding: 32, opacity: right, transform: `translateX(${(1 - right) * 50}px)`}}>
        <div style={{display: "flex", justifyContent: "space-between"}}>
          <span style={{color: MUTED, letterSpacing: 2}}>AUDIENCE</span>
          <span style={{background: "#1e3a32", color: "#d8ffe8", borderRadius: 999, padding: "6px 12px"}}>ON AIR</span>
        </div>
        <div style={{marginTop: 36, fontFamily: SERIF, fontSize: 48}}>The demo token is [REDACTED].</div>
        <div style={{marginTop: 28, color: MUTED, fontSize: 26}}>A clean second screen. Nothing raw.</div>
      </div>
    </Backdrop>
  );
};

const FLOW_NODES = [
  ["Hermes", "Hermes"],
  ["Message", "message"],
  ["Tool", "tool"],
  ["Approval", "approval"],
  ["Redact", "redacted"],
  ["Audience", "audience"],
] as const;

const FLOW_CHIPS = [
  ["Keys", "Keys", 0, 118],
  ["Tokens", "tokens", 142, 132],
  ["Seed phrases", "seed", 298, 196],
  ["Emails", "emails", 518, 124],
] as const;

const NODE_W = 220;
const NODE_STEP = 292;

export const HowScene: React.FC<SceneProps> = ({time, sceneStart}) => {
  const morphStart = wordStart("how", "turns");
  const morph = interpolate(time, [morphStart, morphStart + 1.3], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const gateAt = wordStart("how", "sure");
  const holdAt = wordStart("how", "HOLD");
  const fadeEnd = gateAt + 0.45;
  const diagram = interpolate(time, [gateAt, fadeEnd], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const door = interpolate(time, [fadeEnd - 0.08, holdAt], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const chip = pop(time, holdAt - 0.15);
  const bobTime = Math.min(time, gateAt);
  return (
    <Backdrop time={time}>
      <Headline text="HOW IT WORKS" time={time} start={sceneStart} />
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 214,
          width: 1824,
          height: 420,
          opacity: diagram,
          transform: `scale(${0.96 + diagram * 0.04})`,
          transformOrigin: "912px 150px",
        }}
      >
        {FLOW_NODES.map(([label, word], index) => {
          const at = wordStart("how", word);
          if (time < at) return null;
          const enter = pop(time, at);
          const idle = Math.sin(bobTime * 2 + index) * 3;
          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: 72 + index * NODE_STEP,
                top: 8 + idle,
                width: NODE_W,
                height: 78,
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: label === "Redact" ? "#3a1c22" : PANEL,
                border: "2px solid rgba(225,93,93,0.8)",
                color: INK,
                fontFamily: SANS,
                fontSize: 26,
                lineHeight: "32px",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                opacity: 1,
                transform: `translateY(${(1 - enter) * 16}px)`,
              }}
            >
              {label}
            </div>
          );
        })}
        <svg width="1824" height="100" style={{position: "absolute", left: 0, top: 0, pointerEvents: "none"}}>
          {FLOW_NODES.slice(0, -1).map((node, index) => {
            const start = wordStart("how", node[1]);
            const end = Math.max(wordStart("how", FLOW_NODES[index + 1][1]), start + 0.05);
            const progress = interpolate(time, [start, end], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
            const x1 = 72 + index * NODE_STEP + NODE_W;
            const x2 = x1 + (NODE_STEP - NODE_W) * progress;
            return <line key={node[0]} x1={x1} y1={47} x2={x2} y2={47} stroke={ACCENT} strokeWidth={3} strokeDasharray="8 7" strokeDashoffset={-bobTime * 28} />;
          })}
        </svg>
        {FLOW_CHIPS.map(([label, word, left, width]) => {
          const at = wordStart("how", word);
          if (time < at) return null;
          const enter = pop(time, at);
          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: 591 + left,
                top: 150,
                width,
                height: 48,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 1,
                transform: `translateY(${(1 - enter) * 12}px)`,
                border: "1px solid rgba(244,240,230,0.16)",
                borderRadius: 999,
                color: MUTED,
                fontFamily: SANS,
                fontSize: 24,
                lineHeight: "28px",
                whiteSpace: "nowrap",
                background: "#161b22",
              }}
            >
              {label}
            </div>
          );
        })}
        <div style={{position: "absolute", top: 250, left: 0, width: 1824, height: 56, textAlign: "center", fontFamily: MONO, fontSize: 36, lineHeight: "56px"}}>
          <div style={{opacity: 1 - morph, color: ACCENT, letterSpacing: morph * 4}}>sk-proj-FAKESTAGEGLASSKEY1234567890</div>
          <div style={{position: "absolute", left: 0, width: 1824, top: 0, opacity: morph, clipPath: `inset(0 ${(1 - morph) * 100}% 0 0)`}}>[REDACTED]</div>
        </div>
      </div>
      <div style={{position: "absolute", left: 0, top: 210, bottom: 180, width: "50%", background: "#0a0c10", borderRight: "3px solid #e15d5d", transform: `translateX(${(1 - door) * -102}%)`}} />
      <div style={{position: "absolute", right: 0, top: 210, bottom: 180, width: "50%", background: "#0a0c10", borderLeft: "3px solid #e15d5d", transform: `translateX(${(1 - door) * 102}%)`}} />
      <div style={{position: "absolute", left: 860, top: 430, width: 200, height: 56, transform: `scale(${0.86 + chip * 0.14})`, transformOrigin: "100px 28px", opacity: time + 0.15 >= holdAt ? 1 : 0, background: "#3a1c22", color: "#ffd0d0", fontFamily: SANS, borderRadius: 999, letterSpacing: 3, fontSize: 28, lineHeight: "56px", textAlign: "center"}}>
        HOLD
      </div>
    </Backdrop>
  );
};

export const UseScene: React.FC<SceneProps> = ({time, lead, sceneStart}) => {
  const steps = [
    ["1", "Install", "hermes plugins install https://github.com/Benito3262/stageglass --enable", "Install"],
    ["2", "Turn the feed on", "/onair on", "/onair on"],
    ["3", "Open the page", "http://127.0.0.1:8765", "Open"],
    ["4", "Or add it in OBS", "Browser Source. Share this window, not the terminal.", "OBS"],
    ["5", "Pause", "/onair hold", "/onair hold"],
    ["6", "Stop", "/onair off", "/onair off"],
  ] as const;
  const onair = timings.sentences.find((sentence) => sentence.clip === "onair");
  const scene = timings.scenes.find((item) => item.id === "use");
  const from = onair ? Math.round((onair.start - sceneStart) * 30) + lead : 0;
  const dur = onair && scene ? Math.max(1, Math.round((scene.end - onair.start) * 30)) : 1;
  return (
    <Backdrop time={time}>
      <Headline text="HOW TO USE IT" time={time} start={sceneStart} />
      {onair && time >= onair.start ? null : (
      <div style={{position: "absolute", left: 64, top: 210, width: 1600}}>
        {steps.map(([n, title, code, word]) => {
          const at = wordStart("use", word);
          if (time < at) return null;
          const enter = pop(time, at);
          return (
            <div key={n} style={{display: "flex", gap: 16, marginBottom: 12, opacity: 1, transform: `translateY(${(1 - enter) * 10}px)`, fontFamily: SANS}}>
              <div style={{width: 36, color: ACCENT, fontSize: 24, paddingTop: 2}}>{n}</div>
              <div>
                <div style={{fontSize: 24}}>{title}</div>
                <div style={{fontFamily: MONO, fontSize: 20, color: "#ffd8d4", minHeight: 26}}>{typed(code, time, at, 42)}</div>
              </div>
            </div>
          );
        })}
      </div>
      )}
      {onair ? (
        <Sequence from={from} durationInFrames={dur}>
          <ZoomStack clip="onair" />
        </Sequence>
      ) : null}
    </Backdrop>
  );
};

export const ProofScene: React.FC<SceneProps> = ({time, lead, sceneStart}) => {
  const rows = timings.sentences.filter((sentence) => sentence.scene === "proof" && sentence.clip);
  const groups: {clip: string; start: number; end: number}[] = [];
  rows.forEach((row) => {
    const last = groups[groups.length - 1];
    if (last && last.clip === row.clip) last.end = row.end;
    else groups.push({clip: row.clip as string, start: row.start, end: row.end});
  });
  const active = groups.find((group) => time >= group.start && time < group.end + 0.05) ?? groups[0];
  const note = active?.clip === "tool" ? "The tool name updates on the audience page." : active?.clip === "hold" ? "A private key sends the feed to HOLD." : "The key stays on your screen. The audience sees [REDACTED].";
  return (
    <AbsoluteFill style={{background: "#101318", fontFamily: SANS}}>
      <div style={{position: "absolute", top: 22, left: 48}}>
        <div style={{color: ACCENT, letterSpacing: 3, fontSize: 16}}>STAGEGLASS</div>
        <div style={{fontFamily: SERIF, fontSize: 48, color: INK}}>PROOF</div>
      </div>
      <div style={{position: "absolute", right: 48, top: 48, color: MUTED, fontSize: 24, maxWidth: 760, textAlign: "right"}}>{note}</div>
      {groups.map((group) => {
        const from = Math.round((group.start - sceneStart) * 30) + lead;
        const dur = Math.max(1, Math.round((group.end - group.start) * 30));
        return (
          <Sequence key={`${group.clip}-${group.start}`} from={from} durationInFrames={dur}>
            <ZoomStack clip={group.clip} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const EndScene: React.FC<SceneProps> = ({time, sceneStart}) => {
  const line = pop(time, wordStart("end", "Go"));
  const repo = pop(time, wordStart("end", "github.com/Benito3262/stageglass"));
  const page = pop(time, wordStart("end", "benito3262.github.io/stageglass"));
  const float = Math.sin(time * 1.6) * 6;
  return (
    <Backdrop time={time}>
      <AbsoluteFill style={{alignItems: "center", justifyContent: "center", paddingBottom: 120}}>
        <div style={{transform: `translateY(${float}px)`, textAlign: "center"}}>
          <svg width="92" height="92" viewBox="0 0 64 64">
            <rect x="6" y="8" width="52" height="48" rx="12" fill="#161b22" stroke={ACCENT} strokeWidth="3" />
            <circle cx="46" cy="22" r="4.2" fill={ACCENT} opacity={0.5 + 0.5 * Math.sin(time * 5)} />
            <rect x="16" y="30" width="26" height="3.2" rx="1.6" fill={INK} />
            <rect x="16" y="38" width="16" height="3.2" rx="1.6" fill="#9aa3b2" />
          </svg>
          <div style={{fontFamily: SERIF, fontSize: 76, marginTop: 8}}>Stageglass</div>
          <div style={{fontSize: 36, marginTop: 8, opacity: line, transform: `translateY(${(1 - line) * 12}px)`}}>Go live without leaking.</div>
          <div style={{marginTop: 28, fontFamily: MONO, fontSize: 28, opacity: repo}}>github.com/Benito3262/stageglass</div>
          <div style={{marginTop: 10, fontFamily: MONO, fontSize: 28, color: ACCENT, opacity: page}}>benito3262.github.io/stageglass</div>
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
