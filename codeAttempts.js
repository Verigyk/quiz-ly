// Limite les essais de codes d'association pour empêcher de les deviner au hasard :
// après 5 codes faux, il faut attendre 10 minutes.
const MAX_FAILURES = 5;
const WINDOW = 10 * 60 * 1000;

function check(req) {
	const attempts = req.session.codeAttempts;
	if (attempts && attempts.count >= MAX_FAILURES && Date.now() - attempts.since < WINDOW) {
		const minutes = Math.ceil((WINDOW - (Date.now() - attempts.since)) / 60000);
		throw new Error(`Trop de codes incorrects : réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`);
	}
}

function fail(req) {
	const attempts = req.session.codeAttempts;
	if (!attempts || Date.now() - attempts.since >= WINDOW) {
		req.session.codeAttempts = { count: 1, since: Date.now() };
	} else {
		attempts.count++;
	}
}

function success(req) {
	delete req.session.codeAttempts;
}

module.exports = { check, fail, success };
