// Schéma complet de la base (toutes les tables), partagé par populate.js et setup.js
module.exports = `
CREATE TABLE users (
	username TEXT PRIMARY KEY,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
	points INTEGER NOT NULL DEFAULT 0,
	-- Code pour s'associer entre professeur et élève (ex. « K7PX-3QMA ») : usage unique, jusqu'à link_code_expires
	link_code TEXT UNIQUE,
	link_code_expires TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Liens professeur ↔ élève : un élève peut avoir plusieurs professeurs
CREATE TABLE teacher_students (
	teacher TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	student TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (teacher, student)
);

CREATE TABLE quizzes (
	id SERIAL PRIMARY KEY,
	title TEXT NOT NULL,
	-- Configuration du générateur de questions (NULL pour un quiz écrit à la main)
	config JSONB,
	-- Professeur qui a créé le quiz : seul professeur à le voir et à le modifier ; NULL = ancien quiz commun
	owner TEXT REFERENCES users(username) ON DELETE SET NULL ON UPDATE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Catégories personnelles d'un professeur (ex. « Mes identités remarquables »)
CREATE TABLE categories (
	id SERIAL PRIMARY KEY,
	owner TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	name TEXT NOT NULL,
	UNIQUE (owner, name)
);

-- Modèles de questions : variables tirées au hasard, énoncé, bonne réponse et pièges (voir generators/custom.js)
CREATE TABLE templates (
	id SERIAL PRIMARY KEY,
	owner TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	definition JSONB NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Élèves choisis par le créateur du quiz : eux seuls peuvent le faire
CREATE TABLE quiz_access (
	quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	PRIMARY KEY (quiz_id, username)
);

-- Quiz du jour choisi par un professeur pour toute sa classe (un par date et par professeur)
CREATE TABLE daily_quizzes (
	day DATE NOT NULL,
	teacher TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
	PRIMARY KEY (day, teacher)
);

-- Quiz du jour choisi par un professeur pour un de ses élèves (remplace celui de sa classe) ;
-- quiz_id NULL = pas de quiz de ce professeur ce jour-là. Si le quiz est supprimé, l'élève revient au quiz de la classe.
CREATE TABLE daily_student_quizzes (
	day DATE NOT NULL,
	teacher TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE,
	quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
	PRIMARY KEY (day, teacher, username)
);

-- Compagnon de l'élève : bonheur de 0 à 100, tenue portée ({ emplacement: objet })
CREATE TABLE companions (
	username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
	name TEXT NOT NULL DEFAULT 'Nino',
	happiness INTEGER NOT NULL DEFAULT 60,
	last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	visible BOOLEAN NOT NULL DEFAULT TRUE,
	gifts INTEGER NOT NULL DEFAULT 0,
	equipped JSONB NOT NULL DEFAULT '{}',
	-- Quiz du jour oubliés : jours déjà vérifiés, et nombre de quiz oubliés trouvés le jour missed_on
	checked_until DATE NOT NULL DEFAULT (CURRENT_DATE - 1),
	missed_quizzes INTEGER NOT NULL DEFAULT 0,
	missed_on DATE
);

-- Tenues achetées dans la boutique
CREATE TABLE owned_items (
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
	item_id TEXT NOT NULL,
	bought_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (username, item_id)
);

-- answer = index (à partir de 0) de la bonne réponse dans choices
CREATE TABLE questions (
	id SERIAL PRIMARY KEY,
	quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	text TEXT NOT NULL,
	choices TEXT[] NOT NULL,
	answer INTEGER NOT NULL,
	UNIQUE (quiz_id, position)
);

-- Un résultat enregistré à chaque quiz terminé, ou abandonné via « Recommencer » (completed = false)
CREATE TABLE quiz_results (
	id SERIAL PRIMARY KEY,
	username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
	-- Le titre est copié : supprimer un quiz ne supprime pas l'historique des élèves
	quiz_id INTEGER REFERENCES quizzes(id) ON DELETE SET NULL,
	title TEXT NOT NULL,
	score INTEGER NOT NULL,
	total INTEGER NOT NULL,
	completed BOOLEAN NOT NULL DEFAULT TRUE,
	points INTEGER NOT NULL DEFAULT 0,
	completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copie de chaque question posée et réponse choisie (chosen = index dans choices, -1 si aucune)
CREATE TABLE quiz_answers (
	result_id INTEGER NOT NULL REFERENCES quiz_results(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	text TEXT NOT NULL,
	choices TEXT[] NOT NULL,
	answer INTEGER NOT NULL,
	chosen INTEGER NOT NULL,
	PRIMARY KEY (result_id, position)
);
`;
