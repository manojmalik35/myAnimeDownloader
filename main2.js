const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");
const ProgressBar = require("progress");
const Multiprogress = require("multi-progress")(ProgressBar);
const readline = require('readline');
const ora = require('ora');

const multi = new Multiprogress(process.stderr);

var credentialsFile = process.argv[2];
//cfhdojbkjhnklbpkdaibdccddilifddb - adblocker extension id

var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var spinner;
var anime, se, ee;
reader.question('Enter the name of anime : ', function (name) {
    anime = name;
    reader.question("From which episode you want to download : ", function (episode) {
        se = episode;
        reader.question("To which episode you want to download : ", function (end) {
            ee = end;
            reader.close();
            spinner = ora().start();

            spinner.color = 'red';
            spinner.text = 'Loading website';
            spinner.spinner = 'bouncingBall';
            start(anime, se, ee);
        })
    })
})

async function start(anime, se, ee) {
    try {
        var browser = await puppeteer.launch({
            product: "chrome",
            headless: false,
            defaultViewport: null,
            executablePath: "/usr/bin/google-chrome-stable",
            args: ["--start-maximized"],
            slowMo: 100
        })

        var tabs = await browser.pages();
        var tab = tabs[0];

        await loginHelper(tab, browser);

        await handleAds(tab);
        await tab.waitForSelector(".orig");
        var searchBox = await tab.$$(".orig");
        await searchBox[1].type(anime, { delay: 50 });
        await tab.waitForSelector(".item.fx-none", { visible: true });
        var suggestions = await tab.$$(".item.fx-none .info .name");
        var engNamePresent = false;
        let compareString = anime;
        if(anime.includes("season"))
            compareString = anime.split("season")[0];
        
        for (var i = 0; i < suggestions.length; i++) {
            var sug = suggestions[i];
            var text = await (await sug.getProperty('textContent')).jsonValue();
            if (text.toLowerCase().includes(compareString.toLowerCase())) {
                engNamePresent = true;
                break;
            }
        }

        if (engNamePresent === false) {
            compareString = await findJapaneseName(compareString, browser);
            await tab.keyboard.down("Control");
            await tab.keyboard.press('a');
            await tab.keyboard.up("Control");

            anime = compareString + " season" + anime.split("season")[1];    
            fs.mkdirSync(`/home/manoj/Downloads/${anime}/`);
            await searchBox[1].type(anime, { delay: 50 });
            var ftime = Date.now() + 3000;
            while (Date.now() < ftime) { }
            await tab.waitForSelector(".item.fx-none", { visible: true });
            suggestions = await tab.$$(".item.fx-none .info .name");
        }
        
        await navigationHelper(tab, null, suggestions[0]);
        await handleAds(tab);

        await tab.waitForSelector(".episodes.range.active a");
        var episodeLinks = await tab.$$(".episodes.range.active a");
        var episodesToDownload = ee - se + 1;
        var episodeDownloadedArr = [];
        
        var si = se - 1;
        var ei = (si + episodesToDownload);
        while(si < ei){

            var href = await tab.evaluate(function (link) {
                return link.getAttribute("href");
            }, episodeLinks[si]);

            var ntab = await browser.newPage();
            var episodeWillBeDownloadedPromise = downloadEpisode(href, ntab, anime);
            episodeDownloadedArr.push(episodeWillBeDownloadedPromise);
            si++;
        }

        await Promise.all(episodeDownloadedArr);
        console.log("Episodes downloaded");

    } catch (err) {
        console.log(err.message);
    }

}


async function loginHelper(tab, browser) {
    try {
        var data = await fs.promises.readFile(credentialsFile, "utf-8");
        var credentials = JSON.parse(data);
        var username = credentials.username;
        var pwd = credentials.pwd;
        var url = credentials.url2;

        await tab.goto(url, { waitUntil: "networkidle0" });
        spinner.stop();
        await tab.waitForSelector(".mobileMenuLinkInactive-2PACsn.mobileMenuLink-rELItL");
        await navigationHelper(tab, ".mobileMenuLinkInactive-2PACsn.mobileMenuLink-rELItL");

        await tab.waitForSelector("#user_login");
        await tab.type("#user_login", username, { delay: 50 });
        await tab.type("#user_pass", pwd, { delay: 50 });
        await navigationHelper(tab, "#button");

        console.log("User logged in");


    } catch (err) {
        console.log(err.message);
    }
}

async function navigationHelper(tab, selector, element) {
    if (selector != null) {
        await Promise.all([tab.waitForNavigation({
            waitUntil: "networkidle0"
        }),
        tab.click(selector)]);
    } else {
        await Promise.all([tab.waitForNavigation({
            waitUntil: "networkidle0"
        }),
        element.click()]);
    }
}

async function handleAds(tab) {
    var ads = await tab.$$("iframe");
    for (var i = 0; i < ads.length; i++) {
        await tab.evaluate(function (ad) {
            ad.setAttribute('style', "display:none;");
        }, ads[i]);
    }
}

async function downloadEpisode(link, ntab, anime) {
    try {

        await ntab.goto(link, { waitUntil: "networkidle0" });

        await ntab.waitForSelector(".mirror_dl");
        var dLink = await ntab.$(".mirror_dl");
        var url = await ntab.evaluate(function (anchor) {
            return anchor.getAttribute("href");
        }, dLink);


        var names = await ntab.$$("#titleleft");
        var episodeNo = await (await names[1].getProperty('textContent')).jsonValue();
        console.log("Starting download");
        await ntab.close();
        
        const { data, headers } = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const totalLength = headers['content-length'];

        const progressBar = multi.newBar(`-> downloading ${episodeNo} [:bar] :percent :etas`, {
            width: 40,
            complete: "😂",
            incomplete: ' ',
            renderThrottle: 1,
            total: parseInt(totalLength)
        });

        const writer = fs.createWriteStream(`/home/manoj/Downloads/${anime}/${episodeNo}.mp4`);

        data.on('data', (chunk) => {
            if (progressBar.tick) {
                progressBar.tick(chunk.length);
            }
        });
        data.pipe(writer);

        return new Promise(function (resolve, reject) {
            writer.on('finish', function () {
                writer.close(resolve);
            })

            writer.on('error', function (err) {
                fs.unlink(`/home/manoj/Downloads/${anime}/${episodeNo}.mp4`);
                reject(err);
            })
        })

    } catch (err) {
        console.log(err.message);
    }

}

async function findJapaneseName(anime, browser) {
    var ntab = await browser.newPage();
    await ntab.goto("https://www.wikipedia.org/", { waitUntil: "networkidle0" });
    await ntab.waitForSelector("#searchInput");
    await ntab.type("#searchInput", anime);
    await navigationHelper(ntab, ".pure-button.pure-button-primary-progressive");
    var translation = await ntab.$("i[title='Hepburn transliteration']");
    var ansPromise = (await translation.getProperty('textContent')).jsonValue();
    ntab.close();
    return ansPromise;
}