// Fond étoilé discret, étincelles sur les réponses et petites animations
(() => {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const random = (min, max) => Math.random() * (max - min) + min;

	// ---------- Ciel étoilé avec scintillement et parallaxe ----------
	const canvas = document.querySelector(".sky canvas");
	if (canvas) {
		const ctx = canvas.getContext("2d");
		let stars = [];
		let mouseX = 0, mouseY = 0;

		function resize() {
			const ratio = window.devicePixelRatio || 1;
			canvas.width = innerWidth * ratio;
			canvas.height = innerHeight * ratio;
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
			const count = Math.round((innerWidth * innerHeight) / 7000);
			stars = Array.from({ length: count }, () => ({
				x: Math.random() * innerWidth,
				y: Math.random() * innerHeight,
				r: random(0.3, 1.6),
				depth: random(0.2, 1),
				phase: random(0, Math.PI * 2),
				speed: random(0.5, 2),
				hue: Math.random() < 0.15 ? random(180, 320) : 0
			}));
		}

		function draw(time) {
			ctx.clearRect(0, 0, innerWidth, innerHeight);
			for (const s of stars) {
				const twinkle = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(time / 1000 * s.speed + s.phase);
				const x = s.x + mouseX * s.depth * 6;
				const y = s.y + mouseY * s.depth * 6;
				ctx.beginPath();
				ctx.arc(x, y, s.r, 0, Math.PI * 2);
				ctx.fillStyle = s.hue ? `hsla(${s.hue}, 90%, 80%, ${twinkle})` : `rgba(255, 255, 255, ${twinkle})`;
				ctx.shadowBlur = s.r > 1.2 ? 8 : 0;
				ctx.shadowColor = "white";
				ctx.fill();
			}
			if (!reduced) requestAnimationFrame(draw);
		}

		window.addEventListener("resize", resize);
		window.addEventListener("mousemove", (e) => {
			mouseX = e.clientX / innerWidth - 0.5;
			mouseY = e.clientY / innerHeight - 0.5;
		});
		resize();
		requestAnimationFrame(draw);
	}

	// ---------- Étoile filante de temps en temps ----------
	function shootingStar() {
		const star = document.createElement("div");
		star.className = "shooting-star";
		const angle = random(15, 40);
		const distance = random(400, 800);
		star.style.left = random(0, innerWidth * 0.7) + "px";
		star.style.top = random(0, innerHeight * 0.4) + "px";
		star.style.setProperty("--angle", angle + "deg");
		star.style.setProperty("--dx", Math.cos(angle * Math.PI / 180) * distance + "px");
		star.style.setProperty("--dy", Math.sin(angle * Math.PI / 180) * distance + "px");
		document.body.appendChild(star);
		setTimeout(() => star.remove(), 1300);
		setTimeout(shootingStar, random(20000, 40000));
	}
	if (!reduced) setTimeout(shootingStar, random(8000, 15000));

	// ---------- Étincelles (réponses choisies, bonnes réponses) ----------
	const COLORS = ["#ffd27a", "#62e6ff", "#ff7ac6", "#a792ff", "#52f2b0"];

	function burst(x, y, count = 14, spread = 70) {
		if (reduced) return;
		for (let i = 0; i < count; i++) {
			const spark = document.createElement("div");
			spark.className = "spark";
			const angle = random(0, Math.PI * 2);
			const dist = random(spread * 0.4, spread);
			spark.style.left = x + "px";
			spark.style.top = y + "px";
			spark.style.setProperty("--x", Math.cos(angle) * dist + "px");
			spark.style.setProperty("--y", Math.sin(angle) * dist + "px");
			spark.style.setProperty("--c", COLORS[i % COLORS.length]);
			document.body.appendChild(spark);
			setTimeout(() => spark.remove(), 850);
		}
	}
	window.arcanesBurst = burst;

	// ---------- Apparition des blocs les uns après les autres ----------
	document.querySelectorAll(".reveal").forEach((el, i) => {
		setTimeout(() => el.classList.add("shown"), reduced ? 0 : 80 + i * 90);
	});

	// ---------- Compteurs qui montent ----------
	document.querySelectorAll("[data-count]").forEach((el) => {
		const target = Number(el.dataset.count);
		if (reduced) { el.textContent = target; return; }
		const start = performance.now();
		const duration = 1200;
		(function tick(now) {
			const t = Math.min(1, (now - start) / duration);
			el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
			if (t < 1) requestAnimationFrame(tick);
		})(start);
	});

	// ---------- Texte choisi au hasard à chaque visite (conseils, salutations…) ----------
	document.querySelectorAll("[data-random]").forEach((el) => {
		const options = JSON.parse(el.dataset.random);
		el.textContent = options[Math.floor(Math.random() * options.length)];
	});

	// ---------- Pluie de confettis pour les bons scores ----------
	window.arcanesConfetti = function (amount = 60) {
		if (reduced) return;
		const symbols = ["✦", "★", "●", "▲", "■", "✚"];
		for (let i = 0; i < amount; i++) {
			const c = document.createElement("div");
			c.className = "confetti";
			c.textContent = symbols[i % symbols.length];
			c.style.left = random(0, 100) + "vw";
			c.style.color = COLORS[i % COLORS.length];
			c.style.setProperty("--size", random(14, 30) + "px");
			c.style.setProperty("--dur", random(2.5, 5) + "s");
			c.style.setProperty("--drift", random(-120, 120) + "px");
			c.style.setProperty("--rot", random(-360, 360) + "deg");
			c.style.animationDelay = random(0, 1.2) + "s";
			document.body.appendChild(c);
			setTimeout(() => c.remove(), 6500);
		}
	};
})();
