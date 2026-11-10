import React from "react";
import {AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import timings from "./timings.json";

const INK = "#f4f0e6";
const MUTED = "#a7b0bd";
const ACCENT = "#e15d5d";
const PANEL = "#161b22";
const SANS = "DejaVu Sans, sans-serif";
const SERIF = "DejaVu Serif, serif";
const MONO = "DejaVu Sans Mono, monospace";

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
  const index = Math.max(0, timings.sentences.findIndex((sentence) => time >= sentence.start && time < sentence.end + 0.09));
  const sentence = timings.sentences[index] ?? timings.sentences[0];
  const next = timings.sentences[index + 1]?.start ?? 999;
  const words = timings.words.filter((word) => word.start >= sentence.start - 0.03 && word.start < next - 0.03);
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
              opacity: enter,
              transform: `translateY(${(1 - enter) * 14}px)`,
              color: word.emphasis || live ? "#ffd0d0" : INK,
              fontFamily: word.text.startsWith("/") || word.text.includes(".") ? MONO : SANS,
              fontSize: 36,
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

const Footage: React.FC<{clip: string; focus?: string}> = ({clip, focus = "center 48%"}) => {
  const frame = useCurrentFrame();
  const local = frame / 30;
  const spec = CLIPS[clip];
  const zoom = interpolate(local, [0, Math.max(spec.max, 0.2)], [1.045, 1.01], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const style: React.CSSProperties = {
    width: "100%",
    height: "118%",
    objectFit: "cover",
    objectPosition: focus,
    transform: `scale(${zoom})`,
    transformOrigin: focus,
  };
  return (
    <div style={{position: "absolute", inset: 0, overflow: "hidden", background: "#0d1014"}}>
      {local < spec.max ? (
        <OffthreadVideo
          src={staticFile("proof.mp4")}
          trimBefore={Math.round(spec.from * 30)}
          trimAfter={Math.round((spec.from + spec.max) * 30)}
          style={style}
        />
      ) : (
        <Img src={staticFile(spec.still)} style={style} />
      )}
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

export const HowScene: React.FC<SceneProps> = ({time, sceneStart}) => {
  const nodes = [
    ["Hermes", "Hermes"],
    ["Message", "message"],
    ["Tool", "tool"],
    ["Approval", "approval"],
    ["Redact", "redacted"],
    ["Audience", "audience"],
  ] as const;
  const chips = [
    ["Keys", "Keys"],
    ["Tokens", "tokens"],
    ["Seed phrases", "seed"],
    ["Emails", "emails"],
  ] as const;
  const morphStart = wordStart("how", "turns");
  const morph = interpolate(time, [morphStart, morphStart + 1.3], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const gateAt = wordStart("how", "sure");
  const holdAt = wordStart("how", "HOLD");
  const close = interpolate(time, [gateAt, holdAt], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const chip = pop(time, holdAt - 0.2);
  return (
    <Backdrop time={time}>
      <Headline text="HOW IT WORKS" time={time} start={sceneStart} />
      <div style={{position: "absolute", left: 70, right: 70, top: 230, height: 120}}>
        {nodes.map(([label, word], index) => {
          const at = wordStart("how", word);
          const enter = pop(time, at);
          const idle = Math.sin(time * 2 + index) * 4;
          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: index * 300,
                top: idle,
                width: 230,
                height: 78,
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: label === "Redact" ? "#3a1c22" : PANEL,
                border: `2px solid ${enter > 0.4 ? "rgba(225,93,93,0.8)" : "rgba(244,240,230,0.12)"}`,
                fontSize: 26,
                opacity: enter,
                transform: `scale(${0.86 + enter * 0.14})`,
              }}
            >
              {label}
            </div>
          );
        })}
        <svg width="1800" height="120" style={{position: "absolute", inset: 0, pointerEvents: "none"}}>
          {nodes.slice(0, -1).map((node, index) => {
            const start = wordStart("how", node[1]);
            const end = Math.max(wordStart("how", nodes[index + 1][1]), start + 0.05);
            const progress = interpolate(time, [start, end], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
            const x1 = index * 300 + 230;
            const x2 = x1 + 70 * progress;
            return <line key={node[0]} x1={x1} y1={40} x2={x2} y2={40} stroke={ACCENT} strokeWidth={3} strokeDasharray="8 7" strokeDashoffset={-time * 28} />;
          })}
        </svg>
      </div>
      <div style={{position: "absolute", top: 390, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18}}>
        {chips.map(([label, word]) => {
          const enter = pop(time, wordStart("how", word));
          return (
            <div key={label} style={{opacity: enter, transform: `translateY(${(1 - enter) * 12}px)`, border: "1px solid rgba(244,240,230,0.16)", borderRadius: 999, padding: "10px 18px", color: MUTED, fontSize: 24}}>
              {label}
            </div>
          );
        })}
      </div>
      <div style={{position: "absolute", top: 500, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 36, height: 56, opacity: close > 0.05 ? 0 : 1}}>
        <div style={{opacity: 1 - morph, color: ACCENT, letterSpacing: morph * 4}}>sk-proj-FAKESTAGEGLASSKEY1234567890</div>
        <div style={{position: "absolute", left: 0, right: 0, top: 0, opacity: morph, clipPath: `inset(0 ${(1 - morph) * 100}% 0 0)`}}>[REDACTED]</div>
      </div>
      <div style={{position: "absolute", left: 0, top: 210, bottom: 180, width: "50%", background: "rgba(10,12,16,0.98)", borderRight: "3px solid #e15d5d", transform: `translateX(${(1 - close) * -102}%)`}} />
      <div style={{position: "absolute", right: 0, top: 210, bottom: 180, width: "50%", background: "rgba(10,12,16,0.98)", borderLeft: "3px solid #e15d5d", transform: `translateX(${(1 - close) * 102}%)`}} />
      <div style={{position: "absolute", left: "50%", top: 430, transform: `translateX(-50%) scale(${0.8 + chip * 0.2})`, opacity: chip, background: "#3a1c22", color: "#ffd0d0", borderRadius: 999, padding: "12px 26px", letterSpacing: 3, fontSize: 28}}>
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
      <div style={{position: "absolute", left: 64, top: 210, width: 980}}>
        {steps.map(([n, title, code, word]) => {
          const at = wordStart("use", word);
          const enter = pop(time, at);
          return (
            <div key={n} style={{display: "flex", gap: 16, marginBottom: 12, opacity: enter, transform: `translateY(${(1 - enter) * 10}px)`}}>
              <div style={{width: 36, color: ACCENT, fontSize: 24, paddingTop: 2}}>{n}</div>
              <div>
                <div style={{fontSize: 24}}>{title}</div>
                <div style={{fontFamily: MONO, fontSize: 20, color: "#ffd8d4", minHeight: 26}}>{typed(code, time, at, 42)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {onair ? (
        <Sequence from={from} durationInFrames={dur}>
          <div style={{position: "absolute", right: 40, top: 200, width: 820, height: 560}}>
            <div style={{color: MUTED, fontSize: 18, letterSpacing: 2, marginBottom: 8}}>REAL SESSION</div>
            <div style={{height: 520, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(244,240,230,0.14)"}}>
              <Footage clip="onair" focus="center 64%" />
            </div>
          </div>
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
            <div style={{position: "absolute", left: 36, right: 36, top: 150, bottom: 175, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(244,240,230,0.12)"}}>
              <Footage clip={group.clip} />
            </div>
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
