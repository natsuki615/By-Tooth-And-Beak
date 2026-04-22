let currentAnim = null;
let predator_prey_links = {};

function preload() {
    predator_prey_links = loadJSON("data/aves_prey_links.json");
}

function setup() {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.style("position", "fixed");
    canvas.style("top", "0");
    canvas.style("left", "0");
    canvas.style("pointer-events", "none");
    canvas.style("z-index", "5");

    window.onBirdClick = function(name, dominantClass, x, y) {
        if (currentAnim && currentAnim.cleanup) currentAnim.cleanup();
        if (predator_prey_links[name]) {
            currentAnim = new Predator(name, x, y, predator_prey_links[name]);
        } else {
            switch (dominantClass) {
                case "Mammalia": currentAnim = new Mammalia(x, y); break;
                case "Insecta": currentAnim = new Insecta(x, y); break;
                case "Teleostei": currentAnim = new Teleostei(x, y); break;
                case "Magnoliopsida": currentAnim = new Magnoliopsida(x, y); break;
                case "Malacostraca": currentAnim = new Malacostraca(x, y); break;
                case "Cephalopoda": currentAnim = new Cephalopoda(x, y); break;
                case "Euchelicerata": currentAnim = new Euchelicerata(x, y); break;
                case "Gastropoda": currentAnim = new Gastropoda(x, y); break;
                case "Bivalvia": currentAnim = new Bivalvia(x, y); break;
                case "Pinopsida": currentAnim = new Pinopsida(x, y); break;
                case "Aves": currentAnim = new Aves(x, y); break;
                default: currentAnim = new Other(x, y); break;
            }
        }
    };
}

function draw() {
    clear();
    if (currentAnim && !currentAnim.isDone()) {
        currentAnim.update();
        currentAnim.draw();
    }
}

// Predator(36 birds) - shoots from origin toward each known prey bird's screen position
// requires window.getBirdScreenPos(name) to be defined in chart.js
class Predator {
    static TRAVEL = 55; // frames for dart to reach target
    static HOLD = 90; // frames arrow + label stay at full opacity
    static FADE = 40; // frames to fade out

    constructor(_name, x, y, preyNames) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = Predator.TRAVEL + Predator.HOLD + Predator.FADE + preyNames.length * 3;

        this.darts = preyNames
            .map((prey, i) => {
                const pos = window.getBirdScreenPos ? window.getBirdScreenPos(prey) : null;
                if (!pos) return null;
                return {
                    name: prey,
                    tx: pos.x,
                    ty: pos.y,
                    progress: 0,
                    delay: i * 3,
                    hitFrame: null,
                };
            })
            .filter(d => d !== null);
    }

    // easeOutQuart: fast launch, decelerates into target
    easeOut(t) {
        return 1 - pow(1 - t, 4);
    }

    update() {
        this.frame++;
        for (const dart of this.darts) {
            if (this.frame < dart.delay) continue;
            const raw = min((this.frame - dart.delay) / Predator.TRAVEL, 1);
            dart.progress = this.easeOut(raw);
            if (raw >= 1 && dart.hitFrame === null) dart.hitFrame = this.frame;
        }
    }

    draw() {
        for (const dart of this.darts) {
            if (this.frame < dart.delay) continue;

            const cx = lerp(this.x, dart.tx, dart.progress);
            const cy = lerp(this.y, dart.ty, dart.progress);
            const angle = atan2(dart.ty - this.y, dart.tx - this.x);

            // per-dart alpha: full until hold ends, then fade out
            const dartAlpha = dart.hitFrame === null
                ? 255
                : this.frame < dart.hitFrame + Predator.HOLD
                    ? 255
                    : map(this.frame, dart.hitFrame + Predator.HOLD, dart.hitFrame + Predator.HOLD + Predator.FADE, 255, 0);

            // tail + shaft
            const tailLen = 12;
            const tx = cx - cos(angle) * tailLen;
            const ty = cy - sin(angle) * tailLen;
            stroke(233, 196, 106, dartAlpha);
            strokeWeight(1.5);
            line(tx, ty, cx, cy);

            // arrowhead
            push();
            translate(cx, cy);
            rotate(angle);
            fill(233, 196, 106, dartAlpha);
            noStroke();
            triangle(6, 0, -3, -3, -3, 3);
            pop();

            // label + impact dot fade in after hit, fade out with dart
            if (dart.hitFrame !== null) {
                const fadeIn   = map(this.frame, dart.hitFrame, dart.hitFrame + 20, 0, 255);
                const lblAlpha = max(min(fadeIn, dartAlpha), 0);

                noStroke();
                fill(233, 196, 106, lblAlpha * 0.4);
                ellipse(dart.tx, dart.ty, 10, 10);

                fill(233, 196, 106, lblAlpha);
                textSize(11);
                textAlign(CENTER, TOP);
                text(dart.name, dart.tx, dart.ty + 10);
            }
        }
    }

    isDone() { return this.frame >= this.duration; }
}

