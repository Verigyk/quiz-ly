// Crée un compte professeur, ou donne les droits professeur à un compte existant :
//   npm run create-admin -- <identifiant> <mot de passe>
//   npm run create-admin -- <identifiant>        (compte existant : garde son mot de passe)
const bcrypt = require("bcrypt");
const pool = require("./pool");

async function main() {
	const [username, password] = process.argv.slice(2).map((s) => s.normalize("NFC"));
	if (!username) {
		throw new Error("Usage : npm run create-admin -- <identifiant> [mot de passe]");
	}

	const { rowCount } = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
	if (rowCount === 0 && !password) {
		throw new Error(`Le compte « ${username} » n'existe pas : indiquez aussi un mot de passe pour le créer.`);
	}

	if (rowCount === 0) {
		const hash = await bcrypt.hash(password, 10);
		await pool.query("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')", [username, hash]);
		console.log(`Compte professeur « ${username} » créé.`);
	} else {
		await pool.query("UPDATE users SET role = 'admin' WHERE username = $1", [username]);
		if (password) {
			const hash = await bcrypt.hash(password, 10);
			await pool.query("UPDATE users SET password_hash = $2 WHERE username = $1", [username, hash]);
		}
		console.log(`« ${username} » a maintenant les droits professeur.`);
	}
}

main()
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(() => pool.end());
