const ora = require('ora');
var kissanime = require("./main");
var anime4 = require("./main2");
var readline = require('readline');

var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "anime>"
});

var spinner;

let anime, se, ee, downloadPath;
// "/home/manoj/Downloads"
let credentialsFile = process.argv[2];
reader.on("close", function () {
    console.log();
    console.log("Thank you for using anime cli.");
});


reader.prompt();
reader.question('Enter the name of anime : ', function (name) {
    anime = name;
    reader.question("From which episode you want to download : ", function (episode) {
        se = episode;
        reader.question("To which episode you want to download : ", function (end) {
            ee = end;
            reader.question("Enter the path where you want to download : ", function (path) {
                downloadPath = path;
                reader.question("Enter k for kissanime && 4 for 4anime : ", async function (website) {
                    spinner = ora().start();
                    spinner.color = 'red';
                    spinner.text = 'Loading website';
                    spinner.spinner = 'bouncingBall';
                    setTimeout(function () {
                        spinner.stop();
                    }, 5000);

                    if (website == "k")
                        await kissanime.start(anime, se, ee, downloadPath, credentialsFile);
                    else
                        await anime4.start(anime, se, ee, downloadPath, credentialsFile);
                })

            })
        })
    })
})


