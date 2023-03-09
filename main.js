const express = require('express');
const app = express();

// Import MW for parsing POST params in BODY
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

// Import MW supporting Method Override with express
const methodOverride = require('method-override');
app.use(methodOverride('_method', { methods: ["POST", "GET"] }));

// ========== MODEL ==========

const Sequelize = require('sequelize');

const options = { logging: false, operatorsAliases: 0 };
const sequelize = new Sequelize("sqlite:db.sqlite", options);

const Quiz = sequelize.define( // define Quiz model (table quizzes)
    'quiz', {
        question: Sequelize.STRING,
        answer: Sequelize.STRING
    }
);

(async () => {  // IIFE - Immediatedly Invoked Function Expresión
    try {
        await sequelize.sync(); // Syncronize DB and seed if needed
        const count = await Quiz.count();
        if (count === 0) {
            const c = await Quiz.bulkCreate([
                {question: "Capital of Italy", answer: "Rome"},
                {question: "Capital of France", answer: "Paris"},
                {question: "Capital of Spain", answer: "Madrid"},
                {question: "Capital of Portugal", answer: "Lisbon"}
            ]);
            console.log(`DB filled with ${c.length} quizzes.`);
        } else {
            console.log(`DB exists & has ${count} quizzes.`);
        }
    } catch (err) {
        console.log(err);
    }
})();

// ========== VIEWs ==========
// CSS style to include into the views:
const style = `
        <style>
            .button { display: inline-block; text-decoration: none;
                padding: 2px 6px; margin: 2px;
                background: #4479BA; color: #FFF;
                border-radius: 4px; border: solid 1px #20538D; }
            .button:hover { background: #356094; }
        </style>`;

// View to display all the quizzes in quizzes array
const indexView = quizzes =>
    `<!doctype html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Quiz</title>
        ${style}
    </head>
    <body>
        <h1>Quizzes</h1>` +
    quizzes.map(quiz =>
        `<div>
                <a href="/quizzes/${quiz.id}/play">${quiz.question}</a>
                <a href="/quizzes/${quiz.id}/edit" class="button">Edit</a>
                <a href="/quizzes/${quiz.id}?_method=DELETE" onClick="return confirm('Delete: ${quiz.question}')" class="button">Delete</a>
             </div>`).join("\n") +
    `<a href="/quizzes/new" class="button">New Quiz</a>
    </body>
    </html>`;


// View with form for trying to guess quiz
// response - text of last trial (hidden param)
const playView = (quiz, response) =>
    `<!doctype html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>Quiz</title>
      ${style}
  </head>
  <body>
      <h1>Play Quiz</h1>
      <form method="get" action="/quizzes/${quiz.id}/check">
          <label for="response">${quiz.question}: </label>
          <br>
          <input type="text" name="response" value="${response}" placeholder="Answer">
          <input type="submit" class="button" value="Check">
      </form>
      <br>
      <a href="/quizzes" class="button">Go back</a>
  </body>
  </html>`;


// View with the result of trying to guess the quiz.
// id - played quiz id
// msg - result of trial
// response - user answer for next trial
const resultView = (id, msg, response) =>
    `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Quiz</title>
      ${style}
  </head>
  <body>
    <h1>Result</h1>
    <div id="msg"><strong>${msg}</strong></div>
    <a href="/quizzes" class="button">Go back</a>
    <a href="/quizzes/${id}/play?response=${response}" class="button">Try again</a>
  </body>
  </html>`;


