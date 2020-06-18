const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");
const ProgressBar = require("progress");
const Multiprogress = require("multi-progress")(ProgressBar);
var path = require("path");

const multi = new Multiprogress(process.stderr);

let browser;
module.exports.start = async function () {
    try {
        let anime = arguments[0], se = arguments[1], ee = arguments[2], downloadPath = arguments[3], credentialsFile = arguments[4], mode = arguments[5];

        let data = await fs.promises.readFile(credentialsFile, "utf-8");
        let credentials = JSON.parse(data);
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            executablePath: credentials.executablePath,
            args: ["--start-maximized"],
            slowMo: 100
        })

        var tabs = await browser.pages();
        var tab = tabs[0];

        await loginHelper(tab, credentials);

        await handleAds(tab);
        await tab.waitForSelector(".orig");
        var searchBox = await tab.$$(".orig");
        await searchBox[1].type(anime, { delay: 50 });
        await tab.waitForSelector(".item.fx-none", { visible: true });
        var suggestions = await tab.$$(".item.fx-none .info .name");

        //wikipedia code

        await navigationHelper(tab, null, suggestions[0]);
        await handleAds(tab);

        await tab.waitForSelector(".episodes.range.active a");
        var episodeLinks = await tab.$$(".episodes.range.active a");
        var episodesToDownload = ee - se + 1;

        var si = se - 1;
        var ei = (si + episodesToDownload);
        downloadPath = path.join(downloadPath, anime);
        if (!fs.existsSync(downloadPath))
            fs.mkdirSync(downloadPath);

        if (mode == "serial")
            await downloadEpisodeSerial(tab, si, ei, downloadPath, episodeLinks);
        else
            await downloadEpisodeParallel(tab, si, ei, downloadPath, episodeLinks);

        await browser.close();

    } catch (err) {
        console.log(err.message);
    }

}


async function loginHelper(tab, credentials) {
    try {
        var username = credentials.username;
        var pwd = credentials.pwd;
        var url = "https://4anime.to/";

        await tab.goto(url, { waitUntil: "networkidle0" });
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

async function downloadEpisodeSerial(tab, si, ei, downloadPath, episodeLinks) {
    try {

        let linkArr = [];
        let first = si;
        let firstPromise = undefined;
        while (si < ei) {

            var link = await tab.evaluate(function (link) {
                return link.getAttribute("href");
            }, episodeLinks[si]);

            var ntab = await browser.newPage();
            await ntab.goto(link, { waitUntil: "networkidle0" });

            await ntab.waitForSelector(".mirror_dl");
            var dLink = await ntab.$(".mirror_dl");
            var url = await ntab.evaluate(function (anchor) {
                return anchor.getAttribute("href");
            }, dLink);

            var names = await ntab.$$("#titleleft");
            var episodeNo = await (await names[1].getProperty('textContent')).jsonValue();
            if (si == first)
                firstPromise = realDownload(url, episodeNo, downloadPath);
            else
                linkArr.push({ episodeNo, url });
            si++;
            await ntab.close();
        }

        firstPromise.then(async function () {
            for (let i = 0; i < linkArr.length; i++) {
                await realDownload(linkArr[i].url, linkArr[i].episodeNo, downloadPath);
            }
            console.log("Episodes Downloaded");
        })


    } catch (err) {
        console.log(err.message);
    }

}

async function downloadEpisodeParallel(tab, si, ei, downloadPath, episodeLinks) {
    try {

        let episodeDownloadedArr = [];
        while (si < ei) {
            var link = await tab.evaluate(function (link) {
                return link.getAttribute("href");
            }, episodeLinks[si]);

            var ntab = await browser.newPage();
            await ntab.goto(link, { waitUntil: "networkidle0" });

            await ntab.waitForSelector(".mirror_dl");
            var dLink = await ntab.$(".mirror_dl");
            var url = await ntab.evaluate(function (anchor) {
                return anchor.getAttribute("href");
            }, dLink);

            var names = await ntab.$$("#titleleft");
            var episodeNo = await (await names[1].getProperty('textContent')).jsonValue();
            let episodeWillBeDownloadedPromise = realDownload(url, episodeNo, downloadPath);
            episodeDownloadedArr.push(episodeWillBeDownloadedPromise);
            await ntab.close();
            si++;
        }

        let finalPromise = Promise.all(episodeDownloadedArr);
        finalPromise.then(()=>{
            console.log("Episodes Downloaded");
        });

    } catch (err) {
        console.log(err.message);
    }

}

async function realDownload(url, episodeNo, downloadPath) {
    try {
        const { data, headers } = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const totalLength = headers['content-length'];

        const progressBar = multi.newBar(`-> downloading ${episodeNo} [:bar] :percent :etas`, {
            width: 40,
            complete: "❱",
            incomplete: ' ',
            renderThrottle: 1,
            total: parseInt(totalLength)
        });

        const writer = fs.createWriteStream(path.join(downloadPath, `${episodeNo}.mp4`));

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
                fs.unlink(path.join(downloadPath, `${episodeNo}.mp4`));
                reject(err);
            })
        })
    } catch (err) {
        console.log(err.message);
    }
}


// async function findJapaneseName(anime, browser) {
//     var ntab = await browser.newPage();
//     await ntab.goto("https://www.wikipedia.org/", { waitUntil: "networkidle0" });
//     await ntab.waitForSelector("#searchInput");
//     await ntab.type("#searchInput", anime);
//     await navigationHelper(ntab, ".pure-button.pure-button-primary-progressive");
//     var translation = await ntab.$("i[title='Hepburn transliteration']");
//     var ansPromise = (await translation.getProperty('textContent')).jsonValue();
//     ntab.close();
//     return ansPromise;
// }

// var engNamePresent = false;
        // let compareString = anime;
        // if(anime.includes("season"))
        //     compareString = anime.split("season")[0];

        // for (var i = 0; i < suggestions.length; i++) {
        //     var sug = suggestions[i];
        //     var text = await (await sug.getProperty('textContent')).jsonValue();
        //     if (text.toLowerCase().includes(compareString.toLowerCase())) {
        //         engNamePresent = true;
        //         break;
        //     }
        // }

        // if (engNamePresent === false) {
        //     compareString = await findJapaneseName(compareString, browser);
        //     await tab.keyboard.down("Control");
        //     await tab.keyboard.press('a');
        //     await tab.keyboard.up("Control");

        //     anime = compareString + " season" + anime.split("season")[1];    
        //     fs.mkdirSync(`/home/manoj/Downloads/${anime}/`);
        //     await searchBox[1].type(anime, { delay: 50 });
        //     var ftime = Date.now() + 3000;
        //     while (Date.now() < ftime) { }
        //     await tab.waitForSelector(".item.fx-none", { visible: true });
        //     suggestions = await tab.$$(".item.fx-none .info .name");
        // }