// insecta - one video decoded once, drawn at each bug position on the p5 canvas
class Insecta {
    constructor(x, y) {
        this.frame = 0;
        this.duration = 160;

        // one video element as the shared image source for optimization
        this.vid = createVideo("anim/insecta/bee.webm");
        this.vid.hide(); // keep it out of the DOM visually
        this.vid.loop();
        this.vid.volume(0);
        this.vid.play();

        // bugs are just pos + vel, no separate video elements
        this.bugs = [];
        let k = random(6, 10);
        for (let i = 0; i < k; i++) {
            this.bugs.push({
                x: x,
                y: y,
                vx: random(-3, 3),
                vy: random(-3, 3),
                flipped: random() > 0.5,
            });
        }
    }

    update() {
        this.frame++;
        const maxSpeed = 3;
        for (const b of this.bugs) {
            // nudge velocity by a small random amount each frame to prevent jitteriness 
            b.vx += random(-0.6, 0.6);
            b.vy += random(-0.6, 0.6);

            // clamp speed so bugs don't accelerate forever
            const speed = sqrt(b.vx * b.vx + b.vy * b.vy);
            if (speed > maxSpeed) {
                b.vx = (b.vx / speed) * maxSpeed;
                b.vy = (b.vy / speed) * maxSpeed;
            }

            b.x += b.vx;
            b.y += b.vy;
        }
    }

    draw() {
        let alpha;
        if (this.frame < 60) {
            alpha = 255;
        } else {
            alpha = map(this.frame, 60, this.duration, 255, 0);
        }

        const size = 60;
        tint(255, alpha);
        for (const b of this.bugs) {
            push();
            if (b.flipped) {
                scale(-1, 1);
                image(this.vid, -(b.x+size/2), b.y-size/2, size, size);
            } else {
                image(this.vid, b.x-size/2, b.y-size/2, size, size);
            }
            pop();
        }
        noTint();
    }

    cleanup() {
        this.vid.stop();
        this.vid.remove();
    }

    isDone() {
        if (this.frame >= this.duration) {
            this.cleanup();
            return true;
        }
        return false;
    }
}

// magnoliopsida: seeds and petals drifting downward from origin

class Magnoliopsida {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 120;
        this.seeds = Array.from({ length: 25 }, () => ({
            x: x + random(-20, 20),
            y: y,
            vx: random(-0.8, 0.8),
            vy: random(0.5, 2),
            size: random(3, 7),
            angle: random(TWO_PI),
        }));
    }

    update() {
        this.frame++;
        for (const s of this.seeds) {
            s.x += s.vx + sin(this.frame * 0.05) * 0.3;
            s.y += s.vy;
            s.angle += 0.05;
        }
    }

    draw() {
        const alpha = this.frame < 90 ? 200 : map(this.frame, 90, this.duration, 200, 0);
        for (const s of this.seeds) {
            push();
            translate(s.x, s.y);
            rotate(s.angle);
            noStroke();
            fill(42, 157, 143, alpha);
            ellipse(0, 0, s.size, s.size * 2);
            pop();
        }
    }

    isDone() { 
        return this.frame >= this.duration; 
    }
}

// teleostei - bird dives downward then ripple rings spread at "water surface"

class Teleostei {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 90;
        this.splashY = y + 80;
        this.rings = [];
    }

    update() {
        this.frame++;
        if (this.frame === 30) {
            for (let i = 0; i < 3; i++) {
                this.rings.push({ r: 5, delay: i * 8 });
            }
        }
        for (const ring of this.rings) {
            ring.r += 3;
        }
    }

    draw() {
        const alpha = this.frame < 70 ? 255 : map(this.frame, 70, this.duration, 255, 0);
        const t = min(this.frame / 30, 1);
        const birdY = lerp(this.y, this.splashY, t);

        push();
        translate(this.x, birdY);
        rotate(HALF_PI);
        fill(69, 123, 157, alpha);
        noStroke();
        triangle(0, -6, -4, 5, 4, 5);
        pop();

        noFill();
        for (const ring of this.rings) {
            const ringAlpha = map(ring.r, 5, 120, alpha, 0);
            stroke(69, 123, 157, max(ringAlpha, 0));
            strokeWeight(1.5);
            ellipse(this.x, this.splashY, ring.r * 2, ring.r * 0.6);
        }
    }

    isDone() { 
        return this.frame >= this.duration; 
    }
}