// View to show the form to create a new quiz.
const newView = quiz => {
    return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Quiz</title>
    ${style}
  </head>
  <body>
    <h1>Create New Quiz</h1>
    <form method="POST" action="/quizzes">
      <label for="question">Question: </label>
      <input type="text" name="question" value="${quiz.question}" placeholder="Question"> 
      <br>
      <label for="answer">Answer: </label>
      <input type="text" name="answer" value="${quiz.answer}" placeholder="Answer">
      <input type="submit" class="button" value="Create">
    </form>
    <br>
    <a href="/quizzes" class="button">Go back</a>
  </body>
  </html>`;
}


// View to show a form to edit a given quiz.
const editView = (quiz) => {
    return `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quiz</title>
      ${style}
    </head>
    <body>
      <h1>Edit A Quiz</h1>
      <form method="POST" action="/quizzes/${quiz.id}?_method=PUT">
        <label for="question">Question: </label>
        <input type="text" name="question" value="${quiz.question}" placeholder="Question"> 
        <br>
        <label for="answer">Answer: </label>
        <input type="text" name="answer" value="${quiz.answer}" placeholder="Answer">
        <input type="submit" class="button" value="Update">
      </form>
      <br>
      <a href="/quizzes" class="button">Go back</a>
    </body>
    </html>`;
}


// ========== CONTROLLERs ==========

// GET /, GET /quizzes
const indexController = async (req, res, next) => {
    try {
        const quizzes = await Quiz.findAll()
        res.send(indexView(quizzes))
    } catch (err) {
        next(err);
    }
};

//  GET  /quizzes/:id/play
const playController = async (req, res, next) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return next(new Error(`"${req.params.id}" should be number.`));

    const response = req.query.response || "";

    try {
        const quiz = await Quiz.findByPk(id);
        if (quiz) res.send(playView(quiz, response));
        else next(new Error(`Quiz ${id} not found.`));
    } catch (err) {
        next(err)
    }
};

//  GET  /quizzes/:id/check
const checkController = async (req, res, next) => {
    const response = req.query.response;

    const id = Number(req.params.id);
    if (Number.isNaN(id)) return next(new Error(`"${req.params.id}" should be number.`));

    try {
        const quiz = await Quiz.findByPk(id);
        if (!quiz) return next(new Error(`Quiz ${id} not found.`));
        let msg = (quiz.answer.toLowerCase().trim() === response.toLowerCase().trim())
            ? `Yes, "${response}" is the ${quiz.question}`
            : `No, "${response}" is not the ${quiz.question}`;
        res.send(resultView(id, msg, response));
    } catch (err) {
        next(err)
    }
};

// GET /quizzes/new
const newController = async (req, res, next) => {
    const quiz = {question: "", answer: ""};
    res.send(newView(quiz));
};

// POST /quizzes
const createController = async (req, res, next) => {
    const {question, answer} = req.body;

    try {
        await Quiz.create({question, answer});
        res.redirect(`/quizzes`);
    } catch (err) {
        next(err)
    }
};

//  GET /quizzes/:id/edit
const editController = async (req, res, next) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return next(new Error(`"${req.params.id}" should be number.`));

    try {
        const quiz = await Quiz.findByPk(id);
        if (quiz) res.send(editView(quiz));
        else next(new Error(`Quiz ${id} not found.`));
    } catch (err) {
        next(err)
    }
};

//  PUT /quizzes/:id
const updateController = async (req, res, next) => {
    let pregunta = req.body.question;
    let respuesta = req.body.answer;
    let id = req.params.id;

    try {
        const quiz = await Quiz.findByPk(id);
        if (quiz) {
            await Quiz.update(
                {question: pregunta, answer: respuesta},
                {where: {id: id}}
            );
            res.redirect(`/quizzes`);
        }
        else next(new Error(`Quiz ${id} not found.`));
    } catch (err) {
        next(err)
    }

};

// DELETE /quizzes/:id
const destroyController = async (req, res, next) => {
    
    let id = req.params.id;

    try {
        const quiz = await Quiz.findByPk(id);
        if (quiz) {
            await Quiz.destroy(
                {where: {id: id}}
            );
            res.redirect(`/quizzes`);
        }
        else next(new Error(`Quiz ${id} not found.`));
    } catch (err) {
        next(err)
    }
};


// ========== ROUTES ==========

app.get(['/', '/quizzes'], indexController);
app.get('/quizzes/:id/play', playController);
app.get('/quizzes/:id/check', checkController);
app.get('/quizzes/new', newController);
app.post('/quizzes', createController);

app.get('/quizzes/:id/edit', editController);
app.put('/quizzes/:id', updateController);
app.delete('/quizzes/:id', destroyController);


// ..... crear rutas e instalar los MWs para:
//   GET  /quizzes/:id/edit
//   PUT  /quizzes/:id
//   DELETE  /quizzes/:id


app.all('*', (req, res) =>
    res.status(404).send("Error: resource not found or method not supported.")
);


// Middleware to manage errors:
app.use((error, req, res, next) => {
    console.log("Error:", error.message || error);
    res.redirect("/");
});

// Server started at port 8000
app.listen(8000, () => console.log("Servidor Funcionando en el puerto 8000"));
