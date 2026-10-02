// La plage : vue isométrique (façon « Clash of Clans ») où les compagnons vivent seuls.
// Chaque personnage construit sa structure de sable et agit selon son humeur :
// heureux = actif, joue, rend visite, console les tristes ; calme = construit, se promène ;
// triste = reste assis à l'écart, construit peu.
(() => {
	const DATA = JSON.parse(document.getElementById("beach-data").textContent);
	const canvas = document.getElementById("beach");
	const ctx = canvas.getContext("2d");
	const info = document.getElementById("beach-info");
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	// ---------- Monde ----------
	const TW = 64, TH = 32; // taille d'une case en losange
	const COLS = 5; // emplacements de construction par rangée
	const rows = Math.max(2, Math.ceil(DATA.characters.length / COLS));
	const W = 4 + COLS * 5;          // largeur du monde (en cases)
	const SEA = 5;                   // les cases y < SEA sont la mer
	const H = SEA + 4 + rows * 5 + 2; // profondeur du monde

	const rand = (a, b) => a + Math.random() * (b - a);
	const pick = (list) => list[Math.floor(Math.random() * list.length)];
	const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

	// Monde → écran (avant la caméra)
	const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });

	// ---------- Personnages et emplacements ----------
	const agents = DATA.characters.map((c, i) => {
		const col = i % COLS, row = Math.floor(i / COLS);
		const plot = { x: 4 + col * 5 + (row % 2) * 1.5, y: SEA + 5 + row * 5 };
		const img = new Image();
		img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(c.svg);
		return {
			...c,
			img,
			plot,
			x: plot.x + rand(-1, 1),
			y: plot.y + rand(1.2, 2),
			target: null,
			speed: { heureux: 1.7, calme: 0.9, triste: 0.45 }[c.mood],
			action: "idle",
			until: 0,
			facing: 1,
			phase: Math.random() * 10,
			// Construction « en direct » : la structure se complète quand son propriétaire y travaille
			built: c.mood === "triste" ? 0.55 : 0.7,
			emote: null,
			jump: 0
		};
	});

	// Décor
	const palms = [];
	for (let i = 0; i < Math.ceil(W / 4); i++) palms.push({ x: 1 + i * 4 + rand(-0.5, 0.5), y: SEA + 1.4 + rand(0, 0.6), s: rand(0.8, 1.15) });
	palms.push({ x: W - 1.2, y: H - 3, s: 1 }, { x: 0.8, y: H - 5, s: 0.9 });
	const parasol = { x: W - 3.5, y: SEA + 3 };
	const shells = Array.from({ length: 18 }, () => ({ x: rand(1, W - 1), y: rand(SEA + 1, H - 1), c: pick(["#ffd6e0", "#fff3d6", "#ffe0b8"]) }));
	const crab = { x: W / 2, y: SEA + 0.8, target: null };
	const particles = [];

	// ---------- Comportements selon l'humeur ----------
	const ACTIONS = {
		heureux: [["build", 35], ["play", 20], ["visit", 20], ["console", 15], ["wander", 10]],
		calme: [["build", 35], ["wander", 25], ["sea", 20], ["visit", 10], ["rest", 10]],
		triste: [["rest", 55], ["sea", 25], ["build", 10], ["wander", 10]]
	};
	const EMOTES = {
		build: { heureux: ["🏰", "✨", "♪"], calme: ["🙂", "…"], triste: ["…"] },
		play: ["😄", "♪", "✨"],
		visit: ["👋", "😊"],
		console: ["❤️"],
		sea: { heureux: ["🌊"], calme: ["🌊", "…"], triste: ["💧", "…"] },
		rest: { heureux: ["😌"], calme: ["😌"], triste: ["💧", "😔", "…"] },
		wander: { heureux: ["♪"], calme: ["🙂"], triste: ["…"] }
	};

	function weighted(list) {
		let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
		for (const [name, w] of list) if ((r -= w) <= 0) return name;
		return list[0][0];
	}

	function say(agent, action) {
		const set = EMOTES[action];
		const list = Array.isArray(set) ? set : set && set[agent.mood];
		if (list && Math.random() < 0.7) agent.emote = { text: pick(list), until: now + 2500 };
	}

	let now = 0;

	function randomSand() {
		return { x: rand(1.5, W - 1.5), y: rand(SEA + 2, H - 1.5) };
	}

	function choose(agent) {
		const sad = agents.filter((a) => a !== agent && a.mood === "triste");
		let action = weighted(ACTIONS[agent.mood]);
		if (action === "console" && sad.length === 0) action = "play";
		if (action === "visit" && agents.length < 2) action = "wander";
		agent.action = action;
		agent.partner = null;

		if (action === "build") {
			agent.target = { x: agent.plot.x + rand(-0.6, 0.6), y: agent.plot.y + rand(1.1, 1.6) };
			agent.until = now + rand(4000, 8000);
		} else if (action === "play") {
			agent.target = randomSand();
			agent.until = now + rand(3000, 5000);
		} else if (action === "visit" || action === "console") {
			const others = action === "console" ? sad : agents.filter((a) => a !== agent);
			agent.partner = pick(others);
			agent.until = now + rand(3000, 5000);
		} else if (action === "sea") {
			agent.target = { x: rand(1.5, W - 1.5), y: SEA + rand(0.8, 1.5) };
			agent.until = now + rand(5000, 9000);
		} else if (action === "rest") {
			// Les tristes s'isolent dans un coin, les autres se posent près de leur structure
			agent.target = agent.mood === "triste"
				? { x: pick([1.2, W - 1.2]) + rand(-0.4, 0.4), y: rand(SEA + 2, H - 1.5) }
				: { x: agent.plot.x + rand(-1.5, 1.5), y: agent.plot.y + 1.8 };
			agent.until = now + rand(6000, 12000);
		} else {
			agent.target = randomSand();
			agent.until = now + rand(2000, 4000);
		}
		say(agent, action);
	}

	function update(dt) {
		for (const a of agents) {
			if (a.action === "idle" || (now > a.until && !a.walking)) choose(a);
			// Aller voir un ami : on le rejoint où qu'il soit
			if (a.partner) a.target = { x: a.partner.x + 0.9, y: a.partner.y + 0.3 };

			a.walking = false;
			if (a.target) {
				const d = dist(a, a.target);
				if (d > 0.08) {
					const step = Math.min(d, a.speed * dt);
					a.facing = a.target.x - a.target.y < a.x - a.y ? -1 : 1;
					a.x += ((a.target.x - a.x) / d) * step;
					a.y += ((a.target.y - a.y) / d) * step;
					a.walking = true;
				}
			}

			if (!a.walking) {
				if (a.action === "build") {
					// Construit : la structure se complète, du sable vole vers elle
					a.built = Math.min(1, a.built + dt * (a.mood === "triste" ? 0.004 : a.mood === "calme" ? 0.012 : 0.02));
					if (Math.random() < dt * (a.mood === "heureux" ? 6 : 3)) {
						const from = iso(a.x, a.y), to = iso(a.plot.x, a.plot.y);
						particles.push({ x: from.x, y: from.y - 22, vx: (to.x - from.x) / 0.6, vy: (to.y - 30 - from.y + 22) / 0.6 - 120, life: 0.6 });
					}
				} else if (a.action === "play" && a.jump <= 0 && Math.random() < dt * 1.5) {
					a.jump = 1;
				} else if (a.action === "console" && a.partner && dist(a, a.partner) < 1.3 && Math.random() < dt * 0.6) {
					// Réconforter un ami triste : il sourit un instant
					a.partner.emote = { text: "🙂", until: now + 2000 };
					a.emote = { text: "❤️", until: now + 2000 };
				} else if (a.action === "visit" && a.partner && dist(a, a.partner) < 1.3 && Math.random() < dt * 0.4) {
					a.emote = { text: "👋", until: now + 1500 };
				}
			}
			if (a.jump > 0) a.jump = Math.max(0, a.jump - dt * 2.2);
		}

		// Crabe : petits pas de côté sur le sable mouillé
		if (!crab.target || dist(crab, crab.target) < 0.05) crab.target = { x: rand(1, W - 1), y: SEA + rand(0.4, 1.4) };
		const cd = dist(crab, crab.target);
		crab.x += ((crab.target.x - crab.x) / cd) * Math.min(cd, dt * 0.7);
		crab.y += ((crab.target.y - crab.y) / cd) * Math.min(cd, dt * 0.7);

		for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt; }
		for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
	}

	// ---------- Formes de sable en perspective ----------
	const SAND = { top: "#f3dca6", left: "#dcb776", right: "#c89f5c", line: "rgba(120, 80, 30, 0.25)" };

	// Pavé posé au sol : centre (cx, cy) à l'écran, largeur w et profondeur d (en cases), hauteur h (px)
	function box(cx, cy, w, d, h, colors = SAND) {
		const hw = (w * TW) / 4 + (d * TW) / 4, hh = (w * TH) / 4 + (d * TH) / 4;
		const top = [
			[cx, cy - hh - h], [cx + hw, cy - h], [cx, cy + hh - h], [cx - hw, cy - h]
		];
		ctx.fillStyle = colors.left;
		poly([[cx - hw, cy - h], [cx, cy + hh - h], [cx, cy + hh], [cx - hw, cy]]);
		ctx.fillStyle = colors.right;
		poly([[cx + hw, cy - h], [cx, cy + hh - h], [cx, cy + hh], [cx + hw, cy]]);
		ctx.fillStyle = colors.top;
		poly(top);
	}

	function poly(points) {
		ctx.beginPath();
		points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
		ctx.closePath();
		ctx.fill();
	}

	// Cylindre : rayon r, hauteur h (px), avec des créneaux si crenel
	function cylinder(cx, cy, r, h, crenel) {
		const ry = r / 2;
		const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
		grad.addColorStop(0, SAND.left); grad.addColorStop(0.6, SAND.top); grad.addColorStop(1, SAND.right);
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI);
		ctx.lineTo(cx - r, cy - h);
		ctx.ellipse(cx, cy - h, r, ry, 0, Math.PI, 0, true);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = SAND.top;
		ctx.beginPath(); ctx.ellipse(cx, cy - h, r, ry, 0, 0, Math.PI * 2); ctx.fill();
		if (crenel) {
			for (let k = 0; k < 6; k++) {
				const a = (k / 6) * Math.PI * 2;
				const px = cx + Math.cos(a) * r * 0.8, py = cy - h + Math.sin(a) * ry * 0.8;
				ctx.fillStyle = Math.sin(a) > 0 ? SAND.left : SAND.top;
				ctx.fillRect(px - 2.5, py - 6, 5, 6);
			}
		}
	}

	function cone(cx, cy, r, h, color = SAND.top) {
		ctx.fillStyle = SAND.left;
		ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - h); ctx.lineTo(cx, cy + r / 2); ctx.closePath(); ctx.fill();
		ctx.fillStyle = color;
		ctx.beginPath(); ctx.moveTo(cx + r, cy); ctx.lineTo(cx, cy - h); ctx.lineTo(cx, cy + r / 2); ctx.closePath(); ctx.fill();
		ctx.fillStyle = SAND.right;
		ctx.beginPath(); ctx.ellipse(cx, cy, r, r / 2, 0, 0, Math.PI); ctx.fill();
	}

	function flag(x, y, color) {
		ctx.strokeStyle = "#7a5a32"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 22); ctx.stroke();
		ctx.fillStyle = color;
		const wave = Math.sin(now / 250) * 2;
		poly([[x, y - 22], [x + 14, y - 18 + wave], [x, y - 13]]);
	}

	// Structures : l = niveau (1 à 6) × avancement de la construction
	const STRUCTURES = {
		chateau(cx, cy, l) {
			box(cx, cy, 2.2, 2.2, 8 + l * 2);
			const h = 16 + l * 4, off = 26;
			cylinder(cx, cy - 11 - off / 2 + 4, 9, h, true);
			cylinder(cx - off, cy - 4, 9, h, true);
			cylinder(cx + off, cy - 4, 9, h, true);
			if (l >= 3) cylinder(cx, cy - 6, 13, h + 12 + l * 3, true);
			cylinder(cx, cy + 10, 9, h, true);
			if (l >= 5) flag(cx, cy - 6 - (h + 12 + l * 3) - 6, "#ff5d6c");
		},
		pyramide(cx, cy, l) {
			const steps = l + 1;
			for (let k = 0; k < steps; k++) {
				const size = 2.6 * (1 - k / (steps + 0.5));
				box(cx, cy - k * 9, size, size, 9);
			}
		},
		tour(cx, cy, l) {
			let y = cy, r = 16;
			for (let k = 0; k <= l; k++) {
				cylinder(cx, y, r, 12, false);
				y -= 12; r *= 0.85;
			}
			cone(cx, y, r + 2, 16);
			if (l >= 4) flag(cx, y - 16, "#62e6ff");
		},
		tortue(cx, cy, l) {
			const r = 26 + l * 5;
			for (const [dx, dy] of [[-r * 0.8, 4], [r * 0.8, 4], [-r * 0.5, r * 0.35], [r * 0.5, r * 0.35]]) {
				ctx.fillStyle = SAND.left; ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
			}
			ctx.fillStyle = SAND.right; ctx.beginPath(); ctx.ellipse(cx + r * 0.95, cy - 8, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
			const grad = ctx.createRadialGradient(cx - r / 3, cy - r / 2, 2, cx, cy - r / 4, r);
			grad.addColorStop(0, SAND.top); grad.addColorStop(1, SAND.right);
			ctx.fillStyle = grad;
			ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.55, 0, Math.PI, 0); ctx.ellipse(cx, cy, r, r * 0.22, 0, 0, Math.PI); ctx.fill();
			ctx.strokeStyle = SAND.line; ctx.lineWidth = 1.5;
			for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(cx + k * r * 0.4, cy - r * 0.3, r * 0.2, r * 0.14, 0, 0, Math.PI * 2); ctx.stroke(); }
			ctx.fillStyle = "#2a1d4f"; ctx.beginPath(); ctx.arc(cx + r * 0.98, cy - 8, 1.6, 0, Math.PI * 2); ctx.fill();
		},
		serpent(cx, cy, l) {
			const humps = l + 2;
			for (let k = humps - 1; k >= 0; k--) {
				const x = cx - 44 + k * (80 / (humps - 1)), r = 12 + (k % 2) * 3 + l;
				ctx.fillStyle = k % 2 ? SAND.top : SAND.left;
				ctx.beginPath(); ctx.ellipse(x, cy + (k - humps / 2) * 2, r, r * 1.2, 0, Math.PI, 0); ctx.fill();
			}
			const hx = cx + 50, hy = cy + 6;
			ctx.fillStyle = SAND.top; ctx.beginPath(); ctx.ellipse(hx, hy - 18, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = SAND.left; ctx.beginPath(); ctx.ellipse(hx + 10, hy - 14, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = "#2a1d4f"; ctx.beginPath(); ctx.arc(hx + 3, hy - 22, 2.2, 0, Math.PI * 2); ctx.fill();
		},
		volcan(cx, cy, l) {
			const r = 24 + l * 3, h = 18 + l * 6;
			cone(cx, cy, r, h);
			ctx.fillStyle = SAND.right; ctx.beginPath(); ctx.ellipse(cx, cy - h + 3, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
			if (l >= 3) {
				// Petites bouffées de sable qui s'échappent du cratère
				for (let k = 0; k < 3; k++) {
					const t = ((now / 1500 + k / 3) % 1);
					ctx.fillStyle = `rgba(243, 220, 166, ${0.6 * (1 - t)})`;
					ctx.beginPath(); ctx.arc(cx + Math.sin(t * 6 + k) * 4, cy - h - t * 26, 3 + t * 6, 0, Math.PI * 2); ctx.fill();
				}
			}
		}
	};

	// ---------- Dessin ----------
	let camera = { x: 0, y: 0, zoom: 1 };
	let ground = null;

	// Le sol ne bouge pas : il est dessiné une fois dans une image
	function buildGround() {
		const corners = [iso(0, 0), iso(W, 0), iso(0, H), iso(W, H)];
		const minX = Math.min(...corners.map((p) => p.x)) - TW, maxX = Math.max(...corners.map((p) => p.x)) + TW;
		const minY = Math.min(...corners.map((p) => p.y)) - TH * 4, maxY = Math.max(...corners.map((p) => p.y)) + TH * 2;
		const c = document.createElement("canvas");
		c.width = maxX - minX; c.height = maxY - minY;
		const g = c.getContext("2d");
		// Coordonnées du monde → image du sol
		const at = (x, y) => { const p = iso(x, y); return [p.x - minX, p.y - minY]; };
		// Bande du monde entre les profondeurs y0 et y1, sur toute la largeur
		const band = (y0, y1) => {
			g.beginPath();
			[at(0, y0), at(W, y0), at(W, y1), at(0, y1)].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
			g.closePath();
		};
		// Dégradé qui suit la profondeur (de y0 à y1)
		const depthGradient = (y0, y1, stops) => {
			const [x0, py0] = at(W / 2, y0), [x1, py1] = at(W / 2, y1);
			const grad = g.createLinearGradient(x0, py0, x1, py1);
			stops.forEach(([t, color]) => grad.addColorStop(t, color));
			return grad;
		};

		// Tout est dessiné à l'intérieur du losange du monde
		g.save();
		band(0, H);
		g.clip();

		// Mer : du large (bleu profond) vers le bord (turquoise)
		band(0, SEA + 0.2);
		g.fillStyle = depthGradient(0, SEA, [[0, "#1c6fb0"], [0.55, "#2b8fcf"], [0.85, "#4cb4df"], [1, "#7fd3ec"]]);
		g.fill();

		// Sable sec, légèrement plus foncé au loin
		band(SEA, H);
		g.fillStyle = depthGradient(SEA, H, [[0, "#ead096"], [0.25, "#f2dba9"], [1, "#ecd29c"]]);
		g.fill();

		// Grandes taches douces pour casser l'uniformité du sable
		for (let k = 0; k < W * H / 35; k++) {
			const [x, y] = at(rand(0, W), rand(SEA + 1, H));
			const r = rand(70, 150);
			const light = Math.random() < 0.65;
			const grad = g.createRadialGradient(x, y, 0, x, y, r);
			grad.addColorStop(0, light ? "rgba(255, 246, 220, 0.3)" : "rgba(214, 180, 122, 0.1)");
			grad.addColorStop(1, "rgba(0, 0, 0, 0)");
			g.fillStyle = grad;
			g.beginPath(); g.ellipse(x, y, r, r / 2, 0, 0, Math.PI * 2); g.fill();
		}

		// Sable mouillé au bord de l'eau, qui s'estompe vers la plage
		band(SEA - 0.05, SEA + 1.8);
		g.fillStyle = depthGradient(SEA - 0.05, SEA + 1.8, [[0, "rgba(176, 142, 88, 0.9)"], [0.35, "rgba(196, 162, 104, 0.55)"], [1, "rgba(220, 190, 135, 0)"]]);
		g.fill();

		// Écume qui borde le rivage
		band(SEA - 0.35, SEA + 0.05);
		g.fillStyle = depthGradient(SEA - 0.35, SEA + 0.05, [[0, "rgba(255, 255, 255, 0)"], [0.7, "rgba(255, 255, 255, 0.55)"], [1, "rgba(255, 255, 255, 0.15)"]]);
		g.fill();

		// Grains de sable
		for (let k = 0; k < W * H * 14; k++) {
			const [x, y] = at(rand(0, W), rand(SEA + 0.3, H));
			g.fillStyle = Math.random() < 0.6 ? "rgba(255, 250, 235, 0.4)" : "rgba(150, 110, 60, 0.1)";
			g.fillRect(x, y, rand(1, 2), rand(1, 1.6));
		}

		// Reflets sur l'eau
		for (let k = 0; k < W * 3; k++) {
			const [x, y] = at(rand(0, W), rand(0.3, SEA - 0.6));
			g.fillStyle = "rgba(255, 255, 255, " + rand(0.08, 0.22) + ")";
			g.beginPath(); g.ellipse(x, y, rand(6, 16), 1.2, 0, 0, Math.PI * 2); g.fill();
		}
		g.restore();

		// Bords du monde (épaisseur du terrain)
		g.fillStyle = "#c9a468";
		const bl = iso(0, H), br = iso(W, H), rr = iso(W, 0);
		g.beginPath();
		g.moveTo(bl.x - minX, bl.y - minY); g.lineTo(br.x - minX, br.y - minY); g.lineTo(br.x - minX, br.y - minY + 18); g.lineTo(bl.x - minX, bl.y - minY + 18);
		g.closePath(); g.fill();
		g.fillStyle = "#b8935a";
		g.beginPath();
		g.moveTo(br.x - minX, br.y - minY); g.lineTo(rr.x - minX, rr.y - minY); g.lineTo(rr.x - minX, rr.y - minY + 18); g.lineTo(br.x - minX, br.y - minY + 18);
		g.closePath(); g.fill();
		ground = { canvas: c, x: minX, y: minY };
	}

	function toScreen(x, y) {
		const p = iso(x, y);
		return { x: (p.x - camera.x) * camera.zoom + canvas.width / 2, y: (p.y - camera.y) * camera.zoom + canvas.height / 2 };
	}

	function drawWaves() {
		ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
		ctx.lineWidth = 2;
		for (let k = 0; k < 2; k++) {
			const offset = ((now / 2200 + k * 0.5) % 1);
			const y = SEA - 0.1 - offset * 1.2;
			ctx.globalAlpha = 1 - offset;
			ctx.beginPath();
			for (let x = 0; x <= W; x += 0.25) {
				const p = iso(x, y + Math.sin(x * 1.3 + now / 600) * 0.12);
				x === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	function drawPalm(p) {
		const b = iso(p.x, p.y), s = p.s;
		ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
		ctx.beginPath(); ctx.ellipse(b.x + 14 * s, b.y + 2, 24 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = "#9b6b3c"; ctx.lineWidth = 6 * s; ctx.lineCap = "round";
		ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + 8 * s, b.y - 40 * s, b.x + 4 * s, b.y - 70 * s); ctx.stroke();
		const top = { x: b.x + 4 * s, y: b.y - 70 * s };
		const sway = Math.sin(now / 900 + p.x) * 0.08;
		ctx.fillStyle = "#3fae5a";
		for (let k = 0; k < 6; k++) {
			const a = (k / 6) * Math.PI * 2 + sway;
			ctx.beginPath();
			ctx.ellipse(top.x + Math.cos(a) * 16 * s, top.y + Math.sin(a) * 7 * s + 4, 20 * s, 5 * s, a, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.fillStyle = "#6b4a2a";
		ctx.beginPath(); ctx.arc(top.x - 3, top.y + 5, 3 * s, 0, Math.PI * 2); ctx.arc(top.x + 4, top.y + 6, 3 * s, 0, Math.PI * 2); ctx.fill();
	}

	function drawParasol() {
		const b = iso(parasol.x, parasol.y);
		ctx.fillStyle = "#ff7ac6"; ctx.fillRect(b.x - 26, b.y + 2, 30, 12);
		ctx.strokeStyle = "#eee"; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - 55); ctx.stroke();
		const colors = ["#ff5d6c", "#fff", "#62e6ff", "#fff", "#ffd27a", "#fff"];
		for (let k = 0; k < 6; k++) {
			ctx.fillStyle = colors[k];
			ctx.beginPath(); ctx.moveTo(b.x, b.y - 62);
			ctx.ellipse(b.x, b.y - 52, 42, 16, 0, Math.PI + (k / 6) * Math.PI, Math.PI + ((k + 1) / 6) * Math.PI);
			ctx.closePath(); ctx.fill();
		}
	}

	function drawCrab() {
		const b = iso(crab.x, crab.y);
		const legs = Math.sin(now / 80) * 2;
		ctx.strokeStyle = "#d9463e"; ctx.lineWidth = 2;
		for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
			ctx.beginPath(); ctx.moveTo(b.x + s * 5, b.y - 4 + k * 2); ctx.lineTo(b.x + s * 11, b.y - 1 + k * 3 + (k % 2 ? legs : -legs)); ctx.stroke();
		}
		ctx.fillStyle = "#ef5b4c"; ctx.beginPath(); ctx.ellipse(b.x, b.y - 5, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = "#222"; ctx.fillRect(b.x - 3, b.y - 11, 2, 3); ctx.fillRect(b.x + 1, b.y - 11, 2, 3);
	}

	function drawStructure(a) {
		const b = iso(a.plot.x, a.plot.y);
		// Emplacement tassé et nom de la structure
		ctx.fillStyle = "rgba(160, 120, 60, 0.18)";
		ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, 58, 26, 0, 0, Math.PI * 2); ctx.fill();
		const level = Math.max(1, Math.round(a.structure.level * a.built * 10) / 10);
		ctx.save();
		// La structure « pousse » à mesure que son propriétaire construit
		const grow = 0.55 + 0.45 * a.built;
		ctx.translate(b.x, b.y); ctx.scale(grow, grow); ctx.translate(-b.x, -b.y);
		STRUCTURES[a.structure.type](b.x, b.y, Math.max(1, Math.round(level)));
		ctx.restore();
	}

	function drawAgent(a) {
		const b = iso(a.x, a.y);
		const size = 72;
		const bob = a.walking ? Math.abs(Math.sin(now / 110 + a.phase)) * 4 : Math.sin(now / 600 + a.phase) * 1.2;
		const jumpY = a.jump > 0 ? Math.sin(a.jump * Math.PI) * 26 : 0;
		const squat = !a.walking && a.action === "build" ? 1 - Math.abs(Math.sin(now / 180 + a.phase)) * 0.06 : 1;

		ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
		ctx.beginPath(); ctx.ellipse(b.x, b.y, 16 - jumpY / 4, 6 - jumpY / 10, 0, 0, Math.PI * 2); ctx.fill();

		if (a.img.complete && a.img.naturalWidth) {
			ctx.save();
			ctx.translate(b.x, b.y - bob - jumpY);
			ctx.scale(a.facing, squat);
			ctx.drawImage(a.img, -size / 2, -size * (250 / 220), size, size * (250 / 220));
			ctx.restore();
		}

		// Nom sous les pieds (doré pour son propre compagnon)
		ctx.font = "700 11px Nunito, sans-serif";
		ctx.textAlign = "center";
		const label = a.name;
		const w = ctx.measureText(label).width + 10;
		ctx.fillStyle = a.isMe ? "rgba(255, 210, 122, 0.95)" : "rgba(20, 14, 50, 0.7)";
		ctx.beginPath(); ctx.roundRect(b.x - w / 2, b.y + 6, w, 16, 8); ctx.fill();
		ctx.fillStyle = a.isMe ? "#2a1a00" : "#fff";
		ctx.fillText(label, b.x, b.y + 18);

		if (a.emote && a.emote.until > now) {
			const ey = b.y - size * 1.2 - bob - jumpY - 8;
			ctx.font = "16px sans-serif";
			ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
			ctx.beginPath(); ctx.roundRect(b.x - 16, ey - 16, 32, 24, 10); ctx.fill();
			ctx.beginPath(); ctx.moveTo(b.x - 4, ey + 8); ctx.lineTo(b.x, ey + 14); ctx.lineTo(b.x + 4, ey + 8); ctx.fill();
			ctx.fillStyle = "#222";
			ctx.fillText(a.emote.text, b.x, ey + 2);
		}
		a.screen = { x: b.x, y: b.y - size * 0.6, r: size * 0.55 };
	}

	function draw() {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = "#1f6fae";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.setTransform(camera.zoom, 0, 0, camera.zoom,
			canvas.width / 2 - camera.x * camera.zoom, canvas.height / 2 - camera.y * camera.zoom);
		ctx.drawImage(ground.canvas, ground.x, ground.y);
		drawWaves();

		for (const s of shells) {
			const p = iso(s.x, s.y);
			ctx.fillStyle = s.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4, 2.5, 0.4, 0, Math.PI * 2); ctx.fill();
		}

		// Tout ce qui a de la hauteur est dessiné de l'arrière vers l'avant
		const things = [
			...palms.map((p) => ({ depth: p.x + p.y, draw: () => drawPalm(p) })),
			{ depth: parasol.x + parasol.y, draw: drawParasol },
			{ depth: crab.x + crab.y, draw: drawCrab },
			...agents.map((a) => ({ depth: a.plot.x + a.plot.y, draw: () => drawStructure(a) })),
			...agents.map((a) => ({ depth: a.x + a.y + 0.01, draw: () => drawAgent(a) }))
		].sort((u, v) => u.depth - v.depth);
		things.forEach((t) => t.draw());

		ctx.fillStyle = "#e0bf82";
		for (const p of particles) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
	}

	// ---------- Caméra : glisser pour se déplacer, molette ou pincement pour zoomer ----------
	function resize() {
		const ratio = window.devicePixelRatio || 1;
		canvas.width = canvas.clientWidth * ratio;
		canvas.height = canvas.clientHeight * ratio;
		camera.base = ratio;
	}

	function center() {
		const me = agents.find((a) => a.isMe) || agents[0];
		const p = me ? iso(me.plot.x, me.plot.y) : iso(W / 2, H / 2);
		camera.x = p.x; camera.y = p.y;
		camera.zoom = (window.devicePixelRatio || 1) * (canvas.clientWidth < 600 ? 0.9 : 1.35);
	}

	const pointers = new Map();
	let dragged = false, pinchStart = null;
	canvas.addEventListener("pointerdown", (e) => {
		canvas.setPointerCapture(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		dragged = false;
		if (pointers.size === 2) {
			const [p, q] = [...pointers.values()];
			pinchStart = { d: Math.hypot(p.x - q.x, p.y - q.y), zoom: camera.zoom };
		}
	});
	canvas.addEventListener("pointermove", (e) => {
		const prev = pointers.get(e.pointerId);
		if (!prev) return;
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 2 && pinchStart) {
			const [p, q] = [...pointers.values()];
			setZoom(pinchStart.zoom * Math.hypot(p.x - q.x, p.y - q.y) / pinchStart.d);
			return;
		}
		const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
		if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
		const ratio = window.devicePixelRatio || 1;
		camera.x -= (dx * ratio) / camera.zoom;
		camera.y -= (dy * ratio) / camera.zoom;
	});
	const release = (e) => {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) pinchStart = null;
		if (!dragged && e.type === "pointerup") select(e);
	};
	canvas.addEventListener("pointerup", release);
	canvas.addEventListener("pointercancel", release);
	canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		setZoom(camera.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
	}, { passive: false });

	function setZoom(z) {
		const ratio = window.devicePixelRatio || 1;
		camera.zoom = Math.min(2.5 * ratio, Math.max(0.4 * ratio, z));
	}

	// Cliquer sur un personnage : fiche avec son nom, son humeur et sa structure
	function select(e) {
		const rect = canvas.getBoundingClientRect();
		const ratio = window.devicePixelRatio || 1;
		const sx = (e.clientX - rect.left) * ratio, sy = (e.clientY - rect.top) * ratio;
		const wx = (sx - canvas.width / 2) / camera.zoom + camera.x;
		const wy = (sy - canvas.height / 2) / camera.zoom + camera.y;
		const hit = agents.filter((a) => a.screen && Math.hypot(a.screen.x - wx, a.screen.y - wy) < a.screen.r)
			.sort((u, v) => (v.x + v.y) - (u.x + u.y))[0];
		if (!hit) { info.hidden = true; return; }
		const moodIcon = { heureux: "😄", calme: "🙂", triste: "😔" }[hit.mood];
		info.replaceChildren();
		const title = document.createElement("strong");
		title.textContent = `${hit.name}${hit.isMe ? " (ton compagnon)" : ""}`;
		const lines = [
			`Compagnon de ${hit.owner}`,
			`${moodIcon} ${hit.moodLabel}`,
			`🏖️ ${hit.structure.name} — niveau ${hit.structure.level}`,
			hit.nextLevelIn ? `Encore ${hit.nextLevelIn} quiz pour le niveau suivant` : "Niveau maximum !"
		];
		info.append(title, ...lines.map((t) => { const d = document.createElement("div"); d.textContent = t; return d; }));
		info.hidden = false;
		hit.emote = { text: hit.mood === "triste" ? "🙂" : "👋", until: now + 1500 };
	}

	// ---------- Boucle ----------
	let last = performance.now();
	function frame(t) {
		const dt = Math.min(0.05, (t - last) / 1000) * (reduced ? 0.5 : 1);
		last = t;
		now = t;
		update(dt);
		draw();
		requestAnimationFrame(frame);
	}

	window.addEventListener("resize", () => { resize(); });
	resize();
	buildGround();
	center();
	requestAnimationFrame(frame);
})();
