import { Dumbbell, Zap } from "lucide-react";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Zap size={21} strokeWidth={2.8} aria-hidden="true" /></span>
      <span>Gym Assistant<small>STRENGTH JOURNAL</small></span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <div className="hero-kicker"><span /> YOUR STRENGTH JOURNAL</div>
        <h1 id="hero-heading">Training Log<span>.</span></h1>
        <p>See what you lifted last time and log today’s sets.</p>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <Dumbbell strokeWidth={1.05} />
      </div>
    </section>
  );
}