// mammalia: swooping arc — dives down and snaps back up like a raptor strike.

class Mammalia {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 70;
        this.trail = [];
    }

    update() {
        this.frame++;
        const t = this.frame / this.duration;
        const swoop = sin(t * PI) * 60;
        const cx = this.x + (t - 0.5) * 80;
        const cy = this.y + swoop;
        this.trail.push({ x: cx, y: cy, age: 0 });
        for (const p of this.trail) p.age++;
    }

    draw() {
        const alpha = this.frame < 50 ? 255 : map(this.frame, 50, this.duration, 255, 0);
        noFill();
        for (const p of this.trail) {
            const a = map(p.age, 0, 20, alpha, 0);
            stroke(231, 111, 81, max(a, 0));
            strokeWeight(2);
            point(p.x, p.y);
        }
        const last = this.trail[this.trail.length - 1];
        if (last) {
            noStroke();
            fill(231, 111, 81, alpha);
            ellipse(last.x, last.y, 8, 8);
        }
    }

    isDone() { 
        return this.frame >= this.duration; 
    }
}

// malacostraca - sideways probing dots spreading horizontally like shorebird feeding

class Malacostraca {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 80;
        this.probes = Array.from({ length: 12 }, (_, i) => ({
            angle: map(i, 0, 12, PI * 0.75, PI * 1.25),
            dist: 0,
            speed: random(1.5, 3),
        }));
    }

    update() {
        this.frame++;
        for (const p of this.probes) {
            p.dist = min(p.dist + p.speed, 50);
        }
    }

    draw() {
        const alpha = this.frame < 60 ? 255 : map(this.frame, 60, this.duration, 255, 0);
        noStroke();
        fill(142, 202, 230, alpha);
        for (const p of this.probes) {
            const px = this.x + cos(p.angle) * p.dist;
            const py = this.y + sin(p.angle) * p.dist;
            ellipse(px, py, 6, 6);
        }
    }

    isDone() { 
        return this.frame >= this.duration; 
    }
}

// cephalopoda - piral dive downward with an ink-cloud burst

class Cephalopoda {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 100;
        this.inkParticles = [];
    }

    update() {
        this.frame++;
        if (this.frame === 40) {
            for (let i = 0; i < 20; i++) {
                const angle = random(TWO_PI);
                const speed = random(1, 4);
                this.inkParticles.push({
                    x: this.x, y: this.y + 60,
                    vx: cos(angle) * speed,
                    vy: sin(angle) * speed,
                });
            }
        }
        for (const p of this.inkParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
        }
    }

    draw() {
        const alpha = this.frame < 80 ? 255 : map(this.frame, 80, this.duration, 255, 0);

        noFill();
        stroke(106, 76, 147, alpha);
        strokeWeight(2);
        beginShape();
        for (let i = 0; i <= this.frame * 2; i++) {
            const angle = i * 0.3;
            const r = i * 0.4;
            const px = this.x + cos(angle) * r;
            const py = this.y + sin(angle) * r * 0.4 + i * 0.3;
            vertex(px, py);
        }
        endShape();

        noStroke();
        fill(106, 76, 147, alpha * 0.5);
        for (const p of this.inkParticles) {
            ellipse(p.x, p.y, 6, 6);
        }
    }

    isDone() { 
        return this.frame >= this.duration; 
    }
}

// euchelicerata - spider-web lines radiating outward with dots crawling along them

class Euchelicerata {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 80;
        this.spokes = 8;
        this.spiders = Array.from({ length: this.spokes }, (_, i) => ({
            angle: (TWO_PI / this.spokes) * i,
            dist: 0,
        }));
    }

    update() {
        this.frame++;
        for (const s of this.spiders) {
            s.dist = min(s.dist + 2, 50);
        }
    }

    draw() {
        const alpha = this.frame < 60 ? 200 : map(this.frame, 60, this.duration, 200, 0);
        stroke(168, 218, 220, alpha);
        strokeWeight(1);
        for (const s of this.spiders) {
            const ex = this.x + cos(s.angle) * s.dist;
            const ey = this.y + sin(s.angle) * s.dist;
            line(this.x, this.y, ex, ey);
            noStroke();
            fill(168, 218, 220, alpha);
            ellipse(ex, ey, 5, 5);
            stroke(168, 218, 220, alpha);
        }
        noFill();
        const ringR = this.frame * 0.8;
        if (ringR < 50) ellipse(this.x, this.y, ringR * 2, ringR * 2);
    }

    isDone() { 
        return this.frame >= this.duration; 
    }
}

