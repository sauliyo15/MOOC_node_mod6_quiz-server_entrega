/* eslint-disable no-invalid-this*/
/* eslint-disable no-undef*/
// IMPORTS
const path = require("path");
const Utils = require("../utils/testutils");
const util = require('util');
const exec = util.promisify(require("child_process").exec);
const child_process = require("child_process");
const spawn = require("child_process").spawn;
const fs = require('fs-extra');

// CONSTANTS
const T_WAIT = 2; // Time between commands
const T_TEST = 2 * 60; // Time between tests (seconds)
const WAIT =  typeof process.env.WAIT !== "undefined"?parseInt(process.env.WAIT):50000;
const URL = "http://localhost:8000/quizzes";
const path_assignment = path.resolve(path.join(__dirname, "../"));
const path_file = path.join(path_assignment, "main.js");
const browser = new Browser({"waitDuration": WAIT, "silent": true});

// HELPERS
const timeout = ms => new Promise(res => setTimeout(res, ms));
let server = null;

// CRITICAL ERRORS
let error_critical = null;

// TODO: Integrar bien con un logger
function log() {
    if(DEBUG) {console.log.apply(this, arguments );}
}

// TESTS
describe("Quiz server", function () {
        this.timeout(T_TEST * 1000);

    it("1(Precheck): Comprobando que existe el fichero de la entrega...", async function () {
        this.score = 0;
        this.msg_ok = `Encontrado el fichero '${path_file}'`;
        this.msg_err = `No se encontró el fichero '${path_file}'`;
        const fileexists = await Utils.checkFileExists(path_file);

        if (!fileexists) {
            error_critical = this.msg_err;
        }
        fileexists.should.be.equal(true);
    });


    it("2(Precheck): Comprobando dependencias...", async function () { 
        this.score = 0;
        if (error_critical) {
            this.msg_err = error_critical;
            should.not.exist(error_critical);
        } else {
            this.msg_ok = "Dependencias instaladas con éxito";

            // check that package.json exists
            const path_json = path.join(path_assignment, 'package.json');
            const fileexists = await Utils.checkFileExists(path_json);
            if (!fileexists) {
                this.msg_err = `El fichero '${path_json}' no se ha encontrado`;
                error_critical = this.msg_err;
                should.not.exist(error_critical);

            }
            fileexists.should.be.equal(true);

            // check package.json format
            this.msg_err = `El fichero '${path_json}' no está disponible`;
            let content = fs.readFileSync(path.join(path_assignment, 'package.json'));

            const is_json = Utils.isJSON(content);
            if (!is_json) {
                this.msg_err = `El fichero '${path_json}' no tiene el formato correcto`;
                error_critical = this.msg_err;
                should.not.exist(error_critical);
            }
            is_json.should.be.equal(true);

            // run npm install
            try {
                child_process.execSync("npm install", {cwd: path_assignment}).toString();
            } catch (error_deps) {
                this.msg_err = "Error al ejecutar 'npm install': " + error_deps;
                error_critical = this.msg_err;
                should.not.exist(error_critical);
            }

            // move original db file
            const path_db = path.join(path_assignment, 'db.sqlite');
            const dbexists = await await Utils.checkFileExists(path_db);

            if (dbexists) {
                try {
                fs.moveSync(path_db, path_db+".bak", { overwrite: true });
            }catch(e){console.error(e)}
            }

        }
    });

    it('3(Precheck): Lanzando el servidor', async function () { 
        this.score = 0;
        if (error_critical) {
            this.msg_err = error_critical;
            should.not.exist(error_critical);
        } else {
            this.msg_ok = `'${path_file}' se ha lanzado correctamente`;
            server = spawn("node", [path_file], {cwd: path_assignment});
            let error_launch = "";
            server.on('error', function (data) {
                error_launch += data
            });
            server.stderr.on('data', function (data) {
                error_launch += data
            });
            await Utils.to(timeout(T_WAIT*1000));
            this.msg_err = `Error al lanzar '${path_file}'<<\n\t\t\tRecibido: ${error_launch}`;
            if (error_launch.length) {
                error_critical = this.msg_err;
                should.not.exist(error_critical);
            }
            error_launch.should.be.equal("");
        }
    });
    it(`4(Precheck): Comprobando que se muestra la lista de quizzes...`, async function () { 
        this.score = 0;
        if (error_critical) {
            this.msg_err = error_critical;
            should.not.exist(error_critical);
        } else {
            const expected = "Capital";
            [error_nav, resp] = await Utils.to(browser.visit(URL));
            this.msg_ok = `Se han encontrado los quizzes al visitar ${URL}`;
            this.msg_err = `No se muestran los quizzes al acceder a ${URL}\n\t\t\tRecibido: >>${browser.html('body')}<<`;

            Utils.search(expected, browser.html('body')).should.be.equal(true);

        }
    });

    it('5(Precheck): Comprobando que se puede jugar a los quizzes...', async function () {
        this.score = 0;
        if (error_critical) {
            this.msg_err = error_critical;
            should.not.exist(error_critical);
        } else {
            const expected = /Result/i;
            let error_nav = null;

            this.msg_err = `No se puede acceder a ${URL}`;
            [error_nav, resp] = await Utils.to(browser.visit(URL));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            
            this.msg_err = `No existe ningún enlace a "/quizzes/1/play" en ${URL}`;
            [error_nav, resp] = await Utils.to(browser.click('a[href="/quizzes/1/play"]'));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }

            this.msg_err = `No existe ningún input con 'name' 'response' en "/quizzes/1/play"`;
            [error_nav, resp] = await Utils.to(browser.fill('input[name=response]', "Answer 1"));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            try {
                browser.assert.elements("form", { atLeast: 1 });
                browser.document.forms[0].submit();
                await Utils.to(browser.wait());
            } catch (e) {
                console.log(e)
                error_nav = e;
            }
            this.msg_ok = `Se puede jugar correctamente a los quizzes`;
            this.msg_err = `No se muestra si la respuesta correcta o no al acertar un quiz`;
            Utils.search(expected, browser.html('body')).should.be.equal(true);
        }
    });

    it('6: Comprobando que se pueden editar los quizzes ...', async function () { 
        this.score = 5;
        if (error_critical) {
            this.msg_err = error_critical;
            should.not.exist(error_critical);
        } else {
            const expected = "Question 1";
            let error_nav = null;
            
            [error_nav, resp] = await Utils.to(browser.visit(URL));
            
            this.msg_err = `No se puede acceder s ${URL}`;
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            
            this.msg_err = `No existe ningun enlace a "/quizzes/1/edit" en ${URL}`;
            [error_nav, resp] = await Utils.to(browser.click('a[href="/quizzes/1/edit"]'));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            
            this.msg_err = `No existe ningún input con el 'name' 'question' en "/quizzes/1/edit"`;
            [error_nav, resp] = await Utils.to(browser.fill('input[name="question"]', expected));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }

            this.msg_err = `No existe ningún input con el 'name' 'answer' en "/quizzes/1/edit"`;
            [error_nav, resp] = await Utils.to(browser.fill('input[name="answer"]', "Answer 1"));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            try {
                browser.assert.elements("form", { atLeast: 1 });
                browser.document.forms[0].submit();
                await Utils.to(browser.wait());
            } catch (e) {
                error_nav = e;
            }
            this.msg_ok = `Se ha editado un quiz correctamente`;
            this.msg_err = `No se ha editado correctamente el quiz`;
            Utils.search(expected, browser.html('body')).should.be.equal(true);
        }
    });

    it(`7: Comprobando que se pueden borrar los quizzes...`, async function () { 
        this.score = 5;
        if (error_critical) {
            this.msg_err = error_critical;
            should.not.exist(error_critical);
        } else {
            const expected = 'a[href="/quizzes/3?_method=DELETE"]';
            
            this.msg_err = `No se puede acceder s ${URL}`;
            [error_nav, resp] = await Utils.to(browser.visit(URL));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            
            this.msg_err = `No existe ningun enlace a "/quizzes/3?_method=DELETE" en ${URL}`;
            [error_nav, resp] = await Utils.to(browser.click('a[href="/quizzes/3?_method=DELETE"]'));
            if (error_nav) {
                should.not.exist(error_nav);
                return;
            }
            this.msg_ok = `Se ha borrado correctamente el quiz 3 en ${URL}`;
            this.msg_err = `No se ha podido borrar el quiz 3 en ${URL}`;
            browser.querySelectorAll(expected).length.should.be.equal(0);
        }
    });



    after("Cerrando servidor", async function () {
        // kill server
        if (server) {
            server.kill();
            await Utils.to(timeout(T_WAIT*1000));
        }
        // restore original db file
        const path_db = path.join(path_assignment, 'db.sqlite');
        const [error, exists] = await Utils.to(fs.pathExists(path_db+".bak"));
        if (exists) {
            fs.moveSync(path_db+".bak", path_db, { overwrite: true })
        }
    });
});