// gastropoda - slow expanding ripple rings 
class Gastropoda {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 100;

        // one video element as the shared image source for optimization
        this.vid = createVideo("anim/gastropoda/output.webm");
        this.vid.hide(); // keep it out of the DOM visually
        this.vid.loop();
        this.vid.volume(0);
        this.vid.play();
    }

    update() {
        this.frame++;
    }

    draw() {
        let alpha;
        if (this.frame < 60) {
            alpha = 255;
        } else {
            alpha = map(this.frame, 60, this.duration, 255, 0);
        }

        const size = 240;
        tint(255, alpha);
        image(this.vid, this.x - size / 2, this.y - size / 2, size, size);
        noTint();
    }

    cleanup() {
        this.vid.stop();
        this.vid.remove();
    }

    isDone() {
        if (this.frame >= this.duration) {
            this.cleanup();
            return true;
        }
        return false;
    }
}

// bivalvia - two arcs pulsing open and closed (shells)
class Bivalvia {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 80;
    }

    update() { this.frame++; }

    draw() {
        const alpha = this.frame < 60 ? 255 : map(this.frame, 60, this.duration, 255, 0);
        const openAmount = sin(this.frame * 0.15) * 30 + 30;
        stroke(181, 228, 140, alpha);
        strokeWeight(2);
        noFill();
        push();
        translate(this.x, this.y);
        arc(0, 0, 40, 40, PI + radians(openAmount), TWO_PI);
        arc(0, 0, 40, 40, 0, PI - radians(openAmount));
        pop();
    }

    isDone() { return this.frame >= this.duration; }
}

// pinopsida - needle-like seeds spiraling outward and falling

class Pinopsida {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 110;
        this.needles = Array.from({ length: 20 }, () => ({
            angle: random(TWO_PI),
            r: random(5, 15),
            vy: random(0.5, 2),
            spin: random(-0.05, 0.05),
            len: random(8, 16),
        }));
    }

    update() {
        this.frame++;
        for (const n of this.needles) {
            n.angle += n.spin;
            n.r += 0.5;
        }
    }

    draw() {
        const alpha = this.frame < 80 ? 200 : map(this.frame, 80, this.duration, 200, 0);
        stroke(27, 67, 50, alpha);
        strokeWeight(2);
        for (const n of this.needles) {
            const nx = this.x + cos(n.angle) * n.r;
            const ny = this.y + sin(n.angle) * n.r + n.vy * this.frame;
            const ex = nx + cos(n.angle + HALF_PI) * n.len;
            const ey = ny + sin(n.angle + HALF_PI) * n.len;
            line(nx, ny, ex, ey);
        }
    }

    isDone() { return this.frame >= this.duration; }
}

// ─── Aves ─────────────────────────────────────────────────────────────────────
// Wing arcs flaring out like a bird spreading its wings.

class Aves {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 80;
    }

    update() { this.frame++; }

    draw() {
        const alpha = this.frame < 60 ? 255 : map(this.frame, 60, this.duration, 255, 0);
        const spread = min(this.frame * 1.5, 60);
        stroke(233, 196, 106, alpha);
        strokeWeight(2);
        noFill();
        push();
        translate(this.x, this.y);
        arc(-spread * 0.3, 0, spread, spread * 0.5, PI, TWO_PI);
        arc(spread * 0.3, 0, spread, spread * 0.5, TWO_PI, PI + TWO_PI);
        pop();
    }

    isDone() { return this.frame >= this.duration; }
}

// ─── Other ────────────────────────────────────────────────────────────────────
// Generic particle burst.

class Other {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.frame = 0;
        this.duration = 60;
        this.particles = Array.from({ length: 16 }, () => {
            const angle = random(TWO_PI);
            const speed = random(1, 4);
            return { x: x, y: y, vx: cos(angle) * speed, vy: sin(angle) * speed };
        });
    }

    update() {
        this.frame++;
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
        }
    }

    draw() {
        const alpha = this.frame < 40 ? 255 : map(this.frame, 40, this.duration, 255, 0);
        noStroke();
        fill(211, 211, 211, alpha);
        for (const p of this.particles) {
            ellipse(p.x, p.y, 5, 5);
        }
    }

    isDone() { return this.frame >= this.duration; }
}